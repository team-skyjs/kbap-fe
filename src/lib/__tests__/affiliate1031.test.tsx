/**
 * KB-1031 Amazon 제휴 링크 — 잠그는 것:
 *  ① 추적 ID가 비면 제휴 UI 0(컴포넌트 null · 목록 칸 0) ② 있으면 URL에 tag=<ID> + OS로 연다(인앱 브라우저·WebView 아님)
 *  ③ 열기 거부는 토스트(새지 않는다) ④ 고지 문구 동반 · 10개 로케일 키 누락 0 ⑤ 판정 띠 위·안에 없다(원문 순서) ⑥ 계측 2종
 */
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Linking } from 'react-native';
import { act, create } from 'react-test-renderer';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));
const mockInApp = jest.fn();
jest.mock('expo-web-browser', () => ({ openBrowserAsync: (...a: unknown[]) => mockInApp(...a) }));

// Btn은 reanimated를 끌고 온다 — 여기선 누름만 본다
jest.mock('@/components/Btn', () => {
  const { Text } = jest.requireActual('react-native');
  return { Btn: ({ children, onPress, testID }: { children: React.ReactNode; onPress: () => void; testID: string }) => <Text onPress={onPress} testID={testID}>{children}</Text> };
});
const mockSwitch = { on: true };
jest.mock('@/lib/affiliate', () => {
  process.env.EXPO_PUBLIC_AMAZON_TAG = 'kbap-test-20'; // 화면 부품이 읽는 모듈 = ID가 있는 실제 모듈(끄기는 mockSwitch)
  const actual = jest.requireActual('@/lib/affiliate');
  return { ...actual, affiliateEnabled: () => mockSwitch.on && actual.affiliateEnabled() };
});
// eslint-disable-next-line import/first
import { AffiliateCard, AffiliateItemCard } from '@/components/AffiliateCard';

const SRC = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];

type Mod = typeof import('../affiliate');
/** 추적 ID는 모듈 상수 — 값마다 lib 모듈을 새로 읽는다(실제 모듈) */
function load(tag: string | undefined): Mod {
  let out!: Mod;
  const prev = process.env.EXPO_PUBLIC_AMAZON_TAG;
  if (tag === undefined) delete process.env.EXPO_PUBLIC_AMAZON_TAG; else process.env.EXPO_PUBLIC_AMAZON_TAG = tag;
  jest.isolateModules(() => { out = jest.requireActual('../affiliate'); });
  if (prev === undefined) delete process.env.EXPO_PUBLIC_AMAZON_TAG; else process.env.EXPO_PUBLIC_AMAZON_TAG = prev;
  return out;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { mockSwitch.on = true; mockTrack.mockClear(); mockToast.mockClear(); mockInApp.mockClear(); });
afterEach(() => jest.restoreAllMocks());

