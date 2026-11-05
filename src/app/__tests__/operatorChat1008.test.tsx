/**
 * KB-1008(P-614) 운영진 1:1 채팅 — S-971 계약 v0 스텁.
 * ① 어댑터(역할·커서·안읽음) · 행 조립(지난 문의 구분선) · 시간 · 푸시 딥링크
 * ② 화면: 버전 헤더 · 빈 방 = 기본 인사 · 운영진 메시지 있으면 인사 없음 · 읽음 = 최신 id · 보내기 · 429 CHAT-001 전용 안내 + 실패 말풍선 탭 재전송 · 광고 신고 프리필(자동 전송 0)
 * ③ 플로팅 버튼: 안읽음 점·미리보기 · 커뮤니티 들어 올림
 * ④ 배선 잠금(프로필 Contact us·광고 신고 · KB-986 생략 · 탭 레이아웃) · i18n 10로케일
 */
import * as React from 'react';
import * as fs from 'fs';
import { TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// jest.mock은 babel-jest가 import 위로 올린다 — 목이 먼저 걸린다
import ChatScreen, { chatRows, chatTime } from '@/app/chat';
import { ChatFab, chatFabBottom } from '@/features/chat/ChatFab';
import { adaptChatMessage, adaptChatPage, adaptChatUnread } from '@/lib/api/chatAdapter';
import { routeForNotificationData } from '@/lib/push/pushAdapter';
import { TABBAR_CONTENT_H } from '@/components/TabBar';

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
let mockQuery: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockQuery,
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
async function mount(el: React.ReactElement): Promise<ReactTestRenderer> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
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
  it('행 = 최신 → 과거(보내는 중 맨 아래) · 지난 문의가 시작되는 경계에 구분선 1개', () => {
    const items = [msg(5, 'OPERATOR', 'new'), msg(4, 'USER', 'q'), msg(3, 'OPERATOR', 'old reply', true), msg(2, 'USER', 'old q', true)].map(adaptChatMessage);
    const rows = chatRows([{ localId: 'L', content: 'sending', photos: [], failed: false }], items);
    expect(rows.map((r) => (r.kind === 'msg' ? r.m.id : r.kind))).toEqual(['out', '5', '4', 'legacyDivider', '3', '2']);
    expect(chatRows([], items.slice(2)).some((r) => r.kind === 'legacyDivider')).toBe(false); // 전부 지난 문의 = 구분선 없음
  });
  it('시간: 같은 날 HH:mm · 다른 날 M/D HH:mm · 이상값 빈 문자열', () => {
    const now = new Date(2026, 10, 5, 15, 0);
    expect(chatTime(new Date(2026, 10, 5, 9, 7).toISOString(), now)).toBe('09:07');
    expect(chatTime(new Date(2026, 10, 3, 21, 30).toISOString(), now)).toBe('11/3 21:30');
    expect(chatTime('nope', now)).toBe('');
  });
  it('푸시 OPERATOR_CHAT → /chat', () => {
    expect(routeForNotificationData({ type: 'OPERATOR_CHAT', conversationId: 7 })).toBe('/chat');
  });
});

describe('② 채팅 화면', () => {
  it('빈 방 = 기본 인사 + 팀 줄 · 조회 = 버전 헤더 1.0 · limit 30', async () => {
    routeGets(page([]));
    const r = await mount(<ChatScreen />);
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
    const r = await mount(<ChatScreen />);
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
    const r = await mount(<ChatScreen />);
    await act(async () => { input(r).props.onChangeText('  hi there  '); });
    await press(r, 'chat-send');
    expect(mockPost).toHaveBeenCalledWith('/api/chat/messages', { content: 'hi there' }, H);
    expect(has(r, 'chat-out-sending')).toBe(false);
    expect(input(r).props.value).toBe('');
  });
  it('429 CHAT-001 = 전용 안내(서버 문구 0) + 실패 말풍선 → 탭 = 다시 보내기', async () => {
    routeGets(page([]));
    mockPost.mockRejectedValueOnce(Object.assign(new Error('server says no'), { code: 'CHAT-001' }));
    const r = await mount(<ChatScreen />);
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
    const r = await mount(<ChatScreen />);
    const btn = () => r.root.findAll((n) => n.props?.testID === 'chat-send' && n.props.style !== undefined)[0];
    const off = JSON.stringify(btn().props.style);
    expect(btn().props.disabled).toBe(true);
    await act(async () => { input(r).props.onChangeText('x'); });
    expect(btn().props.disabled).toBe(false);
    expect(JSON.stringify(btn().props.style).replace(/"backgroundColor":"[^"]+"/, '')).toBe(off.replace(/"backgroundColor":"[^"]+"/, ''));
  });
  it('광고 신고(?prefill=ad) = 입력창만 채움 · 자동 전송 0', async () => {
    mockQuery = { prefill: 'ad' };
    routeGets(page([]));
    const r = await mount(<ChatScreen />);
    expect(input(r).props.value).toBe('ads.reportPrefill');
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/chat/messages')).toHaveLength(0);
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
  it('위치: 탭바 위 18 · 커뮤니티 = Write review 알약(최대 40) + 12 더 위', () => {
    const base = TABBAR_CONTENT_H + 10 + 18;
    expect(chatFabBottom(0, 'index')).toBe(base);
    expect(chatFabBottom(0, 'profile')).toBe(base);
    expect(chatFabBottom(0, 'community')).toBe(base + 52);
    expect(chatFabBottom(34, 'index')).toBe(TABBAR_CONTENT_H + 34 + 18);
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
    const KEYS = ['title', 'team', 'repliesWithin', 'greeting', 'placeholder', 'send', 'sendFailed', 'rateLimited', 'failedTapRetry', 'earlierInquiries'];
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id']) {
      const chat = JSON.parse(read(`src/lib/i18n/${l}.json`)).chat as Record<string, string>;
      for (const k of KEYS) {
        expect(typeof chat[k]).toBe('string');
        expect(chat[k]).not.toMatch(/·|\p{Extended_Pictographic}/u);
      }
    }
  });
});
