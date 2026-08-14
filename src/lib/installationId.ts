/**
 * installationId.ts (P-204/KB-317) — 게스트 스캔 평생 3회의 기반 **기기 설치 ID**.
 *
 * 최초 실행 시 UUID 생성 → SecureStore(iOS = 키체인 — **재설치 생존**이 목적:
 * freshInstall의 "잔존 정리"와 반대 방향이라 그 삭제 목록에 넣지 말 것).
 * ⚠️ **클린업 제외 필수(발주 고정)**: 회원 데이터가 아니라 기기 식별 —
 * clearMemberLocal(탈퇴)·clearTokens(로그아웃/재설치 정리)·KB-152 계열 어디에도
 * 이 키를 등록 금지(지워지면 3회 카운트 무력화 — 유닛 잠금).
 * 안드 재설치 방어(SSAID — expo-application)는 미설치 모듈: 다음 네이티브 빌드
 * 보강 항목(이번엔 SecureStore 단독 — 안드 재설치 리셋은 수용, 발주 3).
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

/** ⚠️ 클린업 금지 키 — 기기 귀속(회원 아님). */
const KEY = 'kbap.installation.id.v1';

let cached: string | null = null;

/** UUID v4 — expo-crypto 우선, 불능(웹/jest) 시 Math.random 폴백(기기 식별 용도로 충분). */
function genId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

/** 설치 ID — 최초 생성 후 불변. SecureStore 불능(웹 등) = 세션 메모리 폴백. */
export async function getInstallationId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const id = genId();
    await SecureStore.setItemAsync(KEY, id);
    cached = id;
    return id;
  } catch {
    // 웹/스토리지 불능 — 세션 한정 폴백(다음 실행 시 재시도)
    cached = cached ?? genId();
    return cached;
  }
}

/** 유닛용 — 메모리 캐시 리셋(스토어는 건드리지 않음). */
export function _resetInstallationIdCacheForTest(): void {
  cached = null;
}
