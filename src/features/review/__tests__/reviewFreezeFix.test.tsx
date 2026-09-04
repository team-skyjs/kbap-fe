/**
 * 9/5 예진 실기 프리즈(리뷰 제출 직후 행) 픽스 잠금:
 * (a) PlacePickerSheet — 키보드 선해제 후 닫기(runAfterKeyboardHidden, 전 경로)
 * (b) 리뷰 제출 확인 Modal 직전 Keyboard.dismiss 방어
 * (c) Sentry AppHang V2(미타입 키 관통 — JS-only)
 * (d) api 5xx 관측(captureApi5xx — 태그만·중복창 억제)
 */
const mockKb = { visible: true, listeners: [] as Array<(e?: unknown) => void>, dismiss: jest.fn() };
jest.mock('react-native', () => ({
  Keyboard: {
    isVisible: () => mockKb.visible,
    dismiss: () => mockKb.dismiss(),
    addListener: (ev: string, cb: () => void) => {
      if (ev === 'keyboardDidHide') mockKb.listeners.push(cb);
      return { remove: jest.fn() };
    },
  },
  Platform: { OS: 'ios' },
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  View: () => null,
  Pressable: () => null,
  ScrollView: () => null,
  Modal: () => null,
  ActivityIndicator: () => null,
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
// ReviewCellParts의 무거운 임포트 체인 표면 목(동작 무관 — 이 스위트는 헬퍼·소스 잠금만)
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));
jest.mock('expo-router', () => ({ useSegments: () => [] }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
jest.mock('@/lib/analytics', () => ({ EVENTS: {}, track: jest.fn() }));
jest.mock('@/features/community/placeMap', () => ({ PlaceTagSheet: () => null }));
jest.mock('@/features/community/parts', () => ({ TagChip: () => null }));
jest.mock('@/lib/data/useReviewMutations', () => ({ useToggleReviewLike: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/api/places', () => ({ fetchNearbyPlaces: jest.fn(), fetchSearchPlaces: jest.fn() }));
jest.mock('@/components', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/Txt', () => ({ Txt: () => null }));
jest.mock('@/components/KeyboardDismissBar', () => ({ KeyboardDismissBar: () => null, Input: () => null }));
jest.mock('@/components/RemoteImage', () => ({ RemoteImage: () => null }));
jest.mock('@/lib/review/reviewExtras', () => ({ EMPTY_EXTRAS: {}, extrasFromReview: jest.fn(), hasAnyExtras: () => false }));
jest.mock('@/lib/flags', () => ({ FLAGS: { reviewPlaceEnabled: true } }));
const mockCapture = jest.fn();
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  captureMessage: (...a: unknown[]) => mockCapture(...a),
}));

import { runAfterKeyboardHidden } from '../ReviewCellParts';
import { captureApi5xx } from '@/lib/sentry';

beforeEach(() => {
  jest.useFakeTimers();
  mockKb.visible = true;
  mockKb.listeners = [];
  mockKb.dismiss.mockClear();
  mockCapture.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('(a) runAfterKeyboardHidden — 키보드 선해제 후 실행', () => {
  it('키보드 표시 중 = dismiss 선행 + didHide 도착까지 fn·Promise 모두 보류(P-173 가드 유지)', async () => {
    const fn = jest.fn();
    let settled = false;
    const p = runAfterKeyboardHidden(fn).then(() => {
      settled = true;
    });
    await Promise.resolve(); // 마이크로태스크 flush
    expect(mockKb.dismiss).toHaveBeenCalledTimes(1);
    expect(fn).not.toHaveBeenCalled(); // Modal unmount와 키보드 해제 프레임 분리가 목적
    expect(settled).toBe(false); // Codex #24 P1: await 호출부의 busy 가드가 지연 창에도 유지
    mockKb.listeners.forEach((cb) => cb());
    await p;
    expect(fn).toHaveBeenCalledTimes(1);
    expect(settled).toBe(true);
    jest.advanceTimersByTime(500); // 안전망 타이머가 중복 실행하면 안 된다
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('didHide 유실 시 400ms 안전망으로 1회 실행', () => {
    const fn = jest.fn();
    runAfterKeyboardHidden(fn);
    jest.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('키보드 미표시 = 즉시 실행(dismiss·지연 없음)', () => {
    mockKb.visible = false;
    const fn = jest.fn();
    runAfterKeyboardHidden(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockKb.dismiss).not.toHaveBeenCalled();
  });
});

describe('(d) captureApi5xx — 태그만·중복창 억제', () => {
  it('5xx 1회 캡처(경로 쿼리 제거·태그 구성) + 같은 status·path 20s 내 중복 억제', () => {
    captureApi5xx('/api/places/search?query=abc&lang=en', 502, 'PLACE-001');
    captureApi5xx('/api/places/search?query=def&lang=en', 502, 'PLACE-001'); // 쿼리만 다름 = 동일 키
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith('api_5xx', {
      level: 'warning',
      tags: { path: '/api/places/search', status: '502', code: 'PLACE-001' },
    });
    captureApi5xx('/api/reviews', 500); // 다른 경로 = 별도 캡처(코드 태그 생략)
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it('숫자 세그먼트 정규화 — 리소스/회원 id 태그 유입 방지 + 키 안정(Codex #24 P2)', () => {
    captureApi5xx('/members/me/blocks/123', 500);
    expect(mockCapture).toHaveBeenLastCalledWith('api_5xx', {
      level: 'warning',
      tags: { path: '/members/me/blocks/:id', status: '500' },
    });
    captureApi5xx('/members/me/blocks/456', 500); // id 변주 = 같은 키 → 중복 억제
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});

describe('배선 소스 잠금', () => {
  const fs = require('fs') as typeof import('fs');

  it('(a) 시트의 닫힘·확정 전 경로가 헬퍼 경유(원시 onClose/onPick 직결 0)', () => {
    const src = fs.readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8') as string;
    const sheet = src.split('export function PlacePickerSheet')[1].split('export function')[0];
    expect(sheet).toContain('const close = () => runAfterKeyboardHidden(onClose);');
    expect(sheet).toContain('const pick = (p: ReviewPlaceTag) => runAfterKeyboardHidden(() => onPick(p));');
    expect(sheet).not.toMatch(/onPress=\{onClose\}/); // X·Skip 전부 close 경유
    expect(sheet).not.toMatch(/onPress=\{\(\) => onPick\(/); // 확정·결과 전부 pick 경유
    expect(sheet).toContain('onRequestClose={close}');
  });

  it('(b) 제출 확인 Modal = 헬퍼 경유(직결 0) — dismiss 직후 동기 present 금지(Codex #24)', () => {
    const src = fs.readFileSync('src/app/food/[id]/review.tsx', 'utf8') as string;
    expect(src).toContain('await runAfterKeyboardHidden(() => setSubmitted(true))'); // P1: 가드 유지 await
    expect(src.match(/setSubmitted\(true\)/g)).toHaveLength(1); // 직결 경로 잔존 0
  });

  it('(c) Sentry init에 enableAppHangTrackingV2 관통 키', () => {
    const src = fs.readFileSync('src/lib/sentry.ts', 'utf8') as string;
    expect(src).toContain('enableAppHangTrackingV2: true');
  });

  it('(d) client — 5xx에서만 captureApi5xx(4xx 0회 보장 = >= 500 가드)', () => {
    const src = fs.readFileSync('src/lib/api/client.ts', 'utf8') as string;
    expect(src).toContain('if (res.status >= 500) captureApi5xx(path, res.status');
  });
});
