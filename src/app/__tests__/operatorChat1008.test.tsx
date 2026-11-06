/**
 * KB-1008(P-614) 운영진 1:1 채팅 — S-971 계약 v0 스텁.
 * ① 어댑터(역할·커서·안읽음) · 행 조립(지난 문의 구분선) · 시간 · 푸시 딥링크
 * ② 화면: 버전 헤더 · 빈 방 = 기본 인사 · 운영진 메시지 있으면 인사 없음 · 읽음 = 최신 id · 보내기 · 429 CHAT-001 전용 안내 + 실패 말풍선 탭 재전송 · 광고 신고 프리필(자동 전송 0)
 * ③ 플로팅 버튼: 안읽음 점·미리보기 · 커뮤니티 들어 올림
 * ④ 배선 잠금(프로필 Contact us·광고 신고 · KB-986 생략 · 탭 레이아웃) · i18n 10로케일
 */
import * as React from 'react';
import * as fs from 'fs';
import { AppState, StyleSheet, TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// jest.mock은 babel-jest가 import 위로 올린다 — 목이 먼저 걸린다
import ChatRoute, { CHAT_READ_RETRY_MS, chatErrorKey, chatRows, chatTime } from '@/app/chat';
import { FLAGS } from '@/lib/flags';
import { ChatFab, chatFabBottom } from '@/features/chat/ChatFab';
import { adaptChatMessage, adaptChatPage, adaptChatUnread, chatTimeIso } from '@/lib/api/chatAdapter';
import { invalidateChat } from '@/lib/data/useChat';
import { routeForNotificationData } from '@/lib/push/pushAdapter';
import { TABBAR_CONTENT_H } from '@/components/TabBar';
import { color as C } from '@/lib/theme';

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
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockPush = jest.fn();
const mockRedirect = jest.fn();
let mockQuery: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockQuery,
  useSegments: () => ['chat'],
  Redirect: ({ href }: { href: string }) => { mockRedirect(href); return null; },
  useFocusEffect: (cb: () => (() => void) | void) => {
    const R = jest.requireActual('react') as typeof import('react');
    R.useEffect(() => {
      const off = cb();
      return typeof off === 'function' ? off : undefined;
    }, [cb]);
  },
}));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a), subscribeTopToast: () => () => {} }));
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } }));
let mockGen = 1;
let mockSession: boolean | null = true;
jest.mock('@/lib/auth/useSession', () => ({ useSession: () => mockSession }));
jest.mock('@/lib/auth/beTokens', () => ({ currentGen: () => mockGen }));
jest.mock('@/lib/deviceInfo', () => ({ collectDeviceInfo: () => ({ os: 'ios', lang: 'en' }) }));
jest.mock('@/lib/api/scanImage', () => ({ uploadImage: jest.fn().mockResolvedValue({ path: 'feedback/a.jpg' }) }));


const H = { headers: { 'X-API-Version': '1.0' } };
const page = (items: unknown[], hasMore = false) => ({ conversationId: items.length ? 7 : null, items, nextCursor: hasMore ? 1 : null, hasMore });
const msg = (id: number, role: 'USER' | 'OPERATOR', content: string, legacy = false) => ({ id, authorRole: role, content, imageUrls: [], createdAt: '2026-11-05T03:00:00Z', legacyFeedbackId: legacy ? 99 : null });

function routeGets(messages: unknown, unread: unknown = { unreadCount: 0, lastOperatorMessage: null }) {
  mockGet.mockImplementation((path: string) => Promise.resolve(path.startsWith('/api/chat/unread') ? unread : messages));
}
async function settle() {
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // TanStack 알림 = setTimeout(0)
}
let lastQc: QueryClient;
async function mount(el: React.ReactElement): Promise<ReactTestRenderer> {
  const qc = (lastQc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } }));
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  await settle();
  return r;
}
const has = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => n.props?.testID === id).length > 0;
const press = async (r: ReactTestRenderer, id: string) => {
  await act(async () => { r.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === 'function')[0].props.onPress(); });
  await settle();
};
/** 엘리먼트 prop(ListFooterComponent)이 있으면 toJSON 문자열화가 순환 — 문자열 자식만 모은다(메모 element-prop-breaks-tree-json) */
const text = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string).join('\n');
const input = (r: ReactTestRenderer) => r.root.findAllByType(TextInput).find((n) => n.props.testID === 'chat-input')!;

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = {};
  mockGen = 1;
  mockSession = true;
  // Codex #441 P1: 킬스위치 = DEV_SERVER_CHANNEL(이 스위트 jest 채널에선 false — 메모 jest-flag-default-varies-by-suite) → 채팅 켠 상태로 고정
  (FLAGS as { operatorChatEnabled: boolean }).operatorChatEnabled = true;
  mockPost.mockResolvedValue(msg(10, 'USER', 'hi'));
});

