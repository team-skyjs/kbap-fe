import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

/**
 * Apple Vision 손 관절(VNDetectHumanHandPoseRequest, 최대 손 2개).
 * 좌표 변환은 전부 JS가 한다(OTA로 고칠 수 있게) — 네이티브는 받은 방향 그대로 Vision에 넘기고 원값을 돌려준다.
 */
export interface HandPose extends HybridObject<{ ios: 'swift' }> {
  /**
   * @param orientation CGImagePropertyOrientation 원값(1~8). Vision이 "똑바로 선" 이미지를 보게 JS가 고른다.
   * @returns 손마다 21관절 x 3(x, y, 신뢰도) 평탄 배열. x·y = Vision 정규 좌표(방향 적용 뒤 이미지, 원점 왼쪽 아래).
   *   관절 순서 = wrist, thumb CMC·MP·IP·tip, index MCP·PIP·DIP·tip, middle …, ring …, little …. 못 찾은 관절은 0,0,0.
   */
  detect(frame: Frame, orientation: number): number[];
}
