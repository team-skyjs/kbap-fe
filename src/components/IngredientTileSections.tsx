/**
 * IngredientTileSections (P-150 ① — P-134 온보딩 그리드의 공용화) —
 * 카테고리 섹션 + 4열 정사각 **사진 타일**(AvoidTile — P-145 실사진+색 폴백).
 * 온보딩 회피 스텝과 프로필 회피 수정(Edit restrictions)이 공유(중복 구현 금지).
 * 검색어(query)로 인플레이스 필터 — 검색창·카운트·요약 칩은 소비 화면 몫.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { AvoidTile } from './AvoidTile';
import { IconCheck } from './icons';
import { INGREDIENTS, INGREDIENT_SECTIONS, ingredientLabel } from '@/lib/mocks/ingredients';

/** P-134 카테고리 틴트 순환 — 폴백 타일 배경. */
export const FB_TINT = ['rgba(226,88,12,0.10)', 'rgba(14,154,167,0.10)', 'rgba(47,143,91,0.10)', 'rgba(160,106,0,0.12)', 'rgba(142,47,60,0.10)', 'rgba(90,82,72,0.10)', 'rgba(226,88,12,0.06)'];

export function IngredientTileSections({
  selected,
  onToggle,
  query = '',
  emptyText,
}: {
  selected: ReadonlySet<string>;
  onToggle: (code: string) => void;
  /** 소문자 trim된 검색어 — 빈 문자열 = 전체 */
  query?: string;
  /** 검색 결과 0일 때 표시(미전달 시 무표시) */
  emptyText?: string;
}) {
  const { t } = useTranslation();
  const match = (code: string) => {
    if (!query) return true;
    const item = INGREDIENTS.find((i) => i.code === code);
    if (!item) return false;
    return ingredientLabel(item.code).toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
  };
  const sections = INGREDIENT_SECTIONS.map((secDef, si) => ({ secDef, si, codes: secDef.codes.filter(match) })).filter(
    (s) => s.codes.length > 0,
  );
  if (!sections.length) return emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null;
  return (
    <View>
      {sections.map(({ secDef, si, codes }) => (
        <View key={secDef.key} style={{ marginBottom: 14 }}>
          <Text style={styles.secHead}>{t(`ingCat.${secDef.key}`)}</Text>
          <View style={styles.grid}>
            {codes.map((code) => {
              const item = INGREDIENTS.find((i) => i.code === code)!;
              const on = selected.has(code);
              return (
                <Pressable key={code} style={styles.tileWrap} onPress={() => onToggle(code)} testID={`avoid-${code}`}>
                  {/* P-145: 실사진 81종(S3 CDN) — 실패 시 P-134 색 폴백 그대로 */}
                  <AvoidTile code={code} abbr={item.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()} tint={FB_TINT[si % FB_TINT.length]} selected={on}>
                    {on && (
                      <View style={styles.check}>
                        <IconCheck size={12} color="#fff" />
                      </View>
                    )}
                  </AvoidTile>
                  <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{ingredientLabel(code)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  secHead: { fontFamily: font.bodyBold, fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase', color: C.ink3, marginBottom: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  tileWrap: { width: '22.5%', alignItems: 'center', gap: 4 },
  check: { position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: font.bodyBold, fontSize: 10.5, color: C.ink2, maxWidth: '100%' },
  labelOn: { color: C.primaryText },
  empty: { fontFamily: font.body, fontSize: 13.5, color: C.ink3, paddingVertical: 8 },
});
