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
    const url = new URL(meta.beBase);
    be_env = url.protocol === 'https:' && url.hostname === 'dev.kbap.site' ? 'dev'
      : url.protocol === 'https:' && url.hostname === 'prod.kbap.site' ? 'prod' : 'other';
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
