/**
 * P-314(KB-481) — 홈 Recently scanned 0건 = 섹션 통째 숨김(헤더 포함) 소스 잠금.
 * 로딩은 SkeletonHome 선행 유지·게스트 CTA 유지.
 */
import * as fs from 'fs';

it('회원 0건 = 섹션(헤더 포함) 미렌더 — 빈 블록 잔존 0·게스트 CTA 유지', () => {
  const s = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8');
  expect(s).toContain('{(isGuest || recent.length > 0) && ('); // 0건 = 통째 숨김
  expect(s).not.toContain('home-recent-empty'); // 구 P-287 빈 블록 소멸
  expect(s).not.toContain('home.recentEmpty');
  expect(s).toContain('guestCta'); // 게스트 로그인 유도 CTA 유지
  expect(s).toContain('SkeletonHome'); // 로딩 스켈레톤 유지
});
