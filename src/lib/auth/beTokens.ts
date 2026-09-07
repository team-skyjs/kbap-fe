/**
 * auth/beTokens.ts — BE 세션 토큰 저장 (KB-67).
 * access/refresh 2종을 secure store에 보관 + 메모리 캐시(요청마다 디스크를
 * 읽지 않게). 웹은 secure store가 없어 메모리만으로 동작(세션 한정) — 인증
 * 플로우 자체가 네이티브 전용이라 충분하다.
 */
import * as SecureStore from 'expo-secure-store';
import { BE_BASE } from '@/lib/data/config';

const ACCESS_KEY = 'kbap.auth.access.v1';
const REFRESH_KEY = 'kbap.auth.refresh.v1';
/** P-322(KB-450): 토큰이 발급된 API 환경(BE_BASE 호스트) — dev 토큰이 prod 빌드에
 *  실리는 재사용 차단(9/7 실측: prod DB에 dev 회원 부재 → 첫 실행 "세션 만료" UX). */
const ENV_KEY = 'kbap.auth.env.v1';

let cached: { access: string; refresh: string } | null | undefined; // undefined = not loaded yet

/** KB-421(Codex #19 최종 라운드): **세션 세대 — 저장소(싱크) 소관.** "경계 이후
 *  도착한 결과는 무효" 원칙을 쓰기 지점마다가 아니라 저장 함수 자체가 보장한다
 *  (호출자별 가드는 새 인터리빙마다 구멍 — 6라운드 교훈). 경계(beAuth
 *  endSessionBoundary)가 bump, saveTokens가 쓰기 전후 재검증 + 자가 되돌림. */
let sessionGen = 0;
export function bumpSessionGen(): void {
  sessionGen++;
}
export function currentGen(): number {
  return sessionGen;
}

export async function loadTokens(): Promise<{ access: string; refresh: string } | null> {
  if (cached !== undefined) return cached;
  try {
    const [access, refresh, env] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(ENV_KEY),
    ]);
    // KB-421(P-205): await 사이에 clear/save 경계가 개입했으면(defined) 그쪽이 정본 —
    // 삭제 전 Keychain에서 읽은 스테일 값으로 cached를 재대입하면 지운 세션이
    // 부활한다(재설치 mina 사고). 읽기 결과는 폐기.
    if (cached !== undefined) return cached;
    // P-322: 저장 환경 ≠ 현재 호스트(키 없음 = 기존 저장분 포함) → 조용히 폐기,
    // 게스트 시작 — refresh 발신 자체가 없어 세션 만료 안내·MEMBER-003 경로 진입 0.
    // 삭제는 저장소 소관 원칙대로 체인 경유(KB-421 직렬화 유지, 세대는 무변).
    if (access && refresh && env !== BE_BASE) {
      cached = null;
      void serialized(async () => {
        try {
          await Promise.all([
            SecureStore.deleteItemAsync(ACCESS_KEY),
            SecureStore.deleteItemAsync(REFRESH_KEY),
            SecureStore.deleteItemAsync(ENV_KEY),
          ]);
        } catch {
          /* nothing persisted */
        }
      });
      return cached;
    }
    cached = access && refresh ? { access, refresh } : null;
  } catch {
    if (cached !== undefined) return cached;
    cached = null;
  }
  return cached;
}

/** KB-421 최종: 저장소 **쓰기 직렬화 체인** — save/clear가 순서대로만 실행돼
 *  교체 세션(B)의 쓰기가 낡은 save(A)와 인터리빙되지 않는다(ABA 1차 방어).
 *  cached·세대의 동기 갱신은 체인 밖(즉시성 유지). */
let writeChain: Promise<unknown> = Promise.resolve();
function serialized<T>(op: () => Promise<T>): Promise<T> {
  const p = writeChain.then(op, op);
  writeChain = p.catch(() => {});
  return p;
}

/** Rotation 규칙: 항상 2종을 함께 저장 — 구 refresh는 재사용 금지(KB-67).
 *  @returns false = 쓰기 전/중 세션 끝 경계가 개입 — 자가 되돌림 후 폐기. 호출자는
 *  커밋 단계(세션 점등·로그·내비게이션)를 생략할 것.
 *  ABA 안전(2차 방어): 되돌림은 **자기 쓰기일 때만** — cached·저장소 값이 자기
 *  것과 일치할 때만 지운다(교체 세션 B의 토큰 보존). */
export function saveTokens(
  access: string,
  refresh: string,
  opts?: {
    /** KB-441(Codex #59 P1-5): 로그인 커밋 = 새 세션 경계 — **캐시 공개와 같은 동기
     *  틱에** 세대 증가. bump가 SecureStore await 뒤(beAuth)면 "캐시=B·gen=A" 창이
     *  열려 낡은 AUTH-004의 doRefresh가 B의 refresh를 소모 후 폐기한다(B 로그아웃).
     *  회전(doRefresh)은 이 플래그 없이 호출 — 세대 불변 유지. */
    newSession?: boolean;
  },
): Promise<boolean> {
  if (opts?.newSession) sessionGen++; // 경계 — 아래 캐시 공개와 동일 동기 틱
  const g = sessionGen; // 호출 시점 세대(동기)
  const mine = { access, refresh };
  cached = mine; // 동기 — 즉시 관찰 가능(기존 시맨틱)
  return serialized(async () => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_KEY, access),
        SecureStore.setItemAsync(REFRESH_KEY, refresh),
        SecureStore.setItemAsync(ENV_KEY, BE_BASE), // P-322: 발급 환경 동승(항상 3종 동일 체인)
      ]);
    } catch {
      /* web/test: memory-only */
    }
    if (g !== sessionGen) {
      if (cached === mine) cached = null; // 자기 것일 때만 — B가 덮었으면 보존
      try {
        const [a, r] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_KEY),
          SecureStore.getItemAsync(REFRESH_KEY),
        ]);
        if (a === access && r === refresh) {
          await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
        }
      } catch {
        /* nothing persisted */
      }
      return false;
    }
    return true;
  });
}

/** commit undo 전용(KB-421 P1-8) — 캐시·저장소가 **해당 값일 때만** 지운다.
 *  교체 세션(B)이 이미 덮었으면 무손대. 경계의 clearTokens(무조건)와 구분. */
export function revertTokensIf(access: string, refresh: string): Promise<void> {
  return serialized(async () => {
    if (cached && cached.access === access && cached.refresh === refresh) cached = null;
    try {
      const [a, r] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);
      if (a === access && r === refresh) {
        await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
      }
    } catch {
      /* nothing persisted */
    }
  });
}

export function clearTokens(): Promise<void> {
  cached = null; // 동기 — 경계의 즉시성 유지
  return serialized(async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_KEY),
        SecureStore.deleteItemAsync(REFRESH_KEY),
        SecureStore.deleteItemAsync(ENV_KEY), // P-322: 3종 동시 삭제
      ]);
    } catch {
      /* nothing persisted */
    }
  });
}
