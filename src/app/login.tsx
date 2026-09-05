/**
 * Login / sign-up (KB-10 → KB-433 디자인 4차, 4150:14197) — SOCIAL ONLY.
 * 상단 음식 콜라주(정적 — 예진 확정 9/5, 애니메이션 없음) + 흰→투명 그라데이션,
 * welcome 블록(시안 워드마크 144×46 + 안내), SocialAuthButtons(공용 — Apple은
 * OS 공식 네이티브 버튼이라 시안 primary 재스타일 불가: HIG/심사 리스크, 질문 누적),
 * Browse first = 버튼 아래 텍스트 링크 유지(예진 확정 9/5), 약관 문구.
 *
 * 콜라주 사진 = 스펙 bridge/design/4th/dishes 12장(30장 2.4MB > 1MB 상한 —
 * 발주 규정대로 12장 축소, 1.0MB). JS 번들 자산 — OTA 가능.
 */
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { IconArrowLeft } from '@/components/icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
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

const TILE = 136; // 시안: 136×136 radius 21, 간격 11
const GAP = 11;

/** 시안(4150:14197): 타일 3행, offset x -101 / y -24 — 정적 배치(예진 확정). */
function Collage() {
  const rows = [DISHES.slice(0, 4), DISHES.slice(4, 8), DISHES.slice(8, 12)];
  return (
    <View style={styles.collage} pointerEvents="none">
      {rows.map((row, r) => (
        <View key={r} style={[styles.collageRow, { marginLeft: -101 + r * ((TILE + GAP) / 2) }]}>
          {row.map((src, i) => (
            <Image key={i} source={src} style={styles.tile} />
          ))}
        </View>
      ))}
      {/* 상단 흰→투명 그라데이션 186h(4150:20076) — 상태바 가독 */}
      <LinearGradient colors={['#FFFFFF', 'rgba(255,255,255,0)']} style={styles.collageFade} />
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

  return (
    <View style={[styles.root, { paddingBottom: bottom + 26 }]}>
      <Collage />
      {/* P-129: 뒤로가기 복원 — 빈 스택 GO_BACK 에러는 canGoBack 가드 */}
      {!embedded && router.canGoBack() && (
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.backBtn, { top: insets.top + 6 }]} testID="login-back">
          <IconArrowLeft size={22} color={C.ink} />
        </Pressable>
      )}

      {/* welcome 블록(@y435) — 워드마크 144×46 + 안내 16/400 #2F3137 */}
      <View style={styles.hero}>
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
        <Text style={styles.terms}>{t('login.terms')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  backBtn: { position: 'absolute', left: 16, zIndex: 5, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // 콜라주(시안): 3행 오프셋 배치, y -24 — 화면 밖까지 흘러넘침
  collage: { position: 'absolute', top: -24, left: 0, right: 0, height: TILE * 3 + GAP * 2, overflow: 'hidden' },
  collageRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  tile: { width: TILE, height: TILE, borderRadius: 21, backgroundColor: C.surface2 },
  collageFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 186 },

  // welcome(@y435 비율) — 콜라주 아래 중앙
  hero: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 26, paddingBottom: 24 },
  sub: { fontSize: 16, fontWeight: '400', color: '#2F3137', textAlign: 'center', lineHeight: 23, maxWidth: 300 },

  foot: { gap: 10, paddingHorizontal: 20 },
  terms: { fontSize: 13, fontWeight: '400', color: C.ink3, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
  browse: { fontSize: 13, fontWeight: '500', color: C.ink2, textAlign: 'center', padding: 10 },
  browseDim: { opacity: 0.35 }, // KB-421: 색/불투명도만(프레임 불변 P-151)
});
