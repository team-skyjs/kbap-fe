/**
 * KB-711(P-451) — 사진 업로드 상한·이탈 시 취소를 **실제 업로드 경로**(useFeedback → uploadImage → createUploadTask)로 확인.
 * 목은 네이티브 업로드(expo-file-system)와 API 클라이언트뿐 — 업로드가 영영 끝나지 않는 약한 망을 흉내 낸다.
 */
import * as React from 'react';
import { TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('react-native-svg', () => {
  const R = jest.requireActual('react') as typeof import('react');
  const mk = (name: string) => (props: Record<string, unknown>) => R.createElement(name, props, props.children as never);
  return new Proxy({ __esModule: true, default: mk('Svg') } as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : mk(String(k))),
  });
});
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : k), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockRouteId = '12';
jest.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: (a: unknown) => mockNavDispatch(a) }), // KB-708 이탈 확인
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockRouteId }),
  useSegments: () => [],
  usePathname: () => '/',
  // 포커스 이펙트: 기본은 마운트 시 포커스(정리 함수 = 이탈). 이탈 시나리오는 테스트에서 직접 호출한다.
  useFocusEffect: (cb: () => (() => void) | void) => {
    const R = jest.requireActual('react') as typeof import('react');
    R.useEffect(() => {
      const off = cb();
      mockBlur.fn = typeof off === 'function' ? off : () => {};
      return typeof off === 'function' ? off : undefined;
    }, [cb]);
  },
}));
// KB-708: 이탈 확인 — usePreventRemove(번들 react-navigation) 목: 마지막 호출의 (막는지, 콜백)을 기록 → 테스트가 뒤로 가기를 흉내
const mockNavDispatch = jest.fn();
const mockPrevent: { on: boolean; cb: ((o: { data: { action: unknown } }) => void) | null } = { on: false, cb: null };
jest.mock('expo-router/build/react-navigation/core', () => ({
  usePreventRemove: (on: boolean, cb: (o: { data: { action: unknown } }) => void) => {
    mockPrevent.on = on;
    mockPrevent.cb = cb;
  },
}));
const mockBlur: { fn: () => void } = { fn: () => {} };
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/p1.jpg' }] }),
}));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a), subscribeTopToast: () => () => {} }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.3', nativeBuildVersion: '34' }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ EVENTS: { profile_feedback_submit: 'profile_feedback_submit' }, track: (...a: unknown[]) => mockTrack(...a) }));

const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockTaskUpload = jest.fn();
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: () => Promise.resolve({ exists: true, size: 2_000_000 }),
  createUploadTask: () => ({ uploadAsync: () => mockTaskUpload(), cancelAsync: () => mockCancel() }),
  FileSystemUploadType: { BINARY_CONTENT: 'binary' },
}));
const mockPost = jest.fn();
const mockPut = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/api/client', () => ({ api: { post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a), get: jest.fn() } }));
jest.mock('@/lib/deviceInfo', () => ({ collectDeviceInfo: () => ({}) }));

// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import FeedbackComposeScreen from '@/app/profile/feedback/new';
// eslint-disable-next-line import/first -- 위와 같음
import { UPLOAD_PUT_TIMEOUT_MS } from '@/lib/api/scanImage';

const byId = (r: ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id })[0];
const sendBtn = (r: ReactTestRenderer) => r.root.findAll((n) => n.props?.testID === 'feedback-send' && 'busy' in (n.props ?? {}))[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockImplementation(async (path: string) => {
    if (path === '/images/upload-url') return { uploadUrl: 'https://s/put', method: 'PUT', requiredHeaders: {}, publicUrl: 'https://cdn/x.jpg', objectKey: 'fb/x.jpg' };
    if (path === '/images/complete') return { path: 'fb/x.jpg' };
    if (path === '/api/feedbacks') return { id: 1 };
    throw new Error(path);
  });
  mockTaskUpload.mockImplementation(() => new Promise(() => {})); // 약한 망 — 업로드가 끝나지 않는다
});
afterEach(() => jest.useRealTimers());

async function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<QueryClientProvider client={qc}><FeedbackComposeScreen /></QueryClientProvider>); });
  const input = r.root.findAllByType(TextInput).find((n) => n.props.testID === 'feedback-body')!;
  await act(async () => { input.props.onChangeText('photo inquiry'); });
  await act(async () => { await byId(r, 'feedback-photo-add').props.onPress(); }); // 사진 1장
  return r;
}

it('업로드가 끝나지 않으면 상한 뒤 실패로 돌아온다 — 네이티브 업로드 취소 · 실패 안내 · Send 다시 누를 수 있음 · 본 요청 0', async () => {
  jest.useFakeTimers();
  const r = await setup();
  await act(async () => { void byId(r, 'feedback-send').props.onPress(); });
  await act(async () => { await Promise.resolve(); });
  expect(sendBtn(r).props.busy).toBe(true); // 업로드 중
  await act(async () => { jest.advanceTimersByTime(UPLOAD_PUT_TIMEOUT_MS + 1); });
  await act(async () => { await Promise.resolve(); });
  expect(mockCancel).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledWith('feedback.sendFailed', { error: true }); // 화면의 기존 실패 경로(재시도 가능)
  expect(sendBtn(r).props.busy).toBe(false); // 다시 누를 수 있다
  expect(mockPost.mock.calls.map(([p]) => p)).not.toContain('/api/feedbacks');
  expect(mockBack).not.toHaveBeenCalled();
});

