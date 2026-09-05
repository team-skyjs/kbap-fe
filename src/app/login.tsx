/**
 * Login / sign-up (KB-10 → KB-433 디자인 4차, 4150:14197) — SOCIAL ONLY.
 * 음식 콜라주 = 화면 전면 배경(P-280 — 행 마퀴가 텍스트·버튼 뒤까지 흐름, 하단은
 * blurRadius+흰 워시로 가독) + 상단 흰→투명 그라데이션,
 * welcome 블록(시안 워드마크 144×46 + 안내), SocialAuthButtons(공용 — Apple은
 * OS 공식 네이티브 버튼이라 시안 primary 재스타일 불가: HIG/심사 리스크, 질문 누적),
 * Browse first = 버튼 아래 텍스트 링크 유지(예진 확정 9/5), 약관 문구.
 *
 * 콜라주 사진 = 스펙 bridge/design/4th/dishes 12장(30장 2.4MB > 1MB 상한 —
 * 발주 규정대로 12장 축소, 1.0MB). JS 번들 자산 — OTA 가능.
 */
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Image, Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { IconArrowLeft } from '@/components/icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { resetToOnboarding } from '@/lib/nav';
import { logoutLocalFirst } from '@/lib/auth/beAuth';
import { EVENTS, setUserProps, track } from '@/lib/analytics';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { Wordmark } from '@/components/design4Assets';
import { api } from '@/lib/api/client';
import { GAP, TILE, blurredFromRow, collageRows, embedAvailableH, marqueeDuration, marqueeSpan } from '@/lib/loginCollage';
import { TABBAR_CONTENT_H } from '@/components/TabBar';
import { LEGAL_URLS } from '@/lib/legalText';

/* eslint-disable @typescript-eslint/no-require-imports */
const DISHES = [
  require('../../assets/images/dishes/dish-01.jpg'),
  require('../../assets/images/dishes/dish-02.jpg'),
  require('../../assets/images/dishes/dish-03.jpg'),
  require('../../assets/images/dishes/dish-04.jpg'),
  require('../../assets/images/dishes/dish-05.jpg'),
  require('../../assets/images/dishes/dish-06.jpg'),
  require('../../assets/images/dishes/dish-07.jpg'),
  require('../../assets/images/dishes/dish-08.jpg'),
  require('../../assets/images/dishes/dish-09.jpg'),
  require('../../assets/images/dishes/dish-10.jpg'),
  require('../../assets/images/dishes/dish-11.jpg'),
  require('../../assets/images/dishes/dish-12.jpg'),
];
/* eslint-enable @typescript-eslint/no-require-imports */


/** 시안(4150:14197) 행 오프셋(x -101 + r·73.5)·타일 4열 문법 유지 — 9/5 후속:
 *  각 행 = 가로 마퀴(홀수 행 좌→우·짝수 행 우→좌, ~20px/s 선형 무한 루프).
 *  seamless: 타일 4개 주기를 3배 복제 + 기본 -span 시프트 — x∈[-span,0] 어느
 *  위상에서도 화면 전폭 커버. 12장 자산 순환(추가 에셋 0). */
