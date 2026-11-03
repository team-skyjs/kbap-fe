/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-776 프로필·설정 UX(QA-SWEEP 10/13 B2-4·B3-3·B3-4).
 * - 회피 재료 편집: 안내 = DS 정보 아이콘(빨간 위험 마크 ✕가 닫기로 오인) · "저장하면 반영" 문구 키 · 하단 Save busy(공용 제출 가드)
 *   · 미저장 뒤로 = 이탈 확인(편집 문구) · 저장 성공 = 막기 해제 후 뒤로.
 * - 법적 문서 화면: 온보딩 시트와 같은 LegalDocBody(구조 블록·표) — doc 파라미터별 문서.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v, get: () => v, set: () => {} }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withRepeat: (v: unknown) => v,
    withDelay: (_d: number, v: unknown) => v,
    cancelAnimation: () => {},
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
const mockNavDispatch = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: (a: unknown) => mockNavDispatch(a) }),
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
const mockPrevent: { on: boolean; cb: ((o: { data: { action: unknown } }) => void) | null } = { on: false, cb: null };
jest.mock('expo-router/build/react-navigation/core', () => ({
  usePreventRemove: (on: boolean, cb: (o: { data: { action: unknown } }) => void) => {
    mockPrevent.on = on;
    mockPrevent.cb = cb;
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/analytics', () => ({ EVENTS: {}, setUserProps: jest.fn(), track: jest.fn() }));
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({ name: (c: string) => `srv:${c}`, imageUrl: (c: string) => `https://cdn/${c.toLowerCase()}.webp` }),
}));
const mockMutate = jest.fn();
let mockCodes = ['EGG'];
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { restrictions: mockCodes.map((code) => ({ kind: 'allergy', code })) } }),
  useUpdateMe: () => ({ mutate: mockMutate }),
}));

let mockInset = 0;
jest.mock('@/lib/useBottomInset', () => ({ useBottomInset: () => mockInset })); // KB-900: 안드 3버튼 인셋 흉내
import EditRestrictions from '../profile/restrictions';
import LegalDocScreen from '../profile/legal';
import { Btn } from '@/components/Btn';
import { RiskMark } from '@/components/RiskMark';
import { IconInfo } from '@/components';

const trees: ReactTestRenderer[] = [];
async function render(el: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => {
  jest.clearAllMocks();
  mockInset = 0;
  mockCodes = ['EGG'];
  mockPrevent.on = false;
  mockPrevent.cb = null;
});
const press = async (tree: ReactTestRenderer, id: string) => {
  const n = tree.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function')[0];
  await act(async () => { n.props.onPress(); });
};

