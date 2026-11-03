/**
 * KB-420(P-204) → KB-978(P-593): OTA 적용 정책 + EAS Workflow(develop→teamtest 자동 발행) 잠금.
 *
 * 구조: otaPolicy(순수 판정) · otaCheck(체크→fetch 코어, 모듈 주입형) ·
 * OtaAutoApplyHost(시작 게이트·복귀 배선 — 실구동은 otaApply978).
 */
import { canReloadNow, isBlockedRoute, OTA_CHECK_THROTTLE_MS } from '../otaPolicy';
import { checkAndFetchOta, launchCheckOta, type OtaState, type OtaUpdatesModule } from '../otaCheck';

describe('otaPolicy — 작업 화면 차단', () => {
  it('제외 화면 — 스캔 전 과정·주문 카드·리뷰 작성·온보딩·프로필 하위 전체(Codex #18)', () => {
    for (const p of ['/scan', '/scan-order', '/food/7/review', '/onboarding', '/profile/edit', '/profile/diet', '/profile/restrictions', '/profile/saved']) {
      expect(isBlockedRoute(p)).toBe(true);
    }
    for (const p of ['/login', '/auth/callback', '/community/compose', '/delete-account', '/search', '/scan-order', '/processed-foods/3/review']) {
      expect(isBlockedRoute(p)).toBe(true); // #109 5R/6R: 작업 화면 전수(작업 = 차단 / 목록·상세 = 허용)
    }
    for (const p of ['/notifications', '/states']) {
      expect(isBlockedRoute(p)).toBe(false); // 멱등 토글·데모 = 허용 유지
    }
    for (const p of ['/', '/food', '/profile', '/food/7', '/food/7/reviews']) {
      expect(isBlockedRoute(p)).toBe(false); // 탭 루트·리뷰 "목록"은 제외 아님
    }
  });
});

describe('KB-978: canReloadNow — active·정적 창 AND(부팅 8초 가드 소멸)', () => {
  const OK = { appState: 'active', networkIdle: true };

  it('전부 충족 = true', () => {
    expect(canReloadNow(OK)).toBe(true);
  });

  it('비포그라운드(background/inactive) = false', () => {
    expect(canReloadNow({ ...OK, appState: 'background' })).toBe(false);
    expect(canReloadNow({ ...OK, appState: 'inactive' })).toBe(false);
  });

  it('P-347(KB-509): networkIdle false = false — 진행 중 fetch reject가 죽은 런타임에 스케줄되는 크래시 봉쇄', () => {
    expect(canReloadNow({ ...OK, networkIdle: false })).toBe(false);
  });
});

