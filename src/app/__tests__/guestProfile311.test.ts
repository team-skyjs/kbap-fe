/**
 * P-311(KB-478) → KB-497: 게스트 프로필 = 회원 화면 재활용. 알림은 회원 전용 —
 * 게스트 분기에 알림 설정 진입점 없음, 설정 라우트는 AuthGateSheet(이중 방어), 게스트 로컬 동의 저장소 폐기.
 */
import * as fs from 'fs';

const profile = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8');
const notif = fs.readFileSync('src/app/profile/notifications.tsx', 'utf8');
const login = fs.readFileSync('src/app/login.tsx', 'utf8');

it('게스트 프로필 — 헤더 대체(guestTitle·Sign in)·노출 3(Language·Safety·버전)·알림 행 없음·임베드 로그인 잔존 0', () => {
  expect(profile).toContain("t('profile.guestTitle')");
  expect(profile).toContain('testID="guest-signin"');
  expect(profile).toContain("t('intro.signUp')"); // Sign in 기존 문구 재사용
  expect(profile).not.toContain('GuestLogin'); // 임베드 로그인 소멸
  expect(profile).not.toContain('LoginScreen'); // import 잔존 0
  const guestBlock = profile.slice(profile.indexOf('P-311(KB-478): 게스트'), profile.indexOf(') : meLoading'));
  for (const key of ['profile.language', 'profile.safetyNotice', 'app-version-row']) expect(guestBlock).toContain(key);
  expect(guestBlock).not.toContain('notif.title'); // KB-497(FR-012): 알림 설정 진입점 = 회원 분기만
  expect(profile.match(/profile\/notifications/g)).toHaveLength(1); // 회원 분기 1곳
  for (const hidden of ['profile.myFoods', 'profile.saved', 'myReviews.title', 'profile.dietTitle', 'community.blockedTitle', 'profile.logout', 'profile.deleteAccount', 'profile-rank-card', 'restrictionsTitle']) {
    expect(guestBlock).not.toContain(hidden);
  }
});

it('로그인 임베드 변형 폐기 — login.tsx embedded prop·embedAvailableH 잔존 0(독립 화면뿐)', () => {
  expect(login).not.toContain('embedded ='); // prop 잔존 0(P-311 주석 언급 제외)
  expect(login).not.toContain('{ embedded');
  expect(login).not.toContain('embedAvailableH');
  expect(fs.readFileSync('src/lib/loginCollage.ts', 'utf8')).not.toContain('function embedAvailableH');
});

it('KB-497: 알림 설정 라우트 게스트 = AuthGateSheet(profile)만 — 게스트 토글·로컬 동의 잔존 0', () => {
  expect(notif).toContain('<AuthGateSheet context="profile" open');
  expect(notif).not.toContain('guestConsent');
  expect(notif).not.toContain('guest-marketing');
  expect(notif).not.toContain('guest-night');
  expect(notif).toContain('useNotificationSettings(!isGuest)'); // 게스트 = 설정 요청 0(401 회피)
  expect(fs.existsSync('src/lib/push/guestConsent.ts')).toBe(false);
});
