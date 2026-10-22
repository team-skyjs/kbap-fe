/**
 * KB-812 가공식품 1차 — 어댑터(https 승격·유형 매핑·labelSource·비회원 null) · 요청(3.2 헤더·빈 검색어 요청 0) ·
 * 상세 판정(labelSource 3문구 · Safe 배지 0 · 검출 0 = 회색 미확인 · 노란 행은 unmapped 있을 때만 · 회원 대조/비회원 로그인 줄)
 * · 출처 고지 3종 상시 · 404/410(캐시가 있어도 이긴다) · Food 탭 세그먼트(기본 Dishes·전환·유지) · 계측(검색어 원문 0).
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-reanimated', () => {
  const { View, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, FlatList: jest.requireActual('react-native').FlatList, createAnimatedComponent: (c: unknown) => c ?? Pressable },
    createAnimatedComponent: (c: unknown) => c,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    useAnimatedScrollHandler: () => () => {},
    useAnimatedProps: () => ({}),
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: (p: object) => <View {...p} /> }; });
jest.mock('@/components/RemoteImage', () => { const { View } = jest.requireActual('react-native'); return { RemoteImage: (p: { uri: string }) => <View testID={`img:${p.uri}`} /> }; });
jest.mock('@/components/SubHeader', () => { const { Text } = jest.requireActual('react-native'); return { SubHeader: (p: { title: string }) => <Text testID="subheader">{p.title}</Text> }; });
jest.mock('@/components/AuthGateSheet', () => { const { View } = jest.requireActual('react-native'); return { AuthGateSheet: (p: { open: boolean }) => (p.open ? <View testID="gate-open" /> : null) }; });
jest.mock('@/components/Btn', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return { Btn: (p: { testID: string; onPress?: () => void; children?: React.ReactNode }) => <Pressable testID={p.testID} onPress={p.onPress}><Text>{p.children}</Text></Pressable> };
});
jest.mock('@/components/RiskBadge', () => { const { View } = jest.requireActual('react-native'); return { RiskBadge: (p: { state: string }) => <View testID={`badge-${p.state}`} /> }; });
jest.mock('@/components/icons', () => ({ ...jest.requireActual('@/components/icons'), IconLock: () => null, IconCamera: () => null, IconTabFood: () => null, IconSearch: () => null, IconClose: () => null }));
jest.mock('@/lib/onboarding/data', () => ({ restrictionLabel: (c: string) => `L(${c})` }));
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, navigate: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => ({ id: '1711' }), useSegments: () => [], Redirect: () => null }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error { status?: number; code?: string; constructor(m: string, s?: number, c?: string) { super(m); this.status = s; this.code = c; } }
  return { api: { get: (...a: unknown[]) => mockGet(...a) }, ApiError: MockApiError };
});
let mockGuest = true;
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest }));
let mockMe: { id: string; restrictions: { code: string }[] } | undefined;
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: mockMe }) }));
type Q = { isPending: boolean; isError: boolean; data?: unknown; error?: unknown; refetch: jest.Mock };
let mockDetail: Q;
jest.mock('@/lib/data/useProcessedFoods', () => ({ ...jest.requireActual('@/lib/data/useProcessedFoods'), useProcessedDetail: () => mockDetail }));
// KB-812 2차: 리뷰 섹션은 자기 쿼리를 가진다 — 판정 화면 테스트에선 자리·전달값만(섹션 자체는 packagedReviews507)
const mockReviewsProps = jest.fn();
jest.mock('@/features/processedFood/PackagedReviews', () => {
  const { View } = jest.requireActual('react-native');
  return { PackagedReviews: (p: object) => { mockReviewsProps(p); return <View testID="pf-reviews-stub" />; } };
});

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { adaptProcessedDetail, adaptProcessedSummary, packagedTypeOf, toHttps, VERDICT_RISK, type DetailWire } from '@/lib/api/processedFoodAdapter';
import { fetchProcessedDetail, fetchProcessedSearch } from '@/lib/data/useProcessedFoods';
import { ProcessedFoodDetailScreen as Detail } from '@/app/processed-foods/[id]'; // KB-870: 기본 내보내기 = 채널 게이트 — 화면 자체를 직접 렌더
import { FoodSegmentRow, PackagedExplorer } from '../PackagedExplorer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FLAGS } from '@/lib/flags';
/* eslint-enable import/first */