describe('회피 재료 편집', () => {
  it('KB-900(T-005): 하단 Save 바 아래 여백 = 인셋 + 10(3버튼 내비 48 → 58) — 고정 30이면 버튼이 내비 바 아래로 반쯤', async () => {
    mockInset = 48;
    const tree = await render(<EditRestrictions />);
    const bar = tree.root.findAll((n) => n.props?.testID === 'restrictions-savebar' && n.props?.style)[0];
    expect(StyleSheet.flatten(bar.props.style).paddingBottom).toBe(58);
  });
  it('B3-4: 안내 = DS 정보 아이콘(빨간 위험 마크 0) · 문구 키 유지(저장하면 반영으로 갱신) · 하단 Save = busy 배선', async () => {
    const tree = await render(<EditRestrictions />);
    const notice = tree.root.findAll((n) => n.props?.testID === 'restrictions-notice')[0];
    expect(notice.findAllByType(IconInfo)).toHaveLength(1);
    expect(notice.findAllByType(RiskMark)).toHaveLength(0);
    expect(tree.root.findAllByType(RiskMark).filter((r) => r.props.state === 'danger')).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('restrictionsEdit.notice');
    const save = tree.root.findAllByType(Btn).find((b) => b.props.testID === 'restrictions-save')!;
    expect(save.props.busy).toBe(false);
  });

  it('B3-4 문구: 10로케일 notice가 "즉시 반영"을 말하지 않고 저장을 가리킨다(en·ko 고정)', () => {
    const load = (l: string) => JSON.parse(jest.requireActual<typeof import('fs')>('fs').readFileSync(`src/lib/i18n/${l}.json`, 'utf8'));
    expect(load('en').restrictionsEdit.notice).toBe('All safety warnings use this list. Tap Save to apply your changes.');
    expect(load('ko').restrictionsEdit.notice).toBe('모든 안전 경고의 기준이 돼요. 바꾼 내용은 저장을 눌러야 반영돼요.');
    expect(load('en').restrictionsEdit.notice).not.toMatch(/right away/i);
    expect(load('ko').restrictionsEdit.notice).not.toContain('즉시');
  });

  it('B3-3: 무변경 = 막지 않음 · 타일 해제 = 막음 → 확인 창(편집 문구) · 다시 선택 = 해제', async () => {
    const tree = await render(<EditRestrictions />);
    expect(mockPrevent.on).toBe(false);
    await press(tree, 'avoid-EGG');
    expect(mockPrevent.on).toBe(true);
    await act(async () => { mockPrevent.cb?.({ data: { action: { type: 'GO_BACK' } } }); });
    const s = JSON.stringify(tree.toJSON());
    expect(s).toContain('common.leaveEditTitle');
    expect(s).toContain('common.keepEditing');
    await press(tree, 'discard-keep');
    await press(tree, 'avoid-EGG');
    expect(mockPrevent.on).toBe(false);
  });

  it('KB-843(서버 백필 #448 짝): 서버의 앱이 모르는 코드 = 화면에 안 그림(개수·타일 0) · 무변경 판정 제외 · 저장 때 그대로 보냄 · 전부 해제로도 지우지 않음', async () => {
    mockCodes = ['EGG', 'FUTURE_X'];
    mockMutate.mockImplementation((_b: unknown, o?: { onSuccess?: () => void; onSettled?: () => void }) => { o?.onSuccess?.(); o?.onSettled?.(); });
    const tree = await render(<EditRestrictions />);
    const filter = tree.root.findAll((n) => Array.isArray(n.props?.selected) && typeof n.props?.onToggle === 'function')[0];
    expect(filter.props.selected).toEqual(['EGG']); // 보이는 선택(개수 줄 = selected.length) = EGG 하나
    expect(tree.root.findAll((n) => n.props?.testID === 'avoid-FUTURE_X')).toHaveLength(0);
    expect(mockPrevent.on).toBe(false); // 숨은 코드가 "변경"으로 잡히지 않는다
    await press(tree, 'avoid-PEANUT');
    await press(tree, 'restrictions-save');
    const sent = (mockMutate.mock.calls[0][0] as { restrictions: { code: string }[] }).restrictions.map((r) => r.code);
    expect(sent).toEqual(['EGG', 'PEANUT', 'FUTURE_X']);
    const t2 = await render(<EditRestrictions />);
    await press(t2, 'avoid-clear');
    await press(t2, 'restrictions-save');
    expect((mockMutate.mock.calls[1][0] as { restrictions: { code: string }[] }).restrictions.map((r) => r.code)).toEqual(['FUTURE_X']);
  });

  it('B3-3: 저장 성공 = 막기를 먼저 풀고 다음 렌더에서 뒤로 1회(확인 창 0)', async () => {
    mockMutate.mockImplementation((_b: unknown, o?: { onSuccess?: () => void; onSettled?: () => void }) => { o?.onSuccess?.(); o?.onSettled?.(); });
    const tree = await render(<EditRestrictions />);
    await press(tree, 'avoid-EGG');
    expect(mockPrevent.on).toBe(true);
    await press(tree, 'restrictions-save');
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockPrevent.on).toBe(false);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(tree.root.findAll((n) => n.props?.testID === 'leave-confirm' && typeof n.type === 'string')).toHaveLength(0);
  });
});

describe('B2-4 법적 문서 화면', () => {
  const html = `<body><h1><a href="https://team-skyjs.github.io/kbap-legal/">kbap-legal</a></h1><h1>Privacy Policy</h1>
    <table><thead><tr><th>Category</th><th>Items</th></tr></thead><tbody><tr><td>Account</td><td>Login ID</td></tr></tbody></table></body>`;
  it('doc=privacy = 개인정보처리방침 URL · 구조 블록·표 · 사이트 제목 0 · 제목 = privacyPolicy', async () => {
    mockParams = { doc: 'privacy' };
    const f = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, text: async () => html } as unknown as Response);
    try {
      const tree = await render(<LegalDocScreen />);
      await act(async () => { await Promise.resolve(); });
      expect(f).toHaveBeenCalledWith(expect.stringContaining('privacy-policy.html'));
      const s = JSON.stringify(tree.toJSON());
      expect(s).toContain('onboarding.privacyPolicy');
      expect(s).toContain('Login ID');
      expect(s).not.toContain('"kbap-legal"');
      expect(tree.root.findAll((n) => n.props?.testID === 'legal-table' && typeof n.type === 'string')).toHaveLength(1);
    } finally { f.mockRestore(); }
  });

  it('doc 없음·모르는 값 = 약관 · 실패 = 재시도 → 재요청', async () => {
    mockParams = { doc: 'x' };
    const f = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 500, text: async () => '' } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '<p>Terms body</p>' } as unknown as Response);
    try {
      const tree = await render(<LegalDocScreen />);
      await act(async () => { await Promise.resolve(); });
      expect(f).toHaveBeenCalledWith(expect.stringContaining('terms-of-service.html'));
      expect(JSON.stringify(tree.toJSON())).toContain('onboarding.termsOfService');
      await press(tree, 'legal-retry');
      await act(async () => { await Promise.resolve(); });
      expect(f).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(tree.toJSON())).toContain('Terms body');
    } finally { f.mockRestore(); }
  });
});
