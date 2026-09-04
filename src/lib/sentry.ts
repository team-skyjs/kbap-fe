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
    // 9/5 프리즈(강제종료로 끝난 행 = AppHang V1 미보고) 대응: fatal hang을 다음
    // 실행 때 보고하는 cocoa 8.39+ 옵션. RN 7.11 JS 타입엔 미노출이지만 래퍼가
    // 함수형 옵션만 걸러내고 전 키를 네이티브 dict로 관통(wrapper.js initNativeSdk)
    // → cocoa 8.58(b21 포함)이 파싱. JS-only — 재빌드 불요·OTA 가능.
    ...({ enableAppHangTrackingV2: true } as object),
  });
}

/** 9/5 예진 승인: 5xx 관측 — 경로(쿼리 제거)·status·code 태그만(본문·헤더·PII 0),
 *  /auth/* 포함. react-query 5xx 재시도(1회)로 같은 실패가 이중 캡처되는 것 억제 —
 *  같은 status+path는 20초 중복창 1회만. */
const recent5xx = new Map<string, number>();
export function captureApi5xx(path: string, status: number, code?: string): void {
  // Codex #24 P2: 숫자 세그먼트 정규화 — 회원/리소스 id가 태그로 유입되는 것 방지
  // + 중복 억제 키 안정(같은 라우트의 id 변주가 별개 캡처로 새는 것 차단)
  const cleanPath = path.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id');
  const key = `${status}:${cleanPath}`;
  const now = Date.now();
  if ((recent5xx.get(key) ?? 0) > now - 20_000) return;
  recent5xx.set(key, now);
  Sentry.captureMessage('api_5xx', {
    level: 'warning',
    tags: { path: cleanPath, status: String(status), ...(code ? { code } : {}) },
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