function MarqueeRow({ row, animate, blur }: { row: number; animate: boolean; blur: boolean }) {
  const span = marqueeSpan(4);
  const ltr = row % 2 === 0; // 1·3·5번째 행 = 좌→우
  const x = useSharedValue(ltr ? -span : 0);
  useEffect(() => {
    cancelAnimation(x);
    x.value = ltr ? -span : 0;
    if (!animate) return; // reduce-motion·언포커스·백그라운드 = 정지(정적)
    x.value = withRepeat(
      withTiming(ltr ? 0 : -span, { duration: marqueeDuration(span), easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [animate, ltr, span, x]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // 4열 주기 ×3 — 자산 12장 순환(행마다 시작 타일 4칸 시프트)
  const tiles = Array.from({ length: 12 }, (_, i) => DISHES[(row * 4 + (i % 4)) % DISHES.length]);
  return (
    <Animated.View style={[styles.collageRow, { marginLeft: -101 + row * ((TILE + GAP) / 2) - span }, anim]}>
      {tiles.map((src, i) => (
        /* P-280: hero 하단 구간 행 = 블러(RN 기본 blurRadius — expo-blur 금지, OTA-able) */
        <Image key={i} source={src} style={styles.tile} blurRadius={blur ? 14 : 0} />
      ))}
    </Animated.View>
  );
}

/** P-280: 콜라주 = 화면 전면 배경(absoluteFill) — 행 수 = 높이 채움(ceil, 3~8),
 *  hero 상단(heroTop)부터는 블러 행 + 흰 워시로 텍스트·버튼 가독. */
function Collage({ animate, heroTop }: { animate: boolean; heroTop: number }) {
  const [h, setH] = useState(0);
  const rows = collageRows(h);
  const blurFrom = blurredFromRow(heroTop);
  return (
    <View
      style={styles.collage}
      pointerEvents="none"
      testID="login-collage"
      onLayout={(e) => setH(e.nativeEvent.layout.height)}
    >
      <View style={{ marginTop: -24 }}>
        {Array.from({ length: rows }, (_, r) => (
          <MarqueeRow key={r} row={r} animate={animate} blur={r >= blurFrom} />
        ))}
      </View>
      {/* 상단 흰→투명 그라데이션 186h(4150:20076) — 상태바 가독 */}
      <LinearGradient colors={['#FFFFFF', 'rgba(255,255,255,0)']} style={styles.collageFade} />
      {/* P-280 하단 흰 워시 — 워드마크·안내·약관이 흰 0.9 위에서 판독 */}
      {heroTop > 0 && (
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.86)', 'rgba(255,255,255,0.92)']}
          locations={[0, 0.28, 1]}
          style={[styles.collageWash, { top: heroTop - 40 }]}
        />
      )}
    </View>
  );
}

/** P-146: embedded = 프로필 탭 소속 렌더 — 백 화살표 제거. 독립 /login은 현행 무변. */
export default function Login({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  // KB-421(Codex #19 P1-4): 소셜 로그인 진행 중 = 게스트 진입 잠금(UX 이중 방어)
  const [authBusy, setAuthBusy] = useState(false);
  const { height: winH } = useWindowDimensions();

  // 9/5 후속: 마퀴 정지 조건 — 언포커스·백그라운드·reduce-motion(정적 유지)
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [appActive, setAppActive] = useState(true);
  // null = 판정 전 — 알기 전엔 시작 안 함(reduce-motion 사용자에게 첫 프레임 움직임 0)
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => setReduceMotion(!!v)).catch(() => setReduceMotion(false));
    const rm = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(!!v));
    const app = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => {
      rm?.remove();
      app.remove();
    };
  }, []);
  const animate = focused && appActive && reduceMotion === false;
  const [heroTop, setHeroTop] = useState(0); // P-280: 하단 가독 구간 기준(root 좌표)

  return (
    <View
      style={[
        styles.root,
        { paddingBottom: bottom + 26 },
        // 임베드(프로필 탭 ScrollView 소속) = flex 무경계 — 가용 높이를 명시(헤더·탭바 차감)
        // P-280: 게스트 프로필 탭 = 헤더 미렌더(headerH 0) — 상태바 뒤까지 콜라주
        embedded && { flex: undefined, height: embedAvailableH(winH, 0, TABBAR_CONTENT_H, insets.bottom) },
      ]}
    >
      <Collage animate={animate} heroTop={heroTop} />
      {/* P-129: 뒤로가기 복원 — 빈 스택 GO_BACK 에러는 canGoBack 가드 */}
      {!embedded && router.canGoBack() && (
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.backBtn, { top: insets.top + 6 }]} testID="login-back">
          <IconArrowLeft size={22} color={C.ink} />
        </Pressable>
      )}

      {/* P-280: 콜라주가 absoluteFill 배경 — 스페이서가 hero를 하단으로 민다 */}
      <View style={{ flex: 1 }} pointerEvents="none" />

      {/* welcome 블록(@y435) — 워드마크 144×46 + 안내 16/400 #2F3137 */}
      <View style={styles.hero} onLayout={(e) => setHeroTop(e.nativeEvent.layout.y)}>
        <Wordmark height={46} />
        <Text style={styles.sub}>{t('login.sub')}</Text>
      </View>

      <View style={styles.foot}>
        {/* KB-67: newMember → 온보딩 · onboardingCompleted=false도 온보딩(분기 무변) */}
        <SocialAuthButtons
          onBusyChange={setAuthBusy}
          onSignedIn={(newMember) => {
            void (async () => {
              if (newMember) return resetToOnboarding(router); // P-088④ 스택 리셋
              const completed = await api
                .get<{ onboardingCompleted?: boolean }>('/members/me/profile')
                .then((p) => p.onboardingCompleted === true)
                .catch(() => true);
              if (completed) {
                router.replace((returnTo ?? '/(tabs)') as Href);
              } else {
                resetToOnboarding(router); // P-088④ 스택 리셋
              }
            })();
          }}
        />
        {/* KB-421: 게스트 진입 = 명시적 세션 클리어(await 후 이동 — Codex #19 P1).
            9/5 예진 확정: 버튼 아래 텍스트 링크 13/500 #6A6F7C 중앙 유지 */}
        <Pressable disabled={authBusy} onPress={() => { void (async () => { await logoutLocalFirst().catch(() => {}); track(EVENTS.auth_guest_enter); setUserProps({ user_info_is_registered: false }); /* P-083+144 */ router.replace('/(tabs)' as Href); })(); }} hitSlop={8} testID="browse-first">
          <Text style={[styles.browse, authBusy && styles.browseDim]}>{t('intro.browseFirst')}</Text>
        </Pressable>
        {/* 9/5 예진 판정(D-5 ⑥): 약관 = 시안대로 밑줄 3분할 — 링크는 기존 kbap-legal 정본(LEGAL_URLS) */}
        <Text style={styles.terms}>
          {t('login.termsPrefix')}
          <Text style={[styles.terms, styles.termsLink]} onPress={() => void Linking.openURL(LEGAL_URLS.terms)} testID="terms-tos">
            {t('login.termsTos')}
          </Text>
          {t('login.termsAnd')}
          <Text style={[styles.terms, styles.termsLink]} onPress={() => void Linking.openURL(LEGAL_URLS.privacy)} testID="terms-privacy">
            {t('login.termsPrivacy')}
          </Text>
          {t('login.termsSuffix')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  backBtn: { position: 'absolute', left: 16, zIndex: 5, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // P-280: 콜라주 = 전면 배경(absoluteFill + overflow hidden) — 콘텐츠는 위 레이어
  collage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  collageRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  tile: { width: TILE, height: TILE, borderRadius: 21, backgroundColor: C.surface2 },
  collageFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 186 },
  collageWash: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  // welcome — 콜라주가 flex를 소유, 하단 블록은 safe-area 위 고정
  hero: { alignItems: 'center', gap: 10, paddingHorizontal: 26, paddingTop: 20, paddingBottom: 24 },
  sub: { fontSize: 16, fontWeight: '400', color: '#2F3137', textAlign: 'center', lineHeight: 23, maxWidth: 300 },

  foot: { gap: 10, paddingHorizontal: 20 },
  terms: { fontSize: 13, fontWeight: '400', color: C.ink3, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
  termsLink: { textDecorationLine: 'underline', paddingHorizontal: 0 },
  browse: { fontSize: 13, fontWeight: '500', color: C.ink2, textAlign: 'center', padding: 10 },
  browseDim: { opacity: 0.35 }, // KB-421: 색/불투명도만(프레임 불변 P-151)
});
