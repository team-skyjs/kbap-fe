/**
 * KB-432(P-277) D-4 — 스캔 결과 목록(§1-1) + 리뷰 작성(§2) 디자인 4차 잠금.
 * ① 메뉴 행 변형: 매칭+회피 칩(시안 칩·RiskBadge) / 미등록(#F2F3F6+unable+이탤릭)
 * ② 인식 배너·컨트롤 행(무동작 토글·정렬 드롭다운) 소스 잠금
 * ③ 리뷰 작성 별점 크기(전체 48/세부 32)·사진 슬롯·장소 필 소스 잠금.
 * (§1-2 인식 중·§1-3 게스트 게이트 = 예진 판정으로 현행 유지 — 잠금 없음)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    Easing: { linear: () => 0, out: () => () => 0, quad: 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => ({ data: undefined }) }));

import { ScanRichList } from '../ScanRichList';
import type { ResultDish } from '@/lib/scan/segmentMenu';

const t = (k: string) => k;
const BASE = { box: { x: 0, y: 0, width: 0, height: 0 }, latin: null, rawMenuName: '된장찌개' };
const MATCHED: ResultDish = {
  ...BASE, itemId: 1, risk: 'danger', matched: true, foodId: '7',
  displayName: 'Doenjang Jjigae', koreanName: '된장찌개', priceKrw: 9000,
  imageUrl: 'https://cdn/x.jpg',
  avoidances: [{ code: 'SOYBEAN', name: 'Soybean', risk: 'danger' }],
} as ResultDish;
const UNMATCHED: ResultDish = {
  ...BASE, itemId: 2, risk: 'unable', matched: false, foodId: null,
  displayName: '수제비', koreanName: '수제비', priceKrw: null, imageUrl: null,
} as ResultDish;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('① 메뉴 행 — 매칭 = RiskBadge + 시안 칩(#2F3137 12/700) / 미등록 = #F2F3F6 unable 박스 + 이탤릭', () => {
  const tree = render(
    <ScanRichList dishes={[MATCHED, UNMATCHED]} currency="USD" cart={new Map()} onAdd={() => {}} onRemove={() => {}} onOpen={() => {}} t={t} />,
  );
  const s = JSON.stringify(tree.toJSON());
  // 매칭: 썸네일 100 + 리본 배지(risk-badge testID)
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-badge-danger').length).toBeGreaterThanOrEqual(1);
  expect(s).toContain('"width":100');
  // 회피 칩: 시안 프레임(r37) + 12/700 #2F3137
  expect(s).toContain('"borderRadius":37');
  expect(s).toContain('Soybean');
  // 미등록: #F2F3F6 박스 + 이탤릭 안내
  expect(s).toContain('#F2F3F6');
  expect(s).toContain('"fontStyle":"italic"');
  expect(s).toContain('scan.missNote');
});

it('② 스캔 결과 크롬 — 인식 배너·언더라인 탭·컨트롤 행(무동작 토글+정렬 시트) 소스 잠금', () => {
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).toContain('testID="recog-banner"');
  expect(src).toContain("t('scan.resultsSub', { count: allDishes.length })");
  expect(src).toContain('testID={`seg-${v}`}'); // Photo|List 언더라인 탭(세그 매핑 유지)
  expect(src).toContain('testID="scan-profile-toggle"'); // 시안 렌더·무동작(상태 부재)
  expect(src).toContain('testID="scan-sort"');
  // §1-2/§1-3 현행 유지(예진 판정) — 인식 중 스윕·AuthGateSheet 무변
  expect(src).toContain('ScanSweepOverlay');
  expect(src).toContain('<AuthGateSheet context="scan"');
  // 9/5 예진 판정: 다시찍기 표면·ScanProfileBar 사용처 제거(컴포넌트 정의·리셋 로직은 보존)
  expect(src).not.toContain('testID="retake"');
  expect(src).not.toContain('<ScanProfileBar');
  // 담기 UI = 현행 유지 정정(9/5) — 스테퍼 잔존
  const rich = require('fs').readFileSync('src/features/scan/ScanRichList.tsx', 'utf8') as string;
  expect(rich).toContain('testID={`stepper-${dish.itemId}`}');
});

it('③ 리뷰 작성 — 전체 별 48(stroke 3)·세부 별 32(stroke 2)·사진 슬롯 100·장소 필 소스 잠금', () => {
  const review = require('fs').readFileSync('src/app/food/[id]/review.tsx', 'utf8') as string;
  expect(review).toContain('<Star size={48} fillPct={i <= rating ? 100 : 0} sw={3} />');
  expect(review).toContain('testID="place-pill"');
  expect(review).toContain('testID="place-clear"');
  expect(review).toContain('testID="review-bottom-bar"'); // FixedBottom primary Post
  expect(review).toContain('busy={posting}'); // P-173 공용 가드 문법(Btn busy)
  const parts = require('fs').readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8') as string;
  expect(parts).toContain('<Star size={size} fillPct={(extras[key] ?? 0) >= n ? 100 : 0} sw={2} />');
});

it('③-b 세부 별 폭 적응(Codex #31 P2) — 협폭에서 gap 축소→별 스케일, overflow 0', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fitExtrasStars } = require('@/features/review/ReviewCellParts') as typeof import('@/features/review/ReviewCellParts');
  expect(fitExtrasStars(0)).toEqual({ size: 32, gap: 16 }); // 미측정 = 시안 기본
  expect(fitExtrasStars(300)).toEqual({ size: 32, gap: 16 }); // 여유 = 기본
  // 320 폰: extrasBox(mx39) 내 별 행 가용 ≈ 180 — gap 최소 8로도 초과 → 별 스케일 다운
  for (const w of [224, 200, 180, 150]) {
    const { size, gap } = fitExtrasStars(w);
    expect(size * 5 + gap * 4).toBeLessThanOrEqual(w); // overflow 0
    expect(gap).toBeGreaterThanOrEqual(8);
  }
  expect(fitExtrasStars(200).size).toBe(32); // gap 축소만으로 해결되는 구간
  expect(fitExtrasStars(180).size).toBeLessThan(32); // 스케일 다운 구간(비율 유지)
});

it('④ 태그 시트 2종 — FixedBottom(Close/Done·장소 스킵/Done) + 안내 카드 시안값 소스 잠금', () => {
  const compose = require('fs').readFileSync('src/app/community/compose.tsx', 'utf8') as string;
  expect(compose).toContain('testID="picker-bottom"');
  expect(compose).toContain("backgroundColor: '#FFF4ED', borderWidth: 1, borderColor: '#FFE5D5'");
  const parts = require('fs').readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8') as string;
  expect(parts).toContain('testID="place-sheet-bottom"');
  expect(parts).toContain('testID="place-skip"');
  expect(parts).toContain('testID="place-done"');
});
