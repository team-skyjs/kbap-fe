import { LABELS, TUNING, coverMap, decodeO2O, letterbox, nmsSameClass, postprocess, resizeDims, unletterbox, type Det } from '../bbqModel';

const COLS = 14;
function row(box: [number, number, number, number], cls: number, score: number): number[] {
  const r = [...box, ...new Array(10).fill(0)];
  r[4 + cls] = score;
  return r;
}
const pack = (rows: number[][]) => Float32Array.from(rows.flat());

describe('KB-1019 bbqModel 후처리', () => {
  it('라벨 순서 0 grill ~ 9 wrapped_ssam 고정', () => {
    expect(LABELS).toEqual(['grill', 'raw_meat', 'cooked_meat', 'leaf', 'ssamjang', 'tongs', 'scissors', 'leaf_on_hand', 'topped_leaf', 'wrapped_ssam']);
    expect(TUNING.thresholds).toEqual([0.3, 0.2, 0.15, 0.15, 0.3, 0.25, 0.5, 0.35, 0.65, 0.5]);
  });

  it('레터박스: 세로 360x640 → r=1·padX=140, 1080x1920 → r=1/3', () => {
    expect(letterbox(360, 640, 640)).toEqual({ r: 1, padX: 140, padY: 0 });
    const lb = letterbox(1080, 1920, 640);
    expect(lb.r).toBeCloseTo(1 / 3);
    expect(lb).toMatchObject({ padX: 140, padY: 0 });
    // 홀수 여백은 C++ int 나눗셈처럼 버림: 641x640 → newH 639 → (640-639)/2 = 0.5 → 0
    expect(letterbox(641, 640, 640).padY).toBe(0);
    expect(letterbox(1000, 333, 640).padY).toBe(213); // newH=213 → (640-213)/2=213.5 → 213
  });

  it('역변환은 레터박스의 역함수(원본 범위로 자름)', () => {
    const lb = letterbox(1080, 1920, 640);
    const d: Det = { cls: 0, score: 1, x1: 140 + 10, y1: 20, x2: 140 + 100, y2: 200 };
    const o = unletterbox(d, lb, 1080, 1920);
    expect(o.x1).toBeCloseTo(30);
    expect(o.y1).toBeCloseTo(60);
    expect(o.x2).toBeCloseTo(300);
    expect(o.y2).toBeCloseTo(600);
    const out = unletterbox({ ...d, x1: 0, x2: 700 }, lb, 1080, 1920);
    expect(out.x1).toBe(0);
    expect(out.x2).toBe(1080);
  });

  it('행마다 최고 점수 클래스, 그 클래스 임계값 미만은 버림(경계값은 남김)', () => {
    const out = pack([
      row([0, 0, 10, 10], 2, 0.15), // cooked 0.15 → 남김
      row([0, 0, 10, 10], 5, 0.25), // tongs 0.25 = 임계값(float32로 정확히 표현) → 남김
      row([0, 0, 10, 10], 0, 0.29), // grill 0.29 < 0.30 → 버림
      row([0, 0, 10, 10], 8, 0.6), // topped 0.6 < 0.65 → 버림
      [1, 2, 3, 4, 0.1, 0.4, 0, 0, 0, 0, 0, 0, 0, 0], // 최고 = raw 0.4 ≥ 0.2
      new Array(14).fill(0), // 점수 0 → 버림
    ]);
    const d = decodeO2O(out, 6, COLS, TUNING.thresholds);
    expect(d.map((x) => [x.cls, x.score])).toEqual([
      [2, expect.closeTo(0.15)],
      [5, 0.25],
      [1, expect.closeTo(0.4)],
    ]);
    expect(d[2]).toMatchObject({ x1: 1, y1: 2, x2: 3, y2: 4 });
  });

  it('같은 클래스만 IoU 0.6 초과 시 낮은 점수 제거, 다른 클래스는 겹쳐도 유지', () => {
    const a: Det = { cls: 2, score: 0.9, x1: 0, y1: 0, x2: 100, y2: 100 };
    const b: Det = { cls: 2, score: 0.5, x1: 5, y1: 5, x2: 105, y2: 105 }; // IoU ≈ 0.82
    const c: Det = { cls: 1, score: 0.4, x1: 0, y1: 0, x2: 100, y2: 100 };
    const far: Det = { cls: 2, score: 0.3, x1: 0, y1: 0, x2: 100, y2: 160 }; // IoU 0.625 > 0.6 → 제거
    const keep: Det = { cls: 2, score: 0.3, x1: 0, y1: 0, x2: 100, y2: 170 }; // IoU ≈ 0.588 → 유지
    expect(nmsSameClass([b, a, c], 0.6)).toEqual([a, c]);
    expect(nmsSameClass([a, far], 0.6)).toEqual([a]);
    expect(nmsSameClass([a, keep], 0.6)).toEqual([a, keep]);
  });

  it('postprocess = 해석 → 중복 제거 → 원본 좌표', () => {
    const out = pack([row([150, 0, 250, 100], 0, 0.9), row([152, 0, 252, 100], 0, 0.8), row([0, 0, 1, 1], 5, 0.1)]);
    const d = postprocess(out, 3, COLS, 1080, 1920);
    expect(d).toHaveLength(1);
    expect(d[0]!.x1).toBeCloseTo(30);
    expect(d[0]!.x2).toBeCloseTo(330);
  });

  it('coverMap: 같은 비율이면 배율만, mirror는 좌우 반전', () => {
    const b = { x1: 10, y1: 20, x2: 110, y2: 220 };
    expect(coverMap(b, 360, 640, 360, 640, false)).toEqual({ x: 10, y: 20, w: 100, h: 200 });
    expect(coverMap(b, 360, 640, 360, 640, true)).toEqual({ x: 250, y: 20, w: 100, h: 200 });
    // 뷰가 더 길쭉하면 높이 기준 배율 + 가로 잘림
    const r = coverMap(b, 360, 640, 390, 844, false);
    const s = 844 / 640;
    expect(r.x).toBeCloseTo((390 - 360 * s) / 2 + 10 * s);
    expect(r.h).toBeCloseTo(200 * s);
  });
});

describe('KB-1019 화면 연결', () => {
  it('리사이저 출력은 똑바로 선 프레임 비율 그대로 긴 변 640(검은 여백 0)', () => {
    expect(resizeDims(1080, 1920)).toEqual({ w: 360, h: 640 });
    expect(resizeDims(1440, 1920)).toEqual({ w: 480, h: 640 });
    expect(resizeDims(1920, 1080)).toEqual({ w: 640, h: 360 });
  });

  it('라벨 10개 전부 en 이름표, leaf = Leafy wrap, 고기 종류 이름 없음', () => {
    const en = require('../../../lib/i18n/en.json') as { bbqProbe: { label: Record<string, string> } };
    expect(Object.keys(en.bbqProbe.label)).toEqual([...LABELS]);
    expect(en.bbqProbe.label.leaf).toBe('Leafy wrap');
    expect(Object.values(en.bbqProbe.label).join(' ')).not.toMatch(/pork|beef|samgyeopsal|·/i);
  });
});