describe('① 어댑터·행·시간·딥링크', () => {
  it('역할: USER = 나, 그 외(OPERATOR·미지) = 운영진 · 비-URL 사진 버림 · legacyFeedbackId = 지난 문의', () => {
    expect(adaptChatMessage(msg(1, 'USER', 'a')).role).toBe('user');
    expect(adaptChatMessage({ ...msg(2, 'OPERATOR', 'b'), authorRole: 'BOT' }).role).toBe('operator');
    expect(adaptChatMessage({ ...msg(3, 'USER', 'c'), imageUrls: ['https://x/a.webp', 'feedback/raw.jpg'] }).imageUrls).toEqual(['https://x/a.webp']);
    expect(adaptChatMessage(msg(4, 'USER', 'd', true)).legacy).toBe(true);
  });
  it('커서는 hasMore일 때만 · 빈 방 = conversationId null · 안읽음 음수·이상값 = 0', () => {
    expect(adaptChatPage({ items: [], nextCursor: 5, hasMore: false }).nextCursor).toBeNull();
    expect(adaptChatPage({ items: [msg(1, 'USER', 'a')], nextCursor: 5, hasMore: true }).nextCursor).toBe('5');
    expect(adaptChatPage({ conversationId: null, items: [] }).conversationId).toBeNull();
    expect(adaptChatUnread({ unreadCount: -3 }).count).toBe(0);
    expect(adaptChatUnread({ unreadCount: 2, lastOperatorMessage: { content: 'Hi', createdAt: 'x' } })).toEqual({ count: 2, last: { content: 'Hi', createdAt: 'x' } });
  });
  it('행 = 최신 → 과거(보내는 중 맨 아래) · QA #441: "이전 문의" 구분선 = 지난 문의 묶음 맨 위(배열 = 가장 오래된 것 뒤)', () => {
    const items = [msg(5, 'OPERATOR', 'new'), msg(4, 'USER', 'q'), msg(3, 'OPERATOR', 'old reply', true), msg(2, 'USER', 'old q', true)].map(adaptChatMessage);
    const rows = chatRows([{ localId: 'L', content: 'sending', photos: [], failed: false }], items);
    expect(rows.map((r) => (r.kind === 'msg' ? r.m.id : r.kind))).toEqual(['out', '5', '4', '3', '2', 'legacyDivider']);
    // 전부 지난 문의여도 묶음 맨 위에 제목처럼 1개 · 지난 문의 없음 = 구분선 0
    expect(chatRows([], items.slice(2)).map((r) => (r.kind === 'msg' ? r.m.id : r.kind))).toEqual(['3', '2', 'legacyDivider']);
    expect(chatRows([], items.slice(0, 2)).some((r) => r.kind === 'legacyDivider')).toBe(false);
  });
  it('QA #441 ①: 채팅 시각 = 오프셋 없는 ISO는 UTC로(Z 부착) · 오프셋·Z 있으면 그대로 · 빈값 = 빈 문자열', () => {
    expect(chatTimeIso('2026-11-05T03:00:00')).toBe('2026-11-05T03:00:00Z');
    expect(chatTimeIso('2026-11-05T03:00:00.123456')).toBe('2026-11-05T03:00:00.123456Z');
    expect(chatTimeIso('2026-11-05T03:00:00Z')).toBe('2026-11-05T03:00:00Z');
    expect(chatTimeIso('2026-11-05T12:00:00+09:00')).toBe('2026-11-05T12:00:00+09:00');
    expect(chatTimeIso('2026-11-05T12:00:00+0900')).toBe('2026-11-05T12:00:00+0900');
    expect(chatTimeIso(null)).toBe('');
    // 같은 순간: 오프셋 없는 UTC 03:00 = KST 12:00 표기와 같은 시각
    expect(new Date(adaptChatMessage({ ...msg(1, 'USER', 'a'), createdAt: '2026-11-05T03:00:00' }).createdAt).getTime()).toBe(new Date('2026-11-05T12:00:00+09:00').getTime());
    expect(adaptChatUnread({ unreadCount: 1, lastOperatorMessage: { content: 'x', createdAt: '2026-11-05T03:00:00' } }).last?.createdAt).toBe('2026-11-05T03:00:00Z');
  });
  it('시간: 같은 날 HH:mm · 다른 날 M/D HH:mm · 이상값 빈 문자열', () => {
    const now = new Date(2026, 10, 5, 15, 0);
    expect(chatTime(new Date(2026, 10, 5, 9, 7).toISOString(), now)).toBe('09:07');
    expect(chatTime(new Date(2026, 10, 3, 21, 30).toISOString(), now)).toBe('11/3 21:30');
    expect(chatTime('nope', now)).toBe('');
  });
  it('에러 코드 → 문구 키(서버 message 노출 0) · 미지 = 일반 실패', () => {
    expect(['CHAT-001', 'FEEDBACK-001', 'FEEDBACK-002', 'COMMON-002', 'X', undefined].map(chatErrorKey)).toEqual(['chat.rateLimited', 'chat.tooLong', 'chat.photoInvalid', 'chat.invalid', 'chat.sendFailed', 'chat.sendFailed']);
  });
  it('푸시 OPERATOR_CHAT → /chat · Codex #441 P2: 킬스위치 off = 기존 문의 화면', () => {
    expect(routeForNotificationData({ type: 'OPERATOR_CHAT', conversationId: 7 })).toBe('/chat');
    const prev = FLAGS.operatorChatEnabled;
    (FLAGS as { operatorChatEnabled: boolean }).operatorChatEnabled = false;
    try {
      expect(routeForNotificationData({ type: 'OPERATOR_CHAT', conversationId: 7 })).toBe('/profile/feedback');
    } finally {
      (FLAGS as { operatorChatEnabled: boolean }).operatorChatEnabled = prev;
    }
  });
  it('KB-1008 운영 켜기(2026-11-06): 운영 채팅 API 배포 뒤 전 채널 on — Codex #441 P1의 dev 한정은 해제', () => {
    expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('operatorChatEnabled: true,');
  });
});

