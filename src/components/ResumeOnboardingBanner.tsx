/**
 * ResumeOnboardingBanner (KB-110) — light nudge shown over the tab shell when
 * a mid-flow onboarding draft exists: "이어서 설정하기" resumes at the saved
 * step; the ✕ ("나중에") keeps browsing with the draft intact (server sync of
 * the incomplete state lands with KB-75). Disappears for the session on
 * dismiss and forever once the flow submits (draft cleared).
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { IconClose } from '@/components/icons';
import { loadOnboardingDraft } from '@/lib/onboarding/draft';

export function ResumeOnboardingBanner() {
  const router = useRouter();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void loadOnboardingDraft().then((d) => setVisible(!!d));
  }, []);

  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.title} numberOfLines={2}>
          {t('onboarding.resumeTitle')}
        </Text>
        <Pressable
          style={styles.cta}
          onPress={() => {
            setVisible(false);
            router.push('/onboarding' as Href);
          }}
        >
          <Text style={styles.ctaText}>{t('onboarding.resumeCta')}</Text>
        </Pressable>
        <Pressable onPress={() => setVisible(false)} hitSlop={10}>
          <IconClose size={16} color={C.ink3} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // floats just above the tab bar; box-none lets the rest of the screen tap through
  wrap: { position: 'absolute', left: 14, right: 14, bottom: 104 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...shadow.sh2,
  },
  title: { flex: 1, fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink, lineHeight: 18 },
  cta: { backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  ctaText: { fontFamily: font.bodyBold, fontSize: 13, color: '#fff' },
});
