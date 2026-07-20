/**
 * IngredientFilter — the shared flat-ingredient selection UI (KB-6 override,
 * reused by onboarding KB-8). No category groups, no per-ingredient pre-assigned
 * risk color (risk is contextual per dish). A searchable list of the 81-item
 * catalog + an "active" card of selected chips (tap × to remove). "Why you avoid
 * it" is never asked. The surrounding safety notice / owner-confirm disclaimer
 * live in the consuming screen.
 */
import * as React from 'react';
// P-011(KB-178, B안): 선택 요약 = 고정 높이 1줄 가로 스크롤 — 세로 wrap이 자라며
// 목록을 밀어내던 QA 피드백 해소. 칩은 선택 순서 유지(새 선택이 줄 끝), 추가 시
// 자동 끝 스크롤. 0건이면 줄 미표시(0↔1 전환 1회 높이 변화 — 실물 확인 후 판단).
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { INGREDIENTS, ingredientLabel } from '@/lib/mocks/ingredients';
import { RiskMark } from './RiskMark';
import { IconSearch, IconClose, IconCheck, IconPlus } from './icons';

export function IngredientFilter({ selected, onToggle }: { selected: string[]; onToggle: (code: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = React.useState('');
  const sel = React.useMemo(() => new Set(selected), [selected]);
  const query = q.trim().toLowerCase();
  const list = query
    ? INGREDIENTS.filter((i) => ingredientLabel(i.code).toLowerCase().includes(query) || i.name.toLowerCase().includes(query))
    : INGREDIENTS;

  // B안: 새 선택이 줄 끝에 붙는 게 보이도록 자동 스크롤 (제거 시엔 안 움직임)
  const rowRef = React.useRef<ScrollView>(null);
  const prevCount = React.useRef(selected.length);
  React.useEffect(() => {
    if (selected.length > prevCount.current) {
      requestAnimationFrame(() => rowRef.current?.scrollToEnd({ animated: true }));
    }
    prevCount.current = selected.length;
  }, [selected.length]);

  return (
    <View style={{ gap: 14 }}>
      {/* active selection */}
      <View style={styles.activeCard}>
        <View style={styles.activeHead}>
          <RiskMark state="danger" size={20} />
          <Text style={styles.activeTitle}>
            {selected.length ? t('restrictionsEdit.avoidCount', { count: selected.length }) : t('restrictionsEdit.avoidNone')}
          </Text>
          {selected.length > 0 && <Text style={styles.tag}>{t('restrictionsEdit.tapToRemove')}</Text>}
        </View>
        {/* P-026(KB-178 재수정): 칩 영역을 **항상 고정 높이**로 렌더 — 빈 상태엔
            placeholder. 0→1 전환 시 영역+gap이 새로 생기며 아래 목록을 밀어내던
            버그(Q-11 2·6) 해소: 빈↔선택 레이아웃 높이 불변. */}
        <View style={styles.chipArea}>
          {selected.length > 0 ? (
            /* 고정 높이 1줄 — 선택 순서 그대로(selected 배열 순서), 탭=제거 유지 */
            <ScrollView
              ref={rowRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              {selected.map((code) => (
                <Pressable key={code} style={styles.rmChip} onPress={() => onToggle(code)}>
                  <Text style={styles.rmChipText}>{ingredientLabel(code)}</Text>
                  <View style={styles.rmX}>
                    <IconClose size={11} color={C.ink} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.chipPlaceholder}>{t('restrictionsEdit.chipPlaceholder')}</Text>
          )}
        </View>
      </View>

      {/* search */}
      <View style={styles.search}>
        <IconSearch size={18} color={C.ink2} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder={t('restrictionsEdit.searchPlaceholder')}
          placeholderTextColor={C.ink3}
          autoCorrect={false}
        />
      </View>

      {/* flat catalog */}
      <View style={{ gap: 9 }}>
        <Text style={styles.group}>{t('restrictionsEdit.allIngredients')}</Text>
        {list.length === 0 ? (
          <Text style={styles.empty}>{t('restrictionsEdit.emptyList')}</Text>
        ) : (
          <View style={styles.wrap}>
            {list.map((i) => {
              const on = sel.has(i.code);
              return (
                <Pressable key={i.code} style={[styles.pickChip, on && styles.pickChipOn]} onPress={() => onToggle(i.code)}>
                  <Text style={[styles.pickChipText, on && styles.pickChipTextOn]}>{ingredientLabel(i.code)}</Text>
                  {on ? <IconCheck size={13} color="#fff" /> : <IconPlus size={12} color={C.ink3} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 14, gap: 11, ...shadow.sh1 },
  activeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeTitle: { flex: 1, fontFamily: font.display, fontSize: 15, color: C.ink, letterSpacing: -0.2 },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // P-026: 칩 1줄 높이 고정(rmChip = paddingV 8·2 + border 2 + 콘텐츠 18 ≈ 36).
  // 항상 이 높이라 빈↔선택 전환에 레이아웃 점프 0.
  chipArea: { height: 36, justifyContent: 'center' },
  chipPlaceholder: { fontFamily: font.body, fontSize: 13, color: C.ink3 },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 2, alignItems: 'center' }, // 1줄 고정 — wrap 없음 (B안)

  rmChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingLeft: 13, paddingRight: 9, paddingVertical: 8, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  rmChipText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  rmX: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },

  search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, ...shadow.sh1 },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 14.5, color: C.ink, padding: 0 },

  group: { fontFamily: font.bodyBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: C.ink3, marginLeft: 2 },
  empty: { fontFamily: font.body, fontSize: 13.5, color: C.ink3, paddingVertical: 8 },

  pickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line },
  pickChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  pickChipText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  pickChipTextOn: { color: '#fff' },
});

export default IngredientFilter;