// dev 1711 실응답(10/21 GET) 그대로 — INGREDIENTS_ONLY · 검출 4 · 비회원 avoidance null
const W1711: DetailWire = {
  id: 1711, productName: '우유식빵', maker: '롯데제과', foodType: '빵류', capacity: '420g',
  rawMaterials: '밀가루(밀:수입산),마가린(대두)[식물성유지(팜유:말레이시아산)],우유7.14%(원유:국산),계란,백설탕',
  allergens: '알수없음', labelSource: 'INGREDIENTS_ONLY',
  detections: [
    { code: 'WHEAT', source: 'RAW_MATERIALS', evidence: '밀가루' }, { code: 'SOY', source: 'RAW_MATERIALS', evidence: '대두' },
    { code: 'MILK', source: 'RAW_MATERIALS', evidence: '우유' }, { code: 'EGG', source: 'RAW_MATERIALS', evidence: '계란' },
  ],
  avoidance: null,
  source: { provider: 'HACCP', attributionKey: 'processedFood.source.haccp' },
  image: { url: 'http://www.haccp.or.kr/fresh/prdimg/2007/20070156181583/20070156181583-1.jpg', source: 'HACCP', attributionKey: 'processedFood.image.haccp' },
};

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); mockGuest = true; mockMe = undefined; jest.requireMock('@/lib/i18n').default.language = 'en'; });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const q = (over: Partial<Q>): Q => ({ isPending: false, isError: false, refetch: jest.fn(), ...over });
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
// FlatList(2열)는 ListHeader/Empty 엘리먼트 prop이 트리에 실려 순환 참조 — 엘리먼트 prop은 버리고 렌더 트리만(prodFlagSurfaces436 문법)
const REACT_EL = new Set<symbol>([Symbol.for('react.element'), Symbol.for('react.transitional.element')]);
/** TanStack 알림은 setTimeout(0) 배치라 CI(느린 러너)에선 한 틱 대기로 부족하다 — 조건이 설 때까지 실제 타이머로 기다린다(메모 tanstack-notify-settimeout, PR #336 CI) */
const until = async (cond: () => boolean, ticks = 50) => {
  for (let i = 0; i < ticks && !cond(); i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const text = (t: ReactTestRenderer) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(t.toJSON(), (_k, v: unknown) => {
    if (typeof v === 'object' && v !== null) {
      if (REACT_EL.has((v as { $$typeof?: symbol }).$$typeof as symbol)) return undefined;
      if (seen.has(v)) return undefined;
      seen.add(v);
    }
    return v;
  });
};

describe('어댑터·요청', () => {
  it('http 이미지 → https(iOS ATS·Android cleartext 차단 회피) · 빈 값 null', () => {
    expect(toHttps('http://www.haccp.or.kr/a.jpg')).toBe('https://www.haccp.or.kr/a.jpg');
    expect(toHttps('https://x/b.jpg')).toBe('https://x/b.jpg');
    expect(toHttps('  ')).toBeNull();
    expect(adaptProcessedSummary({ id: 1, productName: 'x', imageUrl: 'http://a/b.jpg' }).imageUrl).toBe('https://a/b.jpg');
    expect(adaptProcessedDetail(W1711).image?.url.startsWith('https://')).toBe(true);
  });
  it('유형: 서버 type(대문자 8종, KB-867) 우선 · 없거나 모르는 값 = 식품 유형 원문 매핑(4종) · 그 외 null', () => {
    expect(['라면', '유탕면류', '빵류', '떡류', '유음료', '혼합음료', '과자', '캔디류', '김치', null].map((f) => packagedTypeOf(f))).toEqual(['RAMEN', 'RAMEN', 'BREAD', 'BREAD', 'DRINKS', 'DRINKS', 'SNACKS', 'SNACKS', null, null]);
    expect(adaptProcessedSummary({ id: 1, productName: 'x', foodType: '과자', type: 'ICE_CREAM' }).type).toBe('ICE_CREAM');
    expect(adaptProcessedSummary({ id: 1, productName: 'x', foodType: '과자', type: 'WHATEVER' }).type).toBe('SNACKS');
  });
  it('상세: 비회원 avoidance null 그대로(빈 배열 아님) · INGREDIENTS_ONLY면 알레르기 원문("알수없음") 숨김 · unmapped 없으면 [] · 모르는 labelSource = NONE', () => {
    const d = adaptProcessedDetail(W1711);
    expect(d.avoidance).toBeNull();
    expect(d.allergens).toBeNull();
    expect('unmapped' in d).toBe(false); // 서버 폐기(#457) — 받지 않는다
    expect(d.detections.map((x) => x.code)).toEqual(['WHEAT', 'SOY', 'MILK', 'EGG']);
    expect(adaptProcessedDetail({ ...W1711, labelSource: 'WHATEVER' }).labelSource).toBe('NONE');
    expect(adaptProcessedDetail({ ...W1711, labelSource: 'DECLARED', allergens: '밀, 우유 함유' }).allergens).toBe('밀, 우유 함유');
  });
  it('요청 = /api/processed-foods + X-API-Version 3.2 · 검색어 인코딩·커서', async () => {
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null }).mockResolvedValueOnce(W1711);
    await fetchProcessedSearch('우유', '5');
    await fetchProcessedDetail('1711');
    expect(mockGet.mock.calls[0]).toEqual([`/api/processed-foods?query=${encodeURIComponent('우유')}&cursor=5&size=20`, { headers: { 'X-API-Version': '3.2' } }]);
    expect(mockGet.mock.calls[1]).toEqual(['/api/processed-foods/1711', { headers: { 'X-API-Version': '3.2' } }]);
  });
});

