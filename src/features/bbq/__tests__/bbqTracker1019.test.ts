import { createGrillGate, createTracker } from '../bbqTracker';
import type { Det } from '../bbqModel';

const box = { x1: 0, y1: 0, x2: 100, y2: 100 };
const det = (cls: number, dx = 0, score = 0.5): Det => ({ cls, score, x1: box.x1 + dx, y1: 0, x2: box.x2 + dx, y2: 100 });

describe('KB-1019 이름표 유지', () => {
  it('안 보여도 400ms까지 유지(held), 넘으면 사라짐', () => {
    const up = createTracker();
    expect(up([det(3)], 0)).toMatchObject([{ cls: 3, held: false }]);
    expect(up([], 400)).toMatchObject([{ cls: 3, held: true }]);
    expect(up([], 401)).toEqual([]);
  });

  it('겹치는 같은 클래스는 같은 id로 이어 붙고, 다른 클래스·멀리 떨어진 박스는 새 id', () => {
    const up = createTracker();
    const [a] = up([det(3)], 0);
    const [b] = up([det(3, 10)], 30);
    expect(b!.id).toBe(a!.id);
    expect(b!.x1).toBe(10);
    const next = up([det(3, 10), det(5, 10), det(3, 500)], 60);
    expect(new Set(next.map((s) => s.id)).size).toBe(3);
  });
});

describe('P-642 손 위 3종 1초 다수결', () => {
  it('7·8·9를 한 물체로 이어 붙이고 최근 1초 다수, 동률 = 가장 최근', () => {
    const up = createTracker();
    up([det(7)], 0);
    up([det(8)], 100);
    up([det(8)], 200);
    const s = up([det(9)], 300);
    expect(s).toHaveLength(1);
    expect(s[0]!.cls).toBe(8); // 7:1 8:2 9:1
    expect(up([det(9)], 400)[0]!.cls).toBe(9); // 8:2 9:2 동률 → 최근 9
  });

  it('손 위 묶음과 테이블 잎(3)·고기는 서로 잇지 않음', () => {
    const up = createTracker();
    up([det(3), det(1)], 0);
    expect(up([det(3), det(1), det(7)], 30).map((x) => x.cls).sort()).toEqual([1, 3, 7]);
  });
});

describe('KB-1019 날고기·익은 고기 1초 다수결', () => {
  it('한 덩어리로 이어 붙이고 최근 1초 다수로 이름을 정함', () => {
    const up = createTracker();
    up([det(1)], 0);
    up([det(1)], 100);
    const s = up([det(2)], 200);
    expect(s).toHaveLength(1);
    expect(s[0]!.cls).toBe(1); // raw 2 : cooked 1
    up([det(2)], 300);
    expect(up([det(2)], 400)[0]!.cls).toBe(2); // 2 : 3
  });

  it('1초 지난 표는 빠짐', () => {
    const up = createTracker();
    for (const t of [0, 50, 100, 150]) up([det(1)], t);
    up([det(2)], 500);
    expect(up([det(2)], 900)[0]!.cls).toBe(1); // raw 4 : cooked 2
    const s = up([det(2)], 1120); // raw 150만 남음 → raw 1 : cooked 3 (만료 없으면 4:3 raw)
    expect(s).toHaveLength(1);
    expect(s[0]!.cls).toBe(2);
  });

  it('유지 시간을 넘긴 트랙은 같은 자리 새 박스를 가로채지 않음(표도 이어지지 않음)', () => {
    const up = createTracker();
    const [a] = up([det(1)], 0);
    up([det(1)], 100);
    const [b] = up([det(2)], 501); // 401ms 공백
    expect(b!.id).not.toBe(a!.id);
    expect(b!.cls).toBe(2);
  });

  it('동률이면 가장 최근 판정', () => {
    const up = createTracker();
    up([det(2)], 0);
    expect(up([det(1)], 100)[0]!.cls).toBe(1); // 1:1 → 최근 raw
    const other = createTracker();
    other([det(1)], 0);
    expect(other([det(2)], 100)[0]!.cls).toBe(2); // 1:1 → 최근 cooked
  });
});

describe('KB-1019 불판 띠 조건', () => {
  const g = (on: boolean): Det[] => (on ? [det(0)] : [det(3)]);

  it('기본: 최근 10프레임 중 7프레임 이상', () => {
    const gate = createGrillGate();
    const seq = [1, 1, 1, 0, 1, 1, 0, 0, 1, 1];
    const res = seq.map((v, i) => gate(g(!!v), i * 100));
    expect(res.slice(0, 9).some(Boolean)).toBe(false);
    expect(res[9]).toBe(true); // 7/10
    expect(gate(g(false), 1000)).toBe(false); // 맨 앞 1이 빠지고 0 추가 → 6/10
  });

  it('대안: 2초 연속, 한 번 끊기면 처음부터', () => {
    const gate = createGrillGate({ mode: 'consecutive', ms: 2000 });
    expect(gate(g(true), 0)).toBe(false);
    expect(gate(g(true), 1999)).toBe(false);
    expect(gate(g(true), 2000)).toBe(true);
    expect(gate(g(false), 2100)).toBe(false);
    expect(gate(g(true), 2200)).toBe(false);
    expect(gate(g(true), 4200)).toBe(true);
  });
});
