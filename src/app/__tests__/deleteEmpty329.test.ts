/**
 * P-329/330(KB-486) — 탈퇴 화면 시안 정합 + 빈 상태 세로 중앙 스윕 소스 잠금.
 */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('P-329 탈퇴 — 카드2 아이콘 없음·텍스트 left·Delete 폭 200·체크 stroke #DCDEE3 1.5·헤어라인 없음', () => {
  const src = read('src/app/delete-account.tsx');
  expect((src.match(/<D4OctagonAlert/g) ?? []).length).toBe(1); // 카드1만
  expect(src).toContain("textAlign: 'left'");
  expect(src).toContain('deleteSlot: { width: 200 }');
  expect(src).toContain("borderWidth: 1.5, borderColor: '#DCDEE3'");
  expect(src).not.toMatch(/bottomBar: \{[^}]*borderTop/); // FixedBottom 헤어라인 없음
});

it('P-330 스윕 — 이동 4곳 중앙 래핑(소스 잠금), 이미 중앙 4곳 무변', () => {
  // 이동: 알림·저장 = flexGrow 1 + 인라인 센터(당겨서 새로고침 유지) / 내 리뷰·스캔 = ScreenCenterFill
  const notif = read('src/app/notifications.tsx');
  expect(notif).toContain("items.length === 0 && { flexGrow: 1 }");
  expect(notif).toMatch(/justifyContent: 'center'[\s\S]{0,200}notif-empty/);
  const saved = read('src/app/profile/saved.tsx');
  expect(saved).toContain("items.length === 0 && { flexGrow: 1 }");
  expect(saved).toMatch(/justifyContent: 'center'[\s\S]{0,400}saved-filter-empty/);
  expect(read('src/app/profile/reviews.tsx')).toMatch(/<ScreenCenterFill>[\s\S]{0,200}myrev-empty/);
  const scan = read('src/app/scan.tsx');
  expect(scan).toMatch(/<ScreenCenterFill>[\s\S]{0,200}scan-results-empty/);
  // A-SC-12 동승: 0건 = 인식 배너 숨김
  expect(scan).toMatch(/allDishes\.length > 0 && \([\s\S]{0,120}recog-banner/);
});