it('전송 중 화면을 떠나면(언마운트) 진행 중인 업로드 취소 · 떠난 뒤 실패 토스트 0 · 본 요청 0', async () => {
  const r = await setup();
  await act(async () => { void byId(r, 'feedback-send').props.onPress(); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(mockTaskUpload).toHaveBeenCalledTimes(1); // PUT 진행 중
  await act(async () => { mockBlur.fn(); r.unmount(); });
  await act(async () => { await Promise.resolve(); });
  expect(mockCancel).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();
  expect(mockPost.mock.calls.map(([p]) => p)).not.toContain('/api/feedbacks');
});

it('배선 잠금 — 리뷰 작성·문의 작성·커뮤니티 글쓰기 모두 제출마다 이탈 취소 신호를 업로드에 넘긴다 · 취소 실패는 조용히', () => {
  const read = (p: string) => (jest.requireActual('fs') as typeof import('fs')).readFileSync(p, 'utf8');
  const review = read('src/app/food/[id]/review.tsx');
  expect(review).toContain('useUploadAbort()');
  expect(review).toContain('uploadReviewImages(localUris, signal)');
  expect(review).toContain('if (signal.aborted) throw new UploadAbortedError();'); // 본 요청 직전 확인
  expect(review).toContain('if (isUploadAborted(e)) return;');
  const fb = read('src/app/profile/feedback/new.tsx');
  expect(fb).toContain('signal: nextUploadSignal()');
  expect(fb).toContain('if (isUploadAborted(e)) return;');
  const cm = read('src/app/community/compose.tsx');
  expect(cm).toContain('signal: nextUploadSignal()');
  // 신호가 공용 uploadImage까지 내려간다(표면별 따로 구현 금지 — 수정 지점은 uploadImage 한 곳)
  expect(read('src/lib/review/reviewPhotos.ts')).toContain("REVIEW_IMAGE_PURPOSE, { signal })");
  expect(read('src/lib/data/useFeedback.ts')).toContain('{ signal: input.signal }');
  expect(read('src/lib/community/adapter.ts')).toContain("'COMMUNITY', { signal })");
});

// #240 공부: bail()은 PUT 뒤·complete 앞뿐 — 마지막 장 complete 도중(최대 15초)에 떠나면 본 요청이 그대로 나갔다
it('마지막 장 complete 도중 이탈 → 본 요청 직전 신호 확인으로 /api/feedbacks 0 · 토스트 0', async () => {
  let releaseComplete!: () => void;
  const completeGate = new Promise<void>((r) => (releaseComplete = r));
  mockTaskUpload.mockResolvedValue({ status: 200 }); // PUT은 끝남
  mockPost.mockImplementation(async (path: string) => {
    if (path === '/images/upload-url') return { uploadUrl: 'https://s/put', method: 'PUT', requiredHeaders: {}, publicUrl: 'https://cdn/x.jpg', objectKey: 'fb/x.jpg' };
    if (path === '/images/complete') { await completeGate; return { path: 'fb/x.jpg' }; } // complete 진행 중
    if (path === '/api/feedbacks') return { id: 1 };
    throw new Error(path);
  });
  const r = await setup();
  await act(async () => { void byId(r, 'feedback-send').props.onPress(); });
  for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); });
  expect(mockPost.mock.calls.map(([p]) => p)).toContain('/images/complete'); // complete 도중
  await act(async () => { mockBlur.fn(); r.unmount(); }); // 이탈
  await act(async () => { releaseComplete(); await completeGate; });
  for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); });
  expect(mockPost.mock.calls.map(([p]) => p)).not.toContain('/api/feedbacks');
  expect(mockToast).not.toHaveBeenCalled();
});

it('사진 0장 — 이미 중단된 신호면 본 요청을 보내지 않는다(전엔 사진이 없으면 신호를 아예 안 봤다)', async () => {
  const { submitFeedback } = jest.requireActual<typeof import('@/lib/data/useFeedback')>('@/lib/data/useFeedback');
  const { isUploadAborted } = jest.requireActual<typeof import('@/lib/api/uploadAbort')>('@/lib/api/uploadAbort');
  const ctl = new AbortController();
  ctl.abort();
  const e = await submitFeedback({ content: 'x', photoUris: [], signal: ctl.signal }).catch((x: unknown) => x);
  expect(isUploadAborted(e)).toBe(true);
  expect(mockPost).not.toHaveBeenCalled();
});

it('커뮤니티 — 사진 0장 · 중단된 신호면 글 작성·수정 요청 0', async () => {
  const adapter = jest.requireActual<typeof import('@/lib/community/adapter')>('@/lib/community/adapter');
  const ctl = new AbortController();
  ctl.abort();
  const input = { body: 'b', photos: [], foodTags: [], placeTag: null, signal: ctl.signal };
  const isAborted = jest.requireActual<typeof import('@/lib/api/uploadAbort')>('@/lib/api/uploadAbort').isUploadAborted;
  expect(isAborted(await adapter.createPost(input).catch((x: unknown) => x))).toBe(true);
  expect(isAborted(await adapter.updatePost('1', input).catch((x: unknown) => x))).toBe(true);
  expect(mockPost).not.toHaveBeenCalled();
  expect(mockPut).not.toHaveBeenCalled();
});
