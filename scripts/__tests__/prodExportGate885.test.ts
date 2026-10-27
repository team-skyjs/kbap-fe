/** KB-885 — 운영 OTA export 게이트: 호스트 + Amplitude 키 포함(production·preview) / 미포함(teamtest·development). 키 값 출력 0. */
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const FAKE_KEY = 'k885fakeamplitudekey0000000000ab';
const probe = `import {resolveExportGate, checkExport} from './scripts/prod-export-gate.mjs';
const [profile, build, directory, shell] = JSON.parse(process.argv[1]);
console.log(JSON.stringify(checkExport(directory, resolveExportGate(profile, build, shell ?? undefined))));`;
const BUILD = { build: {
  production: { channel: 'production', env: { EXPO_PUBLIC_BE_BASE: 'https://prod.kbap.site', EXPO_PUBLIC_AMPLITUDE_API_KEY: FAKE_KEY } },
  preview: { channel: 'preview', env: { EXPO_PUBLIC_BE_BASE: 'https://prod.kbap.site', EXPO_PUBLIC_AMPLITUDE_API_KEY: FAKE_KEY } },
  teamtest: { channel: 'teamtest', env: { EXPO_PUBLIC_BE_BASE: 'https://prod.kbap.site' } },
  development: { channel: 'development' },
} };
const run = (profile: string, directory: string, shell?: string, build: unknown = BUILD) =>
  spawnSync(process.execPath, ['--input-type=module', '-e', probe, JSON.stringify([profile, build, directory, shell ?? null])], { encoding: 'utf8' });
/** expo export 모양: metadata.json이 가리키는 플랫폼별 launch HBC(+ 무관한 .map) */
const bundle = (dir: string, text: string, android = text) => {
  mkdirSync(join(dir, '_expo'), { recursive: true });
  writeFileSync(join(dir, '_expo', 'ios.hbc'), Buffer.concat([Buffer.from([0, 255]), Buffer.from(text)]));
  writeFileSync(join(dir, '_expo', 'android.hbc'), Buffer.from(android));
  writeFileSync(join(dir, '_expo', 'ios.hbc.map'), '// dev.kbap.site 설명 주석(sourcesContent)');
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify({ fileMetadata: { ios: { bundle: '_expo/ios.hbc' }, android: { bundle: '_expo/android.hbc' } } }));
};

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'kb885-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it('production: 키 있는 번들 통과(길이·파일 수만) · 키 없는 번들(10/23 OTA1·OTA2 모양) 실패 — 출력에 키 값 0', () => {
  bundle(dir, `https://prod.kbap.site/api ${FAKE_KEY}`);
  const good = run('production', dir);
  expect(good.status).toBe(0);
  const ok = { target: 1, other: 0, key: 1 };
  expect(JSON.parse(good.stdout)).toEqual({ profile: 'production', host: 'prod.kbap.site', keyLength: 32, ios: ok, android: ok });
  bundle(dir, 'https://prod.kbap.site/api');
  const bad = run('production', dir);
  expect(bad.status).not.toBe(0);
  expect(bad.stderr).toContain('Amplitude key missing');
  for (const r of [good, bad]) expect(r.stdout + r.stderr).not.toContain(FAKE_KEY);
  expect(run('preview', dir).status).not.toBe(0);
  bundle(dir, `https://prod.kbap.site/api ${FAKE_KEY}`, 'https://prod.kbap.site/api'); // 한 플랫폼만 누락
  expect(run('production', dir).stderr).toContain('android: target=1, other=0, key=0');
});

it('teamtest·development: 운영 키 0이 정상 — 키가 실리면 실패', () => {
  bundle(dir, 'https://prod.kbap.site/api');
  expect(run('teamtest', dir).status).toBe(0);
  bundle(dir, `https://prod.kbap.site/api ${FAKE_KEY}`);
  const leaked = run('teamtest', dir);
  expect(leaked.status).not.toBe(0);
  expect(leaked.stderr).toContain('carries the production Amplitude key');
  expect(leaked.stdout + leaked.stderr).not.toContain(FAKE_KEY);
  bundle(dir, 'https://dev.kbap.site/api'); // development = 프로필 env 없음 → 셸 BE 기준
  expect(run('development', dir, 'https://dev.kbap.site').status).toBe(0);
  expect(run('development', dir).status).not.toBe(0); // BE 기준 없음 = fail closed
});

it('호스트 게이트 동봉: launch 번들의 반대 호스트·목표 0건·셸 BE 불일치·미지 프로필·metadata 없음 = 실패', () => {
  bundle(dir, `https://prod.kbap.site ${FAKE_KEY}`, `https://prod.kbap.site https://dev.kbap.site ${FAKE_KEY}`);
  expect(run('production', dir).stderr).toContain('host guard failed');
  bundle(dir, `https://prod.kbap.site ${FAKE_KEY}`);
  expect(run('production', dir).status).toBe(0); // .map 주석의 반대 호스트는 실행 코드가 아니다
  expect(run('production', dir, 'https://dev.kbap.site').status).not.toBe(0);
  expect(run('production', dir, 'https://prod.kbap.site').status).toBe(0);
  expect(run('staging', dir).status).not.toBe(0);
  bundle(dir, FAKE_KEY);
  expect(run('production', dir).stderr).toContain('host guard failed');
  rmSync(join(dir, 'metadata.json'));
  expect(run('production', dir).status).not.toBe(0);
});

it('CLI는 커밋된 eas.json을 읽는다 — 실제 운영 키 포함 export 통과, 미포함 실패, 값 출력 0', () => {
  const key = JSON.parse(readFileSync('eas.json', 'utf8')).build.production.env.EXPO_PUBLIC_AMPLITUDE_API_KEY as string;
  const cli = (profile: string) => spawnSync(process.execPath, ['scripts/prod-export-gate.mjs', profile, dir], { encoding: 'utf8', env: { ...process.env, EXPO_PUBLIC_BE_BASE: '' } });
  bundle(dir, 'https://prod.kbap.site');
  expect(cli('production').status).toBe(1);
  expect(cli('teamtest').status).toBe(0);
  bundle(dir, `https://prod.kbap.site ${key}`);
  const ok = cli('production');
  expect(ok.status).toBe(0);
  expect(ok.stdout + ok.stderr).not.toContain(key);
  expect(cli('teamtest').status).toBe(1);
});
