import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const probe = `import {resolveTeamtestTarget, checkTeamtestBundle} from './scripts/teamtest-target.mjs';
const [config, build, directory] = JSON.parse(process.argv[1]);
const target = resolveTeamtestTarget(config, build);
console.log(JSON.stringify(directory ? checkTeamtestBundle(directory, target) : target));`;
const build = (backend: string) => ({ build: { teamtest: { channel: 'teamtest', env: { EXPO_PUBLIC_BE_BASE: `https://${backend}.kbap.site` } } } });
const run = (config: unknown, profile: unknown, directory?: string) => spawnSync(process.execPath, ['--input-type=module', '-e', probe, JSON.stringify([config, profile, directory])], { encoding: 'utf8' });

it('committed target and build profile resolve the production backend for the existing channel', () => {
  const result = spawnSync(process.execPath, ['scripts/teamtest-target.mjs', 'base'], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('https://prod.kbap.site');
});

it.each(['prod', 'dev'])('known target %s resolves only when the build env agrees', (backend) => {
  const result = run({ backend }, build(backend));
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ backend, base: `https://${backend}.kbap.site` });
  expect(run({ backend }, build(backend === 'prod' ? 'dev' : 'prod')).status).not.toBe(0);
});

it.each([{}, { backend: 'typo' }, { backend: null }, null])('unknown or missing target fails closed without a backend', (config) => {
  const result = run(config, build('prod'));
  expect(result.status).not.toBe(0);
  expect(result.stdout).toBe('');
});

it('host guard accepts actual target bytes, rejects stale/empty/mixed bundles, and traverses nested assets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kb870-host-'));
  try {
    expect(run({ backend: 'prod' }, build('prod'), directory).status).not.toBe(0);
    mkdirSync(join(directory, 'ios'));
    writeFileSync(join(directory, 'ios', 'entry.hbc'), Buffer.from([0, 255, ...Buffer.from('https://prod.kbap.site/api/home')]));
    const good = run({ backend: 'prod' }, build('prod'), directory);
    expect(good.status).toBe(0);
    expect(JSON.parse(good.stdout)).toEqual({ target: 'prod', targetFiles: 1, otherFiles: 0 });
    writeFileSync(join(directory, 'old.hbc'), 'https://dev.kbap.site');
    expect(run({ backend: 'prod' }, build('prod'), directory).status).not.toBe(0);
    writeFileSync(join(directory, 'ios', 'entry.hbc'), 'no host');
    expect(run({ backend: 'prod' }, build('prod'), directory).status).not.toBe(0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('workflow resolves the same target at export and publish; checks bytes before the SDK send', () => {
  const workflow = readFileSync('.eas/workflows/teamtest-update.yml', 'utf8');
  expect(workflow.match(/TEAMTEST_BE_BASE=\$\(node scripts\/teamtest-target.mjs base\) \|\| exit 1/g)).toHaveLength(2);
  expect(workflow.match(/EXPO_PUBLIC_BE_BASE="\$TEAMTEST_BE_BASE"/g)).toHaveLength(2);
  expect(workflow).not.toContain('EXPO_PUBLIC_BE_BASE=https://dev.kbap.site');
  const publish = workflow.slice(workflow.indexOf('- name: Publish to teamtest'));
  expect(publish.indexOf('guard dist || exit 1')).toBeLessThan(publish.indexOf('npx eas-cli update'));
  expect(publish).toContain('--channel teamtest');
  expect(publish).toContain('--clear-cache');
});
