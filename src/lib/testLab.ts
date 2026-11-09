import { Platform } from 'react-native';

/**
 * P-626/KB-1016: Play 사전 출시 로봇(Firebase Test Lab 가상 기기) 판별 — Sentry·Amplitude 공용.
 * 조건 = Android + 구글 사내 빌드 커널 + 제조사·브랜드 비-Google(실기 Pixel 커널도 android-build@…google.com).
 * 로봇 실제 값: OnePlus/OnePlus8Pro, 커널 android-build@apa28.mtv.corp.google.com. timezone·locale·simulator(false)는 로봇마다 달라 안 씀.
 * 공식 판별(Settings.System "firebase.test.lab")은 네이티브 읽기라 지문 회전 → 1.0.6 빌드에서 별도.
 */
type DeviceCtx = { os?: { name?: unknown; kernel_version?: unknown }; device?: { manufacturer?: unknown; brand?: unknown } };
export function isTestLabContexts(contexts: unknown): boolean {
  const c = (contexts ?? {}) as DeviceCtx;
  const low = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '');
  return (
    low(c.os?.name) === 'android' &&
    /android-build@[^ )]*\.google\.com/.test(String(c.os?.kernel_version ?? '')) &&
    low(c.device?.manufacturer) !== 'google' &&
    low(c.device?.brand) !== 'google'
  );
}

/** 앱 시작 1회 계산·캐시. 근거 = Sentry 네이티브 모듈이 이미 내 주는 기기 contexts(Sentry DeviceContext가 이벤트에 합치는 바로 그 값) — 새 네이티브 0.
 *  Sentry 네이티브 init 전이면 null이 와서 1초 간격 3회까지 다시 묻는다. 끝내 못 받으면 false(보냄).
 *  ponytail: Sentry 내부 경로(dist/js/wrapper) 의존 — Sentry 메이저 업그레이드 때 확인, 1.0.6 공식 판별 도입 시 교체. */
let cached: Promise<boolean> | null = null;
export function detectTestLab(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  cached ??= (async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NATIVE } = require('@sentry/react-native/dist/js/wrapper') as typeof import('@sentry/react-native/dist/js/wrapper');
    for (let i = 0; i < 3; i++) {
      try {
        const res = await NATIVE.fetchNativeDeviceContexts();
        if (res?.contexts) return isTestLabContexts(res.contexts);
      } catch {
        // 네이티브 미준비 — 잠시 뒤 다시
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  })();
  return cached;
}
