/**
 * P-062(KB-232): 스캔 화면 디자인 정합 잠금.
 *  - ⓪ 셔터/갤러리 ref 동기 가드 — 연속 2회 호출에도 픽커 1회(레이스)
 *  - ① Run sample scan 부재(카메라·에러 화면)
 *  - ③ D3 하단 바 — 원형 버튼 4(리스트/위험도/원본/다시찍기)·활성 뷰 주황
 */
import * as React from 'react';
import { preloadReactNative, PRELOAD_TIMEOUT_MS } from '@/__tests__/helpers/preloadReactNative';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BackHandler } from 'react-native';
import * as fs from 'fs';
import * as analytics from '@/lib/analytics';

// scanDefaultView 프렐류드 재사용
// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('expo-updates', () => ({ channel: 'teamtest' })); // KB-870: dev 서버 채널 동작 고정(운영 채널 숨김은 prodHide870·prodFlagSurfaces436)
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
    for (const k of ['onUpdate', 'onEnd', 'onStart', 'onFinalize', 'onChange', 'numberOfTaps', 'maxPointers', 'minPointers', 'enabled', 'runOnJS']) b[k] = () => b; // KB-553: onFinalize(useSheetSwipeDismiss)
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
const mockFocused = { v: true }; // 라우트 포커스(useIsFocused) — 다른 화면이 위로 올라가면 false
const mockCamMounts = { n: 0 }; // CameraView 마운트 수 — 새 마운트 = 새 카메라 세션(KB-845 QA: Android 탭 전환 뒤 프리뷰 검정)
jest.mock('expo-camera', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const CameraView = React.forwardRef(function MockCameraView(p: object, r: unknown) {
    React.useEffect(() => { mockCamMounts.n += 1; }, []);
    return React.createElement(View, { ...p, ref: r });
  });
  return { CameraView, useCameraPermissions: () => [{ granted: true }, jest.fn()] };
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
// KB-769: 스캔 결과 이탈 가드(useLeaveConfirm) — 포커스·내비 표면 + usePreventRemove 기록(scanDesign이 콜백을 흉내)
jest.mock('expo-router/build/react-navigation/core', () => ({ usePreventRemove: (on: boolean, cb: unknown) => { (globalThis as { __prevent?: unknown }).__prevent = { on, cb }; } }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), /* P-508: scan.tsx 진입 파라미터(mode·label) */
  useIsFocused: () => mockFocused.v,
  useNavigation: () => ({ dispatch: (a: unknown) => (globalThis as { __navDispatch?: (a: unknown) => void }).__navDispatch?.(a) }),
  useFocusEffect: (cb: () => void) => cb(), // P-255: 진입 선발급 훅 목
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }), // KB-789: push 공유 목(상세 이동 단언)
  usePathname: () => '/scan',
}));
const mockPush = jest.fn();
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/lib/push/scanNudge', () => ({ decideScanNudge: async () => null })); // KB-730: 큐가 넛지 판정을 기다린다 — 안 뜸으로
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
jest.mock('@/features/scan/UnlockCelebration', () => ({ ...jest.requireActual('@/features/scan/UnlockCelebration'), UnlockCelebration: () => null })); // 소진 화면의 축하 연출 = 이 파일 범위 밖(reanimated 목에 set 없음)
// KB-865 ③ Q4: 가공식품 이름 스캔·확정 = 표면 목(한도 덮개 회귀)
const mockScanName = jest.fn();
const mockConfirm = jest.fn();
jest.mock('@/lib/data/useProcessedScan', () => ({
  ...jest.requireActual('@/lib/data/useProcessedScan'),
  scanProcessedName: (...a: unknown[]) => mockScanName(...a),
  confirmProcessedScan: (...a: unknown[]) => mockConfirm(...a),
}));
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
  tree.root.findAll((n) => n.props?.accessibilityLabel === 'scanCamera.choosePhoto' && typeof n.props?.onPress === 'function')[0];

// KB-698: 첫 렌더의 react-native 지연 모듈 로딩·변환(콜드 캐시 1회 비용)을 첫 테스트의 5000ms 밖으로 — 원인·실측은 helpers 주석
beforeAll(preloadReactNative, PRELOAD_TIMEOUT_MS);
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
  // P-285(최종본): 세그 2 + 다시찍기(camera_restart) 복원
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

