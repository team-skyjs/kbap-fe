/**
 * RemoteImage (P-207/KB-307) — 원격 이미지 공용: 로딩 = Shimmer 스켈레톤,
 * 로드 = fade-in, 실패 = settle(폴백 렌더는 호출부 조건 — CardPhoto 전제 동일).
 *
 * ⚠️ 불변 규칙(P-207 승격): 원격 이미지 표면은 공백→팝인 금지 — 신규 표면은
 * CardPhoto(부모 채움)·AvoidTile(재료 타일)·**RemoteImage(크기 지정형)** 중
 * 하나를 경유한다. expo-image 직접 사용 = 로컬(촬영/첨부 미리보기) 전용.
 */
import * as React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { Shimmer } from './Skeleton';

const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

export function RemoteImage({
  uri,
  style,
  contentFit = 'cover',
  recyclingKey,
  transition = 150,
}: {
  uri: string;
  /** 크기·라운딩을 가진 컨테이너 스타일(기존 Image 스타일 그대로 이관) */
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  transition?: number;
}) {
  const [settled, setSettled] = React.useState(false);
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {!settled && <Shimmer style={FILL as never} />}
      <Image
        source={{ uri }}
        recyclingKey={recyclingKey}
        contentFit={contentFit}
        transition={transition}
        style={FILL}
        onLoad={() => setSettled(true)}
        onError={() => setSettled(true)}
      />
    </View>
  );
}

export default RemoteImage;