describe('② 채팅 화면', () => {
  it('빈 방 = 기본 인사 + 팀 줄 · 조회 = 버전 헤더 1.0 · limit 30', async () => {
    routeGets(page([]));
    const r = await mount(<ChatRoute />);
    expect(mockGet).toHaveBeenCalledWith('/api/chat/messages?limit=30', H);
    expect(has(r, 'chat-greeting')).toBe(true);
    expect(has(r, 'chat-team-bar')).toBe(true);
    const s = text(r);
    expect(s).toContain('chat.greeting');
    expect(s).toContain('chat.repliesWithin');
    expect(mockPost).not.toHaveBeenCalledWith('/api/chat/read', expect.anything(), expect.anything()); // 메시지 없음 = 읽음 0
  });
  it('운영진 메시지가 있으면 인사 없음 · 맨 아래 보는 중 = 최신 id로 읽음 1회 · 지난 문의 구분선', async () => {
    routeGets(page([msg(5, 'OPERATOR', 'Hello from team'), msg(4, 'USER', 'q'), msg(3, 'USER', 'old', true)]));
    const r = await mount(<ChatRoute />);
    expect(has(r, 'chat-greeting')).toBe(false);
    expect(has(r, 'chat-op-5')).toBe(true);
    expect(has(r, 'chat-me-4')).toBe(true);
    expect(has(r, 'chat-legacy-divider')).toBe(true);
    expect(mockPost).toHaveBeenCalledWith('/api/chat/read', { lastMessageId: '5' }, H);
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/chat/read')).toHaveLength(1);
    // 위로 올렸다가 다시 맨 아래 = 같은 최신 id라 읽음 재호출 0 · 위에 있는 동안엔 새 메시지가 와도 읽음 0
    const list = () => r.root.findAll((n) => n.props?.testID === 'chat-list' && typeof n.props.onScroll === 'function')[0];
    await act(async () => { list().props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } }); });
    await act(async () => { list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }); });
    await settle();
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/chat/read')).toHaveLength(1);
  });
  it('보내기 = 본문만(사진 0이면 imagePaths 없음) · 버전 헤더 · 성공 뒤 보내는 중 말풍선 사라짐', async () => {
    routeGets(page([]));
    const r = await mount(<ChatRoute />);
    await act(async () => { input(r).props.onChangeText('  hi there  '); });
    await press(r, 'chat-send');
    // S-971 확정: deviceInfo = 문의와 같은 수집 재사용 · 사진 0 = imagePaths 없음
    expect(mockPost).toHaveBeenCalledWith('/api/chat/messages', { content: 'hi there', deviceInfo: { os: 'ios', lang: 'en' } }, H);
    expect(has(r, 'chat-out-sending')).toBe(false);
    expect(input(r).props.value).toBe('');
  });
  it('429 CHAT-001 = 전용 안내(서버 문구 0) + 실패 말풍선 → 탭 = 다시 보내기', async () => {
    routeGets(page([]));
    mockPost.mockRejectedValueOnce(Object.assign(new Error('server says no'), { code: 'CHAT-001' }));
    const r = await mount(<ChatRoute />);
    await act(async () => { input(r).props.onChangeText('hi'); });
    await press(r, 'chat-send');
    expect(mockToast).toHaveBeenCalledWith('chat.rateLimited', { error: true });
    expect(has(r, 'chat-out-failed')).toBe(true);
    await press(r, 'chat-out-failed');
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/chat/messages')).toHaveLength(2);
    expect(has(r, 'chat-out-failed')).toBe(false);
  });
  it('빈 본문 = 보내기 비활성(색만 — 크기 같음)', async () => {
    routeGets(page([]));
    const r = await mount(<ChatRoute />);
    const btn = () => r.root.findAll((n) => n.props?.testID === 'chat-send' && n.props.style !== undefined)[0];
    const off = JSON.stringify(btn().props.style);
    expect(btn().props.disabled).toBe(true);
    await act(async () => { input(r).props.onChangeText('x'); });
    expect(btn().props.disabled).toBe(false);
    expect(JSON.stringify(btn().props.style).replace(/"backgroundColor":"[^"]+"/, '')).toBe(off.replace(/"backgroundColor":"[^"]+"/, ''));
  });
  it('세션 경계: 응답 도착 전에 로그아웃·계정 전환(세대 bump)되면 옛 대화를 캐시에 올리지 않는다', async () => {
    let resolve!: (v: unknown) => void;
    mockGet.mockImplementation((path: string) => (path.startsWith('/api/chat/messages') ? new Promise((r) => { resolve = r; }) : Promise.resolve({ unreadCount: 0 })));
    const r = await mount(<ChatRoute />);
    mockGen = 2; // 요청 중 세션 바뀜
    await act(async () => { resolve(page([msg(5, 'OPERATOR', 'previous user secret')])); });
    await settle();
    expect(has(r, 'chat-op-5')).toBe(false);
    expect(text(r)).not.toContain('previous user secret');
  });
  it('S-971: 사진 첨부 = 로그인 사용자만 — 게스트·세션 미확정 = 버튼 없음, 회원 = 있음', async () => {
    routeGets(page([]));
    mockSession = false;
    expect(has(await mount(<ChatRoute />), 'chat-photo-add')).toBe(false);
    mockSession = null;
    expect(has(await mount(<ChatRoute />), 'chat-photo-add')).toBe(false);
    mockSession = true;
    expect(has(await mount(<ChatRoute />), 'chat-photo-add')).toBe(true);
  });
  it('Codex #441 P2: 킬스위치 off면 /chat 진입 = 문의 화면으로 이동 · 채팅 API 호출 0', async () => {
    const prev = FLAGS.operatorChatEnabled;
    (FLAGS as { operatorChatEnabled: boolean }).operatorChatEnabled = false;
    try {
      routeGets(page([]));
      await mount(<ChatRoute />);
      expect(mockRedirect).toHaveBeenCalledWith('/profile/feedback');
      expect(mockGet).not.toHaveBeenCalled();
    } finally {
      (FLAGS as { operatorChatEnabled: boolean }).operatorChatEnabled = prev;
    }
  });
  it('Codex #441 P2: 앱이 백그라운드면 읽음 처리 0 → 전경 복귀 때 1회', async () => {
    let onChange: (s: string) => void = () => {};
    const orig = AppState.addEventListener;
    (AppState as unknown as { addEventListener: unknown }).addEventListener = (_: string, cb: (s: string) => void) => { onChange = cb; return { remove: () => {} }; };
    try {
      routeGets(page([]));
      await mount(<ChatRoute />);
      await act(async () => { onChange('background'); });
      routeGets(page([msg(9, 'OPERATOR', 'reply while away')]));
      await act(async () => { await lastQc.invalidateQueries({ queryKey: ['chat', 'messages'] }); }); // 폴링 한 번 흉내
      await settle();
      expect(mockPost.mock.calls.filter((c) => c[0] === '/api/chat/read')).toHaveLength(0);
      await act(async () => { onChange('active'); });
      await settle();
      expect(mockPost).toHaveBeenCalledWith('/api/chat/read', { lastMessageId: '9' }, H);
    } finally {
      (AppState as unknown as { addEventListener: unknown }).addEventListener = orig;
    }
  });
  it('Codex #441 P2: 읽음 실패 = 10초 뒤 재시도(같은 최신 id여도)', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    try {
      routeGets(page([msg(5, 'OPERATOR', 'hi')]));
      mockPost.mockImplementation((path: string) => (path === '/api/chat/read' ? Promise.reject(new Error('NETWORK')) : Promise.resolve(msg(10, 'USER', 'x'))));
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
      await act(async () => { renderer.create(<QueryClientProvider client={qc}><ChatRoute /></QueryClientProvider>); });
      for (let i = 0; i < 5; i++) await act(async () => { jest.advanceTimersByTime(1); await Promise.resolve(); });
      const reads = () => mockPost.mock.calls.filter((c) => c[0] === '/api/chat/read').length;
      expect(reads()).toBe(1);
      mockPost.mockImplementation(() => Promise.resolve(undefined));
      await act(async () => { jest.advanceTimersByTime(CHAT_READ_RETRY_MS); await Promise.resolve(); await Promise.resolve(); });
      expect(reads()).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });
  it('Codex #441 P2: 같은 틱 더블탭 = 말풍선 1개·요청 1개(보내는 중에 영영 남는 유령 말풍선 0)', async () => {
    routeGets(page([]));
    let resolve!: (v: unknown) => void;
    mockPost.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const r = await mount(<ChatRoute />);
    await act(async () => { input(r).props.onChangeText('hi'); });
    const send = r.root.findAll((n) => n.props?.testID === 'chat-send' && typeof n.props.onPress === 'function')[0];
    await act(async () => { send.props.onPress(); send.props.onPress(); });
    expect(r.root.findAll((n) => n.props?.testID === 'chat-out-sending' && typeof n.type === 'string')).toHaveLength(1);
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/chat/messages')).toHaveLength(1);
    await act(async () => { resolve(msg(10, 'USER', 'hi')); });
    await settle();
  });
  it('광고 신고(?prefill=ad) = 입력창만 채움 · 자동 전송 0', async () => {
    mockQuery = { prefill: 'ad' };
    routeGets(page([]));
    const r = await mount(<ChatRoute />);
    expect(input(r).props.value).toBe('ads.reportPrefill');
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/chat/messages')).toHaveLength(0);
  });
});