it('P-136/138 뷰 전환 — 기본 List(9/5 판정: 프로필 체크 줄 소멸)+안내문, Photo=원본만', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  // P-138⑤ 기본=List: 범례 없음 · 9/5 예진 판정 — ScanProfileBar(체크 줄) 화면 제거(시안 토글 행만)
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-legend').length).toBe(0);
  const s = JSON.stringify(tree.toJSON());
  expect(s).not.toContain('scan.checkedAgainst');
  expect(tree.root.findAll((n) => n.props?.testID === 'profile-bar')).toHaveLength(0);
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
  expect(JSON.stringify(tree.toJSON())).not.toContain('scan.checkedAgainst'); // 9/5 판정: 체크 줄 소멸
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

it('P-285(최종본): 다시찍기 복원 — camera_restart 탭 = P-161 확인 모달 → 확인 시 카메라 복귀', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  // 탭 → 즉시 리셋 아님, 확인 모달
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'retake' && typeof n.props?.onPress === 'function')[0].props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'retake-confirm').length).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(tree.toJSON())).toContain('₩8,000'); // 결과 보존
  act(() => {
    tree.root.findAll((n) => n.props?.testID === 'retake-go')[0].props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('₩8,000'); // 카메라 복귀(결과 소멸)
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).toContain('D4CameraRestart size={24}'); // 최종본 아이콘(2200:21514)
});

// P-187 contain(레터박스) → KB-845(D-31 scan refresh 로딩 C, 예진 채택): 흰 바탕 335×430 r12 사진 = cover(시안). 교체 근거 = 디자인 변경(P-510)
it('KB-845 로딩 C: 진행 화면 = ScanLoading(흰 바탕) · 사진 contain + 원본 비율 박스(KB-853 예진 결정 — D-31 cover 교체) · 스피너 0', () => {
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  const scanning = src.split("phase === 'scanning'")[1].split('// ---- error ----')[0];
  expect(scanning).toContain('<ScanLoading');
  expect(scanning).not.toContain('ActivityIndicator');
  const loading = fs.readFileSync('src/features/scan/ScanLoading.tsx', 'utf8');
  expect(loading).toContain('resizeMode="contain"');
  expect(loading).not.toContain('ActivityIndicator');
});