describe('otaCheck 코어 — 스로틀·isEnabled·fetch 흐름 (모듈 주입 실측)', () => {
  const mod = (over: Partial<OtaUpdatesModule> = {}): OtaUpdatesModule => ({
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({})),
    ...over,
  });
  const fresh = (): OtaState => ({ lastCheckAt: 0, ready: false });

  it('업데이트 있음 → fetch 후 ready + 체크 시각·ready 기록', async () => {
    const u = mod();
    const st = fresh();
    await expect(checkAndFetchOta(u, st, 1_000_000)).resolves.toBe('ready');
    expect(u.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(st).toEqual({ lastCheckAt: 1_000_000, ready: true });
  });

  it('스로틀 — 2분 내 재호출은 체크 자체를 생략', async () => {
    const u = mod();
    const st = { lastCheckAt: 1_000_000, ready: false };
    await expect(checkAndFetchOta(u, st, 1_000_000 + OTA_CHECK_THROTTLE_MS - 1)).resolves.toBe('skip');
    expect(u.checkForUpdateAsync).not.toHaveBeenCalled();
    await expect(checkAndFetchOta(u, st, 1_000_000 + OTA_CHECK_THROTTLE_MS)).resolves.toBe('ready');
  });

  it('Updates.isEnabled=false(Metro) = no-op — 시작·복귀 둘 다 호출 0', async () => {
    const u = mod({ isEnabled: false });
    await expect(checkAndFetchOta(u, fresh(), 1)).resolves.toBe('skip');
    await expect(launchCheckOta(u, fresh(), 1, 3_000)).resolves.toBe('skip');
    expect(u.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('업데이트 없음 = none(fetch 미호출)', async () => {
    const u = mod({ checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })) });
    await expect(checkAndFetchOta(u, fresh(), 1_000_000)).resolves.toBe('none');
    expect(u.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('체크/페치 실패 = error(throw 없음)', async () => {
    const u = mod({ checkForUpdateAsync: jest.fn(async () => { throw new Error('NETWORK'); }) });
    await expect(checkAndFetchOta(u, fresh(), 1_000_000)).resolves.toBe('error');
    const u2 = mod({ fetchUpdateAsync: jest.fn(async () => { throw new Error('FETCH'); }) });
    const st = fresh();
    await expect(launchCheckOta(u2, st, 1, 3_000)).resolves.toBe('error');
    expect(st.ready).toBe(false);
  });

  it('KB-978 시작 — 스로틀 무시 + 상한 초과 = timeout 먼저, 뒤늦게 받으면 ready 기록(다음 복귀 적용)', async () => {
    jest.useFakeTimers();
    try {
      let finish!: () => void;
      const u = mod({ fetchUpdateAsync: jest.fn(() => new Promise<unknown>((r) => { finish = () => r({}); })) });
      const st = { lastCheckAt: 5_000, ready: false }; // 직전 체크가 있어도 시작은 스로틀 무시
      const p = launchCheckOta(u, st, 5_001, 3_000);
      await Promise.resolve();
      jest.advanceTimersByTime(2_999);
      let settled = false;
      void p.then(() => { settled = true; });
      await Promise.resolve();
      expect(settled).toBe(false); // 상한 전 = 대기
      jest.advanceTimersByTime(1);
      await expect(p).resolves.toBe('timeout');
      expect(st.ready).toBe(false);
      finish();
      await Promise.resolve();
      await Promise.resolve();
      expect(st.ready).toBe(true); // 체크는 뒤에서 계속 — 다음 복귀가 재체크 없이 적용
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('배선·워크플로·i18n 소스 잠금', () => {
  const fs = require('fs') as typeof import('fs');

  it('루트 레이아웃 — 기본 내보내기 = OtaLaunchGate가 앱 트리 전체를 감싼다 + 복귀 호스트 마운트', () => {
    const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
    expect(layout).toMatch(/export default function RootLayout\(\) \{\n  return \(\n    <OtaLaunchGate>\n      <AppRoot \/>\n    <\/OtaLaunchGate>/);
    expect(layout).toContain('<OtaAutoApplyHost />');
  });

  it('호스트 — __DEV__·isEnabled 게이트·expo-updates 지연 require·채널 분기 0(KB-978 운영·비운영 통일)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const host = require('fs').readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
    expect(host).toContain('if (__DEV__) return null;');
    expect(host).toContain('return u?.isEnabled ? u : null;');
    expect(host).toContain("require('expo-updates')");
    expect(host).not.toContain('isProdChannel');
    expect(host).not.toContain('BOOTED_AT');
    expect(host).not.toContain('ota.ready'); // P-316: 배너·수동 적용 경로 없음(유지)
  });

  it('EAS Workflow — develop 푸시 트리거 + prod 호스트 유출 가드 + clear 캐시 + fp 게이트', () => {
    const yml = fs.readFileSync('.eas/workflows/teamtest-update.yml', 'utf8') as string;
    expect(yml).toContain('develop');
    expect(yml).toContain('node scripts/teamtest-target.mjs base'); // 정본/env 일치 검사
    expect(yml.match(/node scripts\/teamtest-target.mjs guard dist/g)).toHaveLength(2); // export 직후 + publish 직전
    expect(yml).toContain('npx expo export --clear --platform ios --platform android'); // web 번들은 AdMob 네이티브 컴포넌트로 실패 — 발행 대상만(d9f6f98d 로봇 실패)
    expect(yml).toContain('--channel teamtest');
    expect(yml).toContain('--clear-cache');
    expect(yml).toMatch(/export[^\n]*--clear/); // Metro 캐시 클리어(8/26 규칙)
    // Codex #18 P2: 연속 push 직렬화 — 옛 런의 스테일 발행(OTA 롤백) 방지
    expect(yml).toContain('concurrency:');
    expect(yml).toContain('cancel_in_progress: true');
    // Codex #18 P1: fp 게이트 — 발행 스텝보다 앞에서 스크립트 경유
    expect(yml).toContain('fingerprint:generate');
    expect(yml.indexOf('ota-fp-gate.sh')).toBeGreaterThan(-1);
    expect(yml.indexOf('ota-fp-gate.sh')).toBeLessThan(yml.indexOf('eas-cli update'));
  });

  it('fp 게이트 셸(P-293b 플랫폼별) — 불일치=해당 플랫폼만 SKIP·전 플랫폼 불일치=실패·조회 실패=fail closed', () => {
    const { spawnSync } = require('child_process') as typeof import('child_process');
    const os = require('os') as typeof import('os');
    const path = require('path') as typeof import('path');
    const out = path.join(os.tmpdir(), `ota-gate-test-${process.pid}`);
    const run = (args: string[]) => spawnSync('bash', ['scripts/ota-fp-gate.sh', ...args, out], { encoding: 'utf8' });
    const plats = () => (fs.readFileSync(out, 'utf8') as string).trim();

    expect(run(['A', 'B', 'A', 'B']).status).toBe(0); // 양 플랫폼 일치
    expect(plats()).toBe('ios android');
    // 한 플랫폼 불일치 = 그 플랫폼만 SKIP(값 명시), 나머지는 발행 — #52 iOS 동반 차단 사고 방지
    const iosMiss = run(['A2', 'B', 'A', 'B']);
    expect(iosMiss.status).toBe(0);
    expect(iosMiss.stdout).toContain('SKIP: ios fp 불일치(installed=A ≠ current=A2)');
    expect(plats()).toBe('android');
    const andMiss = run(['A', 'B2', 'A', 'B']);
    expect(andMiss.status).toBe(0);
    expect(andMiss.stdout).toContain('SKIP: android fp 불일치(installed=B ≠ current=B2)');
    expect(plats()).toBe('ios');
    // 전 플랫폼 불일치 = 발행 대상 0 → 잡 실패(재빌드 필요 신호)
    const bothMiss = run(['A2', 'B2', 'A', 'B']);
    expect(bothMiss.status).toBe(1);
    expect(bothMiss.stdout).toContain('발행 가능 플랫폼 0');
    const noBuilds = run(['A', 'B', 'NONE', 'NONE']);
    expect(noBuilds.status).toBe(0); // 명시적 빌드 0건([]) = 경고만(도달 대상 없음)
    expect(noBuilds.stdout).toContain('WARN');
    expect(plats()).toBe('ios android');
    // Codex #18 P2: 조회/파싱 실패는 게이트가 열린 채 통과하면 안 된다 — fail closed
    for (const bad of [['A', 'B', 'LOOKUP_FAIL', 'B'], ['A', 'B', 'A', '']]) {
      const r = run(bad);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('조회 실패');
    }
    fs.unlinkSync(out);
  });

  it('P-293b 워크플로 — 플랫폼별 발행 배선(--platform + 게이트 산출 파일 소비)', () => {
    const yml = fs.readFileSync('.eas/workflows/teamtest-update.yml', 'utf8') as string;
    expect(yml).toContain('cat /tmp/ota-publish-platforms');
    expect(yml).toContain('--platform "$P"');
    expect(yml).toMatch(/for P in \$PLATS/);
  });

  it('P-316: i18n — ota.ready/apply 키 제거(10로케일 잔존 0, K-41 소멸)', () => {
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(fs.readFileSync(`src/lib/i18n/${loc}.json`, 'utf8') as string) as { ota?: Record<string, string> };
      expect(j.ota?.ready).toBeUndefined();
      expect(j.ota?.apply).toBeUndefined();
    }
  });
});
