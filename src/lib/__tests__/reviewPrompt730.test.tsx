/**
 * KB-730(P-454) — 리뷰 유도 규칙·훅: 7일 간격 · 누적 3회 · 종료 · 스캔 2회째 · 막힌 호출은 소모 0 · 응답 3종.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }) }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a), EVENTS: { review_prompt_view: 'review_prompt_view', review_prompt_response: 'review_prompt_response' } }));
const mockStore = jest.fn(async () => true);
jest.mock('@/lib/storeReview', () => ({ requestStoreReview: () => mockStore() }));

/* eslint-disable import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례 */
import { canShow, EMPTY_PROMPT_STATE, loadPromptState, markDone, markShown, PROMPT_INTERVAL_MS, PROMPT_MAX_SHOWS, recordScanSuccess, REVIEW_PROMPT_KEY, savePromptState, scanTriggerDue, type PromptTrigger } from '@/lib/reviewPrompt';
import { useReviewPrompt } from '@/lib/useReviewPrompt';
import AsyncStorage from '@react-native-async-storage/async-storage';
/* eslint-enable import/first */

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_800_000_000_000;

describe('규칙(reviewPrompt.ts)', () => {
  it('canShow — 처음 = 즉시 · 7일 미만 = 아니오 · 7일 이상 = 예 · 3회 누적 = 아니오 · 종료 = 아니오', () => {
    expect(canShow(EMPTY_PROMPT_STATE, T0)).toBe(true);
    const once = markShown(EMPTY_PROMPT_STATE, T0);
    expect(canShow(once, T0 + 6 * DAY)).toBe(false);
    expect(canShow(once, T0 + PROMPT_INTERVAL_MS)).toBe(true);
    let s = EMPTY_PROMPT_STATE;
    for (let i = 0; i < PROMPT_MAX_SHOWS; i++) s = markShown(s, T0 + i * 8 * DAY);
    expect(canShow(s, T0 + 100 * DAY)).toBe(false); // 3회 소진
    expect(canShow(markDone(EMPTY_PROMPT_STATE), T0 + 100 * DAY)).toBe(false);
  });
  it('스캔 트리거는 성공 2회째에만(1·3회째 아님) · 저장 왕복 · 깨진 값 = 처음처럼', async () => {
    expect([1, 2, 3].map(scanTriggerDue)).toEqual([false, true, false]);
    expect(await recordScanSuccess()).toBe(1);
    expect(await recordScanSuccess()).toBe(2);
    expect((await loadPromptState()).scanSuccess).toBe(2);
    await savePromptState(markDone(markShown(EMPTY_PROMPT_STATE, T0)));
    expect(await loadPromptState()).toEqual({ lastShownAt: T0, shows: 1, done: true, scanSuccess: 0 });
    await AsyncStorage.setItem(REVIEW_PROMPT_KEY, '{not json');
    expect(await loadPromptState()).toEqual(EMPTY_PROMPT_STATE);
  });
});

/* ---- 훅 ---- */
type Api = ReturnType<typeof useReviewPrompt>;
const seen = jest.fn<void, [Api]>();
function Probe() { seen(useReviewPrompt()); return null; }
const latest = () => seen.mock.calls.at(-1)![0];
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
async function mount() { let t!: renderer.ReactTestRenderer; await act(async () => { t = renderer.create(<Probe />); }); return t; }

beforeEach(async () => { jest.clearAllMocks(); seen.mockClear(); await AsyncStorage.clear(); jest.spyOn(Date, 'now').mockReturnValue(T0); });
afterEach(() => jest.restoreAllMocks());