it('P-222: 진행 화면 = 이탈 자제 안내 보조 한 줄(주 문구 유지·과잉 개입 0)', () => {
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  const scanning = src.split("phase === 'scanning'")[1].split('// ---- error ----')[0];
  expect(scanning).toContain("t('scan.reading')"); // 주 문구 존치
  expect(scanning).toContain("t('scan.stayHint')"); // 보조 안내 신설(KB-845: 로딩 C 본문 — 시간 문구 그대로)
  expect(fs.readFileSync('src/features/scan/ScanLoading.tsx', 'utf8')).toContain('testID="scan-stay-hint"');
  // 10 로케일 문구 존재(하드코딩 0)
  for (const lang of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id']) {
    const dict = JSON.parse(fs.readFileSync(`src/lib/i18n/${lang}.json`, 'utf8')) as { scan: Record<string, string> };
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
  const gallery = tree.root.findAll((n) => n.props?.accessibilityLabel === 'scanCamera.choosePhoto')[0];
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

// KB-730: 스캔 성공 **2회째**에만 리뷰 유도 시트(결과 화면 진입 직후) — 1회째·3회째는 아님. 실패 경로는 onSuccess를 안 타므로 자동 제외
it('KB-730 스캔 성공 2회째 → 리뷰 유도 시트 1 · 1회째 → 0', async () => {
  const asMod = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock') as { default?: unknown } & Record<string, unknown>;
  const AsyncStorage = (asMod.default ?? asMod) as { clear: () => Promise<void>; setItem: (k: string, v: string) => Promise<void>; getItem: (k: string) => Promise<string | null>; removeItem: (k: string) => Promise<void> };
  const sheets = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'review-prompt' && typeof n.type === 'string').length;
  const settle = async () => { for (let i = 0; i < 24; i++) await act(async () => { await Promise.resolve(); }); }; // 큐 3스텝(코치·넛지·리뷰) 비동기 판정 통과
  await AsyncStorage.removeItem('kbap.reviewPrompt.v1');
  const first = render(<Scan />);
  await act(async () => { await galleryBtn(first).props.onPress(); }); // 성공 1회째
  await settle();
  expect(sheets(first)).toBe(0);
  expect(JSON.parse((await AsyncStorage.getItem('kbap.reviewPrompt.v1')) ?? '{}').scanSuccess).toBe(1);
  const second = render(<Scan />);
  await act(async () => { await galleryBtn(second).props.onPress(); }); // 성공 2회째
  await settle();
  expect(sheets(second)).toBe(1);
});

describe('KB-769 스캔 결과 뒤로가기 가드', () => {
  type Prevent = { on: boolean; cb: (o: { data: { action: unknown } }) => void };
  const g = globalThis as { __prevent?: Prevent; __navDispatch?: (a: unknown) => void };
  const toResult = async () => {
    const tree = render(<Scan />);
    await act(async () => {
      await galleryBtn(tree).props.onPress();
    });
    return tree;
  };
  const list = (tree: ReactTestRenderer) => tree.root.findAll((n) => typeof n.props?.onAdd === 'function' && Array.isArray(n.props?.dishes))[0];
  const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id);

  it('담은 게 없으면 막지 않는다 → 담으면 back(헤더·하드웨어·스와이프 = beforeRemove) 막고 확인 창 → 취소 = 머묾 · 나가기 = 막았던 이동 그대로', async () => {
    const dispatched: unknown[] = [];
    g.__navDispatch = (a) => dispatched.push(a);
    const tree = await toResult();
    expect(g.__prevent?.on).toBe(false);
    act(() => list(tree).props.onAdd(list(tree).props.dishes[0]));
    expect(g.__prevent?.on).toBe(true);
    const action = { type: 'GO_BACK' };
    act(() => g.__prevent!.cb({ data: { action } }));
    expect(byId(tree, 'scan-leave-confirm').length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain('scan.leaveTitle');
    act(() => byId(tree, 'scan-confirm-cancel').filter((n) => typeof n.props.onPress === 'function')[0].props.onPress());
    expect(byId(tree, 'scan-leave-confirm')).toHaveLength(0);
    expect(dispatched).toHaveLength(0);
    act(() => g.__prevent!.cb({ data: { action } }));
    act(() => byId(tree, 'scan-leave-go').filter((n) => typeof n.props.onPress === 'function')[0].props.onPress());
    expect(dispatched).toEqual([action]);
  });

  it('미등록 안내 열림 + Android 하드웨어 back = 안내만 닫힘(결과·담은 항목 유지, 화면 이탈 0)', async () => {
    const handlers: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_e: string, h: () => boolean) => {
      handlers.push(h);
      return { remove: () => handlers.splice(handlers.indexOf(h), 1) };
    }) as unknown as typeof BackHandler.addEventListener);
    try {
      const tree = await toResult();
      act(() => list(tree).props.onAdd(list(tree).props.dishes[0]));
      expect(handlers).toHaveLength(0);
      act(() => list(tree).props.onOpen({ ...list(tree).props.dishes[0], matched: false }));
      expect(JSON.stringify(tree.toJSON())).toContain('scan.unmatchedSheetTitle');
      let consumed = false;
      act(() => { consumed = handlers[handlers.length - 1](); });
      expect(consumed).toBe(true); // 기본 back(화면 닫기) 소비
      expect(JSON.stringify(tree.toJSON())).not.toContain('scan.unmatchedSheetTitle');
      expect(JSON.stringify(tree.toJSON())).toContain('₩8,000'); // 결과 유지
      expect(handlers).toHaveLength(0); // 닫히면 리스너 해제 → 다음 back은 이탈 가드로
    } finally {
      spy.mockRestore();
    }
  });

  // KB-789: 유사 음식 대체 항목 설명 카드 — 칩 콜백 → 카드 · 상세 버튼 → /food/[대체 foodId] · 배경 탭/back 닫힘 · 이벤트 1건
  describe('KB-789 Closest match 카드', () => {
    const sub = (tree: ReactTestRenderer) => ({ ...list(tree).props.dishes[0], substituted: true, originalScannedName: '된장찌게' });
    const press = (tree: ReactTestRenderer, id: string) => act(() => byId(tree, id).filter((n) => typeof n.props.onPress === 'function')[0].props.onPress());

    it('칩 콜백 → 카드(제목·본문·상세 버튼 1개) + scan_closest_match_open{food_id} 1건 · 상세 버튼 → 대체 음식 상세(src=scan)', async () => {
      const track = jest.spyOn(analytics, 'track');
      try {
        const tree = await toResult();
        expect(typeof list(tree).props.onClosestMatch).toBe('function');
        act(() => list(tree).props.onClosestMatch(sub(tree)));
        const s = JSON.stringify(tree.toJSON());
        expect(s).toContain('scan.closestMatchSheetTitle');
        expect(s).toContain('scan.closestMatchSheetBody');
        expect(s).toContain('scan.closestMatchSeeDetails');
        expect(s).not.toContain('common.gotIt'); // 확인 버튼 없음 — 상세 버튼 1개
        expect(track).toHaveBeenCalledWith('scan_closest_match_open', { food_id: '1' });
        press(tree, 'closest-details');
        expect(mockPush).toHaveBeenCalledTimes(1);
        expect(String(mockPush.mock.calls[0][0])).toMatch(/^\/food\/1\?.*src=scan/);
        expect(JSON.stringify(tree.toJSON())).not.toContain('scan.closestMatchSheetTitle'); // 이동 시 카드 닫힘
      } finally {
        track.mockRestore();
      }
    });

    it('배경 탭 = 닫힘(이동 0) · 카드 자체 탭 = 유지 · Android back = 카드만 닫힘', async () => {
      const handlers: (() => boolean)[] = [];
      const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_e: string, h: () => boolean) => {
        handlers.push(h);
        return { remove: () => handlers.splice(handlers.indexOf(h), 1) };
      }) as unknown as typeof BackHandler.addEventListener);
      try {
        const tree = await toResult();
        act(() => list(tree).props.onClosestMatch(sub(tree)));
        press(tree, 'closest-card');
        expect(JSON.stringify(tree.toJSON())).toContain('scan.closestMatchSheetTitle');
        press(tree, 'closest-backdrop');
        expect(JSON.stringify(tree.toJSON())).not.toContain('scan.closestMatchSheetTitle');
        expect(mockPush).not.toHaveBeenCalled();
        // back
        act(() => list(tree).props.onClosestMatch(sub(tree)));
        expect(handlers.length).toBeGreaterThan(0);
        let consumed = false;
        act(() => { consumed = handlers[handlers.length - 1](); });
        expect(consumed).toBe(true);
        expect(JSON.stringify(tree.toJSON())).not.toContain('scan.closestMatchSheetTitle');
        expect(JSON.stringify(tree.toJSON())).toContain('₩8,000'); // 결과 유지
      } finally {
        spy.mockRestore();
      }
    });
  });
});

