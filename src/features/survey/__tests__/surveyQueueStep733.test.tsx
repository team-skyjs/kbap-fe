/**
 * KB-733 — 설문 시트를 일회성 모달 큐(oneShotQueue) 스텝으로. 홈과 같은 배선 하네스(큐 + 설문 스텝 + 리뷰 유도 step('order')).
 * ① 설문 + 리뷰 유도 동시 조건 → 설문 먼저, 설문이 완전히 닫힌 뒤(onClosed) 리뷰 유도.
 * ② surveyCompleted true/게스트(필드 없음)/구서버 null/온보딩 미완 → 스텝 false 즉시(소모 0) → 리뷰 유도가 바로 뜬다.
 * ③ 대기: 스플래시 전 = 둘 다 닫힘 · 대기 중 큐 clear(블러) = abort → 설문 false · 나중에 = false · blocked = 턴 유지·숨김만(풀리면 다시).
 * ④ (공부 #245 1) present true 직후·첫 렌더 전에 영구 조건이 깨짐(me 재조회 true) → 열린 적 없어도 done 1회 → 다음 스텝.
 * ⑤ (/review 1·4 생애주기) 게스트 콜드 스타트 → 가입/로그인(캐시 clear) → 홈 재포커스(재등록) → 새 회원 → 설문. 오프라인(조회 정지)은 상한으로 false.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn(), EVENTS: { review_prompt_view: 'review_prompt_view', review_prompt_response: 'review_prompt_response' } }));
jest.mock('@/lib/storeReview', () => ({ requestStoreReview: async () => true }));
let mockResolveSplash: () => void = () => {};
jest.mock('@/lib/bootGate', () => ({ ...jest.requireActual('@/lib/bootGate'), whenSplashDone: () => new Promise<void>((r) => { mockResolveSplash = r; }) }));
const mockGate = jest.fn(() => ({ mode: 'pass' }));
jest.mock('@/lib/versionGate', () => ({ ...jest.requireActual('@/lib/versionGate'), useVersionGate: () => mockGate() }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
// 스텝이 쓰는 싱글턴 queryClient = 이 테스트의 mockQc(테스트마다 새 인스턴스)
jest.mock('@/lib/queryClient', () => ({ get queryClient() { return mockQc; } }));
// members/me = 실제 쿼리 클라이언트(캐시 clear·재조회 생애주기 재현). 서버 응답은 mockServerMe
const mockServerMe = jest.fn<Promise<unknown>, []>();
jest.mock('@/lib/data/useMe', () => {
  const { useQuery } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  const fetchMe = () => mockServerMe();
  return { fetchMe, useMe: () => useQuery({ queryKey: ['me', 'en'], queryFn: fetchMe, retry: false }) };
});

/* eslint-disable import/first -- jest.mock 뒤 */
import { useOneShotQueue } from '@/lib/oneShotQueue';
import { useReviewPrompt } from '@/lib/useReviewPrompt';
import { useProfileSurveyStep, SURVEY_DECIDE_CAP } from '../useProfileSurveyStep';
import { _resetSurveyHiddenForTest, hideSurveyThisRun } from '@/lib/survey/surveySession';
/* eslint-enable import/first */

