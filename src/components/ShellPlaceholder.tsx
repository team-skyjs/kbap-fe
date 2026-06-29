/**
 * ShellPlaceholder — neutral placeholder block for tab content not yet built
 * (mockup B1 `.ph-body`). Real screen content replaces this per-tab later.
 */
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius } from '@/lib/theme';

export function ShellPlaceholder() {
  const { t } = useTranslation();
  return (
    <View style={styles.body}>
      <View style={[styles.line, { width: '70%' }]} />
      <View style={styles.card} />
      <View style={styles.chips}>
        <View style={styles.chip} />
        <View style={styles.chip} />
        <View style={styles.chip} />
      </View>
      <View style={[styles.card, styles.cardSm]} />
      <View style={[styles.line, { width: '50%' }]} />
      <Text style={styles.note}>{t('shell.placeholderNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 18, gap: 14 },
  line: { height: 14, borderRadius: 7, backgroundColor: C.surface2 },
  card: { height: 96, borderRadius: radius.lg, backgroundColor: C.surface2 },
  cardSm: { height: 60 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { height: 30, width: 76, borderRadius: 999, backgroundColor: C.surface2 },
  note: { marginTop: 'auto', textAlign: 'center', fontFamily: font.body, fontSize: 12, color: C.ink3 },
});

export default ShellPlaceholder;
