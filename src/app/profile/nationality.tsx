/**
 * Nationality picker (mockup Screen I4) — reached from the profile edit form.
 * Search + Suggested/All country lists with a radio. Selecting patches
 * nationality via PATCH /me (MOCK_MODE) and returns. Changing nationality resets
 * same-nationality review matches (hinted on the edit form).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, RiskMark, Flag, IconSearch, IconCheck } from '@/components';
import { NATIONALITIES } from '@/lib/onboarding/data';
import { useMe, useUpdateMe } from '@/lib/data/useMe';

export default function NationalityPicker() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const update = useUpdateMe();
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const match = (c: (typeof NATIONALITIES)[number]) =>
    !query || c.label.toLowerCase().includes(query) || c.native.toLowerCase().includes(query);
  const suggested = NATIONALITIES.filter((c) => c.suggested && match(c));
  const all = NATIONALITIES.filter((c) => !c.suggested && match(c));

  function pick(code: string) {
    if (code !== me?.nationality) update.mutate({ nationality: code });
    router.back();
  }

  return (
    <View style={styles.root}>
      <SubHeader title={t('nationalityPicker.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.search}>
          <IconSearch size={18} color={C.ink2} />
          <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder={t('nationalityPicker.searchPlaceholder')} placeholderTextColor={C.ink3} autoCorrect={false} />
        </View>

        <View style={styles.notice}>
          <RiskMark state="caution" size={20} />
          <Text style={styles.noticeText}>{t('nationalityPicker.notice')}</Text>
        </View>

        {suggested.length > 0 && (
          <Group label={t('nationalityPicker.suggested')} items={suggested} current={me?.nationality} onPick={pick} />
        )}
        {all.length > 0 && (
          <Group label={t('nationalityPicker.all')} items={all} current={me?.nationality} onPick={pick} />
        )}
        {suggested.length === 0 && all.length === 0 && <Text style={styles.empty}>{t('nationalityPicker.empty')}</Text>}
      </ScrollView>
    </View>
  );
}

function Group({ label, items, current, onPick }: { label: string; items: typeof NATIONALITIES; current?: string; onPick: (code: string) => void }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.group}>{label}</Text>
      <View style={styles.list}>
        {items.map((c, i) => {
          const on = c.code === current;
          return (
            <Pressable key={c.code} style={[styles.row, i === 0 && styles.rowFirst, on && styles.rowOn]} onPress={() => onPick(c.code)}>
              <Flag code={c.code} size={26} />
              <Text style={styles.nm}>
                {c.label} <Text style={styles.sub}>· {c.native}</Text>
              </Text>
              <View style={[styles.radio, on && styles.radioOn]}>{on && <IconCheck size={13} color="#fff" />}</View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, gap: 14 },

  search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, ...shadow.sh1 },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 14.5, color: C.ink, padding: 0 },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  noticeText: { flex: 1, fontFamily: font.bodyBold, fontSize: 13, color: C.ink2, lineHeight: 18 },

  group: { fontFamily: font.bodyBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: C.ink3, marginLeft: 2, marginTop: 4, marginBottom: 2 },
  list: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sh1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
  rowFirst: { borderTopWidth: 0 },
  rowOn: { backgroundColor: 'rgba(226,88,12,0.045)' },
  nm: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  sub: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: C.primary, borderColor: C.primary },
  empty: { fontFamily: font.body, fontSize: 13.5, color: C.ink3, paddingVertical: 8 },
});
