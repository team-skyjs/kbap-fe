/**
 * KB-877 — 가공식품 1시간 무료 창 표시. 창은 서버가 정한다(freeUntil, ISO) — 앱은 끝 시각까지 남은 분만 보여 준다(창 계산 0).
 * 출처: 프로필(카메라 진입·포그라운드 복귀 때 재조회) + 확정·성분표 응답(받은 즉시 프로필 캐시에 반영).
 */
import * as React from 'react';
import { AppState, StyleSheet, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { QueryClient } from '@tanstack/react-query';
import { Txt as Text } from '@/components/Txt';
import { useMe } from '@/lib/data/useMe';
import { color as C, font } from '@/lib/theme';
import type { User } from '@/lib/api/types';

/** 끝 시각까지 남은 분(올림) — 지났거나 없음·해석 불가 = 0 */
export function freeMinutesLeft(untilIso: string | null | undefined, nowMs: number): number {
  const end = untilIso ? Date.parse(untilIso) : NaN;
  if (!Number.isFinite(end) || end <= nowMs) return 0;
  return Math.ceil((end - nowMs) / 60_000);
}

/** 확정·성분표 응답의 freeUntil을 프로필 캐시(['me', lang])에 그대로 반영 — ['me','reviews'] 등 프로필 아닌 캐시는 건드리지 않는다 */
export function applyFreeUntil(qc: QueryClient, freeUntil: string | null): void {
  qc.setQueriesData<unknown>({ queryKey: ['me'] }, (old: unknown) =>
    old && typeof old === 'object' && !Array.isArray(old) && 'restrictions' in old ? { ...(old as User), packagedFreeUntil: freeUntil } : old,
  );
}

// 분 표시용 공용 시계 — 줄이 떠 있는 동안만 15초 간격 1개 + 포그라운드 복귀 즉시. 렌더 중 Date.now() 직접 읽기 금지(컴파일러가 굳힌다)
const TICK_MS = 15_000;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
let clockApp: { remove: () => void } | null = null;
const notifyClock = () => clockListeners.forEach((l) => l());
function subscribeClock(fn: () => void): () => void {
  clockListeners.add(fn);
  if (!clockTimer) {
    clockTimer = setInterval(notifyClock, TICK_MS);
    clockApp = AppState.addEventListener('change', (s) => { if (s === 'active') notifyClock(); });
  }
  return () => {
    clockListeners.delete(fn);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
      clockApp?.remove();
      clockApp = null;
    }
  };
}
// ponytail: 15초 단위로 내린 시각 — 표시가 최대 15초 늦게 바뀐다(분 단위 문구라 체감 0). 초 단위가 필요하면 TICK_MS를 줄인다
const clockNow = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/** "Free packaged scans for 42 min" — 창이 없거나 끝나면 아무것도 그리지 않는다 */
export function PackagedFreeLine({ style, testID = 'pscan-free-line' }: { style?: TextStyle; testID?: string }) {
  const { t } = useTranslation();
  const until = useMe().data?.packagedFreeUntil ?? null;
  const now = React.useSyncExternalStore(subscribeClock, clockNow, clockNow);
  const minutes = freeMinutesLeft(until, now);
  if (minutes <= 0) return null;
  return <Text style={[st.line, style]} testID={testID}>{t('packagedScan.freeFor', { count: minutes })}</Text>;
}

const st = StyleSheet.create({
  line: { fontFamily: font.bodyBold, fontSize: 13, lineHeight: 18, color: C.primaryText },
});
