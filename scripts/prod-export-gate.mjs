import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * KB-885 — OTA export 게이트: 호스트(목표 1+ · 반대 0) + 운영 Amplitude 키를 한 번에 본다.
 * 10/23 OTA1·OTA2가 BE만 인라인하고 키 없이 export돼 운영 analytics가 no-op였다
 * (eas update는 eas.json build 프로필 env를 안 읽는다). 절차: docs/release/PROD-OTA-REPUBLISH.md
 *
 * production·preview = 키 포함 파일 1+ 필수 · teamtest·development = 운영 키 0(정상).
 * 키 값은 어떤 출력에도 싣지 않는다 — 길이·파일 수만.
 * 사용: node scripts/prod-export-gate.mjs <profile> [dist]
 */
const HOSTS = { 'https://dev.kbap.site': 'prod.kbap.site', 'https://prod.kbap.site': 'dev.kbap.site' };
const KEY_REQUIRED = new Set(['production', 'preview']);
const KEY_FORBIDDEN = new Set(['teamtest', 'teamtest-prod', 'development']);

export function resolveExportGate(profile, buildConfig, shellBase) {
  const builds = buildConfig?.build ?? {};
  if (!KEY_REQUIRED.has(profile) && !KEY_FORBIDDEN.has(profile)) throw new Error(`Unknown export profile: ${profile}`);
  const env = builds[profile]?.env ?? {};
  // 프로필 env가 정본, 없으면(development) 셸 값. 둘 다 있으면 일치해야 한다(셸 오염 차단).
  if (env.EXPO_PUBLIC_BE_BASE && shellBase && env.EXPO_PUBLIC_BE_BASE !== shellBase) {
    throw new Error(`shell EXPO_PUBLIC_BE_BASE disagrees with ${profile} profile`);
  }
  const base = env.EXPO_PUBLIC_BE_BASE ?? shellBase;
  if (!HOSTS[base]) throw new Error(`No known BE base for ${profile}`);
  const keys = [...new Set(Object.values(builds).map((b) => b?.env?.EXPO_PUBLIC_AMPLITUDE_API_KEY).filter(Boolean))];
  const keyRequired = KEY_REQUIRED.has(profile);
  if (keyRequired && !env.EXPO_PUBLIC_AMPLITUDE_API_KEY) throw new Error(`${profile} profile has no Amplitude key`);
  return { profile, host: new URL(base).host, blockedHost: HOSTS[base], keys, keyRequired, keyLength: keyRequired ? env.EXPO_PUBLIC_AMPLITUDE_API_KEY.length : 0 };
}

/** 플랫폼별 launch 번들(metadata.json)만 본다 — .map의 sourcesContent 주석(dev 설명)은 실행 코드가 아니다. */
export function checkExport(directory, gate) {
  const files = JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8')).fileMetadata ?? {};
  const platforms = Object.keys(files).sort();
  if (!platforms.length) throw new Error(`${gate.profile} export has no launch bundles`);
  const result = { profile: gate.profile, host: gate.host, keyLength: gate.keyLength };
  for (const platform of platforms) {
    const content = readFileSync(join(directory, files[platform].bundle));
    const target = content.includes(gate.host) ? 1 : 0;
    const other = content.includes(gate.blockedHost) ? 1 : 0;
    const key = gate.keys.some((k) => content.includes(k)) ? 1 : 0;
    const counts = `${platform}: target=${target}, other=${other}, key=${key}`;
    if (!target || other) throw new Error(`${gate.profile} host guard failed (${counts})`);
    if (gate.keyRequired && !key) throw new Error(`${gate.profile} Amplitude key missing from export (${counts})`);
    if (!gate.keyRequired && key) throw new Error(`${gate.profile} export carries the production Amplitude key (${counts})`);
    result[platform] = { target, other, key };
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const buildConfig = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
    const gate = resolveExportGate(process.argv[2], buildConfig, process.env.EXPO_PUBLIC_BE_BASE);
    console.log(JSON.stringify(checkExport(process.argv[3] ?? 'dist', gate)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'export gate failed');
    process.exitCode = 1;
  }
}
