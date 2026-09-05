/**
 * Profile tab (KB-434 D-6, 4150:14371) — 헤더 행(아바타 48+닉네임+국적·언어) +
 * 정보수정 아웃라인 버튼 · 랭킹 카드(그라데이션+RankMedal 28+진행 바) ·
 * 회피 재료 타일 4열 2행 + Show all · 메뉴 행 리스트(tab_box h58).
 *
 * 시안 부재로 소멸: 식이 프리셋 칩 섹션·Recently scanned 섹션(진입은 홈·My Foods 유지).
 * 시안 부재지만 기능 유지(REPORTS 기재): 온보딩 이어하기 행·버전 줄(P-212 셀프체크)·
 * My Foods 행(§5 화면 진입점 — 시안 §1-4 목록에 없음, 질문 누적).
 * Data via useMe()/useMyReviews()/useBookmarks() — 훅·로그아웃·게이트 로직 무변.
 */
import { RemoteImage } from '@/components/RemoteImage';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View, Linking } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  IconChevron,
  Spinner,
  SkeletonProfile,
  QueryErrorBlock,
  ScreenCenterFill,
  RankMedal,
  Btn,
} from '@/components';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { useBookmarks } from '@/lib/data/bookmarks';
import { FLAGS } from '@/lib/flags';
import { tierByKey, TIERS } from '@/lib/ranking';
import { AvoidTile } from '@/components/AvoidTile';
import { FB_TINT } from '@/components/IngredientTileSections';
import { INGREDIENTS } from '@/lib/mocks/ingredients';
import { useIngredientCatalog } from '@/lib/data/useIngredientCatalog';
import { FlagEmoji } from '@/components';
import { AvatarPlaceholder } from '@/components/design4Assets';
import { countryByCode } from '@/lib/onboarding/countries';
import { resetToOnboarding } from '@/lib/nav';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
import Constants from 'expo-constants';
import { tapSentrySelfcheck } from '@/lib/sentry';
import { Snackbar } from '@/components/Snackbar';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useIsGuest } from '@/lib/auth/useSession';

