/**
 * P-407 — `teamtest-prod` 채널(prod 백엔드 리허설 테플 빌드)이 채널 헬퍼에서 어느 쪽으로 해석되는지 잠근다.
 * 원칙: **백엔드는 prod처럼**(eas.json env) · **진단 노출·OTA 적용 정책은 teamtest처럼**.
 *
 * ⚠️ `flags.ts`를 목으로 바꾸지 않는다 — 실제 헬퍼를 `expo-updates` 채널 문자열만 바꿔 로드한다.
 * 목에 허용 목록을 다시 적으면 헬퍼가 틀려도 테스트는 통과한다(불리언 목의 사각).
 */
import * as fs from 'fs';

type Flags = typeof import('@/lib/flags');
function flagsFor(channel: string | null): Flags {
  let out!: Flags;
  jest.isolateModules(() => {
    jest.doMock('expo-updates', () => ({ channel }));
    out = require('@/lib/flags') as Flags; // eslint-disable-line @typescript-eslint/no-require-imports
  });
  return out;
}

afterEach(() => jest.dontMock('expo-updates'));

describe('채널 해석표 — 실제 flags.ts', () => {
  it.each([
    // channel,        prod,  diagnostic
    ['production', true, false],
    ['preview', false, false], // production 백엔드 내부 배포 — 진단 미노출(#176)
    ['teamtest', false, true],
    ['teamtest-prod', false, true], // P-407: 진단·OTA 정책은 teamtest처럼
    ['development', false, true],
    [null, false, true], // 로컬
  ])('%s → isProdChannel=%s · isDiagnosticChannel=%s', (channel, prod, diag) => {
    const f = flagsFor(channel as string | null);
    expect(f.isProdChannel()).toBe(prod);
    expect(f.isDiagnosticChannel()).toBe(diag);
  });
});

describe('eas.json teamtest-prod 프로필', () => {
  const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8')) as {
    build: Record<string, { extends?: string; channel?: string; env?: Record<string, string> }>;
  };
  const p = eas.build['teamtest-prod'];

  it('백엔드 = prod · 채널 = teamtest-prod(로봇 채널과 분리) · teamtest 상속(autoIncrement)', () => {
    expect(p.extends).toBe('teamtest');
    expect(p.env?.EXPO_PUBLIC_BE_BASE).toBe('https://prod.kbap.site');
    expect(p.channel).toBe('teamtest-prod');
    expect(eas.build.teamtest.channel).toBe('teamtest'); // 기존 teamtest는 그대로
  });

  it('Amplitude 키 없음 — 프로젝트가 Prod 하나라 리허설 기기 이벤트가 실데이터에 섞인다(커맨드 센터 결정)', () => {
    expect(Object.keys(p.env ?? {})).toEqual(['EXPO_PUBLIC_BE_BASE']);
  });

  /* P-408 실측: submit.production의 android는 track production·completed라 "내부 트랙까지만" 발주에 그대로 쓰면
     production 트랙 출시가 된다(AD_ID 미신고 거부가 막아 줬다). 스토어 빌드의 Play 제출은 반드시 이 프로필로. */
  it('Play 내부 트랙 제출 프로필 — submit.production-internal = internal/completed · production 프로필은 무변', () => {
    const sub = (eas as unknown as { submit: Record<string, { android?: { track: string; releaseStatus: string } }> }).submit;
    expect(sub['production-internal'].android).toEqual({ track: 'internal', releaseStatus: 'completed' });
    // production 프로필 = 예진 콘솔 승격 대신 **직접 출시**하는 경로 — 발주에 명시될 때만 쓴다(eas.json 스키마가 주석 키를 거부해 여기 기록).
    expect(sub.production.android).toEqual({ track: 'production', releaseStatus: 'completed' });
  });

  it('로봇 OTA는 teamtest 채널에만 발행 — dev 번들이 teamtest-prod 빌드에 꽂히지 않는다', () => {
    const wf = fs.readFileSync('.eas/workflows/teamtest-update.yml', 'utf8');
    expect(wf).toMatch(/--channel teamtest /); // 대조: 발행 채널이 실제로 적혀 있다
    expect(wf).not.toContain('teamtest-prod');
  });
});
