/**
 * coverCrop — 스캔 캡처 WYSIWYG 크롭 역산 (KB-202/P-025, Q-12 규명 후속).
 *
 * CameraView(style=absoluteFill)는 센서 프레임을 cover로 그린다: 뷰포트 비율에
 * 맞춰 중앙만 보이고 나머지는 잘린다. 그런데 takePictureAsync는 센서 전체를
 * 반환 → 미리보기 밖(브라우저 탭·상호명·가격 줄)이 캡처·업로드에 혼입됐다.
 * 이 함수는 그 cover 표시를 역산해 "미리보기에 실제로 보인 영역"의 픽셀 crop
 * rect를 돌려준다. 오버레이 마커는 preview 정규화 공간이라 크롭 후에도 정합.
 */

export type CropRect = { originX: number; originY: number; width: number; height: number };

/** 비율 차가 이 이하면 크롭 생략 — 반올림 픽셀 몇 개 때문에 재인코딩하지 않는다. */
const ASPECT_EPSILON = 0.005;

/**
 * cover 표시에서 보이는 중앙 영역을 사진 픽셀 좌표로 역산.
 * @returns crop rect, 크롭이 불필요(비율 일치)하거나 입력이 무효면 null.
 */
export function coverCropRect(viewW: number, viewH: number, picW: number, picH: number): CropRect | null {
  if (!(viewW > 0 && viewH > 0 && picW > 0 && picH > 0)) return null;
  const viewAspect = viewW / viewH;
  const picAspect = picW / picH;
  if (Math.abs(picAspect - viewAspect) / viewAspect <= ASPECT_EPSILON) return null;
  if (picAspect > viewAspect) {
    // 사진이 뷰보다 옆으로 넓음 → 좌우가 잘려 보였음: 세로 전체 + 가로 중앙
    const width = Math.min(picW, Math.round(picH * viewAspect));
    return { originX: Math.round((picW - width) / 2), originY: 0, width, height: picH };
  }
  // 사진이 뷰보다 위아래로 김 → 상하가 잘려 보였음: 가로 전체 + 세로 중앙
  const height = Math.min(picH, Math.round(picW / viewAspect));
  return { originX: 0, originY: Math.round((picH - height) / 2), width: picW, height };
}

/**
 * P-338(KB-493) → Codex #99 P1 재설계: WYSIWYG 크롭의 방향 판정.
 *
 * ① 방향 소스 = **캡처 사진 자체**(중력 camOrientation 아님) — 폰을 평평히 놓으면
 *   gravity가 z축이라 orientationFromGravity가 portrait를 돌려주는 케이스(테이블
 *   메뉴)에서 중력 판정이 틀린다. EXIF 적용 후 유효 치수가 W>H면 물리 가로 뷰포트
 *   (뷰 H,W 스왑), 아니면 세로. `exif.Orientation` 6/8(90° 회전)이 오면 보고 치수를
 *   raw로 보고 스왑해 "적용 후 치수"로 정규화한 뒤 판단한다.
 * ② 크롭 rect는 **입력(보고된) 치수 좌표계 안**에서 생성 — 스왑은 뷰 비율 계산에만
 *   쓰고, raw 보고 치수면 뷰 비율을 전치해 보고 공간에서 역산한다(경계 초과 없음 —
 *   coverCropRect의 min/centered 불변식 상속).
 */
export function wysiwygCropRect(
  viewW: number,
  viewH: number,
  picW: number,
  picH: number,
  exifOrientation?: number,
): CropRect | null {
  if (!(viewW > 0 && viewH > 0 && picW > 0 && picH > 0)) return null;
  const rotated = exifOrientation === 6 || exifOrientation === 8; // 보고 치수 = raw(90° 회전 전)
  const effW = rotated ? picH : picW; // EXIF 적용 후(월드) 유효 치수
  const effH = rotated ? picW : picH;
  const landscape = effW > effH;
  const [vw, vh] = landscape ? [viewH, viewW] : [viewW, viewH]; // 물리 방향 뷰포트
  // 보고 좌표계로 환산: raw 치수면 뷰 비율도 전치 — rect는 항상 picW×picH 안
  const [rvw, rvh] = rotated ? [vh, vw] : [vw, vh];
  return coverCropRect(rvw, rvh, picW, picH);
}
