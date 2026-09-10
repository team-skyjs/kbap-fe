/** P-353(KB-515) — 9/10 실기 5건 잠금(행동 검증은 각 기존 스위트: 랭킹 =
 *  profileReviewCleanup150 · 기본 이미지 = cardPhoto/designParity315/parityFoodScan486 ·
 *  검색 그리드 = searchDs506/guestListBadges). 여기는 ②·④ 배선 소스 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('② 스캔 진입 상세 — src===scan = Write 미렌더 + Ask 전폭, 그 외 현행 2분할', () => {
  const fd = read('src/app/food/[id]/index.tsx');
  expect(fd).toContain("scanEntry={src === 'scan'}");
  expect(fd).toContain('{FLAGS.reviewsEnabled && !(scanEntry && onAsk) && (');
  expect(fd).toContain('flex: scanEntry ? 1 : narrow ? 1 : 5');
});

it('④ My Foods Ordered 행 — thumbnails[0] = CardPhoto r8, 없으면 핀 현행', () => {
  const mf = read('src/app/profile/my-foods.tsx');
  expect(mf).toContain('{order.thumbnails[0] ? (');
  expect(mf).toContain('<CardPhoto uri={order.thumbnails[0]} borderRadius={8} />');
  expect(mf).toContain('<D4MapPin size={24} color={C.ink3} />'); // 폴백 유지
  expect(mf).toMatch(/pinBox: \{ width: 70, height: 70, borderRadius: 8/);
});

it('③ 기본 이미지 = 앱 번들 로컬 에셋(어댑터 경계 한 곳) — 원격 927KB PNG 동시 로딩 공백 재발 방지', () => {
  const fa = read('src/lib/api/foodAdapter.ts');
  expect(fa).toContain("export const DEFAULT_FOOD_IMAGE = require('../../../assets/images/food-not-found.webp') as number;");
  expect(fa).not.toContain('DEFAULT_FOOD_IMAGE_URL'); // 원격 URL 상수 소멸
  expect(require('fs').existsSync('assets/images/food-not-found.webp')).toBe(true);
  expect(require('fs').statSync('assets/images/food-not-found.webp').size).toBeLessThan(20 * 1024); // ~20KB 목표
});

it('#116 P2 ①② — 판정 드레인 = 공용 useSavedIds(중복 배선 0), 검색 게스트 = AuthGateSheet', () => {
  const bm = read('src/lib/data/bookmarks.ts');
  expect(bm).toContain('export function useSavedIds(): { ids: Set<string>; ready: boolean } {');
  expect(bm).toContain('void saved.fetchNextPage({ cancelRefetch: false });'); // P-332 문법 승계
  const fe = read('src/features/food/FoodExplorer.tsx');
  expect(fe).toContain('const { ids: savedIds, ready: savedReady } = useSavedIds();');
  expect(fe).not.toContain('saved.fetchNextPage({ cancelRefetch: false })'); // 자체 드레인 소멸
  const sr = read('src/app/search.tsx');
  expect(sr).toContain('const { ids: savedIds, ready: savedReady } = useSavedIds();');
  expect(sr).toContain('if (isGuest) return setGate(true);');
  expect(sr).toContain('<AuthGateSheet context="save" open={gate} onClose={() => setGate(false)} />');
});

it('#116 2R — ready(드레인 완료) 전 토글 무시(POST 오발 방지) + 스캔 썸네일 CardPhoto 경유', () => {
  const bm = read('src/lib/data/bookmarks.ts');
  expect(bm).toContain('return { ids, ready: !saved.hasNextPage && !saved.isFetching };');
  expect(read('src/features/food/FoodExplorer.tsx')).toContain('if (!savedReady) return;');
  expect(read('src/app/search.tsx')).toContain('if (!savedReady) return;');
  const rich = read('src/features/scan/ScanRichList.tsx');
  expect(rich).toContain('<CardPhoto uri={thumb} borderRadius={4} />'); // 깨진 URL = 기본 이미지 폴백
});

it('P-362(KB-525): 스캔 썸네일 래퍼 = 고정 118(퍼센트 높이 금지 — 행 160만px 폭주 회귀 잠금)', () => {
  const rich = read('src/features/scan/ScanRichList.tsx');
  expect(rich).toContain("thumbWrap: { width: 118, height: 118 }");
  expect(rich).not.toContain("height: '100%'"); // P-366 ①: thumbWrapInner 자체 소멸(분기 통합)
});
