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
const HIDDEN = { ...FILL, opacity: 0 } as const;

export function RemoteImage({
  uri,
  style,
  contentFit = 'cover',
  recyclingKey,
  transition = 150,
  onError,
  onLoad,
  blurRadius,
  placeholder = 'shimmer',
  hideUntilLoaded = false,
}: {
  uri: string;
  /** 크기·라운딩을 가진 컨테이너 스타일(기존 Image 스타일 그대로 이관) */
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  transition?: number;
  /** P-303: 로드 실패 통지 — 소스 체인(useIngredientImageChain 등) 다음 소스 전환용.
   *  settle(스켈레톤 종료)은 현행 유지 — 호출부가 key={uri}로 소스별 리마운트한다. */
  onError?: () => void;
  /** P-380(KB-518): 실제 렌더 완료 통지 — 캡처 게이트가 프리페치가 아니라 이걸 본다. */
  onLoad?: () => void;
  /** KB-832: expo-image 흐림(네이티브 의존 추가 없음 — 앱 지문 무변). 큐레이션 카드 하단 블러 밴드 */
  blurRadius?: number;
  /** 로딩 중 자리: 'shimmer'(기본 — 공백 금지) · 'none' = 투명(아래에 같은 사진 원본이 이미 깔린 겹침 사본 전용 — KB-846 블러 띠) */
  placeholder?: 'shimmer' | 'none';
  /** KB-865(QA #338: 상세 진입 때 **다른 제품 사진이 잠깐** 보였다 사라짐) — iOS가 앞 화면의 이미지 뷰를 재사용하면 새 사진이 올 때까지
   *  옛 내용이 남는다. 켜면 이번 소스의 onLoad 전까지 이미지를 투명으로 두어(스켈레톤만) 옛 사진을 그리지 않는다. 판정 화면 사진용 */
  hideUntilLoaded?: boolean;
}) {
  const [settled, setSettled] = React.useState(false);
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {!settled && placeholder === 'shimmer' && <Shimmer style={FILL as never} />}
      <Image
        source={{ uri }}
        recyclingKey={recyclingKey}
        contentFit={contentFit}
        transition={transition}
        blurRadius={blurRadius}
        style={hideUntilLoaded && !settled ? HIDDEN : FILL}
        onLoad={() => {
          setSettled(true);
          onLoad?.();
        }}
        onError={() => {
          setSettled(true);
          onError?.(); // P-303: 소스 체인 다음 소스 전환 통지
        }}
      />
    </View>
  );
}

export default RemoteImage;
