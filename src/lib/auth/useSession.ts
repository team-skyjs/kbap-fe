/**
 * useSession / useIsGuest — 실세션 기반 게스트 판별 (KB-77/78, guest-access-policy).
 *
 * P-205 🚨 재작성: 구 구현은 react-query(['auth','session'] + staleTime Infinity)
 * 였는데, 인증 경계의 queryClient.clear()가 쿼리 엔트리를 제거하면 **마운트된
 * 옵저버가 시딩된 새 엔트리와 재연결되지 못해**(Infinity — 복구 트리거 0)
 * 커뮤니티·프로필 탭이 재시작까지 게스트/회원 화면에 고착됐다(예진 실기 8/14,
 * 재현 유닛 잠금). → **세션 = 동기 메모리 스토어 + useSyncExternalStore 구독**으로
 * 승격: 경계(beAuth)가 setSessionState를 동기 emit — "한 번 틀리면 고착" 구조 자체 소멸.
 *
 * 쓰기 지점: beAuth 경계(로그인/로그아웃/탈퇴/만료) + 부팅 1회(initSessionState —
 * 미확정일 때만, 경계가 먼저 왔으면 부팅 늦은 읽기가 덮지 않는다).
 */
import { useSyncExternalStore } from 'react';
import { FLAGS } from '@/lib/flags';

let session: boolean | null = null; // null = 부팅 미확정(스토리지 읽기 전)
const subs = new Set<() => void>();

function emit(): void {
  subs.forEach((f) => f());
}

/** 경계 전파(beAuth 전용) — 동기, 구독 화면 즉시 리렌더. */
export function setSessionState(next: boolean): void {
  if (session === next) return;
  session = next;
  emit();
}

/** 부팅 초기화 — **미확정(null)일 때만** 세팅: 경계가 먼저 발생했으면 늦은 부팅 읽기가 덮지 않는다. */
export function initSessionState(value: boolean): void {
  if (session !== null) return;
  session = value;
  emit();
}

function subscribe(cb: () => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

/** 세션 존재 여부 — null = 미확정(부팅 중). */
export function useSession(): boolean | null {
  return useSyncExternalStore(subscribe, () => session, () => session);
}

/** 게스트 = guestMode ON && BE 세션 없음(확정 false). 미확정(null) = 게스트 아님
 *  (구 구현의 "로딩 중 false" 시맨틱 유지 — 잠금 깜빡임 방지). */
export function useIsGuest(): boolean {
  const s = useSession();
  return FLAGS.guestMode && s === false;
}

/** 동기 판단용 getter(비리액트 컨텍스트·유닛). */
export function getSessionState(): boolean | null {
  return session;
}

/** 유닛용 리셋. */
export function _resetSessionForTest(): void {
  session = null;
  subs.clear();
}