// KB-777 B1-4: 어두운 바탕(카메라·오류 "Not a menu" 등) = 상태바 아이콘 밝게 · 밝은 결과 화면 = 앱 기본(dark)으로.
// KB-845: 인식 중 = 흰 로딩 C라 대상에서 뺀다(어두운 바탕 아님)
it('KB-777 B1-4: 카메라 = StatusBar light · 결과(밝은 바탕) = 없음(기본 dark 복귀) · 오류 대상 · 인식 중(흰 로딩 C) 제외(소스 잠금)', async () => {
  const { StatusBar } = jest.requireActual('expo-status-bar') as typeof import('expo-status-bar');
  const bars = (tr: ReactTestRenderer) => tr.root.findAll((n) => n.type === StatusBar).map((n) => n.props.style);
  const tree = render(<Scan />);
  expect(bars(tree)).toEqual(['light']);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  expect(bars(tree)).toEqual([]);
  const src = jest.requireActual('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).toContain("const DARK_ROOT_PHASES = new Set<string>(['error']);");
  expect(src).toContain("const darkRoot = isGuest || DARK_ROOT_PHASES.has(phase) || (phase === 'camera' && !offline && !FLAGS.systemCamera && scanMode !== 'packaged');");
  expect(src).toContain('const lightBar = isFocused && darkRoot ?');
});

it('KB-854 카메라 v2 B: 위·아래 단색 바(gray-1000 불투명) 2개 · 스크림 0(B1-11 그라데이션 → 바) · 프레이밍 코너 4 · 결과 화면엔 없음', async () => {
  const RN = jest.requireActual('react-native');
  const tree = render(<Scan />);
  for (const id of ['scan-cam-topbar', 'scan-cam-bottombar']) {
    const bar = tree.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
    expect(bar).toHaveLength(1);
    expect(RN.StyleSheet.flatten(bar[0].props.style).backgroundColor).toBe('#1C1E21');
  }
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-cam-topbar')[0].props.pointerEvents).toBe('none'); // 위 바 = 바탕만(닫기·탭은 위에서 받음)
  expect(tree.root.findAll((n) => n.props?.testID === 'cam-scrim-top' || n.props?.testID === 'cam-scrim-bottom')).toHaveLength(0);
  const corners = tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('scan-frame-corner-') && n.props?.width === 28);
  expect([...new Set(corners.map((c) => c.props.testID as string))].sort()).toEqual(['scan-frame-corner-bl', 'scan-frame-corner-br', 'scan-frame-corner-tl', 'scan-frame-corner-tr']);
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-frame-corners')[0].props.pointerEvents).toBe('none'); // 안내일 뿐 — 핀치·탭 통과
  // 긴 번역 = 탭 가로 스크롤(줄이지 않음) · 칸 최소 폭 = 화면 1/3
  const tabsScroll = tree.root.findAll((n) => n.props?.testID === 'scan-mode-tabs-scroll' && n.type === RN.ScrollView);
  expect(tabsScroll).toHaveLength(1);
  expect(tabsScroll[0].props.horizontal).toBe(true);
  const w = RN.Dimensions.get('window').width;
  const menuTab = tree.root.findAll((n) => n.props?.testID === 'scan-mode-menu' && typeof n.type === 'string')[0];
  expect(RN.StyleSheet.flatten(menuTab.props.style).minWidth).toBeCloseTo(w / 3, 5);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-cam-topbar')).toHaveLength(0);
});