describe('추적 ID가 비어 있으면 제휴 UI 0', () => {
  it.each([undefined, '', '   '])('tag=%p — 꺼짐 · 카드 null · 목록 칸 0 · 노출 계측 0', (tag) => {
    const a = load(tag);
    expect(a.affiliateEnabled()).toBe(false);
    const items = Array.from({ length: 20 }, (_, i) => ({ id: String(i) }));
    expect(a.withAffiliateCells(items, a.affiliateEnabled())).toBe(items);
  });
  it('꺼지면 카드 = null(래퍼·여백 0) · 노출 계측 0', () => {
    mockSwitch.on = false;
    let r!: ReturnType<typeof create>;
    act(() => { r = create(<><AffiliateCard placement="processed_detail" variant="button" query="Shin Ramyun" title="Buy" testID="a" /><AffiliateItemCard placement="home" variant="row" n={0} testID="b" /></>); });
    expect(r.toJSON()).toBeNull();
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

describe('추적 ID가 있으면', () => {
  it('URL = amazon.com 검색 + tag=<ID>, 검색어·ID 인코딩', () => {
    const a = load('kbap-test-20');
    expect(a.affiliateEnabled()).toBe(true);
    expect(a.amazonSearchUrl('Korean ramen')).toBe('https://www.amazon.com/s?k=Korean%20ramen&tag=kbap-test-20');
    expect(a.amazonSearchUrl(' Shin Ramyun & Cheese ')).toBe('https://www.amazon.com/s?k=Shin%20Ramyun%20%26%20Cheese&tag=kbap-test-20');
  });

  it('목록 = 8개마다 1칸(8개 미만 = 0칸), 키 겹침 0', () => {
    const a = load('kbap-test-20');
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), foodId: String(i) }));
    expect(a.withAffiliateCells(mk(7), true).filter(a.isAffiliateCell)).toHaveLength(0);
    const out = a.withAffiliateCells(mk(17), true);
    expect(out.map((x, i) => (a.isAffiliateCell(x) ? i : -1)).filter((i) => i >= 0)).toEqual([8, 17]);
    expect(new Set(out.map((x) => x.id)).size).toBe(out.length);
  });

  it.each(['button', 'link', 'row', 'cell'] as const)('%s — 고지 문구 동반 · 노출 1회 · 누르면 OS로 연다(인앱 브라우저 0) + 클릭 계측', async (variant) => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    let r!: ReturnType<typeof create>;
    act(() => { r = create(<AffiliateCard placement="scan_result" variant={variant} query="Bibimbap kit" title="Find Bibimbap kits on Amazon" testID="aff" />); });
    expect(r.root.findByProps({ testID: 'aff-disclosure' }).props.children).toBe('As an Amazon Associate, K-Bap earns from qualifying purchases.');
    // Q-434: 고지·제목 = 한글 어절 단위 줄바꿈(낱말 중간에서 끊기지 않게)
    const texts = r.root.findAll((n) => typeof n.type === 'string' && 'lineBreakStrategyIOS' in n.props);
    expect(texts.map((n) => n.props.lineBreakStrategyIOS)).toEqual(variant === 'button' ? ['hangul-word'] : ['hangul-word', 'hangul-word']);
    expect(mockTrack.mock.calls).toEqual([['affiliate_impression', { placement: 'scan_result', query: 'Bibimbap kit' }]]);
    const target = variant === 'button' || variant === 'link' ? 'aff-open' : 'aff';
    act(() => { r.root.findAllByProps({ testID: target }).find((n) => typeof n.props.onPress === 'function')!.props.onPress(); });
    await flush();
    expect(open).toHaveBeenCalledWith('https://www.amazon.com/s?k=Bibimbap%20kit&tag=kbap-test-20');
    expect(mockInApp).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenLastCalledWith('affiliate_click', { placement: 'scan_result', query: 'Bibimbap kit' });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('열기 거부 = 토스트(unhandled rejection 0)', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('Unable to open URL'));
    const a = load('kbap-test-20');
    await expect(a.openAmazon('home', 'kimchi')).resolves.toBe(false);
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('고정 검색어 카드 = 목록의 n번째(넘치면 돈다) · 표시 문구는 i18n', () => {
    const a = load('kbap-test-20');
    expect(a.affiliateItemAt(a.AFFILIATE_ITEMS.length + 1)).toBe(a.AFFILIATE_ITEMS[1]);
    let r!: ReturnType<typeof create>;
    act(() => { r = create(<AffiliateItemCard placement="scan_loading" variant="row" n={0} testID="c" />); });
    expect(JSON.stringify(r.toJSON())).toContain('Shop Korean ramen on Amazon');
    expect(mockTrack).toHaveBeenCalledWith('affiliate_impression', { placement: 'scan_loading', query: 'Korean ramen' });
  });
});

describe('문구 — 10개 로케일', () => {
  const en = JSON.parse(read('lib/i18n/en.json')).affiliate as Record<string, unknown>;
  const flat = (o: Record<string, unknown>, pre = ''): Record<string, string> =>
    Object.entries(o).reduce((acc, [k, v]) => (typeof v === 'string' ? { ...acc, [pre + k]: v } : { ...acc, ...flat(v as Record<string, unknown>, `${pre}${k}.`) }), {});
  it.each(LOCALES)('%s — 키 누락 0 · 빈 값 0 · 가운데 점 0 · 자리표시자 유지 · "Amazon" 글자', (l) => {
    const loc = flat(JSON.parse(read(`lib/i18n/${l}.json`)).affiliate);
    expect(Object.keys(loc).sort()).toEqual(Object.keys(flat(en)).sort());
    for (const v of Object.values(loc)) { expect(v.trim()).not.toBe(''); expect(v).not.toContain('·'); }
    expect(loc.findKits).toContain('{{food}}');
    expect(loc.shop).toContain('{{item}}');
    for (const k of ['disclosure', 'buy', 'findKits', 'shop']) expect(loc[k]).toContain('Amazon');
  });
  it('고정 검색어마다 표시 문구 키가 있다', () => {
    const a = load('x');
    expect(a.AFFILIATE_ITEMS.map((i) => i.key).sort()).toEqual(Object.keys(en.items as object).sort());
  });
});

describe('자리 — 판정 영역 위·안에 없다(원문 순서 잠금)', () => {
  it('가공식품 상세: 판정 띠·이름 뒤, 조리법 앞', () => {
    const s = read('app/processed-foods/[id].tsx');
    const at = s.indexOf('<AffiliateCard placement="processed_detail"');
    expect(at).toBeGreaterThan(s.lastIndexOf('<PackagedVerdictBand'));
    expect(at).toBeGreaterThan(s.lastIndexOf('<PackagedUnableBand'));
    expect(at).toBeGreaterThan(s.indexOf('testID="pf-name"'));
    expect(at).toBeLessThan(s.indexOf('<RecipeSection'));
  });
  it('음식 상세(스캔 진입만): 판정 띠·재료 뒤, 리뷰 앞', () => {
    const s = read('app/food/[id]/index.tsx');
    const at = s.indexOf('{scanEntry && <AffiliateCard placement="scan_result"');
    expect(at).toBeGreaterThan(s.indexOf('testID="detail-verdict"'));
    expect(at).toBeGreaterThan(s.indexOf("t('detail.dataDisclaimer')"));
    expect(at).toBeLessThan(s.indexOf('testID="review-empty-cta"'));
  });
  it('가공식품 목록 칸 = 옆 ProductCard와 같은 아래 간격(card.root) — Q-434: 다음 줄과 붙음', () => {
    expect(read('features/processedFood/PackagedExplorer.tsx')).toContain('variant="cell" n={affiliateStart + item.n} style={[card.root, { flex: 0, width: cardW }]}');
  });
  it('판정 부품·스캔 결과 목록에는 제휴 코드가 없다', () => {
    for (const p of ['components/VerdictBand.tsx', 'features/processedFood/PackagedVerdict.tsx']) expect(read(p)).not.toMatch(/affiliate/i);
  });
  it('스캔 대기: 카드는 캡션 아래 · 닫기·진행에 조건을 걸지 않는다', () => {
    const s = read('features/scan/ScanLoading.tsx');
    expect(s.indexOf('<AffiliateItemCard placement="scan_loading"')).toBeGreaterThan(s.indexOf('{caption}</Text>'));
    expect(s).not.toMatch(/affiliateEnabled|openAmazon/); // 화면 로직은 제휴 상태를 모른다 — 카드가 스스로 숨는다
  });
  it('아마존을 여는 길은 openAmazon 하나 — 인앱 브라우저(openWebPage)로 열지 않는다', () => {
    expect(read('lib/affiliate.ts')).toContain('return openStoreLink(amazonSearchUrl(query));');
    expect(read('components/AffiliateCard.tsx')).not.toMatch(/openWebPage|WebView|WebBrowser/);
  });
});
