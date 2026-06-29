/**
 * SearchOverlay — static search panel (mockup B2): search header + recent
 * searches list. MVP ships static UI; live querying is wired with the Food screen.
 */
import * as React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, shadow } from '@/lib/theme';
import { IconSearch, IconChevron } from './icons';

const RECENT = ['Kimchi Stew', 'Shrimp paste', 'Bibimbap'];

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.surface }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.box}>
            <IconSearch size={18} color={C.ink2} />
            <Text style={styles.ph}>{t('search.placeholder')}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.tag}>{t('search.recent')}</Text>
          {RECENT.map((s) => (
            <View key={s} style={styles.row}>
              <IconSearch size={17} color={C.ink3} />
              <Text style={styles.rowText}>{s}</Text>
              <View style={{ transform: [{ rotate: '-45deg' }] }}>
                <IconChevron size={15} color={C.ink3} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hair,
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    ...shadow.sh1,
  },
  ph: { flex: 1, fontFamily: font.body, fontSize: 14.5, color: C.ink3 },
  cancel: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary },
  body: { padding: 18, gap: 4 },
  tag: { fontFamily: font.body, fontSize: 11, color: C.ink2, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hair,
  },
  rowText: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
});

export default SearchOverlay;
