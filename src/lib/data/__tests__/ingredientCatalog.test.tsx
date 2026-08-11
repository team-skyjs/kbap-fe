/**
 * P-174: 재료 카탈로그 서버 스왑 — code 머지(서버 우선·누락 폴백)·경로/lang·
 * 이미지 3단 폴백(AvoidTile)·사장님 카드 ko 조립 소스 무변 잠금(safety).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, getFixedT: () => (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k },
}));
jest.mock('@/lib/api/client', () => ({
  api: { get: jest.fn() },
  apiLang: () => 'vi',
}));

import { catalogImageUrl, catalogName, fetchIngredientCatalog, type IngredientCatalogItem } from '../useIngredientCatalog';
import { ingredientLabel } from '@/lib/mocks/ingredients';
import { AvoidTile } from '@/components/AvoidTile';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client');

it('fetch — 버전리스 공개 경로 + lang 필수 부착, code 키 Map', async () => {
  api.get.mockResolvedValueOnce({ ingredients: [{ code: 'EGG', name: 'Trứng', imageUrl: 'https://cdn/egg.webp' }] });
  const map = await fetchIngredientCatalog();
  expect(api.get).toHaveBeenCalledWith('/api/ingredients?lang=vi');
  expect(map.get('EGG')).toEqual({ code: 'EGG', name: 'Trứng', imageUrl: 'https://cdn/egg.webp' });
});

it('code 머지 — 서버 name 우선, 누락 code·무데이터는 기존 ingredientLabel 폴백', () => {
  const cat = new Map<string, IngredientCatalogItem>([['EGG', { code: 'EGG', name: 'Trứng', imageUrl: null }]]);
  expect(catalogName(cat, 'EGG')).toBe('Trứng');
  expect(catalogName(cat, 'SHRIMP')).toBe(ingredientLabel('SHRIMP')); // 누락 폴백
  expect(catalogName(undefined, 'EGG')).toBe(ingredientLabel('EGG')); // 무데이터(오프라인) 폴백
  expect(catalogImageUrl(cat, 'EGG')).toBeNull();
  expect(catalogImageUrl(undefined, 'EGG')).toBeNull();
});

describe('AvoidTile 이미지 3단 폴백 — 서버 → 클라 조립(P-145) → 색(P-134)', () => {
  const { Image } = require('react-native');
  const render = (el: React.ReactElement) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(el);
    });
    return tree;
  };
  const img = (tree: ReactTestRenderer) => tree.root.findAllByType(Image)[0];

  it('서버 imageUrl 우선 → 실패 시 클라 조립 URL → 재실패 시 색 폴백(이미지 언마운트)', () => {
    const tree = render(<AvoidTile code="EGG" imageUrl="https://cdn/server-egg.webp" abbr="EG" tint="#eee" />);
    expect(img(tree).props.source.uri).toBe('https://cdn/server-egg.webp');
    act(() => img(tree).props.onError());
    expect(img(tree).props.source.uri).toContain('images/webp/ingredients/egg.webp'); // 클라 조립
    act(() => img(tree).props.onError());
    expect(tree.root.findAllByType(Image).length).toBe(0); // 색 폴백(약어 잔존)
    expect(JSON.stringify(tree.toJSON())).toContain('EG');
  });

  it('서버 null → 종전 클라 조립부터 시작(P-145 무변)', () => {
    const tree = render(<AvoidTile code="EGG" imageUrl={null} abbr="EG" tint="#eee" />);
    expect(img(tree).props.source.uri).toContain('images/webp/ingredients/egg.webp');
  });
});

it('safety 잠금: 사장님 카드 ko 조립은 서버 카탈로그 미참조 — 소스 무변', () => {
  const fs = require('fs');
  const src = fs.readFileSync('src/lib/order/orderCard.ts', 'utf8') as string;
  expect(src).not.toContain('useIngredientCatalog');
  expect(src).not.toContain('IngredientCatalogItem');
  const hook = fs.readFileSync('src/lib/data/useOwnerConfirmation.ts', 'utf8') as string;
  expect(hook).not.toContain('useIngredientCatalog');
});
