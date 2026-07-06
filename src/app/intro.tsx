/**
 * First-run onboarding intro (KB-76) — RN port of Claude Design hifi-intro.jsx.
 * 3 horizontally-swiped slides (Scan / Your safety / Reviews) + a Welcome/decision
 * screen, reached by swiping past the last slide or tapping Skip. A persistent
 * bottom CTA (Sign up or log in / Browse first) and top-right Skip live on each
 * slide, mirroring the design's self-contained artboards.
 *
 * Brand = K-Bap shared components (BrandLockup / BrandTile / BrandWordmark). All
 * copy is i18n (9 languages); the illustrations are text-free so they never need
 * translation. Colors from theme tokens.
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
import { BrandLockup, BrandTile, BrandWordmark } from '@/components/Brand';
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
  // Each page needs an explicit height: a horizontal ScrollView sizes children to
  // content, so the flex:1 hero / welcome-center have no bounded height to fill
  // without it (foot would float mid-screen instead of pinning to the bottom).
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  // KB-10 login screen isn't built yet → route "Sign up or log in" to the account
  // setup flow (onboarding). Repoint to the login screen once it lands.
  const goSignUp = () => router.replace('/onboarding' as Href);
  const goBrowse = () => router.replace('/(tabs)');
  const goWelcome = () => scrollRef.current?.scrollTo({ x: width * 3, animated: true });

  const foot = (
    <View style={[styles.foot, { paddingBottom: insets.bottom + 24 }]}>
      <Btn onPress={goSignUp} style={styles.cta}>{t('intro.signUp')}</Btn>
      <Pressable onPress={goBrowse} hitSlop={8}>
        <Text style={styles.secondary}>{t('intro.browseFirst')}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s) => (
          <View key={s.index} style={{ width, height }}>
            <View style={[styles.top, { paddingTop: insets.top + 14 }]}>
              <BrandLockup tileSize={34} />
              <Pressable onPress={goWelcome} hitSlop={8}>
                <Text style={styles.skip}>{t('intro.skip')}</Text>
              </Pressable>
            </View>

            <View style={styles.hero}>
              <View style={styles.illus}>{s.illus}</View>
            </View>

            <View style={styles.copy}>
              <View style={[styles.eyebrow, { backgroundColor: s.accent ? accentTint : primaryTint }]}>
                {s.icon}
                <Text style={[styles.eyebrowText, { color: s.accent ? C.accent : C.primary }]}>{t(s.eyebrowKey)}</Text>
              </View>
              <Text style={styles.head}>{t(s.headKey)}</Text>
              <Text style={styles.sub}>{t(s.subKey)}</Text>
            </View>

            <View style={styles.dots}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.dot, i === s.index && styles.dotOn]} />
              ))}
            </View>

            {foot}
          </View>
        ))}

        {/* S4 · Welcome / decision — no carousel chrome, big mark + CTA */}
        <View style={{ width, height }}>
          <View style={styles.welcomeCenter}>
            <View style={styles.welcomeMark}>
              <View style={styles.welcomeGlow} />
              <BrandTile size={104} />
            </View>
            <View style={styles.welcomeBrand}>
              <BrandWordmark size={42} />
              <Text style={styles.welcomeTag}>{t('intro.welcomeTagline')}</Text>
            </View>
          </View>
          {foot}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  skip: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, padding: 6 },

  hero: { flex: 1, minHeight: 0, paddingHorizontal: 26, paddingTop: 20, paddingBottom: 4 },
  illus: { flex: 1, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: C.hair, backgroundColor: C.surface2, ...shadow.sh2 },

  copy: { paddingHorizontal: 30, paddingTop: 22, alignItems: 'center', gap: 9 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 6 },
  eyebrowText: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1.4 },
  head: { fontFamily: font.displayBlack, fontSize: 27, color: C.ink, textAlign: 'center', lineHeight: 31, letterSpacing: -0.4, maxWidth: 300 },
  sub: { fontFamily: font.body, fontSize: 14.5, color: C.ink2, textAlign: 'center', lineHeight: 21, maxWidth: 320 },

  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 22, paddingBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: C.line },
  dotOn: { width: 26, backgroundColor: C.primary },

  foot: { paddingHorizontal: 22, paddingTop: 8, alignItems: 'stretch', gap: 4 },
  cta: { borderRadius: 15, paddingVertical: 15 },
  secondary: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink2, textAlign: 'center', padding: 12 },

  welcomeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 34 },
  welcomeMark: { alignItems: 'center', justifyContent: 'center' },
  welcomeGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: primaryTint },
  welcomeBrand: { alignItems: 'center', gap: 8 },
  welcomeTag: { fontFamily: font.body, fontSize: 16, color: C.ink2, textAlign: 'center', lineHeight: 23, maxWidth: 260 },
});
