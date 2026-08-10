/**
 * P-136 유닛(발주 11): 리치 리스트 행 구성·담기 전환·필 카운트 동기 +
 * 주문 카드 문구 = 기존 orderCard.ts 조립 잠금(신규 한국어 0).
 */
import * as React from 'react';
import { View } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View: V } = require('react-native');
  return {
    __esModule: true,
    default: { View: V, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    useAnimatedScrollHandler: () => () => {},
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en', regionCode: 'US' }] }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k },
}));
const mockDetail = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: (id: string) => mockDetail(id) }));

import { ScanRichList, OrderPill } from '@/features/scan/ScanRichList';
import { FlippedOrderCard } from '@/features/order/FlippedOrderCard';
import { orderSentenceKo, avoidSentenceKo } from '@/lib/order/orderCard';
import type { ResultDish } from '@/lib/scan/segmentMenu';

const t = (k: string) => k;
const BOX = { x: 0, y: 0, width: 0.1, height: 0.1 };
const DISHES: ResultDish[] = [
  { itemId: 0, rawMenuName: '된장찌개', box: BOX, priceKrw: 9000, latin: null, risk: 'caution', matched: true, foodId: '1', displayName: 'Doenjang Jjigae', koreanName: '된장찌개' },
  { itemId: 1, rawMenuName: '수제비', box: BOX, priceKrw: null, latin: null, risk: 'unable', matched: false, foodId: null, displayName: '수제비', koreanName: null },
];

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON());
const byId = (tree: ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function');

/** scan.tsx의 카트 배선 축약 재현 — 리스트·필이 한 상태 공유(카운트 동기) */
function Harness({ dishes }: { dishes: ResultDish[] }) {
  const [cart, setCart] = React.useState<Map<number, number>>(new Map());
  const bump = (id: number, d: number) =>
    setCart((prev) => {
      const m = new Map(prev);
      const q = Math.max(0, (m.get(id) ?? 0) + d);
      if (q === 0) m.delete(id);
      else m.set(id, q);
      return m;
    });
  const count = Array.from(cart.values()).reduce((a, b) => a + b, 0);
  return (
    <View>
      <ScanRichList
        dishes={dishes}
        avoidNames={['Egg']}
        currency="USD"
        cart={cart}
        onAdd={(d) => bump(d.itemId, 1)}
        onRemove={(d) => bump(d.itemId, -1)}
        onOpen={() => {}}
        onEditProfile={() => {}}
        t={t}
      />
      <OrderPill count={count} onPress={() => {}} t={t} bottom={0} />
    </View>
  );
}

beforeEach(() => {
  mockDetail.mockReturnValue({
    data: {
      foodId: '1',
      description: 'Fermented soybean stew',
      photoUrl: 'https://cdn/x.jpg',
      ingredients: [
        { code: 'SOYBEAN', name: 'Soybean', percentage: null, risk: 'danger', note: null },
        { code: 'SHRIMP', name: 'Shrimp', percentage: null, risk: 'caution', note: null },
        { code: 'ONION', name: 'Onion', percentage: null, risk: 'safe', note: null },
      ],
    },
  });
});

it('행 구성 — 경고 칩 = 기피 성분만(safe 제외) flex-wrap, 미매칭 = 무썸네일·무안내문·담기 가능', () => {
  const tree = render(<Harness dishes={DISHES} />);
  // 매칭 행: danger/caution 성분만 칩으로 (safe Onion 제외)
  const warn = tree.root.findAll((n) => n.props?.testID === 'warn-0');
  expect(warn.length).toBeGreaterThanOrEqual(1);
  const s = flat(tree);
  expect(s).toContain('Soybean');
  expect(s).toContain('Shrimp');
  expect(s).not.toContain('Onion');
  expect(JSON.stringify(warn[0].props.style ?? '')).toContain('"flexWrap":"wrap"');
  // 이중 통화 — ₩9,000 + 고정 테이블 환산 존재
  expect(s).toContain('₩9,000');
  // P-138 ③: 미매칭 행 = 무썸네일 + 행 내 안내문 0 + [+] 담기 가능(P-045 실명 주문)
  expect(s).not.toContain('scan.notInDb');
  const imgs = tree.root.findAll((n) => n.props?.source?.uri === 'https://cdn/x.jpg');
  expect(imgs.length).toBeGreaterThanOrEqual(1); // 매칭 행만
  expect(byId(tree, 'add-1').length).toBeGreaterThanOrEqual(1);
  // P-138 ④: 카테고리 헤더 미렌더(플랫 리스트)
  expect(s).not.toContain('scan.showList');
});

it('P-138 ①: [+]↔스테퍼 = 같은 고정 풋프린트 슬롯 — 담기 탭에도 프레임 불변·틴트 없음', () => {
  const tree = render(<Harness dishes={DISHES} />);
  const slotStyle = () => JSON.stringify(tree.root.findAll((n) => n.props?.testID === 'slot-0')[0].props.style);
  const before = slotStyle();
  act(() => byId(tree, 'add-0')[0].props.onPress());
  expect(slotStyle()).toBe(before); // 슬롯 치수·스타일 동일 — 아무것도 안 밀림
  // 스테퍼도 슬롯과 같은 풋프린트(고정 폭)
  const stepper = tree.root.findAll((n) => n.props?.testID === 'stepper-0')[0];
  expect(JSON.stringify(stepper.props.style)).toContain(`"width":72`);
  // 담김 행 초록 틴트 제거 — 행 스타일에 배경 틴트 없음
  const row = tree.root.findAll((n) => n.props?.testID === 'rich-0')[0];
  expect(JSON.stringify(row.props.style ?? '')).not.toContain('backgroundColor');
});

it('담기 전환 + 필 카운트 동기 — [+]→스테퍼, 0으로 내리면 필 소멸 (미매칭 포함)', () => {
  const tree = render(<Harness dishes={DISHES} />);
  expect(byId(tree, 'order-pill').length).toBe(0); // 카트 0 → 필 없음
  act(() => byId(tree, 'add-0')[0].props.onPress());
  // [+] → 스테퍼 전환 + 필 등장(카운트 동기)
  expect(byId(tree, 'add-0').length).toBe(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'stepper-0').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'order-pill').length).toBeGreaterThanOrEqual(1);
  expect(flat(tree)).toContain('scan.viewOrder');
  // 미매칭 행도 담기 가능 — 카운트 합산
  act(() => byId(tree, 'add-1')[0].props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'stepper-1').length).toBeGreaterThanOrEqual(1);
  act(() => byId(tree, 'dec-1')[0].props.onPress());
  act(() => byId(tree, 'inc-0')[0].props.onPress());
  act(() => byId(tree, 'dec-0')[0].props.onPress());
  act(() => byId(tree, 'dec-0')[0].props.onPress());
  // 0 → 스테퍼 해제·필 소멸
  expect(byId(tree, 'add-0').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'order-pill').length).toBe(0);
});

