/**
 * IngredientTile — 재료 타일(음식 상세 §3에서 옮김, KB-914 R-137: 가공식품 감지 재료 그리드도 같은 부품).
 * 위험 마크(RiskMark 18, 좌상단) + 재료 사진 48(AvoidTile과 같은 3단 체인) + 이름 1줄 + 호출측 부가 줄·풋터(children).
 * risk = null이면 마크 없음(비회원·판정 없음 — 없는 판정을 그리지 않는다).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { RiskMark } from '@/components/RiskMark';
import { RemoteImage } from '@/components/RemoteImage';
import { useIngredientImageChain } from '@/components/AvoidTile';
import { IconFood } from '@/components/icons';
import { color as C, radius, type, type RiskState } from '@/lib/theme';

const INK_TITLE = '#2F3137';

/** P-303(KB-457): 재료 타일·시트 이미지 = AvoidTile과 같은 3단 체인(서버 imageUrl → CDN 조립 → 폴백). 체인 소진 = IconFood */
export function IngChainImage({ code, imageUrl, size, iconSize }: { code: string; imageUrl?: string | null; size: number; iconSize: number }) {
  const { uri, isCutout, nextSource } = useIngredientImageChain(code, imageUrl);
  if (!uri) return <IconFood size={iconSize} color={C.ink3} />;
  // key = 소스별 리마운트(RemoteImage settle 리셋 — AvoidTile 문법 동일)
  // P-341(KB-502): 누끼본 = contain(여백은 크기 축소로 근사 — 타일 pad 유지) · Codex #102 P2: 누끼 상태 = 흰 바닥
  return (
    <>
      {isCutout && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]} testID={`ing-cut-bg-${code}`} />}
      <RemoteImage
        key={uri}
        uri={uri}
        onError={nextSource}
        contentFit={isCutout ? 'contain' : undefined}
        style={isCutout ? { width: size * 0.74, height: size * 0.74 } : { width: size, height: size, borderRadius: radius.md }} // P-344: 74% 공통
      />
    </>
  );
}

export function IngredientTile({ code, name, risk, imageUrl, withFoot = false, bare = false, onPress, testID, children }: {
  code: string; name: string; risk: RiskState | null; imageUrl?: string | null; withFoot?: boolean; bare?: boolean; onPress?: () => void; testID: string; children?: React.ReactNode;
}) {
  return (
    <Pressable style={[tile.tile, withFoot && tile.withFoot, bare && tile.bare]} onPress={onPress} disabled={!onPress} testID={testID}>
      {risk && (
        <View style={tile.mark}>
          <RiskMark state={risk} size={18} />
        </View>
      )}
      <View style={tile.img}>
        <IngChainImage code={code} imageUrl={imageUrl} size={48} iconSize={28} />
      </View>
      <Text style={tile.name} numberOfLines={1}>{name}</Text>
      {children}
    </Pressable>
  );
}

/** §3 태그 줄바꿈 규칙: 타일 단위로만 줄바꿈 — flexWrap + 타일 flexShrink 0 + 이름 1줄 */
export const tile = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  tile: { width: '31%', flexGrow: 1, maxWidth: '32%', flexShrink: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDF0', borderRadius: radius.md, paddingTop: 26, alignItems: 'center', gap: 2, overflow: 'hidden' }, // A-FD-08
  mark: { position: 'absolute', top: 6, left: 6 },
  img: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.captionMed, color: INK_TITLE, textAlign: 'center', paddingHorizontal: 6 }, // 13/500
  bare: { paddingBottom: 10 }, // 부가 줄 없는 타일(가공식품 감지 재료) — 이름 아래 여백 = 부가 줄 marginBottom과 같은 10
  sub: { ...type.tabLabel, fontWeight: '400', color: '#5A636A', textAlign: 'center', paddingHorizontal: 4, marginBottom: 10 }, // 12/400(12 토큰 = tabLabel 크기)
  withFoot: { paddingTop: 8 }, // A-FD-08 푸터 변형
  foot: { alignSelf: 'stretch', minHeight: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,113,52,0.05)', borderBottomLeftRadius: radius.xs, borderBottomRightRadius: radius.xs },
  footText: { ...type.captionMed, color: C.primary }, // A-FD-09 13/500(색·굵기는 C-62)
});
