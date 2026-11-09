import { addTurns, mapBox } from '../boxMap';

// 1920x1080 가로 버퍼 · 세로 화면 390x844 · 입력 384. 버퍼 가운데 정사각형 = x 420..1500.
const base = { inputSize: 384, frameW: 1920, frameH: 1080, viewW: 390, viewH: 844, mirror: false };

it('up: 정사각형 전체 = 버퍼 가운데 1080 정사각형, cover 스케일 적용', () => {
  const r = mapBox({ ...base, frameW: 1080, frameH: 1920, orientation: 'up', box: { x1: 0, y1: 0, x2: 384, y2: 384 } });
  // 1080x1920 → 844/1920 스케일 0.4396, 가로 474.75 > 390 → px = -42.4
  const scale = 844 / 1920;
  expect(r.w).toBeCloseTo(1080 * scale);
  expect(r.h).toBeCloseTo(1080 * scale);
  expect(r.y).toBeCloseTo(420 * scale);
});

it('right: 버퍼 왼쪽 위 모서리 → 화면 오른쪽 위', () => {
  const r = mapBox({ ...base, orientation: 'right', box: { x1: 0, y1: 0, x2: 10, y2: 10 } });
  const scale = 844 / 1920;
  const px = (390 - 1080 * scale) / 2;
  // 버퍼 (420,0) 회전 → (1080-0, 420) = 세운 이미지 오른쪽 위
  expect(r.x + r.w).toBeCloseTo(px + 1080 * scale);
  expect(r.y).toBeCloseTo(420 * scale);
});

it('mirror: x만 좌우 반전', () => {
  const box = { x1: 0, y1: 0, x2: 10, y2: 10 };
  const a = mapBox({ ...base, orientation: 'right', box });
  const b = mapBox({ ...base, orientation: 'right', box, mirror: true });
  expect(b.x).toBeCloseTo(390 - (a.x + a.w));
  expect(b.y).toBeCloseTo(a.y);
  expect(b.w).toBeCloseTo(a.w);
});

it('down·left 회전은 서로 다른 위치', () => {
  const box = { x1: 0, y1: 0, x2: 10, y2: 10 };
  const d = mapBox({ ...base, orientation: 'down', box });
  const l = mapBox({ ...base, orientation: 'left', box });
  // down: 버퍼 왼쪽 위 → 세운 이미지 오른쪽 아래 · left: → 왼쪽 아래
  expect(d.x).toBeGreaterThan(l.x);
  expect(l.y).toBeCloseTo((1920 - 420 - 10 * (1080 / 384)) * (844 / 1920));
});

it('addTurns는 4회전마다 제자리', () => {
  expect(addTurns('right', 1)).toBe('down');
  expect(addTurns('left', 1)).toBe('up');
  expect(addTurns('up', 4)).toBe('up');
});