describe('④ 로고·플로팅 버튼 색 (11/5 예진 실기)', () => {
  const MARK_VIEWBOX = '0 -1.528 18.551 21.528'; // AppBarMark = kbap-design/brand/appbar-mark.svg
  const flat = (r: ReactTestRenderer, id: string) => StyleSheet.flatten(r.root.find((n) => n.props?.testID === id && typeof n.type === 'string' || (n.props?.testID === id && n.props?.style)).props.style);
  it('팀 줄·운영진 아바타 = 흰 원 + 정본 마크(AppBarMark) · 폐기 BrandTile(주황 타일) 0', async () => {
    routeGets(page([msg(5, 'OPERATOR', 'Hello from team')]));
    const r = await mount(<ChatRoute />);
    const avatars = r.root.findAll((n) => n.props?.testID === 'chat-team-avatar' && !!n.props?.style);
    expect(avatars.length).toBeGreaterThanOrEqual(2); // 팀 줄 + 메시지
    for (const a of avatars) {
      expect(StyleSheet.flatten(a.props.style).backgroundColor).toBe(C.surface);
      expect(a.findAll((n) => n.props?.viewBox === MARK_VIEWBOX).length).toBeGreaterThan(0);
    }
    expect(r.root.findAll((n) => n.props?.fill === C.primary && n.props?.rx !== undefined)).toHaveLength(0);
    expect(fs.readFileSync('src/app/chat.tsx', 'utf8')).not.toMatch(/BrandTile|KbowlMark/);
  });
  it('FAB = 흰 바탕 + 주황 선 말풍선(채움 없음) + C.line 테두리 · 위험도 색·검정 아님 · 안읽음 점 흰 테두리 2.5', async () => {
    routeGets(page([]), { unreadCount: 1, lastOperatorMessage: { content: 'hi', createdAt: 'x' } });
    const r = await mount(<ChatFab activeRoute="index" />);
    const fab = flat(r, 'chat-fab');
    expect(fab).toMatchObject({ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, shadowOpacity: 0.07 });
    expect([C.riskSafe, C.riskCaution, C.riskDanger, C.riskUnable, C.primary, C.ink]).not.toContain(fab.backgroundColor);
    const icon = r.root.find((n) => n.props?.testID === 'chat-fab').findAll((n) => n.props?.stroke !== undefined);
    expect(icon.length).toBeGreaterThan(0);
    expect(icon[0].props).toMatchObject({ stroke: C.primary, fill: 'none' }); // 선만 주황
    expect(flat(r, 'chat-fab-dot')).toMatchObject({ borderWidth: 2.5, borderColor: C.surface });
  });
});

