/**
 * P-234(KB-316·29): scan_complete.item_count v2 교정 — 107개 스캔이 0으로
 * 발화하던 계측 버그(v2 = 전부 photoOnly 경로, res.items 항상 []).
 * 어댑터 실측 + 화이트리스트 통과(P-215 교훈) + 배선·타임아웃 확정 잠금.
 */
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));

import { EVENTS, sanitize } from '@/lib/analytics';
import { mergeResults, photoOnlyResults } from '@/lib/api/scanAdapter';
import type { ScanResultWire } from '@/lib/api/scanTypes';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('v2 응답(전부 idx=null) — items 0 + photoOnly N → item_count = N(전체 결과 수)', () => {
  // v2 실측 형태: 온디바이스 items를 안 보내므로 결과 전부 idx=null → photoOnly로 수확
  const wire: ScanResultWire[] = Array.from({ length: 107 }, (_, i) => ({
    idx: null,
    matched: i % 3 === 0,
    foodId: i % 3 === 0 ? i : null,
    riskLevel: 'UNKNOWN' as const,
    name: `dish-${i}`,
    koreanName: `메뉴-${i}`,
  }));
  const items = mergeResults([], wire); // v2: 클라 items 빈 배열
  const photoOnly = photoOnlyResults(wire);
  expect(items).toHaveLength(0); // 구 계측이 이것만 세서 0 발화(버그 재현)
  expect(photoOnly).toHaveLength(107);
  const itemCount = items.length + photoOnly.length; // 교정식
  expect(itemCount).toBe(107); // 매칭+미매칭 전체
});

it('v1 경로 — items 본 경로 + photoOnly 보충분 합산 = 전체(현행 시맨틱 유지)', () => {
  const box = { x: 0, y: 0, width: 1, height: 1 };
  const clientItems = [
    { itemId: 0, rawMenuName: '김치찌개', box },
    { itemId: 1, rawMenuName: '수제비', box },
  ];
  const wire: ScanResultWire[] = [
    { idx: 0, matched: true, foodId: 7, riskLevel: 'SAFE', name: 'Kimchi Stew' },
    { idx: 1, matched: false, riskLevel: 'UNKNOWN', name: '수제비' },
    { idx: null, matched: true, foodId: 9, riskLevel: 'CAUTION', name: 'Extra' }, // 사진에서만 추출
  ];
  const items = mergeResults(clientItems, wire);
  const photoOnly = photoOnlyResults(wire);
  expect(items.length + photoOnly.length).toBe(3);
});

it('화이트리스트 통과 — 실제 수가 드롭 없이 전송된다(P-215 교훈)', () => {
  expect(sanitize(EVENTS.scan_complete, { success: true, degraded: false, item_count: 107 })).toEqual({
    success: true,
    degraded: false,
    item_count: 107,
  });
});

it('배선 소스 잠금 — 계측 = items + photoOnly 합산, 타임아웃 = 120초 확정(TEMP 소멸)', () => {
  const scan = read('src/app/scan.tsx');
  expect(scan).toContain('item_count: res.items.length + res.photoOnly.length');
  const useScan = read('src/lib/data/useScan.ts');
  expect(useScan).toContain('timeoutMs: 120_000');
  expect(useScan).not.toContain('600_000'); // TEMP 10분 잔존 0
  expect(useScan).not.toContain('TEMP(P-232)');
  expect(useScan).toContain('실측'); // 확정 근거 주석 상비(재조정 표식)
});
