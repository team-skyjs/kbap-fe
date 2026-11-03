/**
 * simulator (KB-970) — 지금 시뮬레이터·에뮬레이터에서 도는지. 새 네이티브 의존성 0(expo-device를 넣으면 지문이 돈다).
 * - iOS: expo-application `getIosApplicationReleaseTypeAsync()` = SIMULATOR(expo-notifications가 이미 끌고 와 빌드에 있음 — deviceInfo와 같은 지연 require)
 * - Android: Platform.constants의 빌드 지문·모델(에뮬레이터 = generic·emulator·sdk_gphone·"Android SDK built for")
 * 모르면 false(실기로 본다 — 디버그 표면은 숨기는 쪽이 안전).
 */
import { Platform } from 'react-native';
import * as React from 'react';
import { isDiagnosticChannel } from '@/lib/flags';

type AndroidConstants = { Fingerprint?: string; Model?: string; Brand?: string; Manufacturer?: string };

/** 순수 판정(유닛) — Android 빌드 상수로 에뮬레이터 여부 */
export function isAndroidEmulator(c: AndroidConstants | undefined): boolean {
  if (!c) return false;
  const fp = (c.Fingerprint ?? '').toLowerCase();
  const model = (c.Model ?? '').toLowerCase();
  return (
    fp.startsWith('generic') || fp.includes('emulator') || fp.includes('sdk_gphone') || fp.includes('/emu64') ||
    model.includes('emulator') || model.includes('sdk_gphone') || model.includes('android sdk built for') ||
    (c.Brand ?? '').toLowerCase().startsWith('generic') || (c.Manufacturer ?? '') === 'Genymotion'
  );
}

let cached: Promise<boolean> | null = null;
export function isSimulator(): Promise<boolean> {
  if (!cached) cached = detect();
  return cached;
}
async function detect(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') return isAndroidEmulator(Platform.constants as AndroidConstants);
    if (Platform.OS !== 'ios') return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const App = require('expo-application') as typeof import('expo-application');
    return (await App.getIosApplicationReleaseTypeAsync()) === App.ApplicationReleaseType.SIMULATOR;
  } catch {
    return false;
  }
}

/** 판정 전 = false(실기 취급) → 시뮬이면 곧 true */
export function useIsSimulator(): boolean {
  const [sim, setSim] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    void isSimulator().then((v) => { if (live) setSim(v); });
    return () => { live = false; };
  }, []);
  return sim;
}

/** 디버그 OCR 주입(가공식품 스캔 앞면·성분표) 노출 — 개발 번들·진단 채널(dev·teamtest)만, 스토어 채널 0.
 *  KB-970(예진 11/03): 실기에선 채널 무관 숨김 — 카메라 위 입력칸이 성분표 글자를 가렸다. 시뮬은 카메라 OCR이 없어 계속 필요(QA Maestro 주입) */
export const showOcrDebug = (simulator: boolean): boolean => simulator && (__DEV__ || isDiagnosticChannel());

/** 유닛 전용 */
export function _resetSimulatorForTest(): void {
  cached = null;
}
