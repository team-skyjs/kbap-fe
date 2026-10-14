/**
 * deeplink (KB-783) — 앱 딥링크의 **유일한 처리 지점**. 들어오는 길은 둘이다:
 *  ① OS가 연 URL(콜드·웜) — app/+native-intent가 expo-router 대신 여기로 넘기고 라우터 자동 이동은 막는다(null)
 *  ② 에어브릿지 SDK 콜백(setOnDeeplinkReceived) — 트래킹 링크(https://kbap.airbridge.io·abr.ge)를 `kbap://경로`로 되돌려 주고,
 *     지연 딥링크(설치 후 첫 실행)도, 에어브릿지가 아닌 `kbap://` 딥링크도 이 콜백으로 **다시** 온다.
 * 그래서 같은 URL이 ①②로 두 번 올 수 있다 → 짧은 창 안의 같은 경로는 1회만 이동(중복 이동 0).
 *
 * 허용 경로 = 아래 ROUTES 표뿐(알 수 없는 경로·파라미터 형식 불일치 = 무시). 알림 탭은 이 경로가 아니다(expo-notifications 데이터 → pushAdapter).
 * 게이트: 진입 정착 전(스플래시·신규 설치) 또는 로그인·온보딩 화면 위에서 도착하면 보류했다가 통과 뒤 1회 이동(마지막 것만).
 * 정착 뒤 일반 화면(탭·탭 밖 상세 스택)에선 즉시 이동.
 */
import * as React from 'react';
import { router, type Href } from 'expo-router';

export const DEEPLINK_SCHEME = 'kbap';
export const AIRBRIDGE_HOSTS = ['kbap.airbridge.io', 'kbap.abr.ge'] as const;

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** 지원 딥링크(광고 링크 작성용 표 — PR 본문과 같은 내용). 경로는 `kbap://` 뒤 부분, 앞뒤 슬래시 무시. */
const ROUTES: { pattern: string; to: (m: string[]) => string }[] = [
  { pattern: '', to: () => '/(tabs)' },
  { pattern: 'home', to: () => '/(tabs)' },
  { pattern: 'food', to: () => '/(tabs)/food' },
  { pattern: 'reviews', to: () => '/(tabs)/community' },
  { pattern: 'profile', to: () => '/(tabs)/profile' },
  { pattern: 'food/:id', to: ([id]) => `/food/${id}` },
  { pattern: 'food/:id/reviews', to: ([id]) => `/food/${id}/reviews` },
  { pattern: 'search', to: () => '/search' },
  { pattern: 'scan', to: () => '/scan' },
  { pattern: 'notifications', to: () => '/notifications' },
];
export const SUPPORTED_DEEPLINKS = ROUTES.map((r) => `kbap://${r.pattern}`);

function match(path: string): string | null {
  const segs = path.split('/').filter(Boolean);
  for (const r of ROUTES) {
    const pat = r.pattern.split('/').filter(Boolean);
    if (pat.length !== segs.length) continue;
    const params: string[] = [];
    let ok = true;
    for (let i = 0; i < pat.length; i++) {
      if (pat[i].startsWith(':')) {
        if (!ID.test(segs[i])) { ok = false; break; }
        params.push(segs[i]);
      } else if (pat[i] !== segs[i].toLowerCase()) { ok = false; break; }
    }
    if (ok) return r.to(params);
  }
  return null;
}