describe('상세 v4(시안 08~13·34~38·51·52)', () => {
  // dev 10201(바나나맛우유) 실응답 모양 — 비회원 majorAllergens [MILK] · 내용 불명 합성착향료
  const V4: DetailWire = {
    ...W1711, id: 10201, productName: 'Banana Flavored Milk', nameKo: '바나나맛우유', maker: 'Binggrae', type: 'DRINKS',
    verdict: null, avoidMatches: [], mayContainMatches: [], mayContain: [{ code: 'PEANUT', source: 'MAY_CONTAIN', evidence: '땅콩 혼입 가능' }],
    unclearIngredients: ['합성착향료'], majorAllergens: ['MILK'], rawMaterials: '원유,정제수,백설탕',
  };
  const detail = (over: Partial<DetailWire> = {}) => { mockDetail = q({ data: adaptProcessedDetail({ ...V4, ...over }) }); return render(<Detail />); };
  const member = () => { mockGuest = false; mockMe = { id: '41', restrictions: [{ code: 'MILK' }] }; };
  const press = (t: ReactTestRenderer, id: string) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === 'function')[0].props.onPress());

  it('비회원(12): 주요 알레르기 함유 + 혼입 가능 · 가입 유도 = 게이트 · 리본 0 · 원재료 미리보기 + See detail · 처음엔 접힘', () => {
    const t = detail();
    expect(ids(t)).toEqual(expect.arrayContaining(['pf-major', 'pf-major-contains', 'pf-major-may', 'pf-sign-in', 'pf-ingredients-preview', 'pf-see-detail']));
    expect(text(t)).toContain('packaged.containsNames:{\\"names\\":\\"L(MILK)\\"}');
    expect(text(t)).toContain('packaged.mayContainNames:{\\"names\\":\\"L(PEANUT)\\"}');
    expect(ids(t).some((i) => i.startsWith('badge-'))).toBe(false);
    expect(ids(t)).not.toContain('pf-expanded');
    press(t, 'pf-sign-in');
    expect(ids(t)).toContain('gate-open');
  });
  it('회피 0개 회원(13): 같은 화면 + "피하는 재료 설정" → 회피 설정 화면', () => {
    mockGuest = false; mockMe = { id: '41', restrictions: [] };
    const t = detail();
    expect(ids(t)).toContain('pf-set-avoid');
    press(t, 'pf-set-avoid');
    expect(mockPush).toHaveBeenCalledWith('/profile/restrictions');
  });
  it('Codex #338 P1: majorAllergens 필드 없음(구서버·부분 배포) = 모름 — 검출 코드를 함유로(보수) · 검출도 없으면 "확인할 수 없음"(표기 없음 0)', () => {
    const wire = { ...V4 } as Partial<DetailWire>;
    delete wire.majorAllergens;
    expect(adaptProcessedDetail(wire as DetailWire).majorAllergens).toBeNull();
    const withDet = detail({ majorAllergens: undefined });
    expect(text(withDet)).toContain('packaged.containsNames');
    expect(text(withDet)).not.toContain('packaged.majorNoneFound');
    const bare = detail({ majorAllergens: undefined, detections: [] });
    expect(text(bare)).toContain('packaged.majorUnavailable');
    expect(text(bare)).not.toContain('packaged.majorNoneFound');
  });
  it('Codex #338 P1: 리본은 회피 1개 이상 회원만 — 회피를 비운 직후(M0)·비회원은 옛 판정 캐시(SAFE)가 남아 있어도 리본 0', () => {
    mockGuest = false; mockMe = { id: '41', restrictions: [] };
    expect(ids(detail({ verdict: 'SAFE' })).some((i) => i.startsWith('badge-'))).toBe(false);
    mockGuest = true; mockMe = undefined;
    expect(ids(detail({ verdict: 'AVOID', avoidMatches: [{ code: 'MILK', evidence: [] }] })).some((i) => i.startsWith('badge-'))).toBe(false);
  });
  it('주요 알레르기 0개 = "없음" 단정 금지 — 판독 근거 없음(NONE) = 확인 불가 · 있으면 "찾지 못함"', () => {
    expect(text(detail({ majorAllergens: [], labelSource: 'NONE' }))).toContain('packaged.majorUnavailable');
    expect(text(detail({ majorAllergens: [] }))).toContain('packaged.majorNoneFound');
  });
  it('회원 SAFE(08): safe 리본 · 판정 문장 0 · 미리보기 + See detail → 제자리 펼침(Your avoid list·원재료·원문·출처) → See less + 계측(id만)', () => {
    member();
    const t = detail({ verdict: 'SAFE' });
    expect(ids(t)).toContain('badge-safe');
    expect(ids(t).some((i) => i.startsWith('pf-verdict-'))).toBe(false);
    press(t, 'pf-see-detail');
    expect(ids(t)).toEqual(expect.arrayContaining(['pf-expanded', 'pf-your-avoid', 'pf-ingredients', 'pf-raw', 'pf-source', 'pf-source-disclaimer', 'pf-see-less'])); // 번역 전 = 원재료 본문이 원문
    expect(ids(t)).not.toContain('pf-see-detail');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_detail_expand', { product_id: '10201', action: 'see_detail' });
    press(t, 'pf-see-less');
    expect(ids(t)).not.toContain('pf-expanded');
  });
  it('회원 AVOID(10)·CAUTION(11)·SAFE_WITH_NOTE(11b): 리본 + 판정 제목·문장(서버 matches) + Ingredients and source · 펼침엔 Your avoid list 0', () => {
    member();
    const a = detail({ verdict: 'AVOID', avoidMatches: [{ code: 'MILK', evidence: ['원유'] }] });
    expect(ids(a)).toEqual(expect.arrayContaining(['badge-danger', 'pf-verdict-avoid', 'pf-ingredients-source']));
    expect(text(a)).toContain('packaged.avoidMatchBody:{\\"names\\":\\"L(MILK)\\"}');
    press(a, 'pf-ingredients-source');
    expect(ids(a)).toContain('pf-expanded');
    expect(ids(a)).not.toContain('pf-your-avoid');
    const c = detail({ verdict: 'CAUTION', mayContainMatches: [{ code: 'PEANUT', evidence: ['같은 제조시설에서 땅콩을 사용'] }] });
    expect(ids(c)).toEqual(expect.arrayContaining(['badge-caution', 'pf-verdict-caution']));
    expect(text(c)).toContain('packaged.crossContactBody:{\\"names\\":\\"L(PEANUT)\\"}');
    const n = detail({ verdict: 'SAFE_WITH_NOTE' });
    expect(ids(n)).toEqual(expect.arrayContaining(['badge-safe', 'pf-verdict-safe_with_note']));
    expect(text(n)).toContain('packaged.unclearBody:{\\"items\\":\\"합성착향료\\"}');
  });
  it('회원인데 verdict null(원재료·표시 둘 다 없음) = 리본 없이 "확인 못 함"', () => {
    member();
    const t = detail({ verdict: null });
    expect(ids(t)).toContain('pf-not-verified');
    expect(ids(t).some((i) => i.startsWith('badge-'))).toBe(false);
  });
  it('QA AQ2: 번역 없음(#462 전) = 미리보기 원문 2줄 · 펼침 Ingredients 본문 = 원문(빈 제목 0) · "English translation"·별도 Korean original 0', () => {
    const t = detail({ ingredients: { translated: null, original: '감자,식물성유지,조미료' } });
    const prev = t.root.findAll((n) => n.props?.testID === 'pf-ingredients-preview' && typeof n.type === 'string')[0];
    expect(prev.findAll((n) => n.props?.numberOfLines === 2).length).toBeGreaterThan(0);
    press(t, 'pf-see-detail');
    const ing = t.root.findAll((n) => n.props?.testID === 'pf-ingredients' && typeof n.type === 'string')[0];
    expect(JSON.stringify(ing.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children))).toContain('감자,식물성유지,조미료');
    expect(text(t)).not.toContain('packaged.translationLabel');
    expect(ids(t)).not.toContain('pf-original');
    // 번역 있음 = 번역 1줄 + 원문 1줄(시안), 펼침 = 번역 + 별도 원문
    const w = detail({ ingredients: { translated: 'Potato, oil', original: '감자,식물성유지' } });
    const p2 = w.root.findAll((n) => n.props?.testID === 'pf-ingredients-preview' && typeof n.type === 'string')[0];
    expect(p2.findAll((n) => n.props?.numberOfLines === 2)).toHaveLength(0);
    press(w, 'pf-see-detail');
    expect(text(w)).toContain('packaged.translationLabel');
    expect(ids(w)).toContain('pf-original');
  });
  it('원재료: 번역(#462) 있으면 번역 + 원문 · 번역 전 = 원문만 · 한국어 사용자 = 번역 줄 생략', () => {
    const t = detail({ ingredients: { translated: 'Milk, water, sugar', original: '원유,정제수,백설탕' } });
    expect(text(t)).toContain('Milk, water, sugar');
    jest.requireMock('@/lib/i18n').default.language = 'ko';
    const k = detail({ ingredients: { translated: 'Milk, water, sugar', original: '원유,정제수,백설탕' } });
    expect(text(k)).not.toContain('Milk, water, sugar');
    expect(text(k)).toContain('원유,정제수,백설탕');
  });
  it('출처 = HACCP 두 줄 · C002(#455) = 품목제조보고 한 줄(사진 null = 유형 대체 그림)', () => {
    const h = detail();
    press(h, 'pf-see-detail');
    expect(text(h)).toContain('packaged.sourceData1');
    const c = detail({ source: { provider: 'C002', attributionKey: 'processedFood.source.c002' }, image: null, imageUrl: null });
    press(c, 'pf-see-detail');
    expect(ids(c)).toContain('pf-source-c002');
    expect(text(c)).not.toContain('packaged.sourceData1');
    expect(ids(c)).toContain('packaged-placeholder');
  });
  it('QA #338: 상세 사진 = 상세 전용 recyclingKey + 로드 전 투명(다른 제품 사진 비침 0) · 사진이 바뀌면 다시 마운트', () => {
    const src = fs.readFileSync('src/app/processed-foods/[id].tsx', 'utf8');
    expect(src).toContain('<RemoteImage key={d.imageUrl} uri={d.imageUrl} style={s.photoImage} contentFit="contain" recyclingKey={`pf-detail-${d.id}`} hideUntilLoaded />');
  });
  it('"Needs checking"(unmapped) 경로 0 · 성분표 직접 확인 버튼 0(결정 4) · 상세 진입 계측 1회', () => {
    const t = detail();
    expect(ids(t).some((i) => i.startsWith('pf-unmapped'))).toBe(false);
    expect(ids(t)).not.toContain('pf-label-scan');
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'food_packaged_detail_view')).toEqual([['food_packaged_detail_view', { product_id: '10201', label_source: 'INGREDIENTS_ONLY' }]]);
    const src = fs.readFileSync('src/app/processed-foods/[id].tsx', 'utf8');
    expect(src).not.toMatch(/needsChecking|unmappedBody/);
  });
  it('리뷰 섹션 = 펼침 아래 · 제품 id·서버 요약 · 롤백 스위치 off = 섹션째 없음', () => {
    detail({ reviewSummary: { overall: { average: 4.3, count: 3 }, taste: { average: 4.3, count: 3 }, spiciness: { average: 4.2, count: 2 }, sweetness: null } });
    expect(mockReviewsProps).toHaveBeenLastCalledWith(expect.objectContaining({ productId: '10201', summary: { overall: { average: 4.3, count: 3 }, taste: { average: 4.3, count: 3 }, spiciness: { average: 4.2, count: 2 }, sweetness: null } }));
    const live = FLAGS.reviewsLiveEnabled;
    (FLAGS as { reviewsLiveEnabled: boolean }).reviewsLiveEnabled = false;
    try { expect(ids(detail())).not.toContain('pf-reviews-stub'); } finally { (FLAGS as { reviewsLiveEnabled: boolean }).reviewsLiveEnabled = live; }
  });
  it('구 요약({count, avgRating}) = overall·taste 하나 · 맵기·당도 null · 0건 = 축 null', () => {
    expect(adaptProcessedDetail({ ...V4, reviewSummary: { count: 2, avgRating: 4.5 } }).reviewSummary).toEqual({ overall: { average: 4.5, count: 2 }, taste: { average: 4.5, count: 2 }, spiciness: null, sweetness: null });
    expect(adaptProcessedDetail({ ...V4, reviewSummary: { count: 0, avgRating: null } }).reviewSummary?.taste).toBeNull();
    expect(adaptProcessedDetail({ ...V4, reviewSummary: { overall: { average: 4, count: 5 }, spiciness: { average: 3, count: 0 } } }).reviewSummary?.spiciness).toBeNull();
  });
  it('mayContainMatches.evidence = 배열(#457) · 문자열이 와도 배열로', () => {
    const d = adaptProcessedDetail({ ...V4, mayContainMatches: [{ code: 'PEANUT', evidence: ['a', ' '] }, { code: 'SOY', evidence: 'b' }] });
    expect(d.mayContainMatches).toEqual([{ code: 'PEANUT', evidence: ['a'] }, { code: 'SOY', evidence: ['b'] }]);
  });
  it('410 = 생산종료 · 404 = 없음(공통 오류 화면 + 목록으로) — 캐시가 있어도 이긴다 · 503 = 공통 오류 + 다시 시도(시안 34·36·37)', () => {
    mockDetail = q({ data: adaptProcessedDetail(V4), isError: true, error: new ApiError('gone', 410, 'PFOOD-002') });
    const g = render(<Detail />);
    expect(ids(g)).toContain('pf-discontinued');
    expect(ids(g)).not.toContain('pf-detail');
    press(g, 'pf-discontinued-action');
    expect(mockBack).toHaveBeenCalled();
    mockDetail = q({ isError: true, error: new ApiError('x', 404, 'PFOOD-001') });
    expect(ids(render(<Detail />))).toContain('pf-gone');
    mockDetail = q({ isError: true, error: new ApiError('down', 503) });
    const e = render(<Detail />);
    expect(ids(e)).toEqual(expect.arrayContaining(['pf-error', 'query-error-block']));
  });
});