it.each<PromptTrigger>(['scan', 'review', 'order'])('트리거 %s — 조건 충족 = 열림·view 계측·노출 기록 / 7일 미만 재요청 = 안 열림·소모 0 / 7일 뒤 = 다시 열림 / 3회 뒤 = 끝', async (trigger) => {
  const t = await mount();
  expect(await latest().request(trigger)).toBe(true);
  await flush();
  expect(latest().open).toBe(true);
  expect(latest().trigger).toBe(trigger);
  expect(mockTrack).toHaveBeenCalledWith('review_prompt_view', { trigger });
  expect((await loadPromptState()).shows).toBe(1);
  await act(async () => { await latest().respond('later'); });
  (Date.now as jest.Mock).mockReturnValue(T0 + 3 * DAY);
  expect(await latest().request(trigger)).toBe(false);
  expect((await loadPromptState()).shows).toBe(1); // 소모 0
  (Date.now as jest.Mock).mockReturnValue(T0 + 7 * DAY);
  expect(await latest().request(trigger)).toBe(true);
  await act(async () => { await latest().respond('later'); });
  (Date.now as jest.Mock).mockReturnValue(T0 + 14 * DAY);
  expect(await latest().request(trigger)).toBe(true);
  await act(async () => { await latest().respond('later'); });
  (Date.now as jest.Mock).mockReturnValue(T0 + 365 * DAY);
  expect(await latest().request(trigger)).toBe(false); // 3회 소진
  await act(async () => { t.unmount(); });
});

it('막힌 자리(제출 중·다른 모달 위·에러) = blocked → 안 열림 · 저장소·계측 무변(트리거 소모 0) → 바로 다음 요청은 열린다', async () => {
  await mount();
  expect(await latest().request('review', { blocked: true })).toBe(false);
  expect(mockTrack).not.toHaveBeenCalled();
  expect(await loadPromptState()).toEqual(EMPTY_PROMPT_STATE);
  expect(await latest().request('review')).toBe(true);
});

it('응답 — 나중에: 닫힘·종료 아님 / 좋아요: 기본 평점 창 요청 + 종료 + after / 별로예요: 문의 작성 이동 + 종료 + after', async () => {
  await mount();
  const after = jest.fn();
  await latest().request('order', { after });
  await act(async () => { await latest().respond('later'); });
  expect(mockTrack).toHaveBeenCalledWith('review_prompt_response', { answer: 'later' });
  expect(latest().open).toBe(false);
  expect((await loadPromptState()).done).toBe(false);
  expect(after).toHaveBeenCalledTimes(1);

  (Date.now as jest.Mock).mockReturnValue(T0 + 7 * DAY);
  await latest().request('scan', { after });
  await act(async () => { await latest().respond('positive'); });
  expect(mockStore).toHaveBeenCalledTimes(1);
  expect((await loadPromptState()).done).toBe(true);
  expect(after).toHaveBeenCalledTimes(2);
  expect(mockPush).not.toHaveBeenCalled();
  expect(await latest().request('scan')).toBe(false); // 종료 뒤 영영 안 뜸

  await AsyncStorage.clear();
  await latest().request('review', { after });
  await act(async () => { await latest().respond('negative'); });
  expect(mockPush).toHaveBeenCalledWith('/profile/feedback/new');
  expect((await loadPromptState()).done).toBe(true);
  expect(mockStore).toHaveBeenCalledTimes(1); // 별로예요는 평점 창 요청 0
});

describe('문구·계측', () => {
  const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
  it('reviewPrompt 키 4종 10로케일 · 이모지 0 · ko 제목 확정 문구', () => {
    for (const l of LOCALES) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON을 이름으로 순회
      const r = (require(`@/lib/i18n/${l}.json`) as { reviewPrompt: Record<string, string> }).reviewPrompt;
      for (const k of ['title', 'positive', 'negative', 'later']) {
        expect({ l, k, has: typeof r?.[k] === 'string' && r[k].trim().length > 0 }).toEqual({ l, k, has: true });
        expect({ l, k, emoji: /\p{Extended_Pictographic}/u.test(r[k]) }).toEqual({ l, k, emoji: false });
      }
    }
    expect((require('@/lib/i18n/ko.json') as { reviewPrompt: Record<string, string> }).reviewPrompt.title).toBe('K-Bap이 도움이 됐나요?');
  });
  it('계측 허용 키 — review_prompt_view: trigger · review_prompt_response: answer(그 외 드롭)', () => {
    const a = jest.requireActual<typeof import('@/lib/analytics')>('@/lib/analytics');
    expect(a.sanitize(a.EVENTS.review_prompt_view, { trigger: 'scan', junk: 1 })).toEqual({ trigger: 'scan' });
    expect(a.sanitize(a.EVENTS.review_prompt_response, { answer: 'later', trigger: 'scan' })).toEqual({ answer: 'later' });
  });
});
