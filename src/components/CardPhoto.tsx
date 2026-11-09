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
import { View, type ViewStyle } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { DEFAULT_FOOD_IMAGE } from '@/lib/api/foodAdapter';
import { Shimmer } from './Skeleton';
import { SHIMMER_BASE } from './RemoteImage';

// RN 0.85 타입에 absoluteFillObject가 없어 직접 정의 (런타임 동일)
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

/** KB-1014: 누끼(투명 배경) 표시 = 편의점 음식 카드와 같은 방식 — 연회색 바탕 + 안쪽 여백 contain */
export const CUTOUT_BG = '#F7F8FA';

export function CardPhoto({
  uri,
  recyclingKey,
  transition = 150,
  borderRadius,
  cutoutUri,
  cutoutInset = 8,
}: {
  uri: string | null | undefined;
  recyclingKey?: string;
  transition?: number;
  borderRadius?: number;
  /** KB-1014: 대표 편의점 음식 누끼 — 있으면 먼저, 실패 = uri(음식 사진) → 기본 이미지 순 강등 */
  cutoutUri?: string | null;
  cutoutInset?: number;
}) {
  const [settled, setSettled] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [cutoutFailed, setCutoutFailed] = React.useState(false);
  // #116 P2 ③ → KB-603: 리사이클/소스 교체 **전환마다** 리셋(이전 항목의 실패가 새 이미지를 가리지 않는다) — effect가 아니라
  // 렌더 중 전환 비교(React 공식 패턴, 옛 상태가 한 프레임도 안 보임). 값 키로 파생하면 A→B→A에서 옛 실패가 남아
  // 재시도를 잃는다(Codex #208 TabBar와 같은 계열).
  const key = `${recyclingKey ?? ''}\u0000${uri ?? ''}\u0000${cutoutUri ?? ''}`;
  const [prevKey, setPrevKey] = React.useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setSettled(false);
    setFailed(false);
    setCutoutFailed(false);
  }
  const cutout = !!cutoutUri && !cutoutFailed;
  const round = borderRadius != null ? { borderRadius, overflow: 'hidden' as const } : null;
  // KB-905(T-021): RemoteImage와 같은 로딩 바탕(스윕이 보이게)
  const shimmerStyle: ViewStyle[] = round ? [FILL, SHIMMER_BASE, round] : [FILL, SHIMMER_BASE];
  const imageStyle: ImageStyle[] = round ? [FILL, round] : [FILL];
  const source: string | number = !uri || failed ? DEFAULT_FOOD_IMAGE : uri;
  const shown: string | number = cutout ? cutoutUri! : source; // KB-1014: 누끼가 먼저, 없거나 실패면 현행 사진 규칙
  return (
    <>
      {cutout && <View style={[FILL, { backgroundColor: CUTOUT_BG }, round]} testID="card-photo-cutout-bg" />}
      {!settled && <Shimmer style={shimmerStyle} />}
      <Image
        source={shown}
        recyclingKey={recyclingKey}
        contentFit={cutout ? 'contain' : 'cover'}
        transition={transition}
        style={cutout ? [FILL, { top: cutoutInset, right: cutoutInset, bottom: cutoutInset, left: cutoutInset }] : imageStyle}
        onLoad={() => setSettled(true)}
        onError={() => {
          // KB-1014: 누끼 실패 → 음식 사진(스켈레톤 다시) → 기본 이미지 순 1회씩 강등
          if (cutout) { setCutoutFailed(true); setSettled(false); return; }
          // 원본 실패 → 기본 이미지로 1회 강등(기본 이미지 자체 실패면 종료)
          if (source !== DEFAULT_FOOD_IMAGE) setFailed(true);
          else setSettled(true);
        }}
      />
    </>
  );
}

export default CardPhoto;
