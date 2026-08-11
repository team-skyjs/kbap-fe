/**
 * AvoidTile (P-145) — 회피 재료 정사각 타일: 실사진 + 로드 실패 시 색 폴백.
 *
 * 폴백(P-134 원형: 카테고리 틴트+약어 2글자)은 **삭제 금지** — 오프라인·향후
 * 신규 재료(이미지 미업로드) 대비. 사진은 타일 프레임 안 absolute fill이라
 * 로드 여부와 무관하게 프레임 불변(P-103).
 */
import * as React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { font, color as C } from '@/lib/theme';
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
  /** 폴백 약어(2글자) — 사진 로드 전/실패 시 표시 */
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
  React.useEffect(() => setSrcIdx(0), [sources]); // 카탈로그 도착/언어 전환 시 체인 리셋
  const uri = sources[srcIdx];
  return (
    <View style={[styles.tile, { backgroundColor: tint }, selected && styles.tileOn, style]} testID={`avtile-${code}`}>
      <Text style={styles.abbr}>{abbr}</Text>
      {!!uri && (
        <Image
          key={uri}
          source={{ uri }}
          style={styles.photo}
          onError={() => setSrcIdx((i) => i + 1)}
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
  // 사진 = 폴백 위 absolute fill — 로드 성공 시 자연 덮임, 실패 시 언마운트(폴백 노출)
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 12 },
  abbr: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink2, letterSpacing: 1 },
});
