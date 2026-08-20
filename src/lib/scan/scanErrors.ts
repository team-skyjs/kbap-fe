/**
 * scanErrors.ts — 스캔 실패 분류 한 곳 (P-219 3분기 → P-220 계측 분해).
 *
 * 화면(scan.tsx)이 쓰던 인라인 매핑을 분리한 이유: `fail_reason`이 "개선 투자
 * 우선순위" 차트의 축이라(태소노미 CSV) **매핑 전수를 유닛으로 잠가야** 한다.
 *
 * ⚠️ 분기는 **BE `code` 필드**로 한다(HTTP 상태 아님 — 400에 SCAN-001·003이
 * 섞여 있다). BE `message`는 사용자 노출 금지 — 화면은 아래 i18n 키만 렌더.
 */

export type ErrorStage = 'capture' | 'ocr' | 'empty' | 'network' | 'be' | 'notMenu' | 'busy' | 'upload' | 'outage';

export const ERROR_MSG: Record<ErrorStage, string> = {
  capture: 'scan.errCapture',
  ocr: 'scan.errOcr',
  empty: 'scan.noText',
  network: 'scan.errNetwork',
  be: 'scan.errBe',
  notMenu: 'scan.errNotMenu', // SCAN-003(400) — 메뉴판 아님: 사용자 행동 필요(재촬영)
  busy: 'scan.errBusy', // SCAN-002(503) — 인식 실패: 사용자 잘못 아님(잠시 후 재시도)
  upload: 'scan.errUpload', // SCAN-001(400) — 이미지 접근 불가: 업로드부터 재시도
  outage: 'scan.errOutage', // SCAN-006(503, P-241) — LLM 서버 장애: "일시적 서비스 문제" 톤(SCAN-002 인식 실패와 분리)
};

/** BE 코드 → 화면 분기. 미지 코드는 기존 'be'(일반 서버 오류)로. */
export function stageForCode(code: string | undefined, msg: string): ErrorStage {
  if (msg.startsWith('NETWORK')) return 'network';
  switch (code) {
    case 'SCAN-003':
      return 'notMenu';
    case 'SCAN-002':
      return 'busy';
    case 'SCAN-001':
      return 'upload';
    case 'SCAN-006': // P-241(BE #180): LLM 서버 장애 — 인식 실패(SCAN-002)와 분리
      return 'outage';
    default:
      return 'be';
  }
}

/**
 * P-220: `scan_complete.fail_reason` — CSV enum **5종**.
 * `not_menu`(사용자가 메뉴판 아닌 것을 촬영) / `ocr`(온디바이스 OCR 실패 — v1
 * 경로 전용) / `upload`(이미지 업로드·접근 실패) / `network` / `server`.
 *
 * ⚠️ not_menu를 ocr에 흡수하면 "실패 원인 분포" 차트가 개선 투자처를 반대로
 * 가리킨다(전자 = 카메라 가이드, 후자 = OCR·서버 품질) — 커맨드 센터 판단으로
 * 분해 확정(P-220). 값 추가 시 CSV와 이 표를 함께 갱신할 것.
 */
export type FailReason = 'not_menu' | 'ocr' | 'upload' | 'network' | 'server';

export function failReasonForStage(stage: ErrorStage): FailReason {
  switch (stage) {
    case 'notMenu':
      return 'not_menu';
    case 'upload':
      return 'upload';
    case 'network':
      return 'network';
    case 'be': // 일반 서버 오류
    case 'busy': // SCAN-002 = 서버측 인식 실패(사용자 잘못 아님)
    case 'outage': // SCAN-006 = LLM 서버 장애(P-241 — 기존 enum 재사용, 신설 불요 판단)
      return 'server';
    default: // capture·empty(기기 단 실패)·ocr
      return 'ocr';
  }
}
