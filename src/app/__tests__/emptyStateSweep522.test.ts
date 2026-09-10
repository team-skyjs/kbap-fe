/** P-359(KB-522) — 구 StateBlock 전수 폐기 → 디자이너 EmptyBlock 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('구 StateBlock 소멸 — 소스 전수 <StateBlock 0 + 컴포넌트·stateIconColor 부재', () => {
  const { execSync } = require('child_process') as typeof import('child_process');
  const hits = execSync("grep -rln '<StateBlock' src --include='*.tsx' || true").toString().trim();
  expect(hits).toBe('');
  const sb = read('src/components/StateBlock.tsx');
  expect(sb).not.toContain('export function StateBlock');
  expect(sb).not.toContain('stateIconColor');
  expect(sb).toContain('export function EmptyBlock'); // 빈 상태 = EmptyBlock 단일
  expect(sb).toContain('export function QueryErrorBlock'); // 에러 시안(4003:12563)은 무변
  expect(read('src/components/index.ts')).not.toContain('StateBlock,');
});

it('4표면 교체 — 리뷰 전체/필터·커뮤니티·피드 = EmptyBlock(testID) 배선', () => {
  const rv = read('src/app/food/[id]/reviews.tsx');
  expect(rv).toContain('testID="reviews-empty"');
  expect(rv).toContain('testID="reviews-empty-write"'); // 헤더 진입점 부재 → ghost CTA 1개 유지
  expect(rv).toContain('testID="reviews-filter-empty"'); // 필터 0건 = CTA 없음
  expect(rv).toContain("t(sameNatOnly ? 'reviews.emptySameNat' : 'reviews.emptyBody')");
  const cm = read('src/app/(tabs)/community.tsx');
  expect(cm).toContain('testID="community-empty"');
  expect(cm).not.toContain('community.emptyBody'); // 본문 키 폐기
  const fd = read('src/features/community/ReviewFeed.tsx');
  expect(fd).toContain('testID="feed-empty"');
  expect(fd).toContain("t(filterActive ? 'reviews.emptySameNat' : 'reviews.emptyTitle')");
});

it('상세 KR only 빈 문구 — natEmpty Text 폐기 → EmptyBlock(섹션 폭 안)', () => {
  const fd = read('src/app/food/[id]/index.tsx');
  expect(fd).toContain('testID="detail-nat-empty"');
  expect(fd).toContain("<EmptyBlock label={t('reviews.emptySameNat')} />");
  expect(fd).not.toContain('natEmpty:'); // 폭 초과 스타일 소멸
});

it('키 정리 — community.emptyBody·states 카탈로그 전용 10키 삭제, 사용 키(offlineBody 등) 보존 ×10로케일', () => {
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as Record<string, Record<string, string>>;
    expect(j.community.emptyBody).toBeUndefined();
    for (const k of ['emptyReviewsBody', 'unableTitle', 'labelError', 'labelOffline', 'labelUnable', 'viewSavedScans']) {
      expect(j.states[k]).toBeUndefined();
    }
    // QueryErrorBlock 소비 키·잔존 사용 키는 보존
    for (const k of ['errorTitle', 'errorBody', 'offlineTitle', 'offlineBody', 'emptyReviewsTitle']) {
      expect(j.states[k]).toBeTruthy();
    }
    expect(j.reviews.emptyBody).toBeTruthy(); // 필터 0건 카피로 잔존 사용
  }
});
