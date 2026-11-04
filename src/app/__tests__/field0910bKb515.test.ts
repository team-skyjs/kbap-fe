/** P-353(KB-515) — 9/10 실기 5건 잠금(행동 검증은 각 기존 스위트: 랭킹 =
 *  profileReviewCleanup150 · 기본 이미지 = cardPhoto/designParity315/parityFoodScan486 ·
 *  검색 그리드 = searchDs506/guestListBadges). 여기는 ②·④ 배선 소스 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('② 스캔 진입 상세 — src===scan = Write 미렌더 + Ask 전폭, 그 외 현행 2분할', () => {
  const fd = read('src/app/food/[id]/index.tsx');
  expect(fd).toContain("scanEntry={src === 'scan'}");
  expect(fd).toContain('const write = FLAGS.reviewsEnabled && !scanEntry;'); // KB-851 → KB-981: 스캔 진입 = Ask 유무와 무관하게 Write 0
});

it('④ My Foods Ordered 행 — thumbnails[0] = CardPhoto r8, 없으면 핀 현행', () => {
  const mf = read('src/app/profile/my-foods.tsx');
  expect(mf).toContain('{order.thumbnails[0] ? (');
  expect(mf).toContain('<CardPhoto uri={order.thumbnails[0]} borderRadius={radius.md} />');
  expect(mf).toContain('<D4MapPin size={24} color={C.ink3} />'); // 폴백 유지
  expect(mf).toMatch(/pinBox: \{ width: 70, height: 70, borderRadius: radius\.md/);
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
  expect(bm).toContain('export function useSavedIds(opts?: { enabled?: boolean }): { ids: Set<string>; ready: boolean } {'); // KB-779: 홈은 Saved 탭 활성 시에만
  expect(bm).toContain('void fetchNextPage({ cancelRefetch: false });'); // P-332 문법 승계(KB-779 Codex ④: enabled 가드 + 구조분해)
  // KB-959(예진 11/2): 카드 저장 버튼 소멸 → 홈·음식 탭·검색은 판정 드레인(useSavedIds)·카드 토글·검색 저장 게이트를 더 안 쓴다(상세가 정본)
  const fe = read('src/features/food/FoodExplorer.tsx');
  expect(fe).not.toContain('useSavedIds(');
  expect(fe).not.toContain('saved.fetchNextPage({ cancelRefetch: false })'); // 자체 드레인 소멸
  const sr = read('src/app/search.tsx');
  expect(sr).not.toContain('useSavedIds(');
  expect(sr).not.toContain('<AuthGateSheet context="save"');
});

it('#116 2R — ready(드레인 완료) 전 토글 무시(POST 오발 방지) + 스캔 썸네일 CardPhoto 경유', () => {
  const bm = read('src/lib/data/bookmarks.ts');
  expect(bm).toContain('return { ids, ready: !saved.hasNextPage && !saved.isFetching };');
  // KB-959: 카드 토글 소멸 — 드레인 전 토글 가드는 상세(useToggleBookmark 경로)만 남음
  const rich = read('src/features/scan/ScanRichList.tsx');
  expect(rich).toContain('<CardPhoto uri={thumb} borderRadius={radius.md} />'); // 깨진 URL = 기본 이미지 폴백
});

it('P-362(KB-525): 스캔 썸네일 래퍼 = 고정 118(퍼센트 높이 금지 — 행 160만px 폭주 회귀 잠금)', () => {
  const rich = read('src/features/scan/ScanRichList.tsx');
  expect(rich).toContain("thumbWrap: { width: 118, height: 118 }");
  expect(rich).not.toContain("height: '100%'"); // P-366 ①: thumbWrapInner 자체 소멸(분기 통합)
});

describe('P-369(KB-532) b30 QA 3건', () => {
  it('① 검색 결과 수 라벨 = paddingHorizontal 20(그리드 여백 정렬)', () => {
    expect(read('src/app/search.tsx')).toMatch(/count: \{[^}]*paddingHorizontal: 20/);
  });

  it('② 랭킹 메달 글로우 = 각 등급 원색(단일 #FFC700 소멸) — 팔레트 7색 상이', () => {
    const { MEDAL_COLORS } = require('@/components/RankMedal') as typeof import('@/components/RankMedal');
    expect(MEDAL_COLORS).toHaveLength(7);
    expect(new Set(MEDAL_COLORS).size).toBe(7); // 전부 상이
    expect(MEDAL_COLORS[0]).toBe('#ffc700'); // 1등급 = 기존 노랑(원색 유지)
    const rk = read('src/app/profile/ranking.tsx');
    expect(rk).toContain('{ shadowColor: MEDAL_COLORS[tier.level - 1] }');
    expect(rk).not.toContain("shadowColor: '#FFC700'"); // 고정색 소멸
  });

  it('③ My Foods 미태그 행 = 날짜 제목 + items 필만(무동작 장소 필 소멸)', () => {
    const mf = read('src/app/profile/my-foods.tsx');
    expect(mf).not.toContain('order-tag-place-');
    expect(mf).not.toContain('+ {t(');
    expect(mf).toContain('testID={`order-date-title-${order.orderId}`}');
  });
});
