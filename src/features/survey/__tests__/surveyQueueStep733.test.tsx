/**
 * KB-733 — 설문 시트를 일회성 모달 큐(oneShotQueue) 스텝으로. DoD:
 * ① 설문 + 리뷰 유도 동시 조건 → 설문 먼저, 설문이 완전히 닫힌 뒤(onClosed) 리뷰 유도.
 * ② surveyCompleted true/게스트(필드 없음)/구서버 null → 스텝 false 즉시(소모 0) → 리뷰 유도가 바로 뜬다.
 * ③ 스플래시·members/me 판정 가능까지 대기 · 대기 중 cancelPending(블러) = false · 나중에·게이트 blocked = false.
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
