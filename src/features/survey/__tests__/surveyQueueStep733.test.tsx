/**
 * KB-733 — 설문 시트를 일회성 모달 큐(oneShotQueue) 스텝으로. DoD:
 * ① 설문 + 리뷰 유도 동시 조건 → 설문 먼저, 설문이 완전히 닫힌 뒤(onClosed) 리뷰 유도.
 * ② surveyCompleted true/게스트(필드 없음)/구서버 null → 스텝 false 즉시(소모 0) → 리뷰 유도가 바로 뜬다.
 * ③ 스플래시·members/me 판정 가능까지 대기 · 대기 중 cancelPending(블러) = false · 나중에·게이트 blocked = false.
 * ④ (공부 #245 1) present true 직후·첫 렌더 전에 조건이 깨짐(게이트 blocked 확정·me 재조회 true) → 시트가 열린 적 없어도 done 1회 → 다음 스텝.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn(), EVENTS: { review_prompt_view: 'review_prompt_view', review_prompt_response: 'review_prompt_response' } }));
jest.mock('@/lib/storeReview', () => ({ requestStoreReview: async () => true }));
let mockResolveSplash: () => void = () => {};
jest.mock('@/lib/bootGate', () => ({ ...jest.requireActual('@/lib/bootGate'), whenSplashDone: () => new Promise<void>((r) => { mockResolveSplash = r; }) }));
const mockGate = jest.fn(() => ({ mode: 'pass' }));
jest.mock('@/lib/versionGate', () => ({ ...jest.requireActual('@/lib/versionGate'), useVersionGate: () => mockGate() }));

/* eslint-disable import/first -- jest.mock 뒤 */
import type { User } from '@/lib/api/types';
import { useOneShotQueue } from '@/lib/oneShotQueue';
import { useReviewPrompt } from '@/lib/useReviewPrompt';
import { useProfileSurveyStep } from '../useProfileSurveyStep';
import { _resetSurveyHiddenForTest, hideSurveyThisRun } from '@/lib/survey/surveySession';
/* eslint-enable import/first */

type Snap = { survey: boolean; review: boolean; surveyClosed: () => void; cancel: () => void; size: number };
const seen = jest.fn<void, [Snap]>();
/** 홈과 같은 배선: 큐 하나, 등록 순서 설문 → 리뷰 유도(order) */
function Host({ me, meKnown, mountSteps = true }: { me: User | undefined; meKnown: boolean; mountSteps?: boolean }) {
  const queue = useOneShotQueue();
  const survey = useProfileSurveyStep({ me, meKnown });
  const review = useReviewPrompt();
  const surveyStep = survey.step; const reviewStep = review.step;
  React.useEffect(() => {
    if (!mountSteps) return;
    queue.add(surveyStep());
    queue.add(reviewStep('order'));
  }, [queue, surveyStep, reviewStep, mountSteps]);
  seen({ survey: survey.open, review: review.open, surveyClosed: survey.onClosed, cancel: survey.cancelPending, size: queue.size() });
  return null;
}
const latest = () => seen.mock.calls.at(-1)![0];
const drain = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const splash = async () => { await act(async () => { mockResolveSplash(); await drain(); }); };
const MEMBER: User = { id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true } as unknown as User;
const trees: renderer.ReactTestRenderer[] = [];
const mount = (props: React.ComponentProps<typeof Host>) => { let t!: renderer.ReactTestRenderer; act(() => { t = renderer.create(<Host {...props} />); }); trees.push(t); return t; };
beforeEach(() => { jest.clearAllMocks(); _resetSurveyHiddenForTest(); mockGate.mockReturnValue({ mode: 'pass' }); });
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

it('① 설문 + 리뷰 유도 동시 조건: 설문 먼저(리뷰 유도 닫힘) → 설문이 완전히 닫힌 뒤(onClosed) 리뷰 유도', async () => {
  mount({ me: MEMBER, meKnown: true });
  await splash();
  expect(latest().survey).toBe(true);
  expect(latest().review).toBe(false); // 큐가 설문의 done을 기다린다
  expect(latest().size).toBe(1); // 리뷰 스텝은 큐에 남아 설문의 done을 기다린다
  await act(async () => { latest().surveyClosed(); await drain(); });
  expect(latest().survey).toBe(false);
  expect(latest().review).toBe(true);
});

