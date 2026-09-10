/**
 * P-311(KB-478) — 게스트 프로필 = 회원 화면 재활용 + 게스트 알림 동의.
 * 소스 잠금 + guestConsent 실동작(AsyncStorage 목).
 */
import * as fs from 'fs';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/installationId', () => ({ getInstallationId: () => Promise.resolve('inst-42') }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_GUEST_CONSENT, getGuestConsent, setGuestConsent } from '@/lib/push/guestConsent';

const profile = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8');
const notif = fs.readFileSync('src/app/profile/notifications.tsx', 'utf8');
const login = fs.readFileSync('src/app/login.tsx', 'utf8');

it('게스트 프로필 — 헤더 대체(guestTitle·Sign in)·노출 4(Language·알림·Safety·버전)·임베드 로그인 잔존 0', () => {
  expect(profile).toContain("t('profile.guestTitle')");
  expect(profile).toContain('testID="guest-signin"');
  expect(profile).toContain("t('intro.signUp')"); // Sign in 기존 문구 재사용
  expect(profile).not.toContain('GuestLogin'); // 임베드 로그인 소멸
  expect(profile).not.toContain('LoginScreen'); // import 잔존 0
  // 게스트 분기 블록: 숨김 목록 잔존 0(개인화·계정 행), 노출 행 존재
  const guestBlock = profile.slice(profile.indexOf('P-311(KB-478): 게스트'), profile.indexOf(') : meLoading'));
  for (const key of ['profile.language', 'notif.title', 'profile.safetyNotice', 'app-version-row']) expect(guestBlock).toContain(key);
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

it('Codex #72 5R: 게스트 카드 3상 렌더 — pending 스켈레톤/error 배너만(스위치 부재)/ready만 토글', () => {
  const src = fs.readFileSync('src/app/profile/notifications.tsx', 'utf8');
  const pending = src.slice(src.indexOf("consentState === 'pending'"), src.indexOf("consentState === 'ready'"));
  expect(pending).toContain('guest-consent-skel');
  expect(pending).not.toContain('ToggleRow');
  const err = src.slice(src.indexOf("consentState === 'error'"), src.indexOf('</ScrollView>'));
  expect(err).toContain('guest-consent-read-error');
  expect(err).not.toContain('ToggleRow'); // 스위치 미렌더(값 미표시)
  expect(src).toContain("{consentState === 'ready' && ("); // 토글은 ready에서만 렌더
  expect(src).toContain("consentState !== 'ready') return"); // ready에서만 토글 동작
});

it('게스트 알림 화면 — 토글 2(marketing·night)·야간은 마케팅 ON 조건·서비스 토글은 회원 전용 유지', () => {
  expect(notif).toContain('testID="guest-marketing"');
  expect(notif).toContain('testID="guest-night"');
  expect(notif).toContain("if (key === 'night' && !consent.marketing) return;");
  const guestBlock = notif.slice(notif.indexOf('if (isGuest) {'), notif.indexOf('return (', notif.indexOf('if (isGuest) {') + 20) + 200);
  expect(guestBlock).not.toContain('notif.helpful'); // 서비스 토글 미노출
});

describe('guestConsent — 기본 OFF·변경 시각 기록·마케팅 철회 = 야간 동반 철회·installationId 키', () => {
  beforeEach(() => void (AsyncStorage as unknown as { clear: () => void }).clear());

  it('기본값 전부 OFF·시각 null', async () => {
    expect(await getGuestConsent()).toEqual(DEFAULT_GUEST_CONSENT);
  });

  it('동의 저장 = 값 + ISO 변경 시각, 재로드 복원, 키에 installationId', async () => {
    const c = await setGuestConsent('marketing', true);
    expect(c.marketing).toBe(true);
    expect(c.marketingChangedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await getGuestConsent()).toEqual(c); // 영속 복원
    const keys = await (AsyncStorage as unknown as { getAllKeys: () => Promise<string[]> }).getAllKeys();
    expect(keys).toContain('kbap.guestNotif.v1.inst-42');
  });

  it('마케팅 철회 = 야간 동반 철회(시각 갱신)', async () => {
    await setGuestConsent('marketing', true);
    await setGuestConsent('night', true);
    const c = await setGuestConsent('marketing', false);
    expect(c.night).toBe(false);
    expect(c.nightChangedAt).toMatch(/^\d{4}/);
  });
});

it('Codex #72 P1: 동시 토글 직렬화 — 마케팅 off 직후 야간 탭에도 marketing false 유지', async () => {
  await setGuestConsent('marketing', true);
  await setGuestConsent('night', true);
  // 직렬화 검증: off와 night-재켜기를 **대기 없이 연속 발행** — stale read였다면
  // night 쓰기가 marketing:true 스냅샷을 되살림
  const p1 = setGuestConsent('marketing', false);
  const p2 = setGuestConsent('night', true);
  await Promise.all([p1, p2]);
  const c = await getGuestConsent();
  expect(c.marketing).toBe(false); // opt-out 보존(법정 값)
});

describe('Codex #72 3R: 저장 실패 전파·큐 시점 재검증', () => {
  it('P1: setItem reject → throw 전파(상태 반영 없음 — 호출측 표면화)', async () => {
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    await expect(setGuestConsent('marketing', true)).rejects.toThrow('disk');
    spy.mockRestore();
    expect((await getGuestConsent()).marketing).toBe(false); // 저장값 불변
  });

  it('P2: 직렬 큐에서 marketing off 직후 night on 요청 = 최신 상태 재검증으로 무시', async () => {
    await setGuestConsent('marketing', true);
    const p1 = setGuestConsent('marketing', false);
    const p2 = setGuestConsent('night', true); // 큐 처리 시점엔 marketing false
    await Promise.all([p1, p2]);
    const c = await getGuestConsent();
    expect(c.marketing).toBe(false);
    expect(c.night).toBe(false); // 야간만 ON 경로 차단
  });
});

it('Codex #72 4R: getItem reject → read status=error(기본 OFF 위장 금지)·쓰기 throw(저장 보존)', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readGuestConsent } = require('@/lib/push/guestConsent') as typeof import('@/lib/push/guestConsent');
  const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('disk-read'));
  expect((await readGuestConsent()).status).toBe('error');
  await expect(setGuestConsent('marketing', true)).rejects.toThrow(); // 기본값 덮어쓰기 금지
  spy.mockRestore();
  expect((await readGuestConsent()).status).not.toBe('error'); // 복구 후 정상
});
