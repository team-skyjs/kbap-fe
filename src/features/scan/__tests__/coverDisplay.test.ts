/**
 * P-079(KB-238): 결과 사진 cover 표시 잠금 — 하단 여백 0 · 마커 투영 정합 ·
 * 화면 밖 마커 숨김. 픽스처 = 3:4 사진(1200×1600) × 화면비 2종(19.5:9·16:9).
 */
import { coverDisplayRect, markerVisible } from '../coverDisplay';

const IMG = { w: 1200, h: 1600 }; // 카메라 3:4
const SCREENS = [
  { name: '19.5:9', w: 390, h: 845 },
  { name: '16:9', w: 360, h: 640 },
];

it.each(SCREENS)('cover — $name 컨테이너를 가득 채운다(하단 여백 0)', ({ w, h }) => {
  const r = coverDisplayRect(w, h, IMG.w, IMG.h);
  const EPS = 1e-6; // 부동소수점 여유
  expect(r.x).toBeLessThanOrEqual(EPS);
  expect(r.y).toBeLessThanOrEqual(EPS);
  expect(r.x + r.w).toBeGreaterThanOrEqual(w - EPS);
  expect(r.y + r.h).toBeGreaterThanOrEqual(h - EPS); // 하단까지 참
  // 종횡비 보존 (왜곡 없는 스케일)
  expect(r.w / r.h).toBeCloseTo(IMG.w / IMG.h, 5);
});

it('마커 투영 — 19.5:9 × 3:4: 세로 채움 스케일, 중앙 박스는 정위치·좌우 크롭 반영', () => {
  const { w, h } = SCREENS[0];
  const r = coverDisplayRect(w, h, IMG.w, IMG.h);
  // 3:4가 19.5:9보다 납작 → 세로 기준 스케일(845/1600), 좌우가 잘린다
  const scale = 845 / 1600;
  expect(r.h).toBeCloseTo(845, 3);
  expect(r.w).toBeCloseTo(1200 * scale, 3);
  expect(r.x).toBeCloseTo((390 - 1200 * scale) / 2, 3);
  // 사진 정중앙 박스 → 화면 정중앙 (기존 투영식 lx = r.x + box.x * r.w)
  expect(r.x + 0.5 * r.w).toBeCloseTo(195, 3);
  expect(r.y + 0.5 * r.h).toBeCloseTo(422.5, 3);
});

it('화면 밖 마커 숨김 — 좌우 크롭 구간의 앵커는 비표시, 경계 안은 표시', () => {
  const { w, h } = SCREENS[0];
  const r = coverDisplayRect(w, h, IMG.w, IMG.h);
  const lxAt = (bx: number) => r.x + bx * r.w;
  // 크롭 폭 비율: (r.w - 390)/2 / r.w — 그보다 안쪽 x는 보이고 바깥은 숨김
  const cropFrac = -r.x / r.w;
  expect(markerVisible(lxAt(cropFrac * 0.5), 100, w, h)).toBe(false); // 잘린 왼쪽 구간
  expect(markerVisible(lxAt(0.5), 100, w, h)).toBe(true); // 중앙
  expect(markerVisible(lxAt(1 - cropFrac * 0.5), 100, w, h)).toBe(false); // 잘린 오른쪽 구간
  expect(markerVisible(195, -10, w, h)).toBe(false); // 세로 밖도 숨김
});

it('무효 입력 폴백 — 사진 정보 없으면 컨테이너 전체', () => {
  expect(coverDisplayRect(390, 845, 0, 0)).toEqual({ x: 0, y: 0, w: 390, h: 845 });
});
