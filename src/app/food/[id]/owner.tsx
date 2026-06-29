/**
 * Ask the owner (mockup Screen F) — one full-screen card the diner holds up to
 * staff: a large Korean question (place language = ko, Constitution I) with the
 * menu name highlighted, a Korean allergy note, a reader-language caption, and a
 * single dismiss button. No card chrome, no on-screen answer step.
 *
 * Korean text is DATA (OwnerConfirmation), not i18n. menuNameKo matches the
 * scanned menu name (FR-019). Reader caption/button are i18n.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { IconClose } from '@/components';
import { useOwnerConfirmation } from '@/lib/data/useOwnerConfirmation';

export default function OwnerConfirm() {
  const { id, ingredient } = useLocalSearchParams<{ id: string; ingredient?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { data } = useOwnerConfirmation(id ?? '', ingredient);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable style={[styles.close, { top: insets.top + 10 }]} onPress={() => router.back()} hitSlop={8}>
        <IconClose size={22} color={C.ink2} />
      </Pressable>

      <View style={styles.center}>
        {data && (
          <>
            <Text style={styles.question}>{renderQuestion(data.questionKo, data.menuNameKo)}</Text>
            <Text style={styles.note}>{data.explanationKo}</Text>
            <Text style={styles.caption}>{t('owner.caption')}</Text>
          </>
        )}
      </View>

      <View style={[styles.foot, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable style={styles.done} onPress={() => router.back()}>
          <Text style={styles.doneText}>{t('owner.done')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Highlight the menu name (primary) within the Korean question. */
function renderQuestion(question: string, menuNameKo: string) {
  const idx = menuNameKo ? question.indexOf(menuNameKo) : -1;
  if (idx < 0) return question;
  return (
    <>
      {question.slice(0, idx)}
      <Text style={styles.menu}>{menuNameKo}</Text>
      {question.slice(idx + menuNameKo.length)}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  close: {
    position: 'absolute',
    left: 18,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 26 },
  question: { fontFamily: font.koBold, fontSize: 34, lineHeight: 46, color: C.ink, textAlign: 'center' },
  menu: { color: C.primary },
  note: { fontFamily: font.koBold, fontSize: 19, lineHeight: 29, color: C.ink2, textAlign: 'center' },
  caption: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink3, textAlign: 'center', marginTop: 4 },
  foot: { paddingHorizontal: 22 },
  done: { backgroundColor: C.ink, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  doneText: { fontFamily: font.display, fontSize: 17, color: '#fff' },
});
