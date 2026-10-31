/**
 * KB-946 — 같은 사진이 카메라는 성공·갤러리는 실패: 갤러리는 원본 그대로 OCR(작은 웹 이미지 → "아나나맛"·"Shoetg4", dev scan_operation 55~59 후보 0).
 * 갤러리(가공식품·성분표) = 긴 변 2000 미만이면 비율 그대로 키워 OCR. 메뉴판 갤러리 스캔은 무변.
 */
import * as fs from 'fs';
import * as path from 'path';
import { OCR_MIN_LONG_SIDE, upscaleLongSide } from '../coverCrop';

describe('KB-946 upscaleLongSide', () => {
  it.each([
    [500, 750, { width: 1333, height: 2000 }], // 세로 웹 이미지
    [800, 600, { width: 2000, height: 1500 }], // 가로
    [1000, 1000, { width: 2000, height: 2000 }],
    [2000, 1200, null], // 이미 하한
    [3024, 4032, null], // 카메라 원본급
    [0, 0, null], // 치수 모름 = 그대로
  ])('%s×%s → %j', (w, h, want) => {
    expect(upscaleLongSide(w as number, h as number)).toEqual(want);
  });
  it('하한 = 2000(카메라 크롭본과 비슷한 OCR 입력)', () => expect(OCR_MIN_LONG_SIDE).toBe(2000));
});

describe('KB-946 배선(소스)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../app/scan.tsx'), 'utf8');
  it('갤러리 = 가공식품·성분표(menu false)만 키움 · 메뉴판은 원본 그대로', () => {
    expect(src).toContain('await onShot(menu ? picked : await upscaleForOcr(picked));');
    expect(src).toMatch(/async function upscaleForOcr\(pic[^)]*\)[^{]*\{\s*const size = upscaleLongSide\(pic\.width, pic\.height\);\s*if \(!size\) return pic;/);
    expect(src).toContain('ImageManipulator.manipulate(pic.uri).resize(size).renderAsync()');
  });
});
