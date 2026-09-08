/**
 * P-025(KB-202): 캡처 WYSIWYG 크롭 역산 잠금 — 미리보기(cover)에 보인 중앙
 * 영역만 crop rect로 나와야 한다. 새는 방향이 곧 버그: rect가 뷰포트보다 넓으면
 * 미리보기 밖(가격 줄·상호명)이 다시 업로드에 혼입된다(Q-12 재발).
 */
import { coverCropRect, wysiwygCropRect } from '../coverCrop';

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

// P-338(KB-493) → Codex #99 P1: 방향 = 사진 자체 · rect = 보고 좌표계 안
describe('P-338: wysiwygCropRect — 사진 기준 방향 판정', () => {
  const VW = 393, VH = 852; // 세로 잠금 뷰포트

  it('가로 캡처(적용 치수 4032×3024) = 가로 전체 + 세로 중앙(세로 띠 소멸) — 평평(z축) 촬영 포함', () => {
    // 중력이 z축이라 gravity=portrait여도 사진이 가로면 가로 판정(함수가 gravity를 안 받음)
    const r = wysiwygCropRect(VW, VH, 4032, 3024)!;
    expect(r.width).toBe(4032);
    expect(r.height).toBe(Math.round(4032 / (VH / VW)));
    expect(r.originX).toBe(0);
    expect(r.originY).toBe(Math.round((3024 - r.height) / 2));
  });

  it('가로 캡처 raw 보고 치수(3024×4032 + exif 6/8) = rect가 보고 좌표계 경계 안 + 적용 치수 rect의 전치', () => {
    const applied = wysiwygCropRect(VW, VH, 4032, 3024)!;
    for (const exif of [6, 8]) {
      const raw = wysiwygCropRect(VW, VH, 3024, 4032, exif)!;
      expect(raw.originX + raw.width).toBeLessThanOrEqual(3024); // ② 보고 좌표계 clamp
      expect(raw.originY + raw.height).toBeLessThanOrEqual(4032);
      expect(raw.width).toBe(applied.height); // 전치 관계
      expect(raw.height).toBe(applied.width);
    }
  });

  it('세로 캡처(3024×4032, exif 무) = 현행 coverCropRect와 완전 동일(P-025 경로 무변)', () => {
    expect(wysiwygCropRect(VW, VH, 3024, 4032)).toEqual(coverCropRect(VW, VH, 3024, 4032));
    // 세로 raw + exif 6 = 가로 사진으로 정규화되어 가로 판정(보고 공간 rect)
    const r = wysiwygCropRect(VW, VH, 4032, 3024, 6)!;
    expect(r.originX + r.width).toBeLessThanOrEqual(4032);
    expect(r.originY + r.height).toBeLessThanOrEqual(3024);
  });

  it('배선 잠금 — scan.tsx: exif 요청 + 사진 기준 판정(중력 미사용), 로그 = gravity 진단 병기', () => {
    const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
    expect(src).toContain('exif: true');
    expect(src).toContain('wysiwygCropRect(view.width, view.height, pic.width, pic.height, exifOrientation)');
    expect(src).not.toContain("camOrientation === 'landscapeLeft' || camOrientation === 'landscapeRight'"); // 크롭 경로에서 중력 소멸
    expect(src).toContain('gravity: camOrientation, exifOrientation');
  });

  it('가로 rect 비율 = 물리 가로 뷰포트 비율 + 경계 불변식', () => {
    const r = wysiwygCropRect(VW, VH, 4032, 3024)!;
    expect(r.originX + r.width).toBeLessThanOrEqual(4032);
    expect(r.originY + r.height).toBeLessThanOrEqual(3024);
    expect(Math.abs(r.width / r.height - VH / VW)).toBeLessThan(0.01);
  });
});
