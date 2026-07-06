/**
 * LanguagePicker — modal list of the 9 reader languages (T070). Each row shows
 * the endonym (the language's own name/script); the active one is checked.
 * Tapping switches i18next live (whole app re-renders) and persists via
 * LocaleProvider.setLang. Reachable from the profile account "Language" row.
 */
import * as React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, shadow } from '@/lib/theme';
import { SUPPORTED_LANGS, LANG_ENDONYM, type SupportedLang } from '@/lib/i18n/languages';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useUpdateMe } from '@/lib/data/useMe';
import { IconClose, IconCheck } from './icons';

export function LanguagePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { lang, setLang } = useLocale();
  const update = useUpdateMe();

  function pick(next: SupportedLang) {
    if (next !== lang) {
      setLang(next); // app locale (LocaleProvider) — the reader-language SSOT
      update.mutate({ readerLanguage: next }); // mirror onto the profile field for PATCH /me
    }
    onClose();
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.surface }}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.title}>{t('profile.language')}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <IconClose size={22} color={C.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {SUPPORTED_LANGS.map((code) => {
            const active = code === lang;
            return (
              <Pressable key={code} style={[styles.row, active && styles.rowOn]} onPress={() => pick(code)}>
                <Text style={[styles.endonym, active && styles.endonymOn]}>{LANG_ENDONYM[code]}</Text>
                {active && <IconCheck size={20} color={C.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hair,
  },
  title: { fontFamily: font.display, fontSize: 20, color: C.ink },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  list: { padding: 14, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    ...shadow.sh1,
  },
  rowOn: { borderColor: C.primary, backgroundColor: 'rgba(226,88,12,0.06)' },
  endonym: { fontFamily: font.display, fontSize: 16.5, color: C.ink },
  endonymOn: { color: C.primary },
});

export default LanguagePicker;
