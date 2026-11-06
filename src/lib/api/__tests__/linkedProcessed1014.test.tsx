/**
 * KB-1014(서버 KB-1012 #600): 메뉴 음식 linkedProcessedFood — 어댑터(스캔 v2·음식 상세)·사진 강등 순서·계측 출처.
 * 판정(위험도·재료)은 메뉴 음식 값 그대로 — 연결 상품 값이 섞이지 않는지(false-safe 0)까지.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

const mockImage = jest.fn();
jest.mock('expo-image', () => ({
  Image: (p: Record<string, unknown>) => { mockImage(p); return null; },
}));
jest.mock('@/components/Skeleton', () => ({ Shimmer: () => null }));

import { adaptLinkedProcessed } from '../linkedProcessed';
import { mergeResults, photoOnlyResults } from '../scanAdapter';
import { adaptFoodDetail, DEFAULT_FOOD_IMAGE } from '../foodAdapter';
import { CardPhoto } from '@/components/CardPhoto';
import { packagedDetailSource, PACKAGED_DETAIL_SOURCES } from '@/lib/analytics';
import type { ScanResultWire } from '../scanTypes';
import type { FoodDetailWire } from '../foodDetailTypes';

const LINK = { id: 501, name: 'Coca-Cola', nameKo: '코카-콜라', imageUrl: 'https://cdn.kbap.site/pf/501-cut.webp' };

describe('어댑터', () => {
  it('정상 = id 문자열화 · nameKo 같으면 null · 비-URL 이미지 null · id·name 없으면 연결 없음', () => {
    expect(adaptLinkedProcessed(LINK)).toEqual({ id: '501', name: 'Coca-Cola', nameKo: '코카-콜라', imageUrl: LINK.imageUrl });
    expect(adaptLinkedProcessed({ ...LINK, id: '77' })?.id).toBe('77');
    expect(adaptLinkedProcessed({ ...LINK, nameKo: 'Coca-Cola' })?.nameKo).toBeNull();
    expect(adaptLinkedProcessed({ ...LINK, imageUrl: 'pf/501.webp' })?.imageUrl).toBeNull();
    expect(adaptLinkedProcessed({ ...LINK, imageUrl: null })?.imageUrl).toBeNull();
    for (const bad of [undefined, null, 'x', {}, { ...LINK, id: null }, { ...LINK, id: 'abc' }, { ...LINK, name: '' }, { ...LINK, name: 3 }]) {
      expect(adaptLinkedProcessed(bad)).toBeNull();
    }
  });

  const row = (over: Partial<ScanResultWire>): ScanResultWire => ({ idx: 0, matched: true, foodId: 9, name: 'Cola', koreanName: '콜라', riskLevel: 'DANGER', imageRef: 'https://cdn/food/cola.jpg', ...over } as ScanResultWire);
  it('스캔 v2: matched = 연결 실림 · 판정은 음식 값 그대로(DANGER 유지) · 미매칭 = 연결 무시 · 필드 없음 = null', () => {
    const items = [{ itemId: 0, rawMenuName: '콜라', box: { x: 0, y: 0, width: 1, height: 1 } }];
    const [m] = mergeResults(items, [row({ linkedProcessedFood: LINK })]);
    expect(m.linked?.id).toBe('501');
    expect(m.risk).toBe('danger');
    expect(m.imageUrl).toBe('https://cdn/food/cola.jpg'); // 서버 음식 사진은 그대로(앱이 표시에서만 누끼 우선)
    const [u] = mergeResults(items, [row({ matched: false, linkedProcessedFood: LINK })]);
    expect(u.linked).toBeNull();
    expect(u.risk).toBe('unable');
    const [none] = mergeResults(items, [row({})]);
    expect(none.linked).toBeNull();
    expect(photoOnlyResults([row({ idx: null, linkedProcessedFood: LINK })])[0].linked?.id).toBe('501');
  });

  const wire = (over: Partial<FoodDetailWire>): FoodDetailWire => ({ name: 'Cola', koreanName: '콜라', imageRef: 'https://cdn/food/cola.jpg', description: '', spiciness: 0, bookmarked: false, overallRiskStatus: 'CAUTION', ingredients: [{ name: 'Sugar', inclusionPercent: 100, riskStatus: 'CAUTION' } as never], ...over });
  it('음식 상세: 연결 있음 = linkedProcessed · 없음 = null · 위험도·재료·사진은 음식 값 그대로', () => {
    const d = adaptFoodDetail(wire({ linkedProcessedFood: LINK }), '9');
    expect(d.linkedProcessed?.name).toBe('Coca-Cola');
    expect(d.risk).toBe('caution');
    expect(d.ingredients.map((i) => i.risk)).toEqual(['caution']);
    expect(d.photoUrl).toBe('https://cdn/food/cola.jpg');
    expect(adaptFoodDetail(wire({}), '9').linkedProcessed).toBeNull();
    // 연결 상품에 판정 값이 실려 와도(계약 밖) 음식 판정은 흔들리지 않는다
    expect(adaptFoodDetail(wire({ linkedProcessedFood: { ...LINK, verdict: 'SAFE', riskLevel: 'SAFE' } }), '9').risk).toBe('caution');
  });

  it('계측: food_packaged_detail_view source = menu_link (enum)', () => {
    expect(PACKAGED_DETAIL_SOURCES).toContain('menu_link');
    expect(packagedDetailSource('menu_link', undefined)).toBe('menu_link');
    expect(packagedDetailSource('menu_linkx', undefined)).toBe('deeplink');
  });
});

describe('CardPhoto 누끼 우선 → 음식 사진 → 기본 이미지', () => {
  const last = () => mockImage.mock.calls[mockImage.mock.calls.length - 1][0] as { source: unknown; contentFit: string; onError: () => void; onLoad: () => void };
  beforeEach(() => mockImage.mockClear());
  it('누끼 = contain + 연회색 바탕 · 실패 = 음식 사진(cover) · 그것도 실패 = 기본 이미지', () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<CardPhoto uri="https://cdn/food/cola.jpg" cutoutUri={LINK.imageUrl} />); });
    expect(last()).toMatchObject({ source: LINK.imageUrl, contentFit: 'contain' });
    expect(t.root.findAll((n) => n.props?.testID === 'card-photo-cutout-bg').length).toBeGreaterThan(0);
    act(() => { last().onError(); });
    expect(last()).toMatchObject({ source: 'https://cdn/food/cola.jpg', contentFit: 'cover' });
    expect(t.root.findAll((n) => n.props?.testID === 'card-photo-cutout-bg')).toHaveLength(0);
    act(() => { last().onError(); });
    expect(last().source).toBe(DEFAULT_FOOD_IMAGE);
  });
  it('누끼 없음 = 현행 그대로(cover)', () => {
    act(() => { renderer.create(<CardPhoto uri="https://cdn/food/cola.jpg" cutoutUri={null} />); });
    expect(last()).toMatchObject({ source: 'https://cdn/food/cola.jpg', contentFit: 'cover' });
  });
});

describe('표면 배선 · 문구', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  it('스캔 결과 행 썸네일 = 누끼 우선(같은 CardPhoto 강등 규칙) · 스캔 화면이 linked를 행으로 넘긴다(OCR·사진 전용 둘 다)', () => {
    expect(fs.readFileSync('src/features/scan/ScanRichList.tsx', 'utf8')).toMatch(/<CardPhoto uri=\{thumb\} cutoutUri=\{dish\.linked\?\.imageUrl\}/);
    expect(fs.readFileSync('src/app/scan.tsx', 'utf8').match(/linked: (it|p)\.linked, \/\/ KB-1014/g)).toHaveLength(2);
  });
  it('detail.linkedProcessedTitle 10로케일 · 빈 값·가운데 점·이모지 0', () => {
    for (const l of ['ko', 'en', 'es', 'ja', 'ru', 'id', 'vi', 'zh-Hant', 'zh-Hans', 'th']) {
      const v = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).detail.linkedProcessedTitle as string;
      expect({ l, ok: typeof v === 'string' && v.trim().length > 0 && !/·|\p{Extended_Pictographic}/u.test(v) }).toEqual({ l, ok: true });
    }
  });
});
