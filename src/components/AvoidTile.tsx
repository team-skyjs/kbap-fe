/**
 * AvoidTile (P-145 → P-188) — 회피 재료 정사각 타일: 실사진 + 상태 분리.
 * P-188(종한 회의 ⑦⑧): RN Image → **expo-image**(memory+disk 캐시 기본) —
 * 재진입 시 81건 네트워크 재요청 소멸. 상태 분리:
 *   로딩 = Shimmer 스켈레톤(기존 문법 재사용) · 실패(오프라인·404) = 색 타일+약어(P-134).
 * 폴백 체인은 P-174 유지: 서버 imageUrl → 클라 조립(P-145) → 색 타일.
 * 사진은 타일 프레임 안 absolute fill — 상태 무관 프레임 불변(P-103).
 */
import * as React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Txt as Text } from '@/components/Txt';
import { font, color as C } from '@/lib/theme';
import { Shimmer } from './Skeleton';
import { ingredientImageUrl } from '@/lib/onboarding/ingredientImages';

export function AvoidTile({
  code,
  imageUrl,
  abbr,
  tint,
  selected,
  style,
  children,
}: {
  code: string;
  /** P-174: 서버 카탈로그 imageUrl(우선) — null/실패 시 클라 조립(P-145) → 색 폴백(P-134) 3단 */
  imageUrl?: string | null;
  /** 폴백 약어(2글자) — **로드 실패 시에만** 표시(P-188 — 로딩 중은 스켈레톤) */
  abbr: string;
  /** 폴백 카테고리 틴트 */
  tint: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  /** 선택 체크 배지 등 오버레이 */
  children?: React.ReactNode;
}) {
  // P-174: 소스 체인 — 서버 imageUrl → 클라 조립 URL(중복 제거), 소진 시 색 폴백
  const sources = React.useMemo(() => {
    const chain = [imageUrl, ingredientImageUrl(code)].filter((u): u is string => !!u);
    return chain.filter((u, i) => chain.indexOf(u) === i);
  }, [imageUrl, code]);
  const [srcIdx, setSrcIdx] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    setSrcIdx(0);
    setLoaded(false);
  }, [sources]); // 카탈로그 도착/언어 전환 시 체인 리셋
  const uri = sources[srcIdx];
  const failed = !uri; // 체인 소진 = 실패 확정
  return (
    <View style={[styles.tile, { backgroundColor: tint }, selected && styles.tileOn, style]} testID={`avtile-${code}`}>
      {/* P-188: 실패시에만 약어(로딩 중 "GM" 노출 소멸) */}
      {failed && <Text style={styles.abbr}>{abbr}</Text>}
      {!failed && !loaded && (
        <View style={styles.photo} testID={`avtile-skel-${code}`}>
          <Shimmer style={StyleSheet.absoluteFill as never} />
        </View>
      )}
      {!!uri && (
        <Image
          key={uri}
          source={uri}
          style={styles.photo}
          contentFit="cover"
          transition={120}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setSrcIdx((i) => i + 1);
          }}
          testID={`avtile-img-${code}`}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: '100%', aspectRatio: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent', overflow: 'hidden' },
  tileOn: { borderColor: C.primary },
  // 사진/스켈레톤 = 폴백 위 absolute fill — 상태 전환에도 프레임 불변
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 12 },
  abbr: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink2, letterSpacing: 1 },
});