// P-129: 게스트 프로필 탭 = 로그인 화면 임베드 — 로그인 성공 후 프로필 복귀
import LoginScreen from '../login';
function GuestLogin() {
  // P-146: 탭 소속 렌더 — 로고·백 제거(독립 /login 라우트는 무변)
  return <LoginScreen embedded />;
}

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const isGuest = useIsGuest();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();
  const { lang } = useLocale();
  // P-060: 언어 = OS 정본 — 행 탭 시 OS 앱 설정(언어 항목). 안드12-는 앱별
  // 언어 설정이 없어 행 숨김(폰 전체 언어 추종).
  const canOpenLangSettings = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 33);

  const { data: me, isLoading: meLoading, isError: meError, error: meErrorObj, refetch: refetchMe } = useMe();
  const { data: reviews } = useMyReviews();
  const { data: bookmarks } = useBookmarks();

  const [loggingOut, setLoggingOut] = useState(false);
  const ingCat = useIngredientCatalog();

  // ⑪-1: 무반응 버튼 연타 방지 — 확인 모달로 depth 추가, 진행 중엔 스피너+재진입 차단
  function confirmLogout() {
    if (loggingOut) return;
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => void runLogout(doLogout) }, // P-173
    ]);
  }

  const { run: runLogout } = useSubmitGuard(); // P-173: Alert 확인 연타 = 이중 로그아웃 봉쇄
  // P-212: 버전 줄 7연타 = Sentry 수신 검증 — 로직은 tapSentrySelfcheck 한 곳(화면은 표시만)
  const [verToast, setVerToast] = useState<string | null>(null);
  const onVersionTap = () => {
    const msg = tapSentrySelfcheck();
    if (!msg) return;
    setVerToast(msg);
    setTimeout(() => setVerToast(null), 3000);
  };
  async function doLogout() {
    setLoggingOut(true);
    try {
      // KB-67: BE 세션 폐기(POST /auth/logout + 토큰 삭제) 후
      // Firebase signOut(네이티브 전용 — lazy require).
      const { logoutBe } = await import('@/lib/auth/beAuth');
      await logoutBe().catch(() => {});
      if (Platform.OS !== 'web') {
        const session = require('@/lib/auth/session') as typeof import('@/lib/auth/session');
        await session.logOut().catch(() => {});
      }
      // ⑪-2: 로그아웃 후 로그인 화면 강제 대신 홈 — 게스트로 계속 둘러보기
      // (세션만료 처리와 동일 정책, guestMode OFF일 때만 /login).
      router.replace((FLAGS.guestMode ? '/(tabs)' : '/login') as Href);
    } finally {
      setLoggingOut(false);
    }
  }

  // P-196 ②: 에러/오프라인 = 화면 기준 정중앙(4탭 공용 기준) — 스크롤/헤더 패딩 밖
  if (!isGuest && !meLoading && meError) {
    return (
      <View style={styles.root}>
        <ScreenCenterFill>
          <QueryErrorBlock error={meErrorObj} onRetry={() => void refetchMe()} />
        </ScreenCenterFill>
        <StickyHeader hidden={hidden} mode="brand" />
      </View>
    );
  }

  const rank = me?.rank;
  const nextTier = rank?.nextTier ? tierByKey(rank.nextTier) : null;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 110 }}
      >
        {isGuest ? (
          /* P-129(멘토): 게이트 화면 대신 로그인 화면 자체(애플/구글) — 탭 안 임베드 */
          <GuestLogin />
        ) : meLoading ? (
          /* P-007(KB-174) J1: 첫 로드 백지 제거 */
          <SkeletonProfile />
        ) : me && (
          <View style={styles.body}>
            {/* 헤더 행(4150:14371 @y99) — 아바타 48 + 닉네임 16/600 + 국적·언어 14/400 */}
            <View style={styles.id}>
              <View style={styles.avatar}>
                {/* KB-149: 서버 프로필 사진 — 없으면 시안 플레이스홀더(D-1) */}
                {me.profileImageUrl ? (
                  <RemoteImage uri={me.profileImageUrl} style={styles.avatarImg} />
                ) : (
                  <AvatarPlaceholder height={48} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                {/* KB-125: 미완료 프로필 — 검정 '—' 대신 흐린 "미설정" 표기 */}
                {me.nickname ? (
                  <Text style={styles.name} numberOfLines={1}>{me.nickname}</Text>
                ) : (
                  <Text style={styles.nameUnset}>{t('profile.nicknameUnset')}</Text>
                )}
                <View style={styles.natRow}>
                  {!!me.nationality && (
                    <>
                      <FlagEmoji code={me.nationality} size={14} />
                      <Text style={styles.natText} numberOfLines={1} testID="nation-pill">
                        {countryByCode(me.nationality)?.name ?? me.nationality}
                      </Text>
                      <Text style={styles.natText}>·</Text>
                    </>
                  )}
                  <Text style={styles.natText}>{lang.split('-')[0].toUpperCase()}</Text>
                </View>
              </View>
              {/* 정보수정 — 아웃라인 68×36 r8 border #DCDEE3, 13/500 */}
              <Pressable
                style={({ pressed }) => [styles.editBtn, pressed && { backgroundColor: C.surface2 }]}
                onPress={() => router.push('/profile/edit' as Href)}
                testID="profile-edit-pencil"
              >
                <Text style={styles.editBtnText}>{t('profile.edit')}</Text>
              </Pressable>
            </View>

            {/* 미완료 프로필(서버 플래그) — 온보딩 이어하기 유도 행(시안 부재 — 기능 유지) */}
            {me.onboardingCompleted === false && (
              <Pressable style={styles.finishRow} onPress={() => resetToOnboarding(router)}>
                <Text style={styles.finishText}>{t('onboarding.resumeTitle')}</Text>
                <Text style={styles.finishCta}>{t('onboarding.resumeCta')}</Text>
              </Pressable>
            )}

            {/* 랭킹 카드(4150:14390) — h147 그라데이션 + RankMedal 28 + 진행 바 h10 */}
            {rank && (
              <Pressable onPress={() => router.push('/profile/ranking' as Href)} testID="profile-rank-card">
                <LinearGradient colors={['#FFFFFF', '#FFF7F2']} style={styles.rankCard}>
                  <RankMedal level={rank.level} size={28} />
                  <Text style={styles.rankTier}>{t(`ranking.tier.${rank.tier}`)}</Text>
                  <Text style={styles.rankLv}>{t('ranking.levelLabel', { level: rank.level })}</Text>
                  <View style={styles.rankBarRow}>
                    <View style={styles.rankTrack}>
                      <View
                        style={[
                          styles.rankFill,
                          {
                            width: `${nextTier ? Math.min(100, Math.round((rank.score / Math.max(1, nextTier.at)) * 100)) : 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.rankPts} numberOfLines={1}>
                      <Text style={styles.rankPtsCur}>{rank.score}</Text>
                      <Text style={styles.rankPtsSep}> / </Text>
                      <Text style={styles.rankPtsGoal}>{t('ranking.tickPts', { at: nextTier ? nextTier.at : TIERS[TIERS.length - 1].at })}</Text>
                    </Text>
                    <IconChevron size={16} color={C.ink3} />
                  </View>
                </LinearGradient>
              </Pressable>
            )}

            {/* Dietary restrictions(@y334) — 타일 4열 2행(80×86) + Show all n */}
            <View style={styles.sec}>
              <Text style={styles.secLabel}>{t('profile.restrictionsTitle')}</Text>
              <View style={styles.dietGrid}>
                {me.restrictions.slice(0, 8).map((r) => {
                  const item = INGREDIENTS.find((i) => i.code === r.code);
                  return (
                    <Pressable key={r.code} style={styles.dietTile} onPress={() => router.push('/profile/restrictions' as Href)}>
                      <View style={styles.dietImg}>
                        <AvoidTile
                          code={r.code}
                          imageUrl={ingCat.imageUrl(r.code)}
                          abbr={(item?.name ?? r.code).replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
                          tint={FB_TINT[(item ? INGREDIENTS.indexOf(item) : 0) % FB_TINT.length]}
                        />
                      </View>
                      <Text style={styles.dietLabel} numberOfLines={1}>
                        {ingCat.name(r.code)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Btn variant="ghost" onPress={() => router.push('/profile/restrictions' as Href)} testID="avoid-show-all">
                {t('profile.showAll', { count: me.restrictions.length })}
              </Btn>
            </View>

            {/* 메뉴 행 리스트(tab_box h58 pad 17/22) — 구분선 없음, 탭 하이라이트 surface2 */}
            <View style={styles.menuList}>
              {/* My Foods — 시안 §1-4 목록 부재·§5 화면 진입점(질문 누적, 기능 유지) */}
              <MenuRow label={t('profile.myFoods')} onPress={() => router.push('/profile/my-foods' as Href)} />
              <MenuRow label={t('profile.saved')} value={String(bookmarks?.length ?? 0)} onPress={() => router.push('/profile/saved' as Href)} />
              {FLAGS.reviewsEnabled && (
                <MenuRow label={t('myReviews.title')} value={String(reviews?.length ?? 0)} onPress={() => router.push('/profile/reviews' as Href)} />
              )}
              {canOpenLangSettings && (
                <MenuRow label={t('profile.language')} value={LANG_ENDONYM[lang] ?? lang} onPress={() => void Linking.openSettings()} />
              )}
              {/* P-192: 알림 설정 — 푸시 플래그 종속 그대로 */}
              {FLAGS.pushEnabled && (
                <MenuRow label={t('notif.title')} onPress={() => router.push('/profile/notifications' as Href)} />
              )}
              {/* P-061③: 안전 고지 페이지(EN/KO) */}
              <MenuRow label={t('profile.safetyNotice')} onPress={() => void Linking.openURL('https://team-skyjs.github.io/kbap-legal/safety.html')} />
              {/* P-087(KB-251): 차단 목록 — Apple 1.2 해제 수단 */}
              {FLAGS.communityEnabled && (
                <MenuRow label={t('community.blockedTitle')} onPress={() => router.push('/community/blocked' as Href)} />
              )}
              {/* 로그아웃 chevron 유지 확정(2026-07-15 예진 — 시안 무chevron이지만 예진 확정 우선). 재제거 금지.
                  ⑪-1: 확인 모달 + 진행 중 스피너(무반응 연타 방지). */}
              <MenuRow
                label={t('profile.logout')}
                dim
                chevron
                trailing={loggingOut ? <Spinner size={16} /> : undefined}
                onPress={confirmLogout}
              />
              <MenuRow label={t('profile.deleteAccount')} dim onPress={() => router.push('/delete-account' as Href)} />
            </View>

            {/* P-212: 앱 버전 줄 — 라벨은 전 채널, 7연타 트리거는 dev 계열만(내부 게이트) */}
            <Pressable onPress={onVersionTap} style={styles.verRow} testID="app-version-row">
              <Text style={styles.verText}>v{Constants.expoConfig?.version ?? '0.0.0'}</Text>
            </Pressable>
          </View>
        )}
      </Animated.ScrollView>
      {verToast && <Snackbar icon={null} text={verToast} />}

      <StickyHeader hidden={hidden} mode="brand" />
    </View>
  );
}

/** tab_box 행(h58 pad 17/22) — 라벨 15/500 #1C1E21 · 카운트 15/500 #9196A1 · 구분선 없음. */
function MenuRow({
  label,
  value,
  dim,
  chevron,
  trailing,
  onPress,
}: {
  label: string;
  value?: string;
  dim?: boolean;
  chevron?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: C.surface2 }]} onPress={onPress}>
      <Text style={[styles.menuLabel, dim && { color: C.ink3 }]}>{label}</Text>
      {value != null && <Text style={styles.menuValue}>{value}</Text>}
      {trailing}
      {chevron && <IconChevron size={16} color={C.ink3} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingTop: 4, gap: 20 },
  verRow: { alignItems: 'center', paddingVertical: 10 },
  verText: { fontSize: 12, fontWeight: '400', color: C.ink3 },
  finishRow: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF4ED', borderWidth: 1, borderColor: '#FFE5D5', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  finishText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: C.ink, lineHeight: 18 },
  finishCta: { fontSize: 13, fontWeight: '600', color: C.primaryText },

  // 헤더 행 — pad 20
  id: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F6FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  name: { fontSize: 16, fontWeight: '600', color: '#1C1E21' },
  nameUnset: { fontSize: 16, fontWeight: '400', color: C.ink3 },
  natRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  natText: { fontSize: 14, fontWeight: '400', color: '#5A636A', flexShrink: 1 },
  editBtn: { width: 68, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#DCDEE3', alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 13, fontWeight: '500', color: '#1C1E21' },

  // 랭킹 카드(4150:14390) — mx 20 h147 r8 border #F2F3F6 + 그라데이션
  rankCard: { marginHorizontal: 20, height: 147, borderRadius: 8, borderWidth: 1, borderColor: C.hair, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 16 },
  rankTier: { fontSize: 15, fontWeight: '600', color: '#2F3137', textAlign: 'center', marginTop: 2 },
  rankLv: { fontSize: 12, fontWeight: '500', color: C.ink3 },
  rankBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 6 },
  rankTrack: { flex: 1, height: 10, borderRadius: 16, backgroundColor: '#EDEFF4', overflow: 'hidden' },
  rankFill: { height: 10, borderRadius: 16, backgroundColor: C.primary },
  rankPts: { fontSize: 12 },
  rankPtsCur: { fontSize: 12, fontWeight: '500', color: C.primary },
  rankPtsSep: { fontSize: 12, fontWeight: '400', color: C.inkMute },
  rankPtsGoal: { fontSize: 12, fontWeight: '400', color: '#4B4F58' },

  // Dietary restrictions — 4열 2행 80×86 타일
  sec: { paddingHorizontal: 20, gap: 12 },
  secLabel: { fontSize: 14, fontWeight: '500', color: C.ink2 },
  dietGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  dietTile: { width: 80, height: 86, borderWidth: 1, borderColor: '#ECEDF0', borderRadius: 4, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dietImg: { width: 48, height: 48, borderRadius: 4, overflow: 'hidden' },
  dietLabel: { fontSize: 12, fontWeight: '500', color: '#1C1E21', maxWidth: 72, textAlign: 'center' },

  // 메뉴 행 리스트(tab_box)
  menuList: { gap: 0 },
  menuRow: { height: 58, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 17, paddingHorizontal: 22 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1C1E21' },
  menuValue: { fontSize: 15, fontWeight: '500', color: C.ink3 },
});
