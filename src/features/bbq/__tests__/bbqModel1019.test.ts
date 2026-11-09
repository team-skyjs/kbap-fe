import { LABELS, OUTPUT_SHAPE, TUNING, coverMap, decodeE2E, decodeO2O, fileUriToPath, topScore, fromXyxy, letterbox, nmsSameClass, postprocess, resizeDims, squareCropToUpright, unletterbox, type Det } from '../bbqModel';

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
    const out = new Float32Array(8400 * COLS); // 실제 모양 (1, 8400, 14) — 나머지 행 점수 0
    out.set(pack([row([150, 0, 250, 100], 0, 0.9), row([152, 0, 252, 100], 0, 0.8), row([0, 0, 1, 1], 5, 0.1)]));
    const d = postprocess('o2o', out, 1080, 1920);
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

describe('P-636 실기 버그 회귀', () => {
  it('버그 1: 인코딩된 file URL → 디코딩된 파일 경로(14 Pro 실제 문자열)', () => {
    const uri = 'file:///var/mobile/Containers/Data/Application/8FB7A98E-EFA6-44AE-81C6-509E649B6F4A/Library/Application%20Support/.expo-internal/7c5f47f4046bb844d1981f2b825430fd.pte';
    expect(fileUriToPath(uri)).toBe('/var/mobile/Containers/Data/Application/8FB7A98E-EFA6-44AE-81C6-509E649B6F4A/Library/Application Support/.expo-internal/7c5f47f4046bb844d1981f2b825430fd.pte');
    expect(fileUriToPath('/already/plain path.pte')).toBe('/already/plain path.pte');
  });

  it('버그 2: executorch 박스는 xmin~ymax — 읽으면 숫자, 옛 x1~y2 모양·NaN은 null', () => {
    expect(fromXyxy({ xmin: 10, ymin: 20, xmax: 110, ymax: 220 })).toEqual({ x1: 10, y1: 20, x2: 110, y2: 220 });
    expect(fromXyxy({ x1: 10, y1: 20, x2: 110, y2: 220 } as never)).toBeNull();
    expect(fromXyxy({ xmin: NaN, ymin: 0, xmax: 1, ymax: 1 })).toBeNull();
  });

  it('버그 2: 14 Pro 후면(버퍼 1920x1080 left → 똑바로 1080x1920) 정사각형 384 입력 → 화면 393x852 안쪽', () => {
    const full = squareCropToUpright({ x1: 0, y1: 0, x2: 384, y2: 384 }, 384, 1080, 1920);
    expect(full).toEqual({ x1: 0, y1: 420, x2: 1080, y2: 1500 });
    const r = coverMap(full, 1080, 1920, 393, 852, false);
    const s = 852 / 1920;
    expect(r.x).toBeCloseTo((393 - 1080 * s) / 2);
    expect(r.y).toBeCloseTo(420 * s);
    expect(r.w).toBeCloseTo(1080 * s);
    expect(r.h).toBeCloseTo(1080 * s);
    // 가운데 작은 물체는 화면 가운데 근처
    const c = coverMap(squareCropToUpright({ x1: 182, y1: 182, x2: 202, y2: 202 }, 384, 1080, 1920), 1080, 1920, 393, 852, false);
    expect(c.x + c.w / 2).toBeCloseTo(393 / 2, 0);
    expect(c.y + c.h / 2).toBeCloseTo(852 / 2, 0);
  });
});

it('P-636 소스 잠금: 로더는 fileUriToPath, 측정 화면은 fromXyxy 경유', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('fs') as typeof import('fs');
  expect(readFileSync('src/features/bbq/bbqDetector.ts', 'utf8')).toContain('loadModel)(fileUriToPath(uri))');
  const probe = readFileSync('src/features/bbq/ProbeScreen.tsx', 'utf8');
  expect(probe).toContain('fromXyxy(d.box)');
  expect(probe).not.toMatch(/box\.x1|as unknown as \{ x1/);
});

describe('P-637 XNNPACK e2e (1, 300, 6)', () => {
  const e2e = (rows: number[][]) => {
    const out = new Float32Array(300 * 6); // 늘 300행 — 나머지는 0점
    out.set(rows.flat());
    return out;
  };

  it('열 = x1,y1,x2,y2,점수,클래스 · 클래스 임계값 미만·범위 밖 번호는 버림(경계값은 남김)', () => {
    const out = e2e([
      [10, 20, 30, 40, 0.25, 5], // tongs 0.25 = 임계값 → 남김
      [0, 0, 1, 1, 0.6, 8], // topped 0.6 < 0.65 → 버림
      [0, 0, 1, 1, 0.9, 12], // 번호 범위 밖 → 버림
      [5, 6, 7, 8, 0.4, 2], // cooked 0.4 ≥ 0.15
    ]);
    expect(decodeE2E(out, 300, TUNING.thresholds)).toEqual([
      { cls: 5, score: 0.25, x1: 10, y1: 20, x2: 30, y2: 40 },
      { cls: 2, score: expect.closeTo(0.4), x1: 5, y1: 6, x2: 7, y2: 8 },
    ]);
  });

  it('postprocess(e2e) = 해석 → 같은 클래스 중복 제거 → 원본 좌표 · 출력 모양 상수', () => {
    const out = e2e([[150, 0, 250, 100, 0.9, 0], [152, 0, 252, 100, 0.8, 0]]);
    const d = postprocess('e2e', out, 1080, 1920);
    expect(d).toHaveLength(1);
    expect(d[0]!.x1).toBeCloseTo(30);
    expect(OUTPUT_SHAPE).toEqual({ o2o: [1, 8400, 14], e2e: [1, 300, 6] });
  });

  it('진단 topScore: 임계값과 무관한 최고 점수·클래스(두 모양)', () => {
    expect(topScore('e2e', e2e([[0, 0, 1, 1, 0.12, 3], [0, 0, 1, 1, 0.31, 7]]))).toEqual({ score: expect.closeTo(0.31), cls: 7 });
    const o = new Float32Array(8400 * 14);
    o[5000 * 14 + 4 + 9] = 0.07;
    expect(topScore('o2o', o)).toEqual({ score: expect.closeTo(0.07), cls: 9 });
  });
});
