/**
 * otaCheck (KB-420) — 체크→fetch 코어. expo-updates 모듈을 **주입**받는다:
 * jest에서 __DEV__ 게이트(호스트 컴포넌트 소관) 없이 흐름을 직접 실측하기
 * 위함 + 정적 import 금지 관례(구 런타임 방어) 유지.
 * 실패는 조용히 skip(로그만) — OTA는 부가 경로, 앱 동작에 영향 금지.
 */
import { OTA_CHECK_THROTTLE_MS } from './otaPolicy';

export interface OtaUpdatesModule {
  isEnabled: boolean;
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<unknown>;
}

/** 'ready' = 새 번들 fetch 완료(적용 판정으로 넘어감) / 'skip' = 할 일 없음. */
export async function checkAndFetchOta(
  updates: OtaUpdatesModule,
  state: { lastCheckAt: number },
  now: number,
): Promise<'ready' | 'skip'> {
  if (!updates.isEnabled) return 'skip'; // Metro/dev client — OTA 비활성
  if (now - state.lastCheckAt < OTA_CHECK_THROTTLE_MS) return 'skip';
  state.lastCheckAt = now;
  try {
    const res = await updates.checkForUpdateAsync();
    if (!res.isAvailable) return 'skip';
    await updates.fetchUpdateAsync();
    return 'ready';
  } catch (e) {
    console.log('[ota] check/fetch failed (무시):', (e as Error)?.message ?? e);
    return 'skip';
  }
}