describe('③ 플로팅 버튼', () => {
  it('안읽음 = 빨간 점 + 마지막 운영진 미리보기 · 탭 = /chat', async () => {
    routeGets(page([]), { unreadCount: 2, lastOperatorMessage: { content: 'We replied to you', createdAt: 'x' } });
    const r = await mount(<ChatFab activeRoute="index" />);
    expect(mockGet).toHaveBeenCalledWith('/api/chat/unread', H);
    expect(has(r, 'chat-fab-dot')).toBe(true);
    expect(text(r)).toContain('We replied to you');
    await press(r, 'chat-fab-preview');
    expect(mockPush).toHaveBeenCalledWith('/chat');
  });
  it('안읽음 0 = 점·미리보기 없음', async () => {
    routeGets(page([]));
    const r = await mount(<ChatFab activeRoute="index" />);
    expect(has(r, 'chat-fab')).toBe(true);
    expect(has(r, 'chat-fab-dot')).toBe(false);
    expect(has(r, 'chat-fab-preview')).toBe(false);
  });
  it('11/6 운영 실기: 채팅 푸시 수신(invalidateChat) = 미리보기 즉시 새 메시지로', async () => {
    routeGets(page([]), { unreadCount: 1, lastOperatorMessage: { content: 'old one', createdAt: 'x' } });
    const r = await mount(<ChatFab activeRoute="index" />);
    expect(text(r)).toContain('old one');
    routeGets(page([]), { unreadCount: 2, lastOperatorMessage: { content: 'second message', createdAt: 'x' } });
    await act(async () => { invalidateChat(lastQc); });
    await settle();
    expect(text(r)).toContain('second message');
  });
  it('11/6: 백그라운드 = 안읽음 조회 멈춤 → 전경 복귀 때 1회 재조회', async () => {
    let onChange: (s: string) => void = () => {};
    const orig = AppState.addEventListener;
    (AppState as unknown as { addEventListener: unknown }).addEventListener = (_: string, cb: (s: string) => void) => { onChange = cb; return { remove: () => {} }; };
    try {
      routeGets(page([]), { unreadCount: 1, lastOperatorMessage: { content: 'before bg', createdAt: 'x' } });
      const r = await mount(<ChatFab activeRoute="index" />);
      lastQc.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: 60_000 } }); // 앱 queryClient 기본값 — 훅 staleTime 0이 이겨야 복귀 재조회
      const unreadCalls = () => mockGet.mock.calls.filter((c) => c[0] === '/api/chat/unread').length;
      const n0 = unreadCalls();
      await act(async () => { onChange('background'); });
      await settle();
      routeGets(page([]), { unreadCount: 2, lastOperatorMessage: { content: 'after fg', createdAt: 'x' } });
      await act(async () => { onChange('active'); });
      await settle();
      expect(unreadCalls()).toBe(n0 + 1);
      expect(text(r)).toContain('after fg');
    } finally {
      (AppState as unknown as { addEventListener: unknown }).addEventListener = orig;
    }
  });
  it('위치: 탭바 위 18 (전 탭 동일)', () => {
    expect(chatFabBottom(0)).toBe(TABBAR_CONTENT_H + 10 + 18);
    expect(chatFabBottom(34)).toBe(TABBAR_CONTENT_H + 34 + 18);
  });
  it('11/6 예진: 리뷰 탭(community) = 버튼·미리보기 0 · 안읽음 조회 0 / 홈·푸드·프로필 = 있음', async () => {
    routeGets(page([]), { unreadCount: 2, lastOperatorMessage: { content: 'hi', createdAt: 'x' } });
    const rv = await mount(<ChatFab activeRoute="community" />);
    expect(has(rv, 'chat-fab')).toBe(false);
    expect(has(rv, 'chat-fab-preview')).toBe(false);
    expect(mockGet).not.toHaveBeenCalledWith('/api/chat/unread', H);
    for (const route of ['index', 'food', 'profile']) {
      const r = await mount(<ChatFab activeRoute={route} />);
      expect(has(r, 'chat-fab')).toBe(true);
    }
  });
  it('탭 전환 반영 = 레이아웃 effect(페인트 전) — 일반 effect면 첫 프레임에 이전 탭 기준 버튼이 비친다', () => {
    expect(fs.readFileSync('src/app/(tabs)/_layout.tsx', 'utf8')).toContain('React.useLayoutEffect(() => onActive?.(activeRoute), [activeRoute, onActive]);');
  });
});

