import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One explicit target for client product gates, build env and OTA export/publish. Unknowns fail closed. */
export function resolveTeamtestTarget(config, buildConfig) {
  const hosts = { dev: 'dev.kbap.site', prod: 'prod.kbap.site' };
  const backend = config?.backend;
  if (backend !== 'dev' && backend !== 'prod') throw new Error('Unknown teamtest backend target');
  const base = `https://${hosts[backend]}`;
  if (buildConfig?.build?.teamtest?.channel !== 'teamtest'
      || buildConfig?.build?.teamtest?.env?.EXPO_PUBLIC_BE_BASE !== base) {
    throw new Error('teamtest target and build profile disagree');
  }
  return { backend, base, host: hosts[backend], blockedHost: hosts[backend === 'prod' ? 'dev' : 'prod'] };
}

export function checkTeamtestBundle(directory, target) {
  let expected = 0; let blocked = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        const content = readFileSync(path);
        if (content.includes(target.host)) expected++;
        if (content.includes(target.blockedHost)) blocked++;
      }
    }
  };
  walk(directory);
  if (!expected || blocked) throw new Error(`teamtest host guard failed (target files=${expected}, other files=${blocked})`);
  return { target: target.backend, targetFiles: expected, otherFiles: blocked };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const config = JSON.parse(readFileSync(new URL('../src/lib/teamtest-target.json', import.meta.url), 'utf8'));
    const buildConfig = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
    const target = resolveTeamtestTarget(config, buildConfig);
    if (process.argv[2] === 'base') console.log(target.base);
    else if (process.argv[2] === 'guard') console.log(JSON.stringify(checkTeamtestBundle(process.argv[3] ?? 'dist', target)));
    else throw new Error('Expected base or guard command');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid teamtest target');
    process.exitCode = 1;
  }
}
