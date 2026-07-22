/**
 * P-056(KB-176 🔴): OCR 정규화 분모 선택 잠금 — adb 실측 케이스 그대로.
 * 안드형: frame이 measured를 넘고 reported에 담김 → reported (y 2배 뻥튀기 해소)
 * iOS형: measured가 담음 → measured (KB-141 정답 유지 — reported=point 기기 방어)
 */
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: { recognize: jest.fn() },
  TextRecognitionScript: { KOREAN: 'KOREAN' },
}));

import { chooseDenominator } from '../ocr';

const REPORTED = { width: 1883, height: 4080 }; // 크롭 원치수 (안드 실측)
const MEASURED = { width: 942, height: 2040 }; // 절반 다운스케일 저장분

it('안드형(실측 재현): "부대찌개" top=2051 > measured 2040 → reported 채택', () => {
  const r = chooseDenominator(MEASURED, REPORTED, 1800, 2051 + 80);
  expect(r).toMatchObject({ pxW: 1883, pxH: 4080, basis: 'reported' });
});

it('iOS형: frame이 measured 안 → measured 채택 (KB-141 무회귀)', () => {
  // iOS: measured=진짜 픽셀(3024×4032), reported=point(1008×1344) — frame은 픽셀 기준
  const r = chooseDenominator({ width: 3024, height: 4032 }, { width: 1008, height: 1344 }, 2900, 3900);
  expect(r).toMatchObject({ pxW: 3024, pxH: 4032, basis: 'measured' });
});

it('measured 실패(null) → reported 폴백', () => {
  const r = chooseDenominator(null, REPORTED, 1000, 2000);
  expect(r).toMatchObject({ pxW: 1883, pxH: 4080, basis: 'reported' });
});

it('둘 다 못 담음 → 큰 쪽 채택(클램프 최소화) + larger-fallback 표기', () => {
  const r = chooseDenominator(MEASURED, REPORTED, 5000, 9000);
  expect(r).toMatchObject({ pxW: 1883, pxH: 4080, basis: 'larger-fallback' });
});

it('경계 여유: frame이 measured를 2% 이내로 스치면 measured 유지 (반올림 방어)', () => {
  const r = chooseDenominator(MEASURED, REPORTED, 942 * 1.01, 2040 * 1.01);
  expect(r.basis).toBe('measured');
});
