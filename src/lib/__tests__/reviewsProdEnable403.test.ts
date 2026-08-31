/**
 * KB-403(P-272): 리뷰 기능 prod 공개 — P-110 숨김(당시 미완) 해제.
 * prod 채널 상태에서 reviewsEnabled = true(전 표면 개방)·communityEnabled 계열은
 * 잠금 유지(발주 불변식)를 잠근다. 발행은 심사 승인 후 별도(전략 A).
 */
it('prod 채널에서도 reviewsEnabled = true — 리뷰 표면 전부 개방', () => {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { updates: { requestHeaders: { 'expo-channel-name': 'production' } } } },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FLAGS, isProdChannel } = require('@/lib/flags');
  expect(FLAGS.reviewsEnabled).toBe(true);
  // 커뮤니티 계열은 prod 잠금 유지(분리 확인 — 발주 ②)
  if (isProdChannel()) expect(FLAGS.communityEnabled).toBe(false);
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