it.each([
  ['true', { ...MEMBER, surveyCompleted: true }],
  ['게스트(필드 없음)', { id: 'u_001', restrictions: [] }],
  ['구서버(null)', { ...MEMBER, surveyCompleted: null }],
  ['온보딩 미완', { ...MEMBER, onboardingCompleted: false }],
])('② surveyCompleted %s → 설문 스텝 false 즉시(소모 0) → 리뷰 유도가 바로', async (_label, me) => {
  mount({ me: me as unknown as User, meKnown: true });
  await splash();
  expect(latest().survey).toBe(false);
  expect(latest().review).toBe(true);
});

it('③ 대기: 스플래시 전·me 모름이면 둘 다 닫힘(소모 0) → 걷히고 me 도착 뒤 설문', async () => {
  const t = mount({ me: undefined, meKnown: false });
  await splash();
  expect(latest().survey).toBe(false); expect(latest().review).toBe(false);
  await act(async () => { t.update(<Host me={MEMBER} meKnown />); await drain(); });
  expect(latest().survey).toBe(true); expect(latest().review).toBe(false);
});

it('③ 대기 중 cancelPending(블러) = 설문 false · 큐는 다음 스텝(리뷰 유도)으로', async () => {
  mount({ me: MEMBER, meKnown: true });
  act(() => latest().cancel());
  await splash();
  expect(latest().survey).toBe(false);
  expect(latest().review).toBe(true);
});

it('③ 이번 실행 "나중에" · 강제 업데이트 blocked = 설문 false(소모 0)', async () => {
  hideSurveyThisRun();
  mount({ me: MEMBER, meKnown: true });
  await splash();
  expect(latest().survey).toBe(false); expect(latest().review).toBe(true);
  act(() => _resetSurveyHiddenForTest()); // 마운트된 트리에 알림 → act 안에서
  mockGate.mockReturnValue({ mode: 'blocked' } as never);
  mount({ me: MEMBER, meKnown: true });
  await splash();
  expect(latest().survey).toBe(false);
});

it('④ 공부 1: present true 직후 버전 게이트 blocked 확정 → 시트는 열린 적 없음 · done 1회(차례 반납) → 리뷰 유도 실행', async () => {
  mount({ me: MEMBER, meKnown: true }); // 렌더 1: pass → 판정 true
  mockGate.mockReturnValue({ mode: 'blocked' } as never); // 렌더 없이 바뀜 — present는 아직 true를 읽는다
  await splash();
  expect(seen.mock.calls.some(([s]) => s.survey)).toBe(false); // 한 번도 open=true 없음
  expect(latest().survey).toBe(false);
  expect(latest().review).toBe(true); // 큐가 영원히 기다리지 않는다
  expect(latest().size).toBe(0);
});

it('④ 공부 1: present true 뒤 차례 렌더와 같은 배치에 me 재조회(새 객체, surveyCompleted:true) → 열린 적 없음 · done 1회 → 리뷰 유도', async () => {
  const t = mount({ me: MEMBER, meKnown: true }); // 렌더 1: 판정 true
  await act(async () => {
    mockResolveSplash();
    await drain(); // present: latest=true → setTurn(true) 예약
    t.update(<Host me={{ ...MEMBER, surveyCompleted: true } as unknown as User} meKnown />); // 같은 배치에 새 me → turn=true && shouldOpen=false
    await drain();
  });
  expect(seen.mock.calls.some(([s]) => s.survey)).toBe(false); // 한 번도 open=true 없음
  expect(latest().survey).toBe(false);
  expect(latest().review).toBe(true);
});

it('열렸다가 닫히는 경우는 즉시 반납이 아니라 onClosed(onDismiss/언마운트)가 맡는다 — 조건이 깨져 open=false가 돼도 onClosed 전엔 리뷰 유도 0', async () => {
  mount({ me: MEMBER, meKnown: true });
  await splash();
  expect(latest().survey).toBe(true);
  await act(async () => { hideSurveyThisRun(); await drain(); }); // 나중에 → open=false(Modal dismiss 시작)
  expect(latest().survey).toBe(false);
  expect(latest().review).toBe(false); // iOS: onDismiss 전에 다음 모달 present = race(P-267) — 기다린다
  await act(async () => { latest().surveyClosed(); await drain(); });
  expect(latest().review).toBe(true);
});
