/**
 * CardPhoto (멘토링 ⑩) — 카드/히어로 사진 공용: expo-image 아래에 로딩 shimmer.
 * 사진이 도착할 때까지 스켈레톤과 같은 shimmer 스윕이 돌고, 로드되면 기존
 * fade-in(transition)이 이어받는다. 로드 완료/실패 시 shimmer는 언마운트
 * (리스트에서 무한 애니메이션이 남지 않게).
 *
 * photoUrl이 없는 항목은 호출부가 기존 fallback(배경색/아이콘)을 유지할 것 —
 * 여기 오는 uri는 항상 진짜 URL이라는 전제.
 */
import * as React from 'react';
import type { ViewStyle } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { Shimmer } from './Skeleton';

// RN 0.85 타입에 absoluteFillObject가 없어 직접 정의 (런타임 동일)
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

export function CardPhoto({
  uri,
  recyclingKey,
  transition = 150,
  borderRadius,
}: {
  uri: string;
  recyclingKey?: string;
  transition?: number;
  borderRadius?: number;
}) {
  const [settled, setSettled] = React.useState(false);
  const round = borderRadius != null ? { borderRadius, overflow: 'hidden' as const } : null;
  const shimmerStyle: ViewStyle[] = round ? [FILL, round] : [FILL];
  const imageStyle: ImageStyle[] = round ? [FILL, round] : [FILL];
  return (
    <>
      {!settled && <Shimmer style={shimmerStyle} />}
      <Image
        source={uri}
        recyclingKey={recyclingKey}
        contentFit="cover"
        transition={transition}
        style={imageStyle}
        onLoad={() => setSettled(true)}
        onError={() => setSettled(true)}
      />
    </>
  );
}

export default CardPhoto;
