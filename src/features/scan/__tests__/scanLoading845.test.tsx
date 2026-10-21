/**
 * KB-845 로딩 C(D-31 screen-2·6·7) — 스캔선 범위(사진 안 · 시작 = 시안 y480) · 1.8s 왕복 · 모션 줄이기 = 정지(표시 유지) ·
 * 사진 cover · 스피너 0 · 본문 선택 · 큰 글씨 변형.
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

/* eslint-disable import/first -- jest.mock 뒤 */
import { ScanLoading, scanLineRange, LOADING_PHOTO_H, SCAN_LINE_MS } from '../ScanLoading';
/* eslint-enable import/first */

const RN = jest.requireActual('react-native');
const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); mockReduced = false; });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const host = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string')[0];
const layoutPhoto = (t: ReactTestRenderer, h: number) => act(() => host(t, 'scan-loading-photo').props.onLayout({ nativeEvent: { layout: { height: h } } }));

it('스캔선 범위 = 사진 안(시작 200/430 · 끝 = 바닥 − 3) · 짧아진 사진도 비율 그대로 · 0 = 0', () => {
  expect(LOADING_PHOTO_H).toBe(430);
  expect(scanLineRange(430)).toEqual({ from: 200, to: 427 });
  expect(scanLineRange(215)).toEqual({ from: 100, to: 212 });
  expect(scanLineRange(0)).toEqual({ from: 0, to: 0 });
});

it('사진 cover · 스캔선 = 주황(primary) 3 · 1.8s 왕복 무한 · 스피너 0 · 본문 = stayHint 자리', () => {
  const t = render(<ScanLoading title="T" body="B" photoUri="file:m.jpg" caption="C" onClose={jest.fn()} />);
  layoutPhoto(t, 430);
  expect(host(t, 'scanning-preview').props.resizeMode).toBe('cover');
  const line = RN.StyleSheet.flatten(host(t, 'scan-loading-line').props.style);
  expect(line).toMatchObject({ height: 3, backgroundColor: '#FF7134' });
  expect(mockRepeat).toHaveBeenCalledWith(expect.anything(), -1, true);
  expect(mockTiming.mock.calls[0][1]).toMatchObject({ duration: SCAN_LINE_MS });
  expect(SCAN_LINE_MS).toBe(1800);
  expect(t.root.findAll((n) => n.type === RN.ActivityIndicator)).toHaveLength(0);
  expect(host(t, 'scan-stay-hint').props.children).toBe('B');
});

it('모션 줄이기 = 스캔선 정지(시작 위치에 표시 유지) · 애니메이션 시작 0', () => {
  mockReduced = true;
  const t = render(<ScanLoading title="T" body="B" photoUri="file:m.jpg" caption="C" onClose={jest.fn()} />);
  layoutPhoto(t, 430);
  const line = RN.StyleSheet.flatten(host(t, 'scan-loading-line').props.style);
  expect(line.transform).toEqual([{ translateY: 200 }]);
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
