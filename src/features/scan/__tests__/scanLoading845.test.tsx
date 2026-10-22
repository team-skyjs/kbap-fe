/**
 * KB-845 로딩 C(D-31 screen-2·6·7) — 1.8s 왕복 · 모션 줄이기 = 정지(표시 유지) · 스피너 0 · 본문 선택 · 큰 글씨 변형.
 * KB-853(예진 테플): 스캔선 = PR318 이전 글로우 스윕 복원 · 사진 박스 맨 위~맨 아래 왕복 · 사진 contain + 박스 = 원본 비율(최대 영역 안).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
const mockRepeat = jest.fn((v: unknown) => v);
const mockTiming = jest.fn((v: unknown, _c?: unknown) => v);
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useReducedMotion: () => mockReduced,
    useSharedValue: (v: number) => { let x = v; return { get: () => x, set: (n: number) => { x = n; } }; },
    useAnimatedStyle: (f: () => object) => f(),
    withRepeat: (v: unknown, n: number, r: boolean) => mockRepeat(v, n, r),
    withTiming: (v: unknown, c: unknown) => mockTiming(v, c),
    Easing: { inOut: () => () => 0, quad: 0 },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/components/icons', () => ({ IconClose: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: jest.requireActual('react-native').View }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ScanLoading, scanLineRange, fitPhotoBox, LOADING_PHOTO_H, SCAN_LINE_MS, SCAN_GLOW_H, SCAN_GLOW_REACH } from '../ScanLoading';
/* eslint-enable import/first */

const RN = jest.requireActual('react-native');
const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); mockReduced = false; });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const host = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string')[0];
/** 영역 335×h 측정 + (선택) 사진 원본 크기 로드 */
const layoutPhoto = (t: ReactTestRenderer, h: number, img?: { width: number; height: number }) => {
  act(() => host(t, 'scan-loading-area').props.onLayout({ nativeEvent: { layout: { width: 335, height: h } } }));
  if (img) act(() => host(t, 'scanning-preview').props.onLoad({ nativeEvent: { source: img } }));
};
const boxOf = (t: ReactTestRenderer) => RN.StyleSheet.flatten(host(t, 'scan-loading-photo').props.style);
const glowY = (t: ReactTestRenderer) => (RN.StyleSheet.flatten(host(t, 'scan-loading-glow').props.style).transform as { translateY: number }[])[0].translateY;

it('KB-853 스캔선 범위 = 사진 박스 맨 위(0) ~ 맨 아래(높이 − 3) · 0 = 0', () => {
  expect(LOADING_PHOTO_H).toBe(430);
  expect(scanLineRange(430)).toEqual({ from: 0, to: 427 });
  expect(scanLineRange(188)).toEqual({ from: 0, to: 185 });
  expect(scanLineRange(0)).toEqual({ from: 0, to: 0 });
});

it('KB-853 사진 박스 = 원본 비율 contain(최대 영역 안) — 가로 = 폭 가득·낮게 · 세로 = 높이 가득·좁게 · 크기 미상 = 영역', () => {
  expect(fitPhotoBox(335, 430, 4032, 3024)).toEqual({ width: 335, height: 251 }); // 4:3 가로
  expect(fitPhotoBox(335, 430, 3024, 4032)).toEqual({ width: 323, height: 430 }); // 3:4 세로
  expect(fitPhotoBox(335, 200, 3024, 4032)).toEqual({ width: 150, height: 200 }); // 짧은 화면
  expect(fitPhotoBox(335, 430, 0, 0)).toEqual({ width: 335, height: 430 });
  const t = render(<ScanLoading title="T" body="B" photoUri="file:m.jpg" caption="C" onClose={jest.fn()} />);
  layoutPhoto(t, 430, { width: 4032, height: 3024 });
  expect(host(t, 'scanning-preview').props.resizeMode).toBe('contain');
  expect(boxOf(t)).toMatchObject({ width: 335, height: 251, borderRadius: 12, overflow: 'hidden' }); // r12 = 박스(비율 = 원본)
  expect(boxOf(t).width / boxOf(t).height).toBeCloseTo(4032 / 3024, 1);
  // 선은 박스 안에서만: 왕복 끝(1) = 박스 바닥 − 3
  const line = RN.StyleSheet.flatten(host(t, 'scan-loading-line').props.style);
  expect(line).toMatchObject({ top: SCAN_GLOW_REACH, height: 3 }); // 선 = 띠 가운데
  expect(glowY(t)).toBe(0 - SCAN_GLOW_REACH); // 시작 = 선이 박스 맨 위(0)
});

