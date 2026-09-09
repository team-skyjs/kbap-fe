/**
 * KB-420(P-204): OTA 자동 적용 — 채널별 정책(teamtest 즉시 / prod 안전 순간+배너)
 * + EAS Workflow(develop→teamtest 자동 발행) 잠금.
 *
 * 구조: otaPolicy(순수 판정) · otaCheck(체크→fetch 코어, 모듈 주입형) ·
 * OtaAutoApplyHost(루트 배선+배너)는 소스 잠금으로 커버(__DEV__ 게이트가
 * jest에서 참이라 컴포넌트 실구동 대신 코어를 직접 실측 — 관례).
 */
import { isBlockedRoute, OTA_CHECK_THROTTLE_MS, otaApplyDecision, SAFE_ROUTES } from '../otaPolicy';
import { checkAndFetchOta, type OtaUpdatesModule } from '../otaCheck';

describe('otaPolicy — 채널×라우트×뮤테이션 판정', () => {
  it('비-prod(teamtest 등) = 어디서든 즉시 reload', () => {
    for (const pathname of ['/', '/scan', '/food/7/review', '/onboarding']) {
      expect(otaApplyDecision({ prod: false, pathname, mutating: 1 })).toBe('reload');
    }
  });

  it('P-316: prod = 항상 defer(라우트·뮤테이션 무관 — 다음 콜드 스타트 자동 적용)', () => {
    for (const pathname of ['/', '/food', '/profile', '/scan', '/food/7']) {
      expect(otaApplyDecision({ prod: true, pathname, mutating: 0 })).toBe('defer');
      expect(otaApplyDecision({ prod: true, pathname, mutating: 2 })).toBe('defer');
    }
  });

    it('prod + 허용 라우트라도 뮤테이션 진행 중이면 defer', () => {
    expect(otaApplyDecision({ prod: true, pathname: '/', mutating: 1 })).toBe('defer');
  });

  it('prod + 비허용 라우트 = defer (상세·검색 등)', () => {
    for (const pathname of ['/food/7', '/search', '/community']) {
      expect(otaApplyDecision({ prod: true, pathname, mutating: 0 })).toBe('defer');
    }
  });

  it('제외 화면 — 스캔 전 과정·주문 카드·리뷰 작성·온보딩·프로필 하위 전체(Codex #18)', () => {
    for (const p of ['/scan', '/scan-order', '/food/7/review', '/onboarding', '/profile/edit', '/profile/diet', '/profile/restrictions', '/profile/saved']) {
      expect(isBlockedRoute(p)).toBe(true);
      expect(otaApplyDecision({ prod: true, pathname: p, mutating: 0 })).toBe('defer');
    }
    for (const p of ['/', '/food', '/profile', '/food/7', '/food/7/reviews']) {
      expect(isBlockedRoute(p)).toBe(false); // 탭 루트·리뷰 "목록"은 제외 아님
    }
  });
});

describe('P-304(KB-458): canReloadNow — reloadAsync 부팅 가드(3조건 AND)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { canReloadNow, OTA_BOOT_GUARD_MS } = require('../otaPolicy') as typeof import('../otaPolicy');
  const OK = { bootedAt: 0, now: OTA_BOOT_GUARD_MS, splashDone: true, appState: 'active', networkIdle: true }; // P-347: 4조건 AND

  it('전부 충족 = true(경계 8s 포함)', () => {
    expect(canReloadNow(OK)).toBe(true);
    expect(canReloadNow({ ...OK, now: OTA_BOOT_GUARD_MS + 60_000 })).toBe(true);
  });

  it('부팅 8s 미경과 = false(b28 크래시 재현 창 — 3s)', () => {
    expect(canReloadNow({ ...OK, now: 3_000 })).toBe(false);
  });

  it('스플래시 미종료 = false', () => {
    expect(canReloadNow({ ...OK, splashDone: false })).toBe(false);
  });

  it('비포그라운드(background/inactive) = false', () => {
    expect(canReloadNow({ ...OK, appState: 'background' })).toBe(false);
    expect(canReloadNow({ ...OK, appState: 'inactive' })).toBe(false);
  });

  it('P-347(KB-509): networkIdle false = false — 진행 중 fetch reject가 죽은 런타임에 스케줄되는 크래시 봉쇄', () => {
    expect(canReloadNow({ ...OK, networkIdle: false })).toBe(false);
  });

  it('호스트 배선 소스 잠금 — 가드 경유 적용·타이머 1회 재평가·배너 탭 동일 경로·splashDone 배선', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    const host = fs.readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
    expect(host).toContain('const BOOTED_AT = Date.now();'); // 모듈 로드 시각
    expect(host).toContain('if (!canReloadNow({ bootedAt: BOOTED_AT'); // 가드 통과 시에만 applyNow
    expect(host).toContain('if (tryApply()) return;'); // 정책 reload여도 가드 선행(teamtest immediate 포함)
    expect(host).toContain('setTimeout(() => setGuardTick((n) => n + 1), remain)'); // 충족 시각 1회 재평가
    expect(host).toContain('return null;'); // P-316: 배너 렌더 0(수동 적용 경로 소멸)
    const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
    expect(layout).toContain('<OtaAutoApplyHost splashDone={!splashVisible} />');
  });
});