describe('Food 탭 세그먼트·목록', () => {
  it('세그먼트 = 두 탭(Dishes·Packaged) · 선택 상태 · 탭 = onChange', () => {
    const onChange = jest.fn();
    const t = render(<FoodSegmentRow value="dishes" onChange={onChange} />);
    const tab = (s: string) => t.root.findAll((n) => n.props?.testID === `food-segment-${s}` && typeof n.props?.onPress === 'function')[0];
    expect(tab('dishes').props.accessibilityState).toEqual({ selected: true });
    expect(tab('packaged').props.accessibilityState).toEqual({ selected: false });
    act(() => tab('packaged').props.onPress());
    expect(onChange).toHaveBeenCalledWith('packaged');
  });
  it('Food 탭 배선: 기본 Dishes · 선택 유지(모듈 상태) · Packaged = 가공식품 목록 · Dishes 화면은 그대로(세그먼트만 머리에)', () => {
    const src = fs.readFileSync('src/app/(tabs)/food.tsx', 'utf8');
    expect(src).toContain("let lastSegment: FoodSegment = 'dishes';");
    expect(src).toContain('useState<FoodSegment>(() => lastSegment)');
    expect(src).toContain("segRow && foodSegment === 'packaged' ? ("); // KB-870: 운영 채널 = 세그먼트째 없음
    expect(src).toContain('headTop={segRow ? <View style={styles.segGap}>{segRow}</View> : undefined}');
  });
  it('KB-865: 구서버(둘러보기 400) = 검색 안내 폴백(칩·제목 0) · 검색 → 결과 카드(https 사진) · 결과 0 = 빈 상태', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGet.mockRejectedValueOnce(new ApiError('query required', 400, 'FOOD-003'));
    const t = render(<QueryClientProvider client={qc}><PackagedExplorer top={null} /></QueryClientProvider>);
    await until(() => ids(t).includes('packaged-guide'));
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/api/processed-foods?size=20');
    expect(ids(t)).toContain('packaged-guide');
    expect(ids(t)).not.toContain('packaged-types');
    expect(text(t)).not.toContain('packaged.popularPicks');
    mockGet.mockResolvedValueOnce({ items: [{ id: 1711, productName: '우유식빵', maker: '롯데제과', foodType: '빵류', imageUrl: 'http://h/1.jpg' }], hasNext: false, nextCursor: null });
    const input = t.root.findAll((n) => n.props?.testID === 'packaged-search-input' && typeof n.props?.onChangeText === 'function')[0];
    act(() => input.props.onChangeText('우유'));
    await act(async () => { input.props.onSubmitEditing(); });
    await until(() => ids(t).includes('packaged-item-1711'));
    expect(ids(t)).toContain('packaged-item-1711');
    expect(ids(t)).toContain('img:https://h/1.jpg');
    expect(ids(t)).not.toContain('packaged-types'); // 구서버 = 검색 결과에도 칩 없음(type 무시 → 거른 척 방지)
    expect(text(t)).toContain('packaged.searchResults');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_search', { query_length: 2, result_count: 1 });
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    act(() => input.props.onChangeText('없는제품'));
    await act(async () => { input.props.onSubmitEditing(); });
    await until(() => ids(t).includes('packaged-empty'));
    expect(ids(t)).toContain('packaged-empty');
    // Codex #308 R2: 지우고 같은 검색어를 다시 제출해도 검색 1회로 센다(캐시 적중이어도)
    mockTrack.mockClear();
    act(() => t.root.findAll((n) => n.props?.testID === 'packaged-search-clear' && typeof n.props?.onPress === 'function')[0].props.onPress());
    act(() => input.props.onChangeText('우유'));
    await act(async () => { input.props.onSubmitEditing(); });
    await until(() => mockTrack.mock.calls.some((c) => c[0] === 'food_packaged_search'));
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'food_packaged_search')).toHaveLength(1);
  });
  it('Codex #308 P2: 다음 페이지 실패 = 안내 + 다시 시도 · 실패 중 자동 재요청 0', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGet.mockRejectedValueOnce(new ApiError('query required', 400));
    const t = render(<QueryClientProvider client={qc}><PackagedExplorer top={null} /></QueryClientProvider>);
    mockGet.mockResolvedValueOnce({ items: [{ id: 1, productName: 'a', imageUrl: null }], hasNext: true, nextCursor: '1' });
    const input = t.root.findAll((n) => n.props?.testID === 'packaged-search-input' && typeof n.props?.onChangeText === 'function')[0];
    act(() => input.props.onChangeText('우유'));
    await act(async () => { input.props.onSubmitEditing(); });
    await until(() => ids(t).includes('packaged-item-1'));
    mockGet.mockRejectedValueOnce(new ApiError('down', 503));
    const list = () => t.root.findAll((n) => n.props?.testID === 'packaged-list' && typeof n.props?.onEndReached === 'function')[0];
    await act(async () => { list().props.onEndReached(); });
    await until(() => ids(t).includes('packaged-more-retry'));
    expect(ids(t)).toContain('packaged-more-retry');
    const calls = mockGet.mock.calls.length;
    await act(async () => { list().props.onEndReached(); });
    expect(mockGet.mock.calls.length).toBe(calls); // 자동 재요청 없음
    mockGet.mockResolvedValueOnce({ items: [{ id: 2, productName: 'b', imageUrl: null }], hasNext: false, nextCursor: null });
    await act(async () => { t.root.findAll((n) => n.props?.testID === 'packaged-more-retry' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await until(() => ids(t).includes('packaged-item-2'));
    expect(ids(t)).toContain('packaged-item-2');
    expect(ids(t)).not.toContain('packaged-more-retry');
  });
  it('KB-865: 유형은 v4 확인 뒤에만 보낸다 · 칩도 v4일 때만 · 검색 계측에 검색어 원문 0', () => {
    const ex = fs.readFileSync('src/features/processedFood/PackagedExplorer.tsx', 'utf8');
    expect(ex).toContain('useProcessedSearch(query, { type: v4 ? type : null })');
    expect(ex).toContain('{v4 && (');
    expect(ex).toContain('track(EVENTS.food_packaged_search, { query_length: Array.from(term).length, result_count: items.length });');
  });
  it('10언어 문구 전부 · 가운데점 0 · 안전/없음 단정 0(en·ko)', () => {
    const en = JSON.parse(fs.readFileSync('src/lib/i18n/en.json', 'utf8')).packaged;
    const keys = Object.keys(en);
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
      const p = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).packaged;
      expect(Object.keys(p).sort()).toEqual([...keys].sort());
      expect(JSON.stringify(p)).not.toContain('·');
    }
    const ko = JSON.parse(fs.readFileSync('src/lib/i18n/ko.json', 'utf8')).packaged;
    expect(JSON.stringify(en)).not.toMatch(/\bsafe\b|no allergens/i);
    expect(JSON.stringify(ko)).not.toMatch(/안전해요|없어요\. 먹어도/);
  });
});

