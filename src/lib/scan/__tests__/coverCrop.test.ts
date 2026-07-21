/**
 * P-025(KB-202): 캡처 WYSIWYG 크롭 역산 잠금 — 미리보기(cover)에 보인 중앙
 * 영역만 crop rect로 나와야 한다. 새는 방향이 곧 버그: rect가 뷰포트보다 넓으면
 * 미리보기 밖(가격 줄·상호명)이 다시 업로드에 혼입된다(Q-12 재발).
 */
import { coverCropRect } from '../coverCrop';

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
