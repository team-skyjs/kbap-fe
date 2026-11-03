/**
 * otaCheck (KB-420 → KB-978) — 체크→fetch 코어. expo-updates 모듈을 **주입**받는다:
 * jest에서 __DEV__ 게이트(호스트 컴포넌트 소관) 없이 흐름을 직접 실측하기
 * 위함 + 정적 import 금지 관례(구 런타임 방어) 유지.
 * 실패는 throw하지 않고 'error'로 — OTA는 부가 경로, 앱 동작에 영향 금지.
 */
import { OTA_CHECK_THROTTLE_MS } from './otaPolicy';

export interface OtaUpdatesModule {
  isEnabled: boolean;
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<unknown>;
}

/** 시작·복귀가 공유하는 세션 상태 — ready = 이번 런타임에서 새 번들 fetch 완료(아직 미적용). */
export interface OtaState {
  lastCheckAt: number;
  ready: boolean;
}

/** 'ready' = 새 번들 받음 · 'none' = 업데이트 없음 · 'error' = 체크/fetch 실패 · 'skip' = 비활성·스로틀(할 일 없음). */
export type OtaFetchResult = 'ready' | 'none' | 'error' | 'skip';

async function checkAndFetch(updates: OtaUpdatesModule, state: OtaState): Promise<'ready' | 'none' | 'error'> {
  try {
    const res = await updates.checkForUpdateAsync();
    if (!res.isAvailable) return 'none';
    await updates.fetchUpdateAsync();
    state.ready = true;
    return 'ready';
  } catch (e) {
    console.log('[ota] check/fetch failed (무시):', (e as Error)?.message ?? e);
    return 'error';
  }
}

/** 복귀용 — 2분 스로틀. */
export async function checkAndFetchOta(updates: OtaUpdatesModule, state: OtaState, now: number): Promise<OtaFetchResult> {
  if (!updates.isEnabled) return 'skip'; // Metro/dev client — OTA 비활성
  if (now - state.lastCheckAt < OTA_CHECK_THROTTLE_MS) return 'skip';
  state.lastCheckAt = now;
  return checkAndFetch(updates, state);
}

/** 시작용(KB-978) — 스로틀 없음 + 상한. 상한을 넘으면 'timeout'으로 먼저 돌려주고 체크는 뒤에서 계속
 *  (끝나서 받으면 state.ready — 다음 복귀가 적용, 아니면 expo-updates가 다음 콜드 스타트에 적용). */
export async function launchCheckOta(
  updates: OtaUpdatesModule,
  state: OtaState,
  now: number,
  timeoutMs: number,
): Promise<'ready' | 'none' | 'error' | 'timeout' | 'skip'> {
  if (!updates.isEnabled) return 'skip';
  state.lastCheckAt = now;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((r) => {
    timer = setTimeout(() => r('timeout'), timeoutMs);
  });
  try {
    return await Promise.race([checkAndFetch(updates, state), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