it('KB-862 스캔 줄 = 사진 가로 전체(좌우 0 · 사진 박스 안) · 빛은 선 위아래 같은 높이(24)로 선에서 멀어질수록 옅게(대칭) · 선 3 빛 번짐 · 1.8s 왕복 무한 · 스피너 0 · 본문 = stayHint 자리', () => {
  const t = render(<ScanLoading title="T" body="B" photoUri="file:m.jpg" caption="C" onClose={jest.fn()} />);
  layoutPhoto(t, 430, { width: 4032, height: 3024 });
  // 가로: 띠·선 = 좌우 0 → 너비 = 사진 박스 너비(335). 박스 안(overflow hidden · r12) — 둥근 모서리 클립 안쪽
  const glow = RN.StyleSheet.flatten(host(t, 'scan-loading-glow').props.style);
  expect(glow).toMatchObject({ left: 0, right: 0 });
  expect(RN.StyleSheet.flatten(host(t, 'scan-loading-line').props.style)).toMatchObject({ left: 0, right: 0 });
  expect(host(t, 'scan-loading-photo').findAll((n) => n.props?.testID === 'scan-loading-glow').length).toBeGreaterThan(0); // 사진 박스 자식
  expect(RN.StyleSheet.flatten(host(t, 'scan-loading-photo').props.style)).toMatchObject({ width: 335, overflow: 'hidden', borderRadius: 12 });
  // 세로: 위 빛 높이 = 아래 빛 높이 = 24, 선은 그 사이 · 색은 거울(선 쪽 35% → 바깥 0)
  const up = RN.StyleSheet.flatten(host(t, 'scan-loading-trail-up').props.style);
  const down = RN.StyleSheet.flatten(host(t, 'scan-loading-trail-down').props.style);
  expect(up.height).toBe(SCAN_GLOW_REACH);
  expect(down.height).toBe(up.height);
  expect(SCAN_GLOW_REACH).toBe(24);
  expect(glow.height).toBe(SCAN_GLOW_REACH * 2 + 3);
  expect(down.top).toBe(SCAN_GLOW_REACH + 3);
  expect(host(t, 'scan-loading-trail-up').props.colors).toEqual(['rgba(226,88,12,0)', 'rgba(226,88,12,0.35)']);
  expect(host(t, 'scan-loading-trail-down').props.colors).toEqual([...host(t, 'scan-loading-trail-up').props.colors].reverse());
  expect(SCAN_GLOW_H).toBeLessThan(251 / 4); // 짧은 빛 — 사진(가로 4:3 = 높이 251) 끝까지 번지지 않음
  const line = RN.StyleSheet.flatten(host(t, 'scan-loading-line').props.style);
  expect(line).toMatchObject({ height: 3, backgroundColor: '#E2580C', shadowColor: '#E2580C', shadowOpacity: 0.9, shadowRadius: 8 });
  expect(mockRepeat).toHaveBeenCalledWith(expect.anything(), -1, true);
  expect(mockTiming.mock.calls[0][1]).toMatchObject({ duration: SCAN_LINE_MS });
  expect(SCAN_LINE_MS).toBe(1800);
  expect(t.root.findAll((n) => n.type === RN.ActivityIndicator)).toHaveLength(0);
  expect(host(t, 'scan-stay-hint').props.children).toBe('B');
});

it('모션 줄이기 = 스캔선 정지(박스 맨 위에 표시 유지) · 애니메이션 시작 0', () => {
  mockReduced = true;
  const t = render(<ScanLoading title="T" body="B" photoUri="file:m.jpg" caption="C" onClose={jest.fn()} />);
  layoutPhoto(t, 430);
  expect(glowY(t)).toBe(-SCAN_GLOW_REACH);
  expect(host(t, 'scan-loading-line')).toBeTruthy();
  expect(mockRepeat).not.toHaveBeenCalled();
});

it('본문 없음(가공식품) = 본문 줄 0 · 큰 글씨(배율 ≥1.3) = 제목 24 · 본문 subtitle1-sbold', () => {
  const t = render(<ScanLoading title="T" photoUri={null} caption="C" onClose={jest.fn()} />);
  expect(t.root.findAll((n) => n.props?.testID === 'scan-stay-hint')).toHaveLength(0);
  const spy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1.3 });
  const t2 = render(<ScanLoading title="T" body="B" photoUri={null} caption="C" onClose={jest.fn()} />);
  const title = t2.root.findAll((n) => n.props?.children === 'T' && typeof n.type === 'string')[0];
  expect(RN.StyleSheet.flatten(title.props.style).fontSize).toBe(24);
  expect(RN.StyleSheet.flatten(host(t2, 'scan-stay-hint').props.style)).toMatchObject({ fontSize: 16 });
  spy.mockRestore();
});

it('닫기 X = onClose', () => {
  const onClose = jest.fn();
  const t = render(<ScanLoading title="T" photoUri={null} caption="C" onClose={onClose} />);
  act(() => t.root.findAll((n) => n.props?.testID === 'scan-loading-close' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('Codex #318: 하단 여백 = useBottomInset(3버튼 Android 48 바닥) + 32 — safe-area 0 보고에도 캡션이 내비바 밑으로 가지 않는다', () => {
  const src = jest.requireActual('fs').readFileSync('src/features/scan/ScanLoading.tsx', 'utf8') as string;
  expect(src).toContain('paddingBottom: bottom + 32');
  expect(src).toContain('const bottom = useBottomInset();');
});
