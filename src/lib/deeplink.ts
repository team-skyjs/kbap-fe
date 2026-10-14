/**
 * deeplink (KB-783) — 앱 딥링크의 **유일한 처리 지점**. 들어오는 길은 둘이다:
 *  ① OS가 연 URL(콜드·웜) — app/+native-intent가 expo-router 대신 여기로 넘기고 라우터 자동 이동은 막는다(null)
 *  ② 에어브릿지 SDK 콜백(setOnDeeplinkReceived) — 트래킹 링크(https://kbap.airbridge.io·abr.ge)를 `kbap://경로`로 되돌려 주고,
 *     지연 딥링크(설치 후 첫 실행)도, 에어브릿지가 아닌 `kbap://` 딥링크도 이 콜백으로 **다시** 온다.
 * 그래서 같은 URL이 ①②로 두 번 올 수 있다 → 짧은 창 안의 같은 경로는 1회만 이동(중복 이동 0).
 *
 * 허용 경로 = 아래 ROUTES 표뿐(알 수 없는 경로·파라미터 형식 불일치 = 무시). 알림 탭은 이 경로가 아니다(expo-notifications 데이터 → pushAdapter).
 * 게이트: 홈 탭 레이아웃이 마운트되기 전(부팅·온보딩·로그인 중)에 도착하면 보류했다가 탭 진입 시 1회 이동(마지막 것만).
 */
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
let ready = false;
let pending: string | null = null;

function go(to: string): void {
  try {
    router.push(to as Href);
  } catch {
    /* 라우터 미준비 — 무시(보류 경로가 다시 시도) */
  }
}

/** 두 입구(+native-intent·에어브릿지 콜백) 공용. 이동했거나 보류했으면 true. */
export function handleDeeplink(url: string, now: number = Date.now()): boolean {
  const to = resolveDeeplink(url);
  if (!to) return false; // 미지 경로·에어브릿지 https 원본(SDK가 kbap://로 다시 준다) = 무시
  if (last && last.to === to && now - last.at < DEDUPE_MS) return true; // 같은 링크가 두 입구로 — 1회만
  last = { to, at: now };
  if (!ready) {
    pending = to; // 게이트 뒤 — 탭 진입 시 이동(마지막 것만)
    return true;
  }
  go(to);
  return true;
}

/** (tabs) 레이아웃 마운트 = 부팅·온보딩·로그인 게이트 통과. 보류분 1회 이동. 언마운트(온보딩으로 교체 등) = 다시 보류. */
export function setDeeplinkReady(on: boolean): void {
  ready = on;
  if (on && pending) {
    const to = pending;
    pending = null;
    go(to);
  }
}

/** 유닛 전용 */
export function __resetDeeplinkForTest(): void {
  last = null;
  ready = false;
  pending = null;
}
