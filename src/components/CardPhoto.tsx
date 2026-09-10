/**
 * CardPhoto (멘토링 ⑩) — 카드/히어로 사진 공용: expo-image 아래에 로딩 shimmer.
 * 사진이 도착할 때까지 스켈레톤과 같은 shimmer 스윕이 돌고, 로드되면 기존
 * fade-in(transition)이 이어받는다. 로드 완료/실패 시 shimmer는 언마운트
 * (리스트에서 무한 애니메이션이 남지 않게).
 *
 * P-353 ③(KB-515): uri null/로드 실패 = 서버 기본 음식 이미지(DEFAULT_FOOD_IMAGE,
 * 여백 포함 일러스트라 cover 유지) — 호출부 아이콘 폴백 불필요(전 카드 표면 자동).
 */
import * as React from 'react';
import type { ViewStyle } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { DEFAULT_FOOD_IMAGE } from '@/lib/api/foodAdapter';
import { Shimmer } from './Skeleton';

// RN 0.85 타입에 absoluteFillObject가 없어 직접 정의 (런타임 동일)
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

export function CardPhoto({
  uri,
  recyclingKey,
  transition = 150,
  borderRadius,
}: {
  uri: string | null | undefined;
  recyclingKey?: string;
  transition?: number;
  borderRadius?: number;
}) {
  const [settled, setSettled] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  // #116 P2 ③: 리사이클/소스 교체 시 상태 리셋 — 이전 항목의 실패가 새 이미지를 가리지 않게
  React.useEffect(() => {
    setSettled(false);
    setFailed(false);
  }, [uri, recyclingKey]);
  const round = borderRadius != null ? { borderRadius, overflow: 'hidden' as const } : null;
  const shimmerStyle: ViewStyle[] = round ? [FILL, round] : [FILL];
  const imageStyle: ImageStyle[] = round ? [FILL, round] : [FILL];
  const source: string | number = !uri || failed ? DEFAULT_FOOD_IMAGE : uri;
  return (
    <>
      {!settled && <Shimmer style={shimmerStyle} />}
      <Image
        source={source}
        recyclingKey={recyclingKey}
        contentFit="cover"
        transition={transition}
        style={imageStyle}
        onLoad={() => setSettled(true)}
        onError={() => {
          // 원본 실패 → 기본 이미지로 1회 강등(기본 이미지 자체 실패면 종료)
          if (source !== DEFAULT_FOOD_IMAGE) setFailed(true);
          else setSettled(true);
        }}
      />
    </>
  );
}

export default CardPhoto;
