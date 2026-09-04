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

  it('prod + 허용 라우트(탭 루트 3종) + 뮤테이션 0 = reload', () => {
    expect([...SAFE_ROUTES]).toEqual(['/', '/food', '/profile']);
    for (const pathname of SAFE_ROUTES) {
      expect(otaApplyDecision({ prod: true, pathname, mutating: 0 })).toBe('reload');
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

  it('제외 화면 명시 목록 — 스캔 전 과정·주문 카드·리뷰 작성·온보딩·프로필 수정', () => {
    for (const p of ['/scan', '/scan-order', '/food/7/review', '/onboarding', '/profile/edit']) {
      expect(isBlockedRoute(p)).toBe(true);
      expect(otaApplyDecision({ prod: true, pathname: p, mutating: 0 })).toBe('defer');
    }
    for (const p of ['/', '/food', '/profile', '/food/7', '/food/7/reviews']) {
      expect(isBlockedRoute(p)).toBe(false); // 리뷰 "목록"은 제외 아님 — 작성만
    }
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
    expect(layout).toContain('<OtaAutoApplyHost />');
  });

  it('호스트 — __DEV__ 게이트·expo-updates 지연 require·정책 경유·배너 제외 화면 미노출', () => {
    const host = fs.readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
    expect(host).toContain('if (__DEV__) return');
    expect(host).toContain("require('expo-updates')"); // 정적 import 금지(구 런타임 방어 관례)
    expect(host).not.toMatch(/^import .*'expo-updates'/m);
    expect(host).toContain('otaApplyDecision(');
    expect(host).toContain('isBlockedRoute(');
    expect(host).toContain('useIsMutating');
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

  it('fp 게이트 셸 — 일치=통과·불일치=실패·명시적 빌드 0건=경고 통과·조회 실패=fail closed', () => {
    const { spawnSync } = require('child_process') as typeof import('child_process');
    const run = (args: string[]) => spawnSync('bash', ['scripts/ota-fp-gate.sh', ...args], { encoding: 'utf8' });
    expect(run(['A', 'B', 'A', 'B']).status).toBe(0); // 양 플랫폼 일치
    const iosMiss = run(['A2', 'B', 'A', 'B']);
    expect(iosMiss.status).toBe(1);
    expect(iosMiss.stdout).toContain('ios fp 불일치');
    const andMiss = run(['A', 'B2', 'A', 'B']);
    expect(andMiss.status).toBe(1);
    expect(andMiss.stdout).toContain('android fp 불일치');
    const noBuilds = run(['A', 'B', 'NONE', 'NONE']);
    expect(noBuilds.status).toBe(0); // 명시적 빌드 0건([]) = 경고만(도달 대상 없음)
    expect(noBuilds.stdout).toContain('WARN');
    // Codex #18 P2: 조회/파싱 실패는 게이트가 열린 채 통과하면 안 된다 — fail closed
    for (const bad of [['A', 'B', 'LOOKUP_FAIL', 'B'], ['A', 'B', 'A', '']]) {
      const r = run(bad);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('조회 실패');
    }
  });

  it('i18n — ota.ready·ota.apply 10로케일 전부 존재(빈 값 금지)', () => {
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(fs.readFileSync(`src/lib/i18n/${loc}.json`, 'utf8') as string) as {
        ota?: { ready?: string; apply?: string };
      };
      expect(typeof j.ota?.ready).toBe('string');
      expect((j.ota?.ready ?? '').length).toBeGreaterThan(0);
      expect(typeof j.ota?.apply).toBe('string');
      expect((j.ota?.apply ?? '').length).toBeGreaterThan(0);
    }
  });
});
