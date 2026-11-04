/**
 * consent (KB-497) — 광고성 알림 동의 상수.
 *
 * 문구 버전은 서버 동의 원장에 기록되는 정수(1~65535). 동의 문구(kbap-legal 페이지)를
 * 바꾸면 해당 버전을 올린다 — 서버는 열린 동의의 버전이 다르면 재동의로 기록한다.
 */
import { LEGAL_URLS } from '@/lib/legalText';
import type { NotificationSettingsPatch } from '@/lib/data/useNotificationSettings';

/** 마케팅 목적 개인정보 수집·이용 동의 문구 버전. */
export const PRIVACY_CONSENT_VERSION = 2;
/** 광고성 정보 수신 동의 문구 버전. */
export const RECEIVE_CONSENT_VERSION = 2;

/**
 * 광고성 동의 확정 PATCH — 설정 화면·홈·알림함 동의 시트 공용(KB-979: 표면마다 body가 갈라지지 않게 한 곳).
 * KB-544 계약: consent:true + 버전 2종 = 동의 기록, enabled = 이 기기 소식 ON, 식사 시간도 함께 ON.
 * 서버 처리 순서 consent → enabled → mealTime 이라 한 요청에 담아도 NOTIFICATION-001 없음.
 * KB-987: 확인 = 활동 알림(activity)도 ON(비광고성 — 추가 동의 불필요).
 */
export const MARKETING_CONSENT_PATCH: NotificationSettingsPatch = {
  activity: true,
  news: { consent: true, privacyConsentVersion: PRIVACY_CONSENT_VERSION, receiveConsentVersion: RECEIVE_CONSENT_VERSION, enabled: true, mealTime: true },
};

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
