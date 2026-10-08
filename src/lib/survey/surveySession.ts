/**
 * surveySession (KB-729 공부 #244 1) — "나중에"는 **이번 앱 실행 동안만** 설문을 숨긴다. 메모리 플래그뿐, 영구 저장 금지:
 * 서버가 surveyCompleted=false인 한 다음 실행에 다시 묻는다(필수 의도 유지). 존재 이유 = 벽돌화 방지 —
 * 서버 400(계약 결함)·API 장애·탈퇴 처리 중(MEMBER-003)이면 닫기 불가 시트가 홈(탭바까지)을 영구 차단하던 것.
 * 렌더는 useSyncExternalStore로 구독(모듈 변수 직접 읽기는 컴파일러가 굳힌다 — KB-694).
 */
import { useSyncExternalStore } from 'react';

let hiddenThisRun = false;
const listeners = new Set<() => void>();

export function hideSurveyThisRun(): void {
  if (hiddenThisRun) return;
  hiddenThisRun = true;
  listeners.forEach((l) => l());
}
export const isSurveyHiddenThisRun = (): boolean => hiddenThisRun;

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function useSurveyHiddenThisRun(): boolean {
  return useSyncExternalStore(subscribe, isSurveyHiddenThisRun, isSurveyHiddenThisRun);
}

/* ---- 시트 표시 중 딥링크 보류(공부 #244 실기 확인거리) — 닫기 불가 시트 위로 fullScreenModal(스캔 등)이 열리면 KB-377류 교착.
 *  시트가 떠 있는 동안 들어온 알림 탭 이동은 시트가 닫힌 뒤(제출 성공·나중에) 순서대로 실행. 안 떠 있으면 즉시. */
let presented = false;
const pending: (() => void)[] = [];
export function setSurveyPresented(on: boolean): void {
  presented = on;
  if (!on) { const run = pending.splice(0); run.forEach((f) => f()); }
}
export const isSurveyPresented = (): boolean => presented;
export function deferUntilSurveyClosed(fn: () => void): void {
  if (presented) pending.push(fn);
  else fn();
}

/** 유닛용 */
export function _resetSurveyHiddenForTest(): void {
  hiddenThisRun = false;
  presented = false;
  pending.length = 0;
  listeners.forEach((l) => l());
}
