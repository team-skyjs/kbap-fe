/**
 * IngredientFilter — the shared flat-ingredient selection UI (KB-6 override).
 * P-177: 요약 칩 카드("You avoid n things"+×칩) 소멸 — **온보딩 Ob4Avoid와 완전
 * 동일 문법**(검색 → 카운트 줄 "n selected"+Clear → 카테고리 섹션 타일 그리드).
 * 제거는 타일 탭 해제로 충분(카드 × 기능 중복이었음). "Why you avoid it" is
 * never asked. 안전 배너/Save 게이트는 소비 화면 몫(무변).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Input } from './KeyboardDismissBar';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, shadow } from '@/lib/theme';
import { IngredientTileSections } from './IngredientTileSections';
import { IconSearch } from './icons';

export function IngredientFilter({
  selected,
  onToggle,
  onClear,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  /** P-177: 카운트 줄 Clear — 미전달 시 링크 미노출(온보딩 문법) */
  onClear?: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = React.useState('');
  const sel = React.useMemo(() => new Set(selected), [selected]);
  const query = q.trim().toLowerCase();

  return (
    <View style={{ gap: 14 }}>
      {/* search */}
      <View style={styles.search}>
        <IconSearch size={18} color={C.ink2} />
        <Input
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder={t('restrictionsEdit.searchPlaceholder')}
          placeholderTextColor={C.ink3}
          autoCorrect={false}
        />
      </View>

      {/* P-177: 선택 카운트 줄 — 온보딩 avCount 문법 그대로(n selected + Clear) */}
      <View style={styles.avCount} testID="avoid-count-line">
        <Text style={styles.avCountText}>
          {selected.length ? t('onboarding.selectedCount', { count: selected.length }) : t('onboarding.noneSelectedYet')}
        </Text>
        {selected.length > 0 && onClear && (
          <Pressable onPress={onClear} hitSlop={8} testID="avoid-clear">
            <Text style={styles.avClear}>{t('onboarding.clearSelection')}</Text>
          </Pressable>
        )}
      </View>

      {/* P-150 ①: 카탈로그 = 온보딩과 동일 카테고리 섹션+사진 타일(공용 컴포넌트) */}
      <IngredientTileSections selected={sel} onToggle={onToggle} query={query} emptyText={t('restrictionsEdit.emptyList')} />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, ...shadow.sh1 },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 14.5, color: C.ink, padding: 0 },
  // 온보딩 avCount/avCountText/avClear 수치 전사 (문법 통일)
  avCount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20, marginBottom: -4 },
  avCountText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  avClear: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
});
