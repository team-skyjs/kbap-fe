/**
 * First-run onboarding intro (KB-76) — RN port of Claude Design hifi-intro.jsx.
 * 3 slides (Scan / Your safety / Reviews). Only the ILLUSTRATION card slides
 * horizontally; the brand header, copy (eyebrow/headline/sub), dots and the
 * bottom CTA stay fixed — the copy and dots track the swiped illustration index.
 *
 * Brand = K-Bap shared components (BrandLockup). All copy is i18n (9 languages);
 * the illustrations are text-free so they never need translation. Theme tokens.
 *
 * Scope (KB-76): UI + CTA routing only. First-run gating + hasSeenIntro
 * persistence need auth + storage → deferred to the real-API integration step.
 */
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, accentTint, radius, shadow } from '@/lib/theme';
import { Btn, RiskMark, IconCamera, IconSpeech } from '@/components';
import { BrandLockup } from '@/components/Brand';
import { IllusScan, IllusSafety, IllusReviews } from '@/features/intro/IntroIllustrations';

type SlideDef = {
  index: number;
  eyebrowKey: string;
  headKey: string;
  subKey: string;
  icon: React.ReactNode;
  accent?: boolean;
  illus: React.ReactNode;
};

const SLIDES: SlideDef[] = [
  { index: 0, eyebrowKey: 'intro.s1Eyebrow', headKey: 'intro.s1Head', subKey: 'intro.s1Sub', icon: <IconCamera size={13} color={C.primary} />, illus: <IllusScan /> },
  { index: 1, eyebrowKey: 'intro.s2Eyebrow', headKey: 'intro.s2Head', subKey: 'intro.s2Sub', icon: <RiskMark state="caution" size={13} />, illus: <IllusSafety /> },
  { index: 2, eyebrowKey: 'intro.s3Eyebrow', headKey: 'intro.s3Head', subKey: 'intro.s3Sub', icon: <IconSpeech size={13} color={C.accent} />, accent: true, illus: <IllusReviews /> },
];

export default function Intro() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  // hero height is dynamic (flex:1); measure it so the horizontal pager's pages
  // get an explicit height (a horizontal ScrollView sizes children to content).
  const [heroH, setHeroH] = useState(0);

  // KB-10 login screen isn't built yet → route "Sign up or log in" to the account
  // setup flow (onboarding). Repoint to the login screen once it lands.
  const goSignUp = () => router.replace('/onboarding' as Href);
  const goHome = () => router.replace('/(tabs)'); // Browse first / Skip → guest home

  const cur = SLIDES[active];

  return (
    <View style={styles.root}>
      {/* fixed header */}
      <View style={[styles.top, { paddingTop: insets.top + 14 }]}>
        <BrandLockup tileSize={34} />
        <Pressable onPress={goHome} hitSlop={8}>
          <Text style={styles.skip}>{t('intro.skip')}</Text>
        </Pressable>
      </View>

      {/* ONLY the illustration card slides */}
      <View style={styles.hero} onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
        {heroH > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              if (i !== active && i >= 0 && i < SLIDES.length) setActive(i);
            }}
          >
            {SLIDES.map((s) => (
              <View key={s.index} style={[styles.page, { width, height: heroH }]}>
                <View style={styles.illus}>{s.illus}</View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* fixed copy — tracks the swiped illustration */}
      <View style={styles.copy}>
        <View style={[styles.eyebrow, { backgroundColor: cur.accent ? accentTint : primaryTint }]}>
          {cur.icon}
          <Text style={[styles.eyebrowText, { color: cur.accent ? C.accent : C.primary }]}>{t(cur.eyebrowKey)}</Text>
        </View>
        <Text style={styles.head}>{t(cur.headKey)}</Text>
        <Text style={styles.sub}>{t(cur.subKey)}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.dot, i === active && styles.dotOn]} />
        ))}
      </View>

      {/* fixed CTA */}
      <View style={[styles.foot, { paddingBottom: insets.bottom + 24 }]}>
        <Btn onPress={goSignUp} style={styles.cta}>{t('intro.signUp')}</Btn>
        <Pressable onPress={goHome} hitSlop={8}>
          <Text style={styles.secondary}>{t('intro.browseFirst')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  skip: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, padding: 6 },

  hero: { flex: 1, minHeight: 0 },
  page: { paddingHorizontal: 26, paddingTop: 20, paddingBottom: 4 },
  illus: { flex: 1, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: C.hair, backgroundColor: C.surface2, ...shadow.sh2 },

  copy: { paddingHorizontal: 30, paddingTop: 22, alignItems: 'center', gap: 9 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 6 },
  eyebrowText: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1.4 },
  head: { fontFamily: font.displayBlack, fontSize: 27, color: C.ink, textAlign: 'center', lineHeight: 34, letterSpacing: -0.4, maxWidth: 300 },
  sub: { fontFamily: font.body, fontSize: 14.5, color: C.ink2, textAlign: 'center', lineHeight: 21, maxWidth: 320 },

  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 22, paddingBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: C.line },
  dotOn: { width: 26, backgroundColor: C.primary },

  foot: { paddingHorizontal: 22, paddingTop: 8, alignItems: 'stretch', gap: 4 },
  cta: { borderRadius: 15, paddingVertical: 15 },
  secondary: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink2, textAlign: 'center', padding: 12 },
});