it('P-138 ⑦: 환산 병기 — KRW 계정 = 생략(설계 정상), 타 통화 = 병기', () => {
  const usd = render(<Harness dishes={DISHES} />); // Harness currency=USD
  expect(flat(usd).replace(/","/g, '')).toContain('₩9,000 · $'); // 병기 렌더(children 배열 평탄화)
  const krwTree = render(
    <ScanRichList dishes={DISHES} avoidNames={[]} currency="KRW" cart={new Map()} onAdd={() => {}} onRemove={() => {}} onOpen={() => {}} onEditProfile={() => {}} t={t} />,
  );
  const s = flat(krwTree).replace(/","/g, '');
  expect(s).toContain('₩9,000');
  expect(s).not.toContain('₩9,000 · '); // KRW→KRW 병기 생략
});

it('주문 카드 문구 잠금 — 기존 orderCard.ts 조립 결과만, 시안 신규 한국어(알레르기 단정) 0', () => {
  const items = [
    { nameKo: '된장찌개', name: 'Doenjang Jjigae', qty: 2, priceKrw: 9000 },
    { nameKo: '공기밥', name: 'Rice', qty: 1, priceKrw: 1000 },
  ];
  const tree = render(
    <FlippedOrderCard items={items} avoidCodes={['EGG', 'SHRIMP']} avoidNames={['Egg', 'Shrimp']} currency="USD" onDone={() => {}} t={t} />,
  );
  const s = flat(tree);
  // 항목별 주문 줄 + 기피 고지 1회 = 기존 조립 함수 출력 그대로
  expect(s).toContain(orderSentenceKo('된장찌개', 2));
  expect(s).toContain(orderSentenceKo('공기밥', 1));
  expect(s).toContain(avoidSentenceKo(['EGG', 'SHRIMP'])!);
  expect(s).not.toContain('알레르기'); // 🚫 시안 문구("알레르기가 있습니다") 이식 금지
  // 뒤집힌 카드 + 정방향 미러 + 합계(₩19,000)
  expect(tree.root.findAll((n) => n.props?.testID === 'flip-card').length).toBeGreaterThanOrEqual(1);
  expect(s).toContain('order.mirrorTitle');
  expect(s.replace(/","/g, '')).toContain('2 × Doenjang Jjigae'); // children 배열 직렬화 평탄화
  expect(s).toContain('order.mirrorAvoid');
  expect(s).toContain('₩19,000');
});

it('P-149 ①: 주문 카드 = 전체 스크롤 컨테이너(항목 多 도달) + 확대 뷰도 스크롤·명시 닫기', () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ nameKo: `메뉴${i}`, name: `Menu${i}`, qty: 1, priceKrw: 1000 }));
  const tree = render(
    <FlippedOrderCard items={many} avoidCodes={[]} avoidNames={[]} currency="USD" onDone={() => {}} t={t} />,
  );
  // 본문 = ScrollView (14개여도 내역·미러·합계·Done 도달)
  expect(tree.root.findAll((n) => n.props?.testID === 'order-scroll').length).toBeGreaterThanOrEqual(1);
  const s2 = flat(tree);
  expect(s2).toContain('메뉴13'); // 마지막 항목 렌더
  expect(s2).toContain('order.done'); // Done 접근 가능(스크롤 끝)
  // 확대 열기 → 풀스크린도 스크롤 + 명시 닫기 버튼
  const zoomOpen = tree.root.findAll((n) => n.props?.testID === 'zoom-open' && typeof n.props?.onPress === 'function')[0];
  act(() => zoomOpen.props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'zoom-scroll').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'zoom-close' && typeof n.props?.onPress === 'function').length).toBeGreaterThanOrEqual(1);
});
