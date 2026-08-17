/**
 * P-062(KB-232): 스캔 화면 디자인 정합 잠금.
 *  - ⓪ 셔터/갤러리 ref 동기 가드 — 연속 2회 호출에도 픽커 1회(레이스)
 *  - ① Run sample scan 부재(카메라·에러 화면)
 *  - ③ D3 하단 바 — 원형 버튼 4(리스트/위험도/원본/다시찍기)·활성 뷰 주황
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// scanDefaultView 프렐류드 재사용
// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    withSpring: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    FadeInDown: chain(),
    SlideInDown: chain(),
    ZoomIn: chain(),
    ZoomOut: chain(),
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
// P-064: ScanResultOverlay가 gesture-handler 사용 — 표면 mock
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['onUpdate', 'onEnd', 'onStart', 'numberOfTaps', 'maxPointers', 'minPointers', 'enabled', 'runOnJS']) b[k] = () => b;
    return b;
  };
  return {
    GestureDetector: ({ children }: { children: unknown }) => children,
    Gesture: { Pinch: chain, Pan: chain, Tap: chain, Race: () => ({}), Simultaneous: () => ({}) },
    GestureHandlerRootView: View,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return { CameraView: View, useCameraPermissions: () => [{ granted: true }, jest.fn()] };
});
const mockLaunchLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (o: unknown) => mockLaunchLibrary(o) }));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/scan',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/features/scan/ScanCoachMark', () => ({ ScanCoachMark: () => null, shouldShowCoachMark: async () => false, markCoachSeen: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/scan/ocr', () => ({
  recognizeMenuLines: jest.fn().mockResolvedValue([
    { text: '된장찌개', box: { x: 0.12, y: 0.16, width: 0.5, height: 0.08 } },
  ]),
}));
jest.mock('@/lib/data/useFoods', () => ({
  useInfiniteFoods: () => ({ isError: false, error: null, refetch: jest.fn() }),
  // P-136 리치 리스트 행이 상세 프리페치 — 표면 목
  useFoodDetail: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { restrictions: [{ kind: 'allergy', code: 'EGG' }] } }),
  useMyReviews: () => ({ data: [] }),
}));
jest.mock('@/lib/data/useScan', () => ({
  scanV2Enabled: () => false, // P-153: 이 스위트 픽스처는 v1(온디바이스 OCR) 경로 잠금
  useScan: () => ({
    mutate: (
      _vars: unknown,
      { onSuccess }: { onSuccess: (r: { items: unknown[]; photoOnly: unknown[]; degraded: boolean }) => void },
    ) =>
      onSuccess({
        degraded: false,
        items: [
          { itemId: 0, rawMenuName: '된장찌개', box: { x: 0, y: 0, width: 0.1, height: 0.1 }, risk: 'safe', matched: true, foodId: '1', displayName: 'Doenjang Jjigae', koreanName: '된장찌개', price: 8000 },
        ],
        photoOnly: [],
      }),
  }),
}));

import Scan from '../scan';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer, s: string) => tree.root.findAll((n) => n.props?.children === s).length;
const galleryBtn = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.props?.accessibilityLabel === 'scan.gallery' && typeof n.props?.onPress === 'function')[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:menu.jpg', width: 900, height: 1200 }] });
});

it('⓪ ref 동기 가드: 연속 2회 탭 → 픽커 1회만 (리렌더 전 레이스 차단)', async () => {
  let release!: (v: unknown) => void;
  mockLaunchLibrary.mockReturnValue(new Promise((r) => (release = r)));
  const tree = render(<Scan />);
  const g = galleryBtn(tree);
  await act(async () => {
    void g.props.onPress(); // 첫 탭 — pending
    void g.props.onPress(); // 즉시 재탭(리렌더 전) — ref 가드가 차단해야
    release({ canceled: true });
  });
  expect(mockLaunchLibrary).toHaveBeenCalledTimes(1);
});

it('① Run sample scan 부재 — 카메라·권한 화면 어디에도 없음', () => {
  const tree = render(<Scan />);
  expect(texts(tree, 'scan.sample')).toBe(0);
});

it('③→P-136/138 콰이엇 크롬 — 세그·다시찍기, 기본 List에 가격, Photo 뷰에 범례 4종', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  expect(texts(tree, 'scan.resultCaption')).toBe(0); // P-064: 캡션 삭제 유지
  expect(JSON.stringify(tree.toJSON())).toContain('₩8,000'); // P-138⑤ 기본=List — 가격 행 노출
  // 구 D3 플로팅 라벨 소멸 (원본 세그 소멸 — 피크로 존치)
  for (const k of ['scan.showList', 'scan.showResult', 'scan.showOriginal']) expect(texts(tree, k)).toBe(0);
  // 콰이엇 헤더: 세그 2 + 다시찍기 아이콘 버튼
  for (const id of ['seg-risk', 'seg-list', 'retake']) {
    expect(tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function').length).toBeGreaterThanOrEqual(1);
  }
  // P-149(예진 확정): Photo 뷰 = 쌩 원본 + 줌만 — 범례·힌트·마커·미니시트 부재
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'seg-risk')[0].props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-legend').length).toBe(0);
  expect(texts(tree, 'scan.legendHint')).toBe(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'mini-sheet-wrap').length).toBe(0);
});

it('P-149: Photo 뷰 = 원본+줌 전용 — 피크 롱프레스·캡슐 잔재 0 (원본이 기본이라 피크 소멸)', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'seg-risk')[0].props.onPress();
  });
  // 원본이 그대로 보이므로 피크(롱프레스) 표면 소멸 + 미니시트 부재
  expect(tree.root.findAll((n) => typeof n.props?.onLongPress === 'function').length).toBe(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'mini-sheet-wrap').length).toBe(0);
});

it('P-136/138 뷰 전환 — 기본 List=프로필 체크 줄+안내문(헤더·범례 없음), Photo=범례', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  // P-138⑤ 기본=List: 범례 없음, 프로필 체크 줄+하단 안내문+스크롤 여백
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-legend').length).toBe(0);
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('scan.checkedAgainst');
  expect(s).toContain('scan.listFootNote');
  expect(s).not.toContain('scan.notInDb'); // P-138③ 행 내 안내문 소음 제거
  expect(tree.root.findAll((n) => n.props?.contentContainerStyle?.paddingBottom === 120).length).toBeGreaterThanOrEqual(1);
  // P-149: Photo 전환해도 범례 없음(원본+줌만), List 복귀 시 리치 리스트 무회귀
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'seg-risk')[0].props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-legend').length).toBe(0);
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'seg-list')[0].props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).toContain('scan.checkedAgainst');
});

it('P-149: 코치마크 표면 생존 — 리스트 행 마크 탭(재열람) 배선 존재 (캡슐 철거 무관)', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  // 기본=List — 행 RiskMark가 탭 가능(코치마크 재열람, P-134 표면)
  const marks = tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('mark-') && typeof n.props?.onPress === 'function');
  expect(marks.length).toBeGreaterThanOrEqual(1);
});

it('P-161: 다시찍기 = 확인 모달 선노출 — 취소 시 결과 보존, 확인 시에만 카메라 복귀', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  // ↻ 탭 → 즉시 리셋 아님, 모달 노출
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'retake')[0].props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'retake-confirm').length).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(tree.toJSON())).toContain('₩8,000'); // 결과 아직 보존
  // 취소 → 모달 닫힘 + 결과 무변
  const cancel = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'profile.delete.cancel').length > 0).pop()!;
  act(() => cancel.props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'retake-confirm').length).toBe(0);
  expect(JSON.stringify(tree.toJSON())).toContain('₩8,000');
  // 재탭 → 확인(Rescan) → 카메라 복귀(결과 소멸)
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'retake')[0].props.onPress();
  });
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'retake-go')[0].props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('₩8,000');
  expect(tree.root.findAll((n) => n.props?.accessibilityLabel === 'scan.gallery').length).toBeGreaterThanOrEqual(1); // 카메라 화면
});

it('P-187: 진행 화면 미리보기 = contain(레터박스) — cover 크롭 소멸(소스 잠금)', () => {
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  const scanning = src.split("phase === 'scanning'")[1].split('// ---- error ----')[0];
  expect(scanning).toContain('resizeMode="contain"');
  expect(scanning).not.toContain('resizeMode="cover"');
});

it('P-222: 진행 화면 = 이탈 자제 안내 보조 한 줄(주 문구 유지·과잉 개입 0)', () => {
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  const scanning = src.split("phase === 'scanning'")[1].split('// ---- error ----')[0];
  expect(scanning).toContain("t('scan.reading')"); // 주 문구 존치
  expect(scanning).toContain("t('scan.stayHint')"); // 보조 안내 신설
  expect(scanning).toContain('testID="scan-stay-hint"');
  // 10 로케일 문구 존재(하드코딩 0)
  for (const lang of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id']) {
    const dict = JSON.parse(require('fs').readFileSync(`src/lib/i18n/${lang}.json`, 'utf8')) as { scan: Record<string, string> };
    expect(typeof dict.scan.stayHint).toBe('string');
  }
  // 발주 고정: 진행 화면에서 백그라운드 감지 구독·경고 모달·keep-awake 도입 금지
  // (권한 복귀 재조회용 AppState 구독은 별건 — 진행 블록 밖이라 무관)
  expect(scanning).not.toContain('AppState.addEventListener');
  expect(scanning).not.toContain('Alert.alert');
  expect(src).not.toContain('expo-keep-awake');
});

it('P-191: 갤러리 원본 로드 중 = 로딩 오버레이(scan.loadingPhoto), 완료 후 소멸', async () => {
  let release!: (v: { canceled: boolean; assets?: { uri: string; width: number; height: number }[] }) => void;
  mockLaunchLibrary.mockImplementation(() => new Promise((r) => (release = r)));
  const tree = render(<Scan />);
  const gallery = tree.root.findAll((n) => n.props?.accessibilityLabel === 'scan.gallery')[0];
  await act(async () => {
    void gallery.props.onPress();
    await Promise.resolve();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'importing-overlay').length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    release({ canceled: true });
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'importing-overlay').length).toBe(0); // 취소 = 복구
});
