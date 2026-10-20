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
// KB-769: 스캔 결과 이탈 가드(useLeaveConfirm) — 포커스·내비 표면 + usePreventRemove 기록(scanDesign이 콜백을 흉내)
jest.mock('expo-router/build/react-navigation/core', () => ({ usePreventRemove: (on: boolean, cb: unknown) => { (globalThis as { __prevent?: unknown }).__prevent = { on, cb }; } }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), /* P-508: scan.tsx 진입 파라미터(mode·label) */
  useIsFocused: () => true,
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

// KB-777 B1-4: 어두운 바탕(카메라·인식 중·오류 "Not a menu" 등) = 상태바 아이콘 밝게 · 밝은 결과 화면 = 앱 기본(dark)으로
it('KB-777 B1-4: 카메라 = StatusBar light · 결과(밝은 바탕) = 없음(기본 dark 복귀) · 오류·인식 중도 대상(소스 잠금)', async () => {
  const { StatusBar } = jest.requireActual('expo-status-bar') as typeof import('expo-status-bar');
  const bars = (tr: ReactTestRenderer) => tr.root.findAll((n) => n.type === StatusBar).map((n) => n.props.style);
  const tree = render(<Scan />);
  expect(bars(tree)).toEqual(['light']);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  expect(bars(tree)).toEqual([]);
  const src = jest.requireActual('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).toContain("const DARK_ROOT_PHASES = new Set<string>(['error', 'scanning']);");
  expect(src).toContain("const darkRoot = isGuest || DARK_ROOT_PHASES.has(phase) || (phase === 'camera' && !offline && !FLAGS.systemCamera && scanMode !== 'packaged');");
  expect(src).toContain('const lightBar = isFocused && darkRoot ?');
});

it('KB-777 B1-11: 카메라 뷰파인더 위·아래 스크림(제목·안내 대비) — 터치 통과(pointerEvents none) · 결과 화면엔 없음', async () => {
  const tree = render(<Scan />);
  for (const id of ['cam-scrim-top', 'cam-scrim-bottom']) {
    const s = tree.root.findAll((n) => n.props?.testID === id);
    expect(s.length).toBeGreaterThanOrEqual(1);
    expect(s[0].props.pointerEvents).toBe('none');
  }
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'cam-scrim-top')).toHaveLength(0);
});
