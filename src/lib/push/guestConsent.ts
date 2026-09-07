/**
 * guestConsent (P-311/KB-478) — 게스트 알림 동의 로컬 저장(마케팅 수신·야간 수신).
 * 근거: 게스트 마케팅 푸시(종한 설계 중) — 정보통신망법 50조 사전 동의 + 야간(21~08시)
 * 별도 동의, Apple 4.5.4. **기본 전부 OFF**, 각 토글 값 + 변경 시각(ISO) 저장.
 * 키에 installationId 포함(기기 단위 동의 — 게스트는 계정 없음).
 * BE 동의 API(KB-354/425) 확정 시 이 모듈 한 곳에서 서버 동기화로 스왑.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInstallationId } from '@/lib/installationId';

export interface GuestConsent {
  marketing: boolean;
  night: boolean;
  marketingChangedAt: string | null; // ISO — 동의/철회 시각(법정 기록)
  nightChangedAt: string | null;
}

export const DEFAULT_GUEST_CONSENT: GuestConsent = {
  marketing: false,
  night: false,
  marketingChangedAt: null,
  nightChangedAt: null,
};

async function storageKey(): Promise<string> {
  return `kbap.guestNotif.v1.${await getInstallationId()}`;
}

export async function getGuestConsent(): Promise<GuestConsent> {
  try {
    const raw = await AsyncStorage.getItem(await storageKey());
    return raw ? { ...DEFAULT_GUEST_CONSENT, ...(JSON.parse(raw) as Partial<GuestConsent>) } : DEFAULT_GUEST_CONSENT;
  } catch {
    return DEFAULT_GUEST_CONSENT; // 저장소 오류 = 미동의(보수 — false-safe 계열)
  }
}

// Codex #72 P1: 동시 토글의 stale read(read-modify-write 레이스)가 법정 동의 값을
// 되살릴 수 있음 → 쓰기를 **단일 체인으로 직렬화**(beTokens serialized 문법) —
// 각 쓰기는 직전 쓰기 완료 후의 최신값을 읽어 수정한다.
let writeChain: Promise<unknown> = Promise.resolve();

export function setGuestConsent(key: 'marketing' | 'night', on: boolean): Promise<GuestConsent> {
  const p = writeChain.then(() => applyConsent(key, on), () => applyConsent(key, on));
  writeChain = p.catch(() => {});
  return p;
}

async function applyConsent(key: 'marketing' | 'night', on: boolean): Promise<GuestConsent> {
  const cur = await getGuestConsent();
  // Codex #72 3R P2: 큐 처리 시점 최신 상태 재검증 — 마케팅 OFF인데 야간 ON 요청이
  // 직렬 큐를 통과해 "야간만 ON"이 되는 경로 차단(야간 = 마케팅 부속 동의).
  if (key === 'night' && on && !cur.marketing) return cur;
  const now = new Date().toISOString();
  const next: GuestConsent = { ...cur, [key]: on, [`${key}ChangedAt`]: now };
  // 마케팅 철회 = 야간 동의도 동반 철회(야간은 마케팅의 부속 동의)
  if (key === 'marketing' && !on && cur.night) {
    next.night = false;
    next.nightChangedAt = now;
  }
  // Codex #72 3R P1: 저장 실패를 삼키지 않는다 — UI OFF·저장 ON(법정 철회 유실) 방지.
  // 성공 후에만 새 값 반환(호출측이 성공 값으로만 상태 반영·실패 시 원복+표면화).
  await AsyncStorage.setItem(await storageKey(), JSON.stringify(next));
  return next;
}