describe('④ 배선 잠금 · i18n', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  it('프로필 Contact us·광고 신고 → 채팅(플래그) · 홈 KB-986 생략 · 탭 레이아웃에 버튼', () => {
    const profile = read('src/app/(tabs)/profile.tsx');
    expect(profile.match(/FLAGS\.operatorChatEnabled \? '\/chat' : '\/profile\/feedback'/g)).toHaveLength(2);
    expect(profile.match(/FLAGS\.operatorChatEnabled \? '\/chat\?prefill=ad'/g)).toHaveLength(2);
    expect(read('src/app/(tabs)/index.tsx')).toContain("if (!FLAGS.operatorChatEnabled) modalQueue.add({ key: 'feedbackPrompt'");
    expect(read('src/app/(tabs)/_layout.tsx')).toContain('<ChatFab activeRoute={activeRoute} />');
  });
  it('chat 키 10로케일 전부 · 가운데 점·이모지 0', () => {
    const KEYS = ['title', 'team', 'repliesWithin', 'greeting', 'placeholder', 'send', 'sendFailed', 'rateLimited', 'failedTapRetry', 'earlierInquiries', 'tooLong', 'photoInvalid', 'invalid'];
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id']) {
      const chat = JSON.parse(read(`src/lib/i18n/${l}.json`)).chat as Record<string, string>;
      for (const k of KEYS) {
        expect(typeof chat[k]).toBe('string');
        expect(chat[k]).not.toMatch(/·|\p{Extended_Pictographic}/u);
      }
    }
  });
});
