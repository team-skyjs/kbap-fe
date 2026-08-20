/**
 * P-064④: 핀치 줌/팬 클램프 잠금 — 1~4x, 팬은 확대분 절반, 미확대=0.
 */
import { clampPan, clampScale, DOUBLE_TAP_ZOOM, ZOOM_MAX, ZOOM_MIN } from '../zoom';

it('스케일 클램프 1~4 (더블탭 목표 2.5는 범위 내)', () => {
  expect(clampScale(0.3)).toBe(ZOOM_MIN);
  expect(clampScale(2.5)).toBe(2.5);
  expect(clampScale(9)).toBe(ZOOM_MAX);
  expect(clampScale(DOUBLE_TAP_ZOOM)).toBe(DOUBLE_TAP_ZOOM);
});

it('팬 클램프: 확대분의 절반까지, 미확대(1x)=0 고정', () => {
  expect(clampPan(999, 2, 400)).toBe(200);
  expect(clampPan(-999, 2, 400)).toBe(-200);
  expect(clampPan(150, 2, 400)).toBe(150);
  expect(clampPan(50, 1, 400)).toBe(0);
  expect(clampPan(-50, 0.9, 400)).toBe(-0);
});

it('P-248: contain 레터박스 — 콘텐츠 기준 클램프(여백으로 팬 안 끌려감)', () => {
  // 컨테이너 800, 실표시 콘텐츠 400(세로 전단의 가로축): 1.5x = 600 < 800 → 팬 0
  expect(clampPan(100, 1.5, 400, 800)).toBe(0);
  // 2.5x = 1000 > 800 → 여분 200의 절반 100까지만
  expect(clampPan(999, 2.5, 400, 800)).toBe(100);
  expect(clampPan(-999, 2.5, 400, 800)).toBe(-100);
  // cover(content=container) = 기존 시맨틱 하위호환
  expect(clampPan(999, 2, 400, 400)).toBe(200);
});

it('P-248 배선 소스 잠금 — Photo 뷰 = contain + 어두운 배경(레터박스)·cover 잔존 0', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/features/scan/ScanResultOverlay.tsx', 'utf8') as string;
  expect(src).toContain('resizeMode="contain"');
  expect(src).not.toContain('resizeMode="cover"');
  expect(src).toContain("backgroundColor: '#16110d'"); // 레터박스 배경(P-187 문법)
  expect(src).toContain('clampPan(tx.value, scale.value, contentW, size.w)'); // 콘텐츠 기준 클램프
});
