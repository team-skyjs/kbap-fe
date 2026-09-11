/**
 * consent (KB-497) — 광고성 알림 동의 상수.
 *
 * 문구 버전은 서버 동의 원장에 기록되는 정수(1~65535). 동의 문구(kbap-legal 페이지)를
 * 바꾸면 해당 버전을 올린다 — 서버는 열린 동의의 버전이 다르면 재동의로 기록한다.
 */
import { LEGAL_URLS } from '@/lib/legalText';

/** 마케팅 목적 개인정보 수집·이용 동의 문구 버전. */
export const PRIVACY_CONSENT_VERSION = 1;
/** 광고성 정보 수신 동의 문구 버전. */
export const RECEIVE_CONSENT_VERSION = 1;

/**
 * KB-544(설정 (회원, 기기) 단위) 새 X-API-Version 매핑 값. BE 규약상 "KB-544가 실리는
 * 앱 릴리스 번호" — 착수 시 확정. null = 헤더 오버라이드 없음(현행 회원 단위 레거시).
 */
export const NOTIF_SETTINGS_API_VERSION: string | null = null;

export type ConsentKind = 'privacy' | 'receive';

/** 동의 전문 페이지 — 로그인 약관 링크 선례(openWebPage + kbap-legal 정적 페이지). */
export function consentUrl(kind: ConsentKind): string {
  return kind === 'privacy' ? LEGAL_URLS.marketingPrivacy : LEGAL_URLS.marketingReceive;
}
