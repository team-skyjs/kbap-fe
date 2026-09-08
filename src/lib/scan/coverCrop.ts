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
 * P-338(KB-493): 방향 반영 크롭 — 가로 스캔이 세로 띠로 잘리던 결함의 수정 지점.
 *
 * 화면은 세로 잠금이라 뷰포트 치수는 항상 (W<H)로 들어오지만, 기기를 눕히면
 * 센서·뷰가 함께 회전해 "보이는 영역"의 물리 방향은 가로(H×W)가 된다. 사진은
 * EXIF 적용된 월드 방향(가로 = W>H)으로 오므로, 뷰포트를 (H,W)로 스왑해 같은
 * 좌표계에서 cover 역산하면 센서 공간 계산과 등가다(전치 검산 완료).
 * 사진 치수가 논리 방향과 어긋나면(가로 모드인데 W<H = EXIF 미적용 보고 치수)
 * 치수를 스왑해 계산 — expo-image-manipulator는 EXIF 적용 후(월드 방향) 픽셀에
 * 크롭을 적용하므로 rect는 월드 방향 좌표가 맞다.
 */
export function orientedCoverCropRect(
  viewW: number,
  viewH: number,
  picW: number,
  picH: number,
  landscape: boolean,
): CropRect | null {
  if (!landscape) return coverCropRect(viewW, viewH, picW, picH); // 세로 = 현행(P-025 검증 경로)
  const [pw, ph] = picH > picW ? [picH, picW] : [picW, picH]; // EXIF 미적용 치수 방어
  return coverCropRect(viewH, viewW, pw, ph);
}
