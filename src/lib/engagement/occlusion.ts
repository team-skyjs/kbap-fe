/**
 * KB-873 lifecycle ②a — 화면 가림 상태 하나(중첩 카운터).
 * 가림 = 앱 안 덮개(Modal·사진 선택기·Alert·전면 광고·동의 폼)가 하나라도 떠 있음 **또는** AppState≠active
 * (외부 브라우저·설정·권한 팝업·ATT·Instagram 공유 등 앱을 떠나는 표면은 AppState로 잡힌다).
 * 체류 송신은 아직 OFF — ②b의 공용 스케줄러가 isOccluded()/subscribeOcclusion()을 읽는다.
 * 덮개는 직접 부르지 말고 occlusionSurfaces의 래퍼를 쓴다(occlusionLock 테스트가 src 전수 검사).
 */
import * as React from 'react';
import { AppState } from 'react-native';

let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** 덮개 하나 시작 — 돌려받은 release를 정확히 한 번 부른다(두 번째부터 무시: 언마운트·닫힘 이중 호출 안전) */
export function pushOcclusion(): () => void {
  count += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count -= 1;
    emit();
  };
}

/** 비동기 OS 표면(사진 선택기·동의 폼) — 끝나거나 실패하면 해제 */
export async function withOcclusion<T>(fn: () => Promise<T>): Promise<T> {
  const release = pushOcclusion();
  try {
    return await fn();
  } finally {
    release();
  }
}

/** 보이는 동안 가림(Modal·전면 광고) — false·언마운트 = 해제 */
export function useOcclusion(active: boolean): void {
  React.useEffect(() => (active ? pushOcclusion() : undefined), [active]);
}

export function isOccluded(): boolean {
  return count > 0 || AppState.currentState !== 'active';
}

/** 가림 상태가 바뀔 수 있을 때 알림(덮개 수·AppState) — 구독 해제 함수 반환 */
export function subscribeOcclusion(fn: () => void): () => void {
  listeners.add(fn);
  const sub = AppState.addEventListener('change', fn);
  return () => {
    listeners.delete(fn);
    sub.remove();
  };
}

/** 테스트 전용 — 모듈 전역 카운터 초기화 */
export function _resetOcclusionForTest(): void {
  count = 0;
}