type Snap = { survey: boolean; review: boolean; surveyClosed: () => void; reviewClosed: () => void; clear: () => void; size: number };
const seen = jest.fn<void, [Snap]>();
/** 홈과 같은 배선: 큐 하나, 포커스(focusGen 변화)마다 설문 → 리뷰 유도(order) 등록, 블러 = clear */
function Host({ focusGen = 0 }: { focusGen?: number }) {
  const queue = useOneShotQueue();
  const survey = useProfileSurveyStep();
  const review = useReviewPrompt();
  const surveyStep = survey.step; const reviewStep = review.step;
  React.useEffect(() => {
    queue.add(surveyStep());
    queue.add(reviewStep('order'));
    return () => queue.clear();
  }, [queue, surveyStep, reviewStep, focusGen]);
  seen({ survey: survey.open, review: review.open, surveyClosed: survey.onClosed, reviewClosed: review.onClosed, clear: queue.clear, size: queue.size() });
  return null;
}
const latest = () => seen.mock.calls.at(-1)![0];
const everOpen = () => seen.mock.calls.some(([s]) => s.survey);
// drain = 마이크로태스크 + 실제 타이머 1틱 — TanStack 옵저버 알림은 setTimeout(0)이라 마이크로태스크만 비우면 stale(#241 교훈)
const drain = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 1)); for (let i = 0; i < 10; i++) await Promise.resolve(); };
const flush = async () => { await act(async () => { await drain(); }); };
const splash = async () => { await act(async () => { mockResolveSplash(); await drain(); }); };
const MEMBER = { id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true };
const GUEST = { id: 'u_001', restrictions: [] };
let mockQc: QueryClient;
const trees: renderer.ReactTestRenderer[] = [];
// 마운트·갱신은 async act 안에서 마이크로태스크까지 비운다 — 실제 useQuery의 fetch 해결(setState)이 act 밖에 떨어지지 않게
const mount = async (focusGen = 0) => { let t!: renderer.ReactTestRenderer; await act(async () => { t = renderer.create(<QueryClientProvider client={mockQc}><Host focusGen={focusGen} /></QueryClientProvider>); await drain(); }); trees.push(t); return t; };
const refocus = async (t: renderer.ReactTestRenderer, gen: number) => { await act(async () => { t.update(<QueryClientProvider client={mockQc}><Host focusGen={gen} /></QueryClientProvider>); await drain(); }); };
beforeEach(() => {
  jest.clearAllMocks(); _resetSurveyHiddenForTest(); mockGate.mockReturnValue({ mode: 'pass' });
  mockQc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockServerMe.mockImplementation(async () => MEMBER);
});
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); mockQc.clear(); });

it('① 설문 + 리뷰 유도 동시 조건: 설문 먼저(리뷰 유도 닫힘·리뷰 스텝 큐 대기) → 설문이 완전히 닫힌 뒤(onClosed) 리뷰 유도', async () => {
  await mount();
  await splash();
  expect(latest().survey).toBe(true);
  expect(latest().review).toBe(false);
  expect(latest().size).toBe(1); // 리뷰 스텝은 큐에 남아 설문의 done을 기다린다
  await act(async () => { latest().surveyClosed(); await drain(); });
  expect(latest().survey).toBe(false);
  expect(latest().review).toBe(true);
});

it.each([
  ['true', { ...MEMBER, surveyCompleted: true }],
  ['게스트(필드 없음)', GUEST],
  ['구서버(null)', { ...MEMBER, surveyCompleted: null }],
  ['온보딩 미완', { ...MEMBER, onboardingCompleted: false }],
])('② surveyCompleted %s → 설문 스텝 false 즉시(소모 0) → 리뷰 유도가 바로', async (_label, me) => {
  mockServerMe.mockImplementation(async () => me);
  await mount();
  await splash();
  expect(everOpen()).toBe(false);
  expect(latest().review).toBe(true);
});

it('③ 대기: 스플래시 전엔 둘 다 닫힘(소모 0) → 걷힌 뒤 설문 · 대기 중 큐 clear(블러) = abort → 설문 false·리뷰로', async () => {
  await mount();
  await flush();
  expect(latest().survey).toBe(false); expect(latest().review).toBe(false);
  await splash();
  expect(latest().survey).toBe(true);

  act(() => trees.pop()!.unmount());
  seen.mockClear();
  await mount();
  await act(async () => { latest().clear(); await drain(); }); // 블러 — 판정 전 대기 abort
  await splash();
  expect(everOpen()).toBe(false);
  expect(latest().review).toBe(false); // clear는 리뷰 스텝도 버렸다
  expect(latest().size).toBe(0);
});

it('③ 이번 실행 "나중에" = 설문 false(소모 0) → 리뷰 유도', async () => {
  hideSurveyThisRun();
  await mount();
  await splash();
  expect(everOpen()).toBe(false); expect(latest().review).toBe(true);
});

it('③·/review 5: 강제 업데이트 blocked는 일시 조건 — 턴 유지·숨김만(리뷰 유도 0) → 풀리면 같은 턴에서 다시 뜬다 · 떠 있다가 blocked → 닫힘(onClosed) → 풀리면 재표시', async () => {
  mockGate.mockReturnValue({ mode: 'blocked' } as never);
  const t = await mount();
  await splash();
  expect(everOpen()).toBe(false);
  expect(latest().review).toBe(false); // 턴은 설문이 쥐고 있다
  mockGate.mockReturnValue({ mode: 'pass' });
  await act(async () => { t.update(<QueryClientProvider client={mockQc}><Host /></QueryClientProvider>); await drain(); });
  expect(latest().survey).toBe(true);

  mockGate.mockReturnValue({ mode: 'blocked' } as never); // 떠 있는 동안 blocked 확정
  await act(async () => { t.update(<QueryClientProvider client={mockQc}><Host /></QueryClientProvider>); await drain(); });
  expect(latest().survey).toBe(false);
  await act(async () => { latest().surveyClosed(); await drain(); }); // iOS onDismiss
  expect(latest().review).toBe(false); // 반납 아님
  mockGate.mockReturnValue({ mode: 'pass' });
  await act(async () => { t.update(<QueryClientProvider client={mockQc}><Host /></QueryClientProvider>); await drain(); });
  expect(latest().survey).toBe(true);
});

