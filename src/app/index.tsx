/**
 * TEMPORARY boot screen — verifies the foundation (fonts, theme, i18n, query seam).
 * Replaced by the (tabs) app shell in the app-shell unit.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { color, font } from '@/lib/theme';
import { useHome } from '@/lib/data/useHome';

export default function Index() {
  const { t } = useTranslation();
  const { data } = useHome();

  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <Text style={styles.markText}>K</Text>
      </View>
      <Text style={styles.word}>{t('brand')}</Text>
      <Text style={styles.note}>
        Foundation ready · {data?.recommended.length ?? 0} mock recommendations
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: color.surface },
  mark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: '#fff', fontFamily: font.display, fontSize: 42 },
  word: { color: color.primary, fontFamily: font.display, fontSize: 34 },
  note: { color: color.ink2, fontFamily: font.body, fontSize: 14 },
});