describe('KB-865 v4 목록(01·03·05·06·49)', () => {
  const V4 = (over: object[] = []) => ({
    items: [
      { id: 7, productName: 'Banana Flavored Milk', nameKo: '바나나맛우유', maker: 'Binggrae', foodType: '가공유', imageUrl: 'https://h/7.jpg', rating: { average: 4.7, count: 12 }, verdict: 'SAFE' },
      { id: 8, productName: 'Shrimp Crackers', nameKo: '새우깡', maker: 'Nongshim', foodType: '과자', imageUrl: null, rating: { average: 0, count: 0 }, verdict: 'AVOID' },
      { id: 9, productName: '새우깡', nameKo: '새우깡', maker: null, foodType: '과자', imageUrl: null, verdict: null },
      ...over,
    ],
    hasNext: false,
    nextCursor: null,
  });
  // TanStack 알림은 setTimeout(0) 배치 — 실패 전이는 두 틱 뒤에 보인다(메모 tanstack-notify-settimeout)
  const flush = () => act(async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0)); });
  beforeEach(() => mockGet.mockReset()); // 앞 스위트의 남은 mockResolvedValueOnce 큐 제거(clearAllMocks는 큐를 안 비운다)
  const mount = async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const t = render(<QueryClientProvider client={qc}><PackagedExplorer top={null} /></QueryClientProvider>);
    await flush();
    return t;
  };

  it('둘러보기 성공 = Popular picks · 유형 칩 · 카드(판정 리본·한국어명·평점) — 서버 필드가 없으면 그 줄만 숨김', async () => {
    mockGuest = false; mockMe = { id: '41', restrictions: [{ code: 'MILK' }] }; // 리본 = 회피 1개 이상 회원
    mockGet.mockResolvedValueOnce(V4());
    const t = await mount();
    expect(text(t)).toContain('packaged.popularPicks');
    expect(ids(t)).toEqual(expect.arrayContaining(['packaged-types', 'packaged-type-all', 'packaged-type-snacks', 'packaged-type-ramen', 'packaged-type-drinks', 'packaged-type-bread']));
    expect(ids(t).filter((i) => i.startsWith('badge-'))).toEqual(['badge-safe', 'badge-danger']); // verdict null(9) = 배지 0
    expect(text(t)).toContain('바나나맛우유');
    expect(text(t)).toContain('"4.7"'); // 음식 목록 카드 평점 줄 그대로(채운 별 + 평균 + (개수))
    expect(text(t)).toContain('"(","12",")"');
    expect(ids(t)).toContain('packaged-rating-7');
    expect(ids(t)).not.toContain('packaged-rating-8'); // 리뷰 0 = 평점 줄 숨김(0.0 (0) 금지)
    // 9: 한국어명 = 표시명 → 중복 줄 0 · 제조사 없음 → 줄 0
    const card9 = t.root.findAll((n) => n.props?.testID === 'packaged-item-9' && typeof n.type === 'string')[0];
    expect(JSON.stringify(card9.findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string').map((n) => n.props.children)).match(/새우깡/g)).toHaveLength(1);
  });

  it('칩 → type 파라미터로 다시 조회 + 계측(type만) · All = 파라미터 없음', async () => {
    mockGet.mockResolvedValueOnce(V4());
    const t = await mount();
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    const chip = (k: string) => t.root.findAll((n) => n.props?.testID === `packaged-type-${k}` && typeof n.props?.onPress === 'function')[0];
    await act(async () => { chip('snacks').props.onPress(); });
    await flush();
    expect(mockGet.mock.calls[1][0]).toBe('/api/processed-foods?type=SNACKS&size=20'); // KB-867: 대문자
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_type_select', { type: 'snacks' });
    expect(ids(t)).toContain('packaged-no-filter-match'); // 칩으로 0 = 시안 47
    await act(async () => { chip('all').props.onPress(); });
    expect(mockTrack).toHaveBeenLastCalledWith('food_packaged_type_select', { type: 'all' });
    expect(ids(t)).toContain('packaged-item-7'); // 캐시된 둘러보기로 복귀(추가 요청 0)
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('검색 + 칩 = query·type 함께 · 제목 Search results', async () => {
    mockGet.mockResolvedValueOnce(V4());
    const t = await mount();
    const chip = t.root.findAll((n) => n.props?.testID === 'packaged-type-drinks' && typeof n.props?.onPress === 'function')[0];
    mockGet.mockResolvedValueOnce(V4());
    await act(async () => { chip.props.onPress(); });
    await flush();
    mockGet.mockResolvedValueOnce(V4());
    const input = t.root.findAll((n) => n.props?.testID === 'packaged-search-input' && typeof n.props?.onChangeText === 'function')[0];
    act(() => input.props.onChangeText('바나나'));
    await act(async () => { input.props.onSubmitEditing(); });
    await flush();
    expect(mockGet.mock.calls[2][0]).toBe(`/api/processed-foods?query=${encodeURIComponent('바나나')}&type=DRINKS&size=20`);
    expect(text(t)).toContain('packaged.searchResults');
  });

  it('로딩 = 사진 자리 스켈레톤 2열 4장(스피너 중복 0) · 일시 오류(5xx) = 공통 오류 블록(검색 안내로 위장 금지)', async () => {
    let resolve!: (v: unknown) => void;
    mockGet.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const t = render(<QueryClientProvider client={qc}><PackagedExplorer top={null} /></QueryClientProvider>);
    expect(ids(t)).toContain('packaged-skeleton');
    expect(text(t)).toContain('packaged.popularPicks');
    await act(async () => { resolve({ items: [], hasNext: false, nextCursor: null }); });
    trees.splice(0).forEach((x) => act(() => x.unmount()));
    mockGet.mockRejectedValueOnce(new ApiError('down', 503));
    const t2 = await mount();
    expect(ids(t2)).not.toContain('packaged-guide');
    expect(ids(t2)).not.toContain('packaged-skeleton');
    expect(ids(t2)).toContain('query-error-block'); // 공통 오류 블록(다시 시도)
  });

  it('사진 로드 실패 = 유형 플레이스홀더로 폴백(공백 금지)', async () => {
    mockGet.mockResolvedValueOnce(V4());
    const t = await mount();
    const { ProductCard } = jest.requireActual('../PackagedExplorer') as typeof import('../PackagedExplorer');
    expect(ProductCard).toBeDefined();
    const card7 = t.root.findAll((n) => n.props?.testID === 'packaged-item-7' && typeof n.type === 'string')[0];
    expect(card7.findAll((n) => typeof n.type === 'string' && n.props?.testID === 'img:https://h/7.jpg').length).toBe(1);
    const img = t.root.findAll((n) => n.props?.uri === 'https://h/7.jpg' && typeof n.props?.onError === 'function')[0];
    act(() => img.props.onError());
    const after = t.root.findAll((n) => n.props?.testID === 'packaged-item-7' && typeof n.type === 'string')[0];
    expect(after.findAll((n) => n.props?.testID === 'packaged-placeholder').length).toBeGreaterThan(0);
  });

  it('시안 04: 검색 0 = 탭 안 빈 상태(검색창·칩 유지, 제목 0) · Change search = 비우고 둘러보기로 · 성분표 찍기 = 비회원 가입 게이트', async () => {
    mockGet.mockResolvedValueOnce(V4());
    const t = await mount();
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    const input = t.root.findAll((n) => n.props?.testID === 'packaged-search-input' && typeof n.props?.onChangeText === 'function')[0];
    act(() => input.props.onChangeText('쌀과자'));
    await act(async () => { input.props.onSubmitEditing(); });
    await flush();
    expect(ids(t)).toEqual(expect.arrayContaining(['packaged-empty', 'packaged-types', 'packaged-empty-change-search']));
    expect(text(t)).not.toContain('packaged.searchResults');
    // packagedLabelScan = 이 스위트 기본 false(dev 서버 채널 아님) → 성분표 버튼 0 · 본문도 성분표 언급 없는 문구
    expect(ids(t)).not.toContain('packaged-empty-scan-label');
    expect(text(t)).toContain('packaged.emptyBody');
    await act(async () => { t.root.findAll((n) => n.props?.testID === 'packaged-empty-change-search' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    expect(ids(t)).toContain('packaged-item-7'); // 캐시된 둘러보기
    expect(input.props.value ?? '').toBe('');
  });

  it('시안 04 + 성분표 플래그 켜짐: 버튼 = 비회원 가입 게이트(내비 0)', async () => {
    (FLAGS as { packagedLabelScan: boolean }).packagedLabelScan = true;
    try {
      mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
      const t = await mount();
      expect(text(t)).toContain('packaged.emptyBodyLabel');
      await act(async () => { t.root.findAll((n) => n.props?.testID === 'packaged-empty-scan-label' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
      expect(ids(t)).toContain('gate-open');
    } finally {
      (FLAGS as { packagedLabelScan: boolean }).packagedLabelScan = false;
    }
  });

  it('시안 47: 유형 칩으로 0 = "조건에 맞는 제품 없음" · Show all products = All로(유형 해제)', async () => {
    mockGet.mockResolvedValueOnce(V4());
    const t = await mount();
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    await act(async () => { t.root.findAll((n) => n.props?.testID === 'packaged-type-bread' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await flush();
    expect(ids(t)).toContain('packaged-no-filter-match');
    expect(text(t)).toContain('packaged.noFilterMatchTitle');
    await act(async () => { t.root.findAll((n) => n.props?.testID === 'packaged-empty-show-all' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    expect(ids(t)).toContain('packaged-item-7');
    expect(mockTrack).toHaveBeenLastCalledWith('food_packaged_type_select', { type: 'all' });
  });

  it('Codex #338 R3 P1: 판정 캐시 = 회피 코드 집합에 묶임 — 설정을 다른 목록으로 바꾸면 새로 받고, 받기 전엔 옛 판정(리본)을 그리지 않는다', async () => {
    mockGuest = false; mockMe = { id: '41', restrictions: [{ code: 'MILK' }] };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    mockGet.mockResolvedValueOnce(V4());
    const el = () => <QueryClientProvider client={qc}><PackagedExplorer top={null} /></QueryClientProvider>;
    const t = render(el());
    await flush();
    expect(ids(t)).toContain('badge-safe');
    let resolve!: (v: unknown) => void;
    mockGet.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    mockMe = { id: '41', restrictions: [{ code: 'PEANUT' }, { code: 'MILK' }] };
    act(() => t.update(el()));
    expect(mockGet).toHaveBeenCalledTimes(2); // 새 키 = 새 요청(캐시 적중 0)
    expect(ids(t).some((i) => i.startsWith('badge-'))).toBe(false); // 받기 전 = 옛 판정 0(스켈레톤)
    expect(ids(t)).toContain('packaged-skeleton');
    await act(async () => { resolve(V4()); });
    await flush();
    expect(ids(t)).toContain('badge-safe');
    const src = fs.readFileSync('src/lib/data/useProcessedFoods.ts', 'utf8');
    expect(src).toContain("queryKey: ['processedFoods', 'detail', id, verdictKey],"); // 상세도 같은 키
  });

  it('Codex #338 R4: 언어를 바꾸면(번역 언어) 새 키 = 새로 받는다 — 옛 언어 번역이 남지 않는다', async () => {
    mockGuest = false; mockMe = { id: '41', restrictions: [{ code: 'MILK' }] };
    const i18nMock = jest.requireMock('@/lib/i18n').default as { language: string };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    mockGet.mockResolvedValueOnce(V4());
    const el = () => <QueryClientProvider client={qc}><PackagedExplorer top={null} /></QueryClientProvider>;
    const t = render(el());
    await flush();
    mockGet.mockResolvedValueOnce(V4());
    i18nMock.language = 'ja';
    act(() => t.update(el()));
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('Codex #338 P1: 목록 리본도 회피 1개 이상 회원만 — 회피 0개·비회원은 응답에 verdict가 남아 있어도 리본 0', async () => {
    mockGuest = false; mockMe = { id: '41', restrictions: [] };
    mockGet.mockResolvedValueOnce(V4());
    const t = await mount();
    expect(ids(t).some((i) => i.startsWith('badge-'))).toBe(false);
  });

  it('Codex #336: SAFE_WITH_NOTE = safe 리본 + 스크린리더 단서(내용 불명) · 그냥 SAFE엔 단서 없음', async () => {
    mockGuest = false; mockMe = { id: '41', restrictions: [{ code: 'MILK' }] };
    mockGet.mockResolvedValueOnce(V4([{ id: 10, productName: 'Choco Pie', imageUrl: null, verdict: 'SAFE_WITH_NOTE' }]));
    const t = await mount();
    const label = (id: string) => t.root.findAll((n) => n.props?.testID === `packaged-item-${id}` && typeof n.type === 'string')[0].props.accessibilityLabel as string;
    expect(label('10')).toContain('risk.safe');
    expect(label('10')).toContain('packaged.unclearNoteA11y');
    expect(label('7')).not.toContain('packaged.unclearNoteA11y');
  });

  it('어댑터: 모르는 verdict = null(앱이 SAFE를 만들지 않음) · SAFE_WITH_NOTE = safe 리본 · 구서버(필드 없음) = 전부 null', () => {
    expect(adaptProcessedSummary({ id: 1, productName: 'x', verdict: 'SAFEISH' }).verdict).toBeNull();
    expect(adaptProcessedSummary({ id: 1, productName: 'x', verdict: 'SAFE_WITH_NOTE' }).verdict).toBe('SAFE_WITH_NOTE');
    expect(VERDICT_RISK.SAFE_WITH_NOTE).toBe('safe');
    expect(VERDICT_RISK.CAUTION).toBe('caution');
    const legacy = adaptProcessedSummary({ id: 1, productName: 'x' });
    expect([legacy.verdict, legacy.nameKo, legacy.rating]).toEqual([null, null, null]);
    expect(adaptProcessedSummary({ id: 1, productName: 'x', rating: { average: 4, count: null } }).rating).toBeNull();
  });
});
