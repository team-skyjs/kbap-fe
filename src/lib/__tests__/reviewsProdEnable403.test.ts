/**
 * KB-403(P-272): 리뷰 기능 prod 공개 — P-110 숨김(당시 미완) 해제.
 * reviewsEnabled·reviewExtrasEnabled·reviewPlaceEnabled = 전 채널 공개,
 * communityEnabled 계열·placeTagsEnabled(KB-274)는 잠금 유지. 발행은 심사 후(전략 A).
 *
 * Codex P2 반영 노트: 초안은 채널을 목킹해 FLAGS를 재로드하는 방식이었으나
 * ① expo-constants 목킹은 flags의 실소스(expo-updates.channel)와 무관했고(지적 타당)
 * ② expo-updates 목킹은 jest-expo 프리셋과의 경합으로 전체 병렬 실행에서만
 * 간헐 미적용(실측 — 단독/inBand 통과·full 실패 2회 재현)이라 폐기.
 * **공개 플래그가 리터럴 `true`(채널식 자체 소멸)가 된 지금은 소스 리터럴 잠금이
 * 채널 무관 보증의 완전 증명**이다 — 재로드 시뮬 불요. 잠금 플래그의 prod=false는
 * `!PROD_CHANNEL` 리터럴 잠금이 같은 방식으로 보증(pushProdGuard221 불변식과 동형).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const flagsSrc = require('fs').readFileSync('src/lib/flags.ts', 'utf8') as string;

it('공개 3종 = 리터럴 true(채널식 소멸 — prod 포함 전 채널 보증)', () => {
  expect(flagsSrc).toContain('reviewsEnabled: true');
  expect(flagsSrc).toContain('reviewExtrasEnabled: true');
  expect(flagsSrc).toContain('reviewPlaceEnabled: true');
  // 채널 분기 잔존 0 — 셋 중 하나라도 !PROD_CHANNEL로 회귀하면 실패
  for (const g of ['reviewsEnabled', 'reviewExtrasEnabled', 'reviewPlaceEnabled']) {
    expect(flagsSrc).not.toContain(`${g}: !PROD_CHANNEL`);
  }
});

it('잠금 유지 — communityEnabled = !PROD_CHANNEL·placeTagsEnabled(KB-274) = false 무변', () => {
  expect(flagsSrc).toContain('communityEnabled: !PROD_CHANNEL');
  expect(flagsSrc).toContain('homeAllContent: !PROD_CHANNEL');
  expect(flagsSrc).toContain('placeTagsEnabled: false');
});

it('잠금 표면 분리 — 리뷰 게이트 소비처는 reviewsEnabled 단독(커뮤니티 플래그 비의존)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // 리뷰 라우트 가드 3곳 + 프로필 내 리뷰 행 = reviewsEnabled 단독 게이트
  for (const f of ['src/app/profile/reviews.tsx', 'src/app/food/[id]/review.tsx', 'src/app/food/[id]/reviews.tsx']) {
    const src = fs.readFileSync(f, 'utf8') as string;
    expect(src).toContain('FLAGS.reviewsEnabled');
    expect(src).not.toContain('communityEnabled'); // 얽힘 0 — 커뮤니티 잠금이 리뷰를 못 막는다
  }
  // 커뮤니티 탭(ReviewFeed 포함)은 communityEnabled 게이트 그대로(무변)
  expect(fs.readFileSync('src/app/(tabs)/community.tsx', 'utf8')).toContain('FLAGS.communityEnabled');
});
