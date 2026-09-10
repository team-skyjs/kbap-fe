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

it('③ 기본 이미지 상수 = 어댑터 경계 한 곳(서버 DEFAULT_FOOD_IMAGE_PATH 동일 URL)', () => {
  const fa = read('src/lib/api/foodAdapter.ts');
  expect(fa).toContain("export const DEFAULT_FOOD_IMAGE_URL = 'https://d29c1cr2ng7w0.cloudfront.net/images/webp/default_miss_food/food_not_found.png';");
});

it('#116 P2 ①② — 판정 드레인 = 공용 useSavedIds(중복 배선 0), 검색 게스트 = AuthGateSheet', () => {
  const bm = read('src/lib/data/bookmarks.ts');
  expect(bm).toContain('export function useSavedIds(): Set<string> {');
  expect(bm).toContain('void saved.fetchNextPage({ cancelRefetch: false });'); // P-332 문법 승계
  const fe = read('src/features/food/FoodExplorer.tsx');
  expect(fe).toContain('const savedIds = useSavedIds();');
  expect(fe).not.toContain('saved.fetchNextPage({ cancelRefetch: false })'); // 자체 드레인 소멸
  const sr = read('src/app/search.tsx');
  expect(sr).toContain('const savedIds = useSavedIds();');
  expect(sr).toContain('if (isGuest) return setGate(true);');
  expect(sr).toContain('<AuthGateSheet context="save" open={gate} onClose={() => setGate(false)} />');
});