it('④ 공부 1: present true 직후·첫 렌더 전에 me 재조회가 surveyCompleted:true(영구 조건) → 열린 적 없음 · done 1회 → 리뷰 유도', async () => {
  const t = await mount();
  await act(async () => {
    mockResolveSplash();
    await drain(); // present: 판정 true → setTurn 예약
    mockQc.setQueryData(['me', 'en'], { ...MEMBER, surveyCompleted: true }); // 같은 배치에 재조회 결과
    t.update(<QueryClientProvider client={mockQc}><Host /></QueryClientProvider>);
    await drain();
  });
  await flush();
  expect(everOpen()).toBe(false);
  expect(latest().review).toBe(true);
});

it('열렸다가 영구 조건으로 닫히는 경우(나중에)는 즉시 반납이 아니라 onClosed가 맡는다 — onClosed 전엔 리뷰 유도 0', async () => {
  await mount();
  await splash();
  expect(latest().survey).toBe(true);
  await act(async () => { hideSurveyThisRun(); await drain(); });
  expect(latest().survey).toBe(false);
  expect(latest().review).toBe(false); // iOS: onDismiss 전에 다음 모달 present = race(P-267)
  await act(async () => { latest().surveyClosed(); await drain(); });
  expect(latest().review).toBe(true);
});

it('⑤ 생애주기(/review 1·4): 게스트 콜드 스타트(설문 없음) → 가입/로그인 = 캐시 clear + 홈 재포커스 → 새 회원(false) → 설문 · 제출 → 캐시 true → 닫힘', async () => {
  mockServerMe.mockImplementation(async () => GUEST);
  const t = await mount();
  await splash();
  expect(everOpen()).toBe(false);
  expect(latest().review).toBe(true); // 게스트: 설문 건너뜀
  await act(async () => { latest().reviewClosed(); await drain(); }); // 하네스의 리뷰 유도 시트 닫힘(done) — 큐 해제(홈엔 없는 스텝)

  mockServerMe.mockImplementation(async () => MEMBER); // 로그인 → 서버는 새 회원
  await act(async () => { mockQc.clear(); await drain(); }); // beAuth.resetServerCache
  seen.mockClear();
  await refocus(t, 1); // replace('/(tabs)') → 홈 재포커스 = 재등록
  await splash();
  expect(latest().survey).toBe(true); // 종전 구현(1회성 known + ref 스냅샷)은 옛 게스트를 읽어 false였다

  await act(async () => { mockQc.setQueryData(['me', 'en'], { ...MEMBER, surveyCompleted: true }); await drain(); }); // 제출 성공
  await flush();
  expect(latest().survey).toBe(false);
});

it('⑤ 오프라인 콜드 스타트(조회가 끝나지 않음) = 상한으로 false → 큐 진행(리뷰 유도) · 조회 실패(isError)도 false', async () => {
  const prevCap = SURVEY_DECIDE_CAP.ms;
  SURVEY_DECIDE_CAP.ms = 20; // 실제 타이머로 짧게(가짜 타이머는 TanStack 알림과 섞이면 멈춘다)
  try {
    mockServerMe.mockImplementation(() => new Promise(() => {})); // paused처럼 영원히
    await mount();
    await splash();
    expect(latest().review).toBe(false); // 상한 전 — 설문 스텝이 기다리는 중
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); await drain(); });
    expect(everOpen()).toBe(false);
    expect(latest().review).toBe(true);
  } finally {
    SURVEY_DECIDE_CAP.ms = prevCap;
  }
  act(() => trees.pop()!.unmount());
  seen.mockClear(); mockQc.clear();
  mockServerMe.mockImplementation(async () => { throw new Error('offline'); });
  await mount();
  await splash();
  expect(everOpen()).toBe(false);
  expect(latest().review).toBe(true);
});
