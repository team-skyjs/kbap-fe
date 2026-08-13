/**
 * sentry.ts (P-197/KB-39) — 에러 모니터링 유일 관문.
 *
 * 1차 계측 = 미처리 예외·네이티브 크래시 **자동 수집만**(수동 캡처·트레이싱 없음).
 * - `enabled: !__DEV__` — Metro 개발 노이즈 차단(발주 고정).
 * - environment = 채널 판별(prod/dev) — isProdChannel 단일 소스(P-114).
 * - **PII 최소화(발주 고정)**: 유저 식별 = memberId만 — 닉네임·이메일 금지,
 *   이미지/본문 페이로드 첨부 금지. 식별 배선은 setSentryUser 한 곳.
 * ⚠️ 네이티브 모듈(config plugin) — P-192와 동일하게 OTA 단독 발행 금지,
 *   P-198 빌드부터 유효. init 자체는 구 런타임에서도 JS-only로 무해하지만
 *   원칙 통일: 빌드16 전 OTA에 동승하지 않는다.
 */
import * as Sentry from '@sentry/react-native';
import { isProdChannel } from '@/lib/flags';

const DSN = 'https://c6471e5cf050aaa65dd9067d4a119de6@o4511895920574464.ingest.us.sentry.io/4511895936761856';

export function initSentry(): void {
  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__, // Metro/dev 노이즈 차단
    environment: isProdChannel() ? 'prod' : 'dev',
    // 1차 최소 — 자동 수집만: 트레이싱·리플레이·프로파일링 전부 off(기본값 유지)
    sendDefaultPii: false, // PII 발주 고정(기본값이지만 명시 잠금)
  });
}

/** 유저 식별 — memberId만(닉네임·이메일 금지). null = 해제(로그아웃·게스트). */
export function setSentryUser(memberId: string | null): void {
  Sentry.setUser(memberId ? { id: memberId } : null);
}
