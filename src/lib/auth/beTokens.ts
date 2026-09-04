/**
 * auth/beTokens.ts — BE 세션 토큰 저장 (KB-67).
 * access/refresh 2종을 secure store에 보관 + 메모리 캐시(요청마다 디스크를
 * 읽지 않게). 웹은 secure store가 없어 메모리만으로 동작(세션 한정) — 인증
 * 플로우 자체가 네이티브 전용이라 충분하다.
 */
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'kbap.auth.access.v1';
const REFRESH_KEY = 'kbap.auth.refresh.v1';

let cached: { access: string; refresh: string } | null | undefined; // undefined = not loaded yet

export async function loadTokens(): Promise<{ access: string; refresh: string } | null> {
  if (cached !== undefined) return cached;
  try {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    // KB-421(P-205): await 사이에 clear/save 경계가 개입했으면(defined) 그쪽이 정본 —
    // 삭제 전 Keychain에서 읽은 스테일 값으로 cached를 재대입하면 지운 세션이
    // 부활한다(재설치 mina 사고). 읽기 결과는 폐기.
    if (cached !== undefined) return cached;
    cached = access && refresh ? { access, refresh } : null;
  } catch {
    if (cached !== undefined) return cached;
    cached = null;
  }
  return cached;
}

/** Rotation 규칙: 항상 2종을 함께 저장 — 구 refresh는 재사용 금지(KB-67). */
export async function saveTokens(access: string, refresh: string): Promise<void> {
  cached = { access, refresh };
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, access),
      SecureStore.setItemAsync(REFRESH_KEY, refresh),
    ]);
  } catch {
    /* web/test: memory-only */
  }
}

export async function clearTokens(): Promise<void> {
  cached = null;
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  } catch {
    /* nothing persisted */
  }
}
