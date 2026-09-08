/**
 * P-025(KB-202): 캡처 WYSIWYG 크롭 역산 잠금 — 미리보기(cover)에 보인 중앙
 * 영역만 crop rect로 나와야 한다. 새는 방향이 곧 버그: rect가 뷰포트보다 넓으면
 * 미리보기 밖(가격 줄·상호명)이 다시 업로드에 혼입된다(Q-12 재발).
 */
import { coverCropRect, orientedCoverCropRect } from '../coverCrop';

describe('coverCropRect — 센서가 뷰보다 옆으로 넓은 케이스 (세로 폰 + 4:3 센서, 실기기 기본)', () => {
  it('좌우 크롭: 세로 전체 유지, 가로는 뷰 비율만큼 중앙', () => {
    // iPhone 미리보기 390×844 (aspect 0.462) ← 4:3 센서 3024×4032 (aspect 0.75)
    const r = coverCropRect(390, 844, 3024, 4032);
    expect(r).not.toBeNull();
    expect(r!.height).toBe(4032); // 세로는 전부 보였음
    expect(r!.width).toBe(Math.round(4032 * (390 / 844))); // = 1863
    expect(r!.originX).toBe(Math.round((3024 - r!.width) / 2)); // 중앙 정렬
    expect(r!.originY).toBe(0);
    // 크롭 결과 비율 = 뷰 비율 (±반올림 1px)
    expect(r!.width / r!.height).toBeCloseTo(390 / 844, 2);
  });
});

describe('coverCropRect — 센서가 뷰보다 위아래로 긴 케이스', () => {
  it('상하 크롭: 가로 전체 유지, 세로는 뷰 비율만큼 중앙', () => {
    const r = coverCropRect(390, 844, 1000, 3000); // pic aspect 0.333 < view 0.462
    expect(r).not.toBeNull();
    expect(r!.width).toBe(1000);
    expect(r!.height).toBe(Math.round(1000 / (390 / 844))); // = 2164
    expect(r!.originX).toBe(0);
    expect(r!.originY).toBe(Math.round((3000 - r!.height) / 2));
  });
});

describe('coverCropRect — 크롭 불필요/무효 입력', () => {
  it('비율 일치(반올림 오차 내) → null (재인코딩 생략)', () => {
    expect(coverCropRect(390, 844, 1170, 2532)).toBeNull(); // 정확히 3배
    expect(coverCropRect(390, 844, 1171, 2532)).toBeNull(); // 1px 오차 — epsilon 내
  });

  it('무효 치수(0/음수) → null — 크롭 생략이 안전 폴백', () => {
    expect(coverCropRect(0, 844, 3024, 4032)).toBeNull();
    expect(coverCropRect(390, 844, 0, 0)).toBeNull();
    expect(coverCropRect(390, -1, 3024, 4032)).toBeNull();
  });

  it('rect는 사진 경계를 절대 넘지 않는다 (originX+width ≤ picW 등)', () => {
    for (const [vw, vh, pw, ph] of [[390, 844, 3024, 4032], [390, 844, 1000, 3000], [500, 500, 4000, 3000]] as const) {
      const r = coverCropRect(vw, vh, pw, ph);
      if (!r) continue;
      expect(r.originX).toBeGreaterThanOrEqual(0);
      expect(r.originY).toBeGreaterThanOrEqual(0);
      expect(r.originX + r.width).toBeLessThanOrEqual(pw);
      expect(r.originY + r.height).toBeLessThanOrEqual(ph);
    }
  });
});

// P-338(KB-493): 방향 반영 — 가로 스캔 세로 띠 결함 잠금 (방향 3 × 사진 2)
describe('P-338: orientedCoverCropRect — 뷰포트 방향 스왑', () => {
  const VW = 393, VH = 852; // 세로 잠금 뷰포트

  it('가로 모드 + 가로 사진(4032×3024) = 가로 전체 + 세로 중앙(세로 띠 소멸)', () => {
    for (const landscape of [true]) {
      const r = orientedCoverCropRect(VW, VH, 4032, 3024, landscape)!;
      expect(r.width).toBe(4032); // 가로 전체 — 구 결함은 width가 세로 띠(≈1390)
      expect(r.height).toBe(Math.round(4032 / (VH / VW)));
      expect(r.originX).toBe(0);
      expect(r.originY).toBe(Math.round((3024 - r.height) / 2));
    }
  });

  it('가로 모드 + 세로 보고 치수(3024×4032 — EXIF 미적용) = 치수 스왑 후 동일 결과', () => {
    const a = orientedCoverCropRect(VW, VH, 4032, 3024, true)!;
    const b = orientedCoverCropRect(VW, VH, 3024, 4032, true)!;
    expect(b).toEqual(a);
  });

  it('세로 모드 = 현행 coverCropRect와 완전 동일(P-025 검증 경로 무변) — 사진 2종', () => {
    for (const [pw, ph] of [[3024, 4032], [4032, 3024]] as const) {
      expect(orientedCoverCropRect(VW, VH, pw, ph, false)).toEqual(coverCropRect(VW, VH, pw, ph));
    }
  });

  it('배선 잠금 — scan.tsx 캡처 경로가 camOrientation을 크롭에 반영', () => {
    const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
    expect(src).toContain("camOrientation === 'landscapeLeft' || camOrientation === 'landscapeRight'");
    expect(src).toContain('orientedCoverCropRect(view.width, view.height, pic.width, pic.height, landscape)');
    expect(src).toContain('orientation: camOrientation'); // 실측 로그(P-338 ②)
  });

  it('가로 rect도 사진 경계 안 + 크롭 결과 비율 = 가로 뷰포트 비율', () => {
    const r = orientedCoverCropRect(VW, VH, 4032, 3024, true)!;
    expect(r.originX + r.width).toBeLessThanOrEqual(4032);
    expect(r.originY + r.height).toBeLessThanOrEqual(3024);
    expect(Math.abs(r.width / r.height - VH / VW)).toBeLessThan(0.01);
  });
});
