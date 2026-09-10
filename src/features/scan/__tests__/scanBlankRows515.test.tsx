/**
 * KB-515 후속(9/10 실기 공백 행) — **실응답 픽스처**(dev 스캔 v2, 110건 = matched 20 ·
 * unmatched 90, 전부 idx 없음 → photoOnly 경로) 재현: JS 렌더 트리에서 110행이
 * 전부 이름 텍스트와 함께 렌더되는지 계수. 여기가 green이면 실기 공백은 JS가 아니라
 * 네이티브/이미지 계층(구 원격 927KB PNG ×90 동시 디코드) 문제로 분리된다.
 */
import * as React from 'react';
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
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => ({ data: undefined }) }));

import { ScanRichList } from '@/features/scan/ScanRichList';
import { photoOnlyResults } from '@/lib/api/scanAdapter';
import type { ScanResultWire } from '@/lib/api/scanTypes';

const FIXTURE = require('@/lib/api/__tests__/__fixtures__/scan-response-0910.json') as {
  payload: { results: ScanResultWire[] };
};

const t = (k: string) => k;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('실응답 110건(idx 전무 = photoOnly) — 어댑터가 110건 전부 통과(이름 결측 0 확인)', () => {
  const photo = photoOnlyResults(FIXTURE.payload.results);
  expect(FIXTURE.payload.results).toHaveLength(110);
  expect(photo).toHaveLength(110); // 실데이터엔 무명 항목 0 — 드롭 없음
  expect(photo.filter((p) => !p.matched)).toHaveLength(90);
  for (const p of photo) expect(p.displayName.trim().length).toBeGreaterThan(0);
});

it('ScanRichList 렌더 — 110행 전부 마운트 + 이름 텍스트 존재(JS 트리 계수 — 공백 행 0)', () => {
  const photo = photoOnlyResults(FIXTURE.payload.results);
  // scan.tsx photoDishes 매핑 그대로(음수 합성 itemId)
  const dishes = photo.map((p, k) => ({
    itemId: -1 - k,
    rawMenuName: p.displayName,
    box: { x: 0, y: 0, width: 0, height: 0 },
    latin: null,
    priceKrw: p.price,
    risk: p.risk,
    matched: p.matched,
    foodId: p.foodId,
    displayName: p.displayName,
    koreanName: p.koreanName,
    imageUrl: p.imageUrl,
    avoidances: p.avoidances,
  }));
  const tree = render(
    <ScanRichList dishes={dishes} currency="KRW" cart={new Map()} onAdd={() => {}} onRemove={() => {}} onOpen={() => {}} t={t} />,
  );
  // 행 계수 — composite+host 중복 방지: 고유 testID 집합
  const rowIds = new Set(
    tree.root
      .findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('rich-'))
      .map((n) => n.props.testID as string),
  );
  expect(rowIds.size).toBe(110);
  const markIds = new Set(
    tree.root
      .findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('mark-'))
      .map((n) => n.props.testID as string),
  );
  expect(markIds.size).toBe(110); // 미매칭 90 포함 전 행에 마크/배지
  // 이름 텍스트 실존 — 트리 직렬화에서 표본 확인(첫·중간·끝 미매칭)
  const flat = JSON.stringify(tree.toJSON());
  for (const name of ['원조김밥', '김치김밥', FIXTURE.payload.results[109].name ?? '']) {
    expect(flat).toContain(name);
  }
  // 공백 행 감지: 이름이 결측인 행 0 — 모든 행 직렬화에 최소 1개 텍스트
  const unmatchedNames = FIXTURE.payload.results.filter((r) => !r.matched).map((r) => r.name);
  const missing = unmatchedNames.filter((n) => n && !flat.includes(n));
  expect(missing).toEqual([]);
});
