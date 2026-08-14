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
import Constants from 'expo-constants';
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

/**
 * P-212(KB-39): 수신 검증 트리거 — 프로필 버전 줄 7연타(2s 창).
 * 대시보드 이벤트 0 → 크래시 외 검증 수단 상비. 반환 = 토스트 메시지 or null
 * (화면은 표시만 — 카운터·채널 게이트·전송 전부 여기 한 곳).
 * - prod 채널 = 트리거 무동작(P-114 분기 — 라벨만 남음)
 * - __DEV__(Metro) = Sentry off(enabled:false)라 전송 불가 — 안내만
 * - 태그: 채널·앱 버전(대시보드 식별용). PII 무변(memberId 외 0).
 * 토스트 문구는 dev 계열 진단 전용이라 i18n 제외(하드코딩).
 */
const selfcheckTaps = { n: 0, last: 0 };
const SELFCHECK_WINDOW_MS = 2000;
export function tapSentrySelfcheck(now = Date.now()): string | null {
  if (isProdChannel()) return null;
  selfcheckTaps.n = now - selfcheckTaps.last < SELFCHECK_WINDOW_MS ? selfcheckTaps.n + 1 : 1;
  selfcheckTaps.last = now;
  if (selfcheckTaps.n < 7) return null;
  selfcheckTaps.n = 0;
  if (__DEV__) return 'Metro에선 Sentry off — 빌드에서 확인하세요';
  // 메시지 고정(수신 시각은 Sentry가 기록) — 유니크 문자열은 이슈 그루핑만 파편화
  Sentry.captureMessage('sentry-selfcheck', {
    tags: { channel: 'dev', appVersion: Constants.expoConfig?.version ?? '0.0.0' },
  });
  return 'Sentry 테스트 이벤트 전송됨';
}

export function _resetSelfcheckForTest(): void {
  selfcheckTaps.n = 0;
  selfcheckTaps.last = 0;
}
