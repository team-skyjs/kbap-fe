/**
 * KB-1014(예진 11/6): 대표 편의점 음식이 연결된 스캔 행 = 사진만 누끼. 가격·용량(옵션)·이름·판정은 메뉴판 스캔 값 그대로 —
 * 연결 유무로 행 텍스트가 한 글자도 바뀌지 않는다(편의점 음식 가격·용량·이름 미사용).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ScanRichList } from '@/features/scan/ScanRichList';
import type { ResultDish } from '@/lib/scan/segmentMenu';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), usePathname: () => '/', useLocalSearchParams: () => ({}) }));
jest.mock('react-native-reanimated', () => {
  const { View: V } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    useReducedMotion: () => false,
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
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en', regionCode: 'US' }] }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k },
}));
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => ({ data: undefined }) }));


const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${Object.values(o).join('|')}` : k);
const BOX = { x: 0, y: 0, width: 0.1, height: 0.1 };
const COLA: ResultDish = {
  itemId: 0, rawMenuName: '콜라', box: BOX, priceKrw: 2000, latin: null, risk: 'caution', matched: true, foodId: '9',
  displayName: 'Cola', koreanName: '콜라', imageUrl: 'https://cdn/food/cola.jpg', spice: 0,
};
const OPTS: ResultDish = { ...COLA, itemId: 1, priceKrw: null, priceOptions: [{ label: '500ml', priceKrw: 2000 }, { label: '1.5L', priceKrw: 3500 }] };
const LINK = { id: '2866', name: 'Coca-Cola Zero 1.5L', nameKo: '코카-콜라 제로 1.5L', imageUrl: 'https://cdn/pf/2866-cut.webp' };

function render(dishes: ResultDish[]): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ScanRichList dishes={dishes} currency="USD" cart={new Map()} onAdd={() => {}} onRemove={() => {}} onOpen={() => {}} onClosestMatch={jest.fn()} t={t} />);
  });
  return tree;
}
/** 행에 보이는 글자 전부(사진 prop 제외) */
type J = { children?: (J | string)[] | null } | string | null;
const leaves = (n: J | J[]): string[] => (Array.isArray(n) ? n.flatMap(leaves) : n == null ? [] : typeof n === 'string' ? [n] : leaves((n.children ?? []) as J[]));
const texts = (tr: ReactTestRenderer) => leaves(tr.toJSON() as J | J[]);
const photos = (tr: ReactTestRenderer) => tr.root.findAll((n) => 'cutoutUri' in (n.props ?? {})).map((n) => ({ uri: n.props.uri, cutout: n.props.cutoutUri ?? null }));

it('가격·용량(옵션)·이름 = 메뉴판 스캔 값 그대로 — 연결 유무로 행 글자 불변, 편의점 음식 이름·용량 0', () => {
  const plain = render([COLA, OPTS]);
  const linked = render([{ ...COLA, linked: LINK }, { ...OPTS, linked: LINK }]);
  expect(texts(linked)).toEqual(texts(plain));
  const all = texts(linked).join('\n');
  expect(all).not.toMatch(/Coca-Cola|코카-콜라/); // 상품 이름 0
  expect(all).not.toContain('1.5L Coca'); // 상품 용량 0
  expect(all).toContain('500ml'); // 메뉴판 옵션 그대로
  expect(all).toContain('Cola');
  expect(all).toContain('₩2,000'); // 메뉴판 가격 그대로
  expect(all).toContain('₩3,500');
});

it('바뀌는 건 사진뿐 — 연결 = 누끼(cutoutUri) + 음식 사진 폴백 그대로 · 연결 없음 = 누끼 0', () => {
  expect(photos(render([COLA]))).toEqual([{ uri: 'https://cdn/food/cola.jpg', cutout: null }]);
  expect(photos(render([{ ...COLA, linked: LINK }]))).toEqual([{ uri: 'https://cdn/food/cola.jpg', cutout: LINK.imageUrl }]);
});

it('스캔 행 소스: linked는 imageUrl만 읽는다(이름·가격·nameKo 미사용)', () => {
  const src = (jest.requireActual('fs') as typeof import('fs')).readFileSync('src/features/scan/ScanRichList.tsx', 'utf8');
  expect(src.match(/linked\?\.\w+/g)).toEqual(['linked?.imageUrl']);
});