// ── KB-845(D-31 scan refresh) 공통 카메라 ──
describe('KB-845 공통 카메라', () => {
  const RN = jest.requireActual('react-native');
  const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
  const pressId = async (tree: ReactTestRenderer, id: string) => {
    await act(async () => { await tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress(); });
  };
  it('KB-854 메뉴: "Scan" 헤더만 · 안내 문구·Photos·라이브러리 링크 제거 · 갤러리 아이콘("Choose photo") = 라이브러리 · 전환 = "Switch camera" · Food photo 탭 불가', async () => {
    const tree = render(<Scan />);
    expect(texts(tree, 'scanCamera.title')).toBeGreaterThan(0);
    for (const k of ['scanCamera.menuTitle', 'scanCamera.menuHint', 'scanCamera.photos', 'scanCamera.menuLink', 'scan.cameraHintLandscape']) expect(texts(tree, k)).toBe(0);
    expect(byId(tree, 'scan-library-link')).toHaveLength(0);
    expect(byId(tree, 'scan-cam-hint')).toHaveLength(0); // 메뉴 = 흐름 안내 없음
    const food = tree.root.findAll((n) => n.props?.testID === 'scan-mode-food')[0];
    expect(food.props.onPress).toBeUndefined();
    expect(food.props.accessibilityState).toMatchObject({ disabled: true });
    expect(byId(tree, 'scan-flip')[0].props.accessibilityLabel).toBe('scanCamera.switchCamera');
    expect(byId(tree, 'scan-gallery')[0].props.accessibilityLabel).toBe('scanCamera.choosePhoto');
    await pressId(tree, 'scan-gallery'); // 갤러리 = 메뉴 스캔 시작(로딩 C로 넘어간다)
    expect(mockLaunchLibrary).toHaveBeenCalledTimes(1);
  });
  it('줌 칩 1x·2x = 같은 틀(높이 36·테두리 1 — 상태는 색만) · KB-854 셔터 60 + 링 72 stroke 3 · 갤러리·전환 터치 52', () => {
    const tree = render(<Scan />);
    const chip = (k: string) => RN.StyleSheet.flatten(byId(tree, `zoom-${k}`)[0].props.style);
    const [a, b] = [chip('x1'), chip('x2')];
    for (const k of ['height', 'borderWidth', 'borderRadius', 'minWidth', 'paddingHorizontal']) expect(a[k]).toBe(b[k]);
    expect(a.height).toBe(36);
    expect(a.backgroundColor).not.toBe(b.backgroundColor); // 활성 = 흰 · 비활성 = gray-800
    const shutter = RN.StyleSheet.flatten(byId(tree, 'scan-shutter')[0].props.style);
    expect(shutter).toMatchObject({ width: 72, height: 72, borderWidth: 3 });
    const inner = RN.StyleSheet.flatten(byId(tree, 'scan-shutter')[0].children.find((c: { props: { style?: unknown } }) => c.props?.style).props.style);
    expect(inner).toMatchObject({ width: 60, height: 60 });
    for (const id of ['scan-gallery', 'scan-flip']) expect(RN.StyleSheet.flatten(byId(tree, id)[0].props.style)).toMatchObject({ width: 52, height: 52 });
  });
  it('탭 Packaged food = 같은 카메라(안내 문구 없음) · 링크 "성분표로 확인하기" 유지 → 성분표(탭은 Packaged 유지) → "앞면으로" 되돌림', async () => {
    const { FLAGS } = jest.requireActual('@/lib/flags') as { FLAGS: { packagedLabelScan: boolean } };
    const prev = FLAGS.packagedLabelScan;
    FLAGS.packagedLabelScan = true;
    try {
      const { QueryClient, QueryClientProvider } = jest.requireActual('@tanstack/react-query');
      const tree = render(<QueryClientProvider client={new QueryClient()}><Scan /></QueryClientProvider>);
      await pressId(tree, 'scan-mode-packaged');
      for (const k of ['scanCamera.packageTitle', 'scanCamera.packageHint']) expect(texts(tree, k)).toBe(0); // KB-854: 안내 문구 제거
      expect(byId(tree, 'scan-shutter')).toHaveLength(1);
      expect(byId(tree, 'pscan-label-instead')).toHaveLength(1); // 기능 링크는 유지(시안 Packaged 하단)
      await pressId(tree, 'pscan-label-instead');
      for (const k of ['scanCamera.labelTitle', 'scanCamera.labelHint']) expect(texts(tree, k)).toBe(0);
      expect(byId(tree, 'pscan-front-instead')).toHaveLength(1);
      expect(tree.root.findAll((n) => n.props?.testID === 'scan-mode-packaged')[0].props.accessibilityState).toMatchObject({ selected: true });
      await pressId(tree, 'pscan-front-instead');
      expect(byId(tree, 'pscan-label-instead')).toHaveLength(1);
      await pressId(tree, 'scan-mode-menu');
      expect(byId(tree, 'pscan-label-instead')).toHaveLength(0);
      expect(tree.root.findAll((n) => n.props?.testID === 'scan-mode-menu')[0].props.accessibilityState).toMatchObject({ selected: true });
    } finally {
      FLAGS.packagedLabelScan = prev;
    }
  });
  it('QA(Android 검정 프리뷰): 탭 메뉴 ↔ 가공식품 ↔ 성분표 전환 = CameraView 한 인스턴스(재마운트·새 세션 0) · 카메라 화면 동안 active', async () => {
    const { FLAGS } = jest.requireActual('@/lib/flags') as { FLAGS: { packagedLabelScan: boolean } };
    const prev = FLAGS.packagedLabelScan;
    FLAGS.packagedLabelScan = true;
    try {
      const { QueryClient, QueryClientProvider } = jest.requireActual('@tanstack/react-query');
      const tree = render(<QueryClientProvider client={new QueryClient()}><Scan /></QueryClientProvider>);
      await act(async () => {});
      const cam = () => tree.root.findAll((n) => typeof n.type === 'string' && n.props?.zoom !== undefined && n.props?.facing !== undefined);
      const before = mockCamMounts.n;
      expect(cam()).toHaveLength(1);
      expect(cam()[0].props.active).toBe(true);
      for (const id of ['scan-mode-packaged', 'pscan-label-instead', 'pscan-front-instead', 'scan-mode-menu', 'scan-mode-packaged']) {
        await pressId(tree, id);
        expect(cam()).toHaveLength(1);
        expect(cam()[0].props.active).toBe(true);
      }
      expect(mockCamMounts.n).toBe(before); // 전환 내내 새 마운트 0
    } finally {
      FLAGS.packagedLabelScan = prev;
    }
  });
  it('Codex #318: 스캔이 다른 화면에 가려지면(포커스 잃음) 카메라 active=false → 돌아오면 다시 true(같은 인스턴스)', async () => {
    const { FLAGS } = jest.requireActual('@/lib/flags') as { FLAGS: { packagedLabelScan: boolean } };
    const prev = FLAGS.packagedLabelScan;
    FLAGS.packagedLabelScan = true;
    try {
      const { QueryClient, QueryClientProvider } = jest.requireActual('@tanstack/react-query');
      const qc = new QueryClient();
      const el = () => <QueryClientProvider client={qc}><Scan /></QueryClientProvider>;
      const tree = render(el());
      await pressId(tree, 'scan-mode-packaged');
      const cam = () => tree.root.findAll((n) => typeof n.type === 'string' && n.props?.zoom !== undefined && n.props?.facing !== undefined)[0];
      const before = mockCamMounts.n;
      expect(cam().props.active).toBe(true);
      mockFocused.v = false;
      await act(async () => { tree.update(el()); });
      expect(cam().props.active).toBe(false);
      mockFocused.v = true;
      await act(async () => { tree.update(el()); });
      expect(cam().props.active).toBe(true);
      expect(mockCamMounts.n).toBe(before);
    } finally {
      mockFocused.v = true;
      FLAGS.packagedLabelScan = prev;
    }
  });
  it('KB-865 ③ Q4: 가공식품 확정 한도 = 흐름 위 소진 덮개(흐름 언마운트 0 · 후보·선택 유지) → 나중에 = 같은 후보 화면 · 카메라 재마운트 0', async () => {
    const { ApiError } = jest.requireActual('@/lib/api/client');
    const cand = { id: '11', reportNo: 'R1', name: 'P11', nameKo: null, maker: null, foodType: null, type: null, imageUrl: null, verdict: null, majorAllergens: null };
    mockScanName.mockResolvedValueOnce({ analysisId: 'A1', state: 'CANDIDATES', candidates: [cand] });
    mockConfirm.mockRejectedValueOnce(new ApiError('quota', 403, 'SCAN-004'));
    const { QueryClient, QueryClientProvider } = jest.requireActual('@tanstack/react-query');
    const tree = render(<QueryClientProvider client={new QueryClient()}><Scan /></QueryClientProvider>);
    await pressId(tree, 'scan-mode-packaged');
    // 촬영 대역 = 카메라 위 OCR 주입 패널(개발·진단 채널 — 같은 runName 경로)
    act(() => tree.root.findAll((n) => n.props?.testID === 'pscan-ocr-debug-input' && typeof n.props?.onChangeText === 'function')[0].props.onChangeText('새우깡'));
    await pressId(tree, 'pscan-ocr-debug-run');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(byId(tree, 'pscan-candidates').length).toBeGreaterThan(0);
    await pressId(tree, 'pscan-candidate-11');
    const flowNode = tree.root.findAll((n) => n.props?.testID === 'pscan-candidates')[0];
    const before = mockCamMounts.n;
    await pressId(tree, 'pscan-confirm');
    expect(mockConfirm).toHaveBeenCalledWith('A1', 'R1');
    expect(byId(tree, 'pscan-quota-overlay').length).toBeGreaterThan(0);
    expect(tree.root.findAll((n) => n.props?.testID === 'pscan-candidates')[0]).toBe(flowNode); // 같은 인스턴스 = 상태 유지
    await pressId(tree, 'scan-quota-later');
    expect(byId(tree, 'pscan-quota-overlay')).toHaveLength(0);
    const card = tree.root.findAll((n) => n.props?.testID === 'pscan-candidate-11' && n.props?.accessibilityState)[0];
    expect(card.props.accessibilityState).toMatchObject({ selected: true });
    expect(mockCamMounts.n).toBe(before);
  });
});