/** `kbap://…` → 앱 경로(허용 표에 있을 때만). 그 밖의 스킴·형식 = null. 쿼리스트링은 버린다(경로만 허용). */
export function resolveDeeplink(url: string): string | null {
  const m = /^kbap:\/\/([^?#]*)/i.exec(url.trim());
  if (!m) return null;
  let path: string;
  try {
    path = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return match(path);
}

/** OS가 연 URL 중 이 모듈이 맡는 것 — `kbap://`(개발 클라이언트 경로 제외)와 에어브릿지 트래킹 링크 */
export function isOwnedSystemUrl(url: string): boolean {
  if (/^kbap:\/\/expo-development-client/i.test(url)) return false;
  if (/^kbap:\/\//i.test(url)) return true;
  const h = /^https?:\/\/([^/?#]+)/i.exec(url);
  return !!h && (AIRBRIDGE_HOSTS as readonly string[]).includes(h[1].toLowerCase());
}

const DEDUPE_MS = 3000;
let last: { to: string; at: number } | null = null;
let tabsFocused = false;
/** 이 프로세스에서 탭이 한 번이라도 포커스됐나 — 네비게이터가 떠 있고 진입을 탭으로 통과했다는 신호(콜드 스타트에 스택 마운트 전 push 유실 방지) */
let tabsSeen = false;
/** 진입 게이트 정착(#278 Codex 3R) — RootLayout이 첫 실행 판별(entryChecked)과 로그인 리다이렉트까지 끝냈는가.
 *  신규 설치는 (tabs)가 먼저 마운트·포커스된 **뒤** 루트 effect가 /login으로 교체한다(자식 effect가 먼저 돈다) — 그 틈의 탭 포커스로
 *  이동하면 보류 링크가 로그인 직전에 소비·유실된다. */
let entryResolved = false;
/** 신규 설치: /login 교체(state 갱신)는 즉시지만 탭의 blur(포커스 정리)는 다음 렌더 — 그 사이 정착하면 아직 focused인 탭 기준으로
 *  로그인 위에 밀어 넣는다(#278 Codex 4R). 그래서 교체 직후엔 "탭을 떠날 때 정착"으로 예약한다. */
let resolveOnBlur = false;
/** 게이트 화면(로그인·온보딩)이 포커스 중인 수 — 이 위에선 이동하지 않고 보류(useDeeplinkGate) */
let gates = 0;
let pending: string | null = null;
let gateTimer: ReturnType<typeof setTimeout> | null = null;
/** KB-786(#281 Codex P2): 게이트 해제 지연 중(타이머 대기) — 이 동안 온 새 링크도 보류로 받아 보류분을 교체한다(옛 링크가 새 링크 위로 뒤늦게 덮지 않게) */
let releasing = false;
/** KB-786(#283 Codex P2): 보류분을 이동시킨 직후 — go()는 액션을 큐에 넣을 뿐이라 세그먼트가 아직 옛 경로다. 화면 조회가 실제 이동(세그먼트 변화)을
 *  볼 때까지 첫 기록을 계속 미룬다(useScreenTracking이 releaseNavHold). 목적지가 지금 화면과 같으면 변화가 없으니 시간 상한으로 푼다. */
let navAwait = false;
let navAwaitTimer: ReturnType<typeof setTimeout> | null = null;
const NAV_AWAIT_MAX_MS = 1500;
/** 게이트가 풀린 뒤 다음 화면 포커스(로그인→온보딩 교체 등)가 이어 붙을 시간 — 그 사이엔 flush하지 않는다 */
const GATE_RELEASE_MS = 300;

function go(to: string): void {
  try {
    // KB-786(#278 Codex P2 → #283 Codex P1): 탭 목적지 = 루트 스택을 (tabs) 셸까지 비우고(dismissAll) **탭 인식 navigate**로 탭 전환 —
    // 푸시 알림 탭과 같은 검증된 방식(lib/nav openNotificationRoute, KB-573). dismissTo('/(tabs)')는 스택 히스토리만 보고 탭은 안 바꿨다
    // (프로필 탭에서 kbap://home = 그대로 프로필). push면 셸 중복·back이 링크 전 상세로. 스택 화면(상세·검색 등)은 그대로 push.
    if (to.startsWith('/(tabs)')) {
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        /* 스택 밖 — 무시 */
      }
      router.navigate(to as Href);
    } else router.push(to as Href);
  } catch {
    /* 라우터 미준비 — 무시(보류 경로가 다시 시도) */
  }
}

/** KB-783 후속(Android QA 10/14): 진입이 정착했고 게이트(로그인·온보딩) 위가 아니면 **어느 화면이든 즉시**(탭 밖 상세 스택 포함).
 *  전엔 탭 포커스일 때만 이동 → 상세에서 받은 링크가 보류됐다가 back으로 탭에 돌아오는 순간 엉뚱하게 점프했다. */
function canNavigateNow(): boolean {
  return entryResolved && gates === 0 && !releasing && tabsSeen;
}

/** 두 입구(+native-intent·에어브릿지 콜백) 공용. 이동했거나 보류했으면 true. */
export function handleDeeplink(url: string, now: number = Date.now()): boolean {
  const to = resolveDeeplink(url);
  if (!to) return false; // 미지 경로·에어브릿지 https 원본(SDK가 kbap://로 다시 준다) = 무시
  if (last && last.to === to && now - last.at < DEDUPE_MS) return true; // 같은 링크가 두 입구로 — 1회만
  last = { to, at: now };
  if (!canNavigateNow()) {
    pending = to; // 스플래시·로그인·온보딩 위(·게이트 해제 대기) — 통과 후 이동(마지막 것만)
    notifyEntry(); // KB-786: 보류 상태 변화 = 화면 조회 보류(useScreenTracking)
    return true;
  }
  go(to);
  return true;
}

function flushIfReady(): void {
  if (!canNavigateNow() || !pending) return;
  const to = pending;
  pending = null;
  go(to);
  // 이동은 큐에 들어갔을 뿐 — 화면 조회 보류는 세그먼트가 실제로 바뀔 때(releaseNavHold) 또는 상한 뒤 해제(#283 Codex P2)
  navAwait = true;
  if (navAwaitTimer) clearTimeout(navAwaitTimer);
  navAwaitTimer = setTimeout(releaseNavHold, NAV_AWAIT_MAX_MS);
}

/** useScreenTracking 전용 — 보류분 이동 뒤 세그먼트가 바뀐 것을 확인했을 때(또는 상한) 화면 조회 재개 */
export function releaseNavHold(): void {
  if (navAwaitTimer) clearTimeout(navAwaitTimer);
  navAwaitTimer = null;
  if (!navAwait) return;
  navAwait = false;
  notifyEntry();
}

/** (tabs) 포커스 신호(useFocusEffect). 진입이 정착했으면 보류분 1회 이동. */
export function setDeeplinkReady(on: boolean): void {
  tabsFocused = on;
  if (on) tabsSeen = true;
  if (!on && resolveOnBlur) {
    resolveOnBlur = false;
    entryResolved = true; // 탭을 떠난 뒤 정착 — 이동은 게이트 통과 뒤(탭 포커스·게이트 해제)
    notifyEntry();
    return;
  }
  if (on && gates === 0 && releasing) {
    // 탭이 포커스됐고 게이트도 없다 = 안전한 착지 — 해제 대기를 끝내고 바로(KB-786)
    releasing = false;
    if (gateTimer) clearTimeout(gateTimer);
    gateTimer = null;
  }
  if (on) flushIfReady();
}

/** 게이트 화면(로그인·온보딩) 포커스 동안 이동 보류. 해제는 짧은 지연 뒤 재확인(다음 게이트가 이어 붙으면 그대로 보류) */
export function setDeeplinkGate(on: boolean): void {
  gates = Math.max(0, gates + (on ? 1 : -1));
  if (gateTimer) clearTimeout(gateTimer);
  gateTimer = null;
  releasing = false;
  if (on || !pending) return;
  releasing = true;
  gateTimer = setTimeout(() => {
    gateTimer = null;
    releasing = false;
    flushIfReady();
  }, GATE_RELEASE_MS);
}

/** RootLayout 전용 — 진입 게이트 정착(일반 부팅 = 스택 렌더 전, 신규 설치 = /login 교체 직후). 한 번 true면 유지(앱 프로세스 동안). */
export function markEntryResolved(): void {
  entryResolved = true;
  notifyEntry();
  if (tabsFocused) flushIfReady();
}

/** RootLayout 전용 — 신규 설치 /login 교체 **직후**. 탭이 아직 포커스면 블러 때 정착(그 전엔 이동 0), 탭이 없으면 즉시 정착. */
export function markEntryResolvedAfterLeavingTabs(): void {
  if (tabsFocused) resolveOnBlur = true;
  else markEntryResolved();
}

/** KB-784(PR 280 Codex P2): 진입 정착을 구독 가능하게 — screen_view가 신규 설치의 부팅 라우팅(정착 전 (tabs)/index)을 기록하지 않도록 */
const entryListeners = new Set<() => void>();
function notifyEntry(): void {
  for (const l of [...entryListeners]) l();
}
export function subscribeEntryResolved(cb: () => void): () => void {
  entryListeners.add(cb);
  return () => {
    entryListeners.delete(cb);
  };
}

/** KB-786(#280 Codex P2): 보류된 딥링크가 있으면 화면 조회를 미룬다 — 콜드 스타트 딥링크에서 기본 루트(홈)가 먼저 기록되던 것.
 *  이동(flush) 뒤 알림으로 재개되면 그때 화면 = 목적지. */
export function hasPendingDeeplink(): boolean {
  return pending !== null || navAwait;
}

/** 진입 정착 여부 — 홈 진입 계측(HOME_VIEWED)도 같은 신호로 막는다(로그인 게이트 전 홈 마운트는 '홈 진입'이 아니다) */
export function isEntryResolved(): boolean {
  return entryResolved;
}

/** 유닛 전용 */
export function __resetDeeplinkForTest(entry = true): void {
  last = null;
  tabsFocused = false;
  tabsSeen = entry; // 기존 유닛 = 정착된 앱(탭을 이미 지나옴) — 진입 흐름 유닛만 false로 시작
  entryResolved = entry;
  resolveOnBlur = false;
  gates = 0;
  releasing = false;
  navAwait = false;
  if (navAwaitTimer) clearTimeout(navAwaitTimer);
  navAwaitTimer = null;
  if (gateTimer) clearTimeout(gateTimer);
  gateTimer = null;
  pending = null;
}

/** 로그인·온보딩 화면 전용 — 마운트 동안 딥링크 보류(게이트). 두 화면은 떠날 때 항상 replace(언마운트)라 마운트 = 그 위에 있음 */
export function useDeeplinkGate(): void {
  React.useEffect(() => {
    setDeeplinkGate(true);
    return () => setDeeplinkGate(false);
  }, []);
}
