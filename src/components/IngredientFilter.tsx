/**
 * IngredientFilter — the shared flat-ingredient selection UI (KB-6 override,
 * reused by onboarding KB-8). No category groups, no per-ingredient pre-assigned
 * risk color (risk is contextual per dish). A searchable list of the 81-item
 * catalog + an "active" card of selected chips (tap × to remove). "Why you avoid
 * it" is never asked. The surrounding safety notice / owner-confirm disclaimer
 * live in the consuming screen.
 */
import * as React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { INGREDIENTS } from '@/lib/mocks/ingredients';
import { RiskMark } from './RiskMark';
import { IconSearch, IconClose, IconCheck, IconPlus } from './icons';

export function IngredientFilter({ selected, onToggle }: { selected: string[]; onToggle: (code: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = React.useState('');
  const sel = React.useMemo(() => new Set(selected), [selected]);
  const query = q.trim().toLowerCase();
  const list = query ? INGREDIENTS.filter((i) => i.name.toLowerCase().includes(query)) : INGREDIENTS;
  const selectedItems = INGREDIENTS.filter((i) => sel.has(i.code));

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
        {selected.length > 0 && (
          <View style={styles.wrap}>
            {selectedItems.map((i) => (
              <Pressable key={i.code} style={styles.rmChip} onPress={() => onToggle(i.code)}>
                <Text style={styles.rmChipText}>{i.name}</Text>
                <View style={styles.rmX}>
                  <IconClose size={11} color={C.ink} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
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
                  <Text style={[styles.pickChipText, on && styles.pickChipTextOn]}>{i.name}</Text>
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
