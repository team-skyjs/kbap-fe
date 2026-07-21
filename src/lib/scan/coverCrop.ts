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