describe('otaCheck 코어 — 스로틀·isEnabled·fetch 흐름 (모듈 주입 실측)', () => {
  const mod = (over: Partial<OtaUpdatesModule> = {}): OtaUpdatesModule => ({
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({})),
    ...over,
  });

  it('업데이트 있음 → fetch 후 ready + 체크 시각 기록', async () => {
    const u = mod();
    const st = { lastCheckAt: 0 };
    await expect(checkAndFetchOta(u, st, 1_000_000)).resolves.toBe('ready');
    expect(u.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(st.lastCheckAt).toBe(1_000_000);
  });

  it('스로틀 — 2분 내 재호출은 체크 자체를 생략', async () => {
    const u = mod();
    const st = { lastCheckAt: 1_000_000 };
    await expect(checkAndFetchOta(u, st, 1_000_000 + OTA_CHECK_THROTTLE_MS - 1)).resolves.toBe('skip');
    expect(u.checkForUpdateAsync).not.toHaveBeenCalled();
    await expect(checkAndFetchOta(u, st, 1_000_000 + OTA_CHECK_THROTTLE_MS)).resolves.toBe('ready');
  });

  it('Updates.isEnabled=false(Metro) = no-op', async () => {
    const u = mod({ isEnabled: false });
    await expect(checkAndFetchOta(u, { lastCheckAt: 0 }, 1)).resolves.toBe('skip');
    expect(u.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('업데이트 없음 = skip(fetch 미호출)', async () => {
    const u = mod({ checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })) });
    await expect(checkAndFetchOta(u, { lastCheckAt: 0 }, 1)).resolves.toBe('skip');
    expect(u.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('체크/페치 실패 = 조용히 skip(throw 없음)', async () => {
    const u = mod({ checkForUpdateAsync: jest.fn(async () => { throw new Error('NETWORK'); }) });
    await expect(checkAndFetchOta(u, { lastCheckAt: 0 }, 1)).resolves.toBe('skip');
  });
});

describe('배선·워크플로·i18n 소스 잠금', () => {
  const fs = require('fs') as typeof import('fs');

  it('루트 레이아웃이 OtaAutoApplyHost를 마운트한다', () => {
    const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
    expect(layout).toContain('<OtaAutoApplyHost splashDone={!splashVisible} />'); // P-304: 가드 조건 ② 배선
  });

  it('호스트 — __DEV__ 게이트·expo-updates 지연 require·정책 경유·배너 소멸(P-316)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const host = require('fs').readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
    expect(host).toContain('if (__DEV__) return;');
    expect(host).toContain("require('expo-updates')");
    expect(host).toContain('otaApplyDecision(');
    expect(host).not.toContain('ota.ready'); // P-316: prod 배너·수동 적용 소멸
    expect(host).not.toContain('ota-banner');
  });

  it('EAS Workflow — develop 푸시 트리거 + prod 호스트 유출 가드 + clear 캐시 + fp 게이트', () => {
    const yml = fs.readFileSync('.eas/workflows/teamtest-update.yml', 'utf8') as string;
    expect(yml).toContain('develop');
    expect(yml).toContain('prod.kbap.site'); // grep 가드(0건 아니면 실패)
    expect(yml).toContain('dev.kbap.site'); // 목표 호스트 주입 + 1건 이상 확인
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
