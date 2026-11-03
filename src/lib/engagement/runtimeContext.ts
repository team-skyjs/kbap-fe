import { type RuntimeContext } from './schema';
interface Metadata {
  development: boolean; os: string; beBase: string; channel?: string | null;
  nativeVersion?: string | null; nativeBuild?: string | number | null;
  updateId?: string | null; runtimeVersion?: unknown;
}
/** Input must come from the installed runtime; OTA manifest version fields are not native build metadata. */
export function runtimeContext(meta: Metadata): RuntimeContext {
  let be_env: RuntimeContext['be_env'] = 'unknown';
  try {
    // teamtest host guard: 번들에 반대 환경 전체 호스트가 실리면 OTA 발행이 막힌다(10/27 e7132a20 실패) —
    // 전체 호스트 리터럴 없이 정확히 `<sub>.kbap.site` 한 단계만 dev/prod로(그 밖·https 아님 = other, 이전 규칙과 같음)
    const url = new URL(meta.beBase);
    const [sub, ...rest] = url.hostname.split('.');
    const ours = url.protocol === 'https:' && rest.join('.') === 'kbap.site';
    be_env = ours && sub === 'dev' ? 'dev' : ours && sub === 'prod' ? 'prod' : 'other';
  } catch { /* never forward the raw URL */ }
  const channels = ['production', 'preview', 'teamtest', 'teamtest-prod', 'development'];
  const channel = meta.channel && channels.includes(meta.channel) ? meta.channel : !meta.channel && meta.development ? 'local' : 'unknown';
  const version = (value: unknown) => typeof value === 'string' && /^[0-9]+([.][0-9]+){0,3}$/.test(value) ? value : 'unknown';
  return {
    app_env: meta.development ? 'development' : 'release', be_env, channel,
    os: ['ios', 'android', 'web'].includes(meta.os) ? meta.os as RuntimeContext['os'] : 'unknown',
    app_version: version(meta.nativeVersion), app_build: version(meta.nativeBuild == null ? undefined : String(meta.nativeBuild)),
    update_id: typeof meta.updateId === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(meta.updateId) ? meta.updateId : 'unknown',
    runtime_version: typeof meta.runtimeVersion === 'string' && /^[0-9a-f]{40,64}$/i.test(meta.runtimeVersion) ? meta.runtimeVersion : 'unknown',
  };
}
