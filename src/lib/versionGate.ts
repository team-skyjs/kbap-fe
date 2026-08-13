/**
 * versionGate — 최소 지원 버전 게이트 (P-111/KB-269).
 *
 * 판정: 현재 마케팅 버전(Constants.expoConfig.version — 빌드번호 아님) vs
 * 서버 /app-config. min 미만 = 하드 게이트(blocked) · min≤현재<latest =
 * 소프트 넛지(nudge) · 그 외 = pass.
 *
 * **페일 오픈이 헌법**: 네트워크 실패·404·타임아웃·파싱 실패·필드 누락·semver
 * 형식 불량 — 전부 통과(게이트로 인한 벽돌 금지, 유닛 잠금). 구계약 오해석
 * 차단이 목적이지 앱을 잠그는 게 목적이 아니다.
 *
 * 구조: 모듈 싱글턴 스토어 — 루트에서 startVersionGate() 1회(시작 + 포그라운드
 * 복귀 시 재조회, 직전 5분 내 스킵), 게이트 오버레이/홈 배너는 useVersionGate()
 * 구독. JS-only(네이티브 신규 의존 0 — 지문 불변, OTA 안전).
 */
import * as React from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { api, APP_VERSION_PATH } from './api/client';
import { adaptAppConfig, type AppConfig } from './api/appConfigAdapter';
import { compareSemver } from './semver';

export type VersionGateState =
  | { mode: 'pass' }
  | { mode: 'blocked'; storeUrl: string | null }
  | { mode: 'nudge'; latestVersion: string; storeUrl: string | null };

const PASS: VersionGateState = { mode: 'pass' };

/** 순수 판정 — 유닛 대상. cfg/current 부재·형식 불량 = pass (페일 오픈). */
export function evaluateGate(
  cfg: AppConfig | null,
  currentVersion: string | null | undefined,
  platform: string,
): VersionGateState {
  if (!cfg || !currentVersion) return PASS;
  const storeUrl = platform === 'ios' ? cfg.storeUrls.ios : platform === 'android' ? cfg.storeUrls.android : null;
  const vsMin = compareSemver(currentVersion, cfg.minSupportedVersion);
  if (vsMin == null) return PASS;
  if (vsMin < 0) return { mode: 'blocked', storeUrl };
  if (cfg.latestVersion) {
    const vsLatest = compareSemver(currentVersion, cfg.latestVersion);
    if (vsLatest != null && vsLatest < 0) return { mode: 'nudge', latestVersion: cfg.latestVersion, storeUrl };
  }
  return PASS;
}

/* ---- 모듈 스토어 ---- */

let state: VersionGateState = PASS;
const subs = new Set<() => void>();
let lastFetchAt = 0;
let started = false;
const REFRESH_MIN_MS = 5 * 60_000;

function setState(next: VersionGateState) {
  state = next;
  subs.forEach((f) => f());
}

export async function refreshVersionGate(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFetchAt < REFRESH_MIN_MS) return; // 5분 내 재조회 스킵
  lastFetchAt = now;
  try {
    // P-199(KB-269): 실계약 배선 — GET /api/app-version(무인증·헤더 예외, 404 페일오픈 해소)
    const cfg = adaptAppConfig(await api.get<unknown>(APP_VERSION_PATH));
    setState(evaluateGate(cfg, Constants.expoConfig?.version, Platform.OS));
  } catch {
    // 페일 오픈 — 상태 유지(초기값 pass). 이미 blocked면 유지(일시 오프라인으로 게이트 해제 금지).
  }
}

/** 루트 1회 — 시작 조회 + 포그라운드 복귀 재조회. cleanup 반환. */
export function startVersionGate(): () => void {
  if (started) return () => {};
  started = true;
  void refreshVersionGate(true);
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void refreshVersionGate();
  });
  return () => {
    sub.remove();
    started = false;
  };
}

export function useVersionGate(): VersionGateState {
  return React.useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
    () => state,
  );
}

/** 현재 게이트 상태 — 훅 밖 조회(테스트·비리액트 코드). */
export function getVersionGateState(): VersionGateState {
  return state;
}

/** 테스트 전용 리셋. */
export function __resetVersionGate(): void {
  state = PASS;
  lastFetchAt = 0;
  started = false;
  subs.clear();
}
