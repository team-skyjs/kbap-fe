/**
 * P-220(KB-316): 스캔 실패 계측 분해 — 에러 코드 → fail_reason 매핑 **전수**.
 * 이 매핑이 "개선 투자 우선순위" 차트의 축이라(not_menu = 카메라 가이드 개선 /
 * ocr = 인식 품질 개선) 뭉개지면 지표가 투자처를 반대로 가리킨다.
 */
import { EVENTS, sanitize } from '@/lib/analytics';
import { ERROR_MSG, failReasonForStage, stageForCode, type ErrorStage } from '../scanErrors';

/** 실제 실패 시나리오 → (분기 stage) → (계측 사유) 전수 */
const CASES: { label: string; code?: string; msg: string; stage: ErrorStage; reason: string }[] = [
  { label: 'SCAN-003 메뉴판 아님(사용자 촬영 문제)', code: 'SCAN-003', msg: 'not a menu', stage: 'notMenu', reason: 'not_menu' },
  { label: 'SCAN-001 이미지 접근 불가', code: 'SCAN-001', msg: 'image', stage: 'upload', reason: 'upload' },
  { label: 'SCAN-002 서버 인식 실패(사용자 잘못 아님)', code: 'SCAN-002', msg: 'unavailable', stage: 'busy', reason: 'server' },
  { label: 'SCAN-006 LLM 서버 장애(P-241 — 인식 실패와 분리·재시도 안내)', code: 'SCAN-006', msg: 'llm outage', stage: 'outage', reason: 'server' },
  { label: '통신 실패', code: undefined, msg: 'NETWORK: timeout', stage: 'network', reason: 'network' },
  { label: '미지 코드 = 일반 서버 오류', code: 'COMMON-002', msg: 'bad request', stage: 'be', reason: 'server' },
];

it.each(CASES)('$label → stage=$stage → fail_reason=$reason', ({ code, msg, stage, reason }) => {
  expect(stageForCode(code, msg)).toBe(stage);
  expect(failReasonForStage(stage)).toBe(reason);
});

it('v1 온디바이스 OCR 실패 계열(capture·empty·ocr) = ocr — v2에선 발생하지 않는다', () => {
  for (const s of ['capture', 'empty', 'ocr'] as ErrorStage[]) expect(failReasonForStage(s)).toBe('ocr');
});

it('P-241: outage는 별도 stage(전용 안내문) — 계측은 server 재사용(신설 불요 판단)', () => {
  expect(ERROR_MSG.outage).toBe('scan.errOutage'); // SCAN-002(errBusy)와 문구 분리
  // 화면 분기 — outage도 재시도 대상(같은 사진 유지·일시 장애)
  const fs = require('fs');
  expect(fs.readFileSync('src/app/scan.tsx', 'utf8')).toContain("stage === 'outage'");
});

it('최종 5종 전부 도달 가능 — 값 하나라도 누락되면 차트 축이 비뚤어진다', () => {
  const produced = new Set([...CASES.map((c) => c.reason), failReasonForStage('ocr')]);
  expect([...produced].sort()).toEqual(['network', 'not_menu', 'ocr', 'server', 'upload']);
});

it('신규 2종(not_menu·upload)이 어댑터를 실제로 통과한다 — 화이트리스트 조용한 드롭 방지(P-215 교훈)', () => {
  for (const reason of ['not_menu', 'upload']) {
    expect(sanitize(EVENTS.scan_complete, { success: false, fail_reason: reason, item_count: 0, degraded: false })).toEqual({
      success: false,
      fail_reason: reason,
      item_count: 0,
      degraded: false,
    });
  }
});

it('배선 소스 잠금 — 화면은 매핑을 자체 구현하지 않고 scanErrors 경유, 분기 stage마다 i18n 키 보유', () => {
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).toContain('failReasonForStage(stage)');
  expect(src).not.toContain("stage === 'be' || stage === 'busy'"); // 구 인라인 매핑 소멸
  // 8분기 전부 사용자 문구를 갖는다(BE message 노출 금지 — FE i18n만)
  for (const key of Object.values(ERROR_MSG)) expect(key.startsWith('scan.')).toBe(true);
});
