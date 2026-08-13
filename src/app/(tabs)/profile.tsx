/**
 * Profile tab (mockup Screen I1) — identity, ranking ladder, dietary
 * restrictions, my reviews, and account rows (incl. delete account).
 *
 * Data via useMe()/useMyReviews()/useFoods() (MOCK_MODE). Scroll-aware brand
 * header; no emoji; reader text i18n'd; risk colors fixed.
 */
import { Image } from 'expo-image'; // P-189: 원격 사진 = 디스크 캐시
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View, Linking } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  Btn,
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  MedalEmblem,
  IconProfile,
  IconEdit,
  IconBell,
  IconGlobe,
  IconGear,
  IconUserX,
  IconTrash,
  IconChevron,
  IconPlus,
  IconLogout,
  IconSpeech,
  IconStar,
  Spinner,
  SkeletonProfile,
  QueryErrorBlock,
  ScreenCenterFill,
} from '@/components';
import { SPICE_LEVEL_LABEL, spiceRank } from '@/lib/spice';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { useBookmarks } from '@/lib/data/bookmarks';
import { FLAGS } from '@/lib/flags';
import { TIERS } from '@/lib/ranking';
import { AvoidTile } from '@/components/AvoidTile';
import { FB_TINT } from '@/components/IngredientTileSections';
import { INGREDIENTS } from '@/lib/mocks/ingredients';
import { useIngredientCatalog } from '@/lib/data/useIngredientCatalog';
import { useHome } from '@/lib/data/useHome';
import { RecentRow } from './index';
import { FlagEmoji } from '@/components';
import { countryByCode } from '@/lib/onboarding/countries';
import { resetToOnboarding } from '@/lib/nav';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
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

  const curLevel = me?.rank.level ?? 1;
  const [loggingOut, setLoggingOut] = useState(false);
  // P-176: 회피 표시 = 사진 미니 타일(온보딩 문법·P-174 서버 이미지 승계) — 8개(2줄) 초과 시 접기
  const ingCat = useIngredientCatalog();
  const recentScans = useHome().data?.recent ?? []; // P-181 ②: 서버 보관 이력 — 신규 API 0
  const [showAllAvoid, setShowAllAvoid] = useState(false);

  // ⑪-1: 무반응 버튼 연타 방지 — 확인 모달로 depth 추가, 진행 중엔 스피너+재진입 차단
  function confirmLogout() {
    if (loggingOut) return;
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => void runLogout(doLogout) }, // P-173
    ]);
  }

  const { run: runLogout } = useSubmitGuard(); // P-173: Alert 확인 연타 = 이중 로그아웃 봉쇄
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
  // (P-007 false-empty/백지 제거 원칙 무변 — 위치 기준만 통일)
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
            {/* identity */}
            <View style={styles.id}>
              <View style={styles.avatar}>
                {/* KB-149: 서버 프로필 사진 — 없으면 기존 플레이스홀더 */}
                {me.profileImageUrl ? (
                  <Image source={{ uri: me.profileImageUrl }} style={styles.avatarImg} />
                ) : (
                  <IconProfile size={30} color={C.primary} />
                )}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {/* KB-125: 미완료 프로필 — 검정 '—' 대신 흐린 "미설정" 표기 */}
                {me.nickname ? (
                  <Text style={styles.name}>{me.nickname}</Text>
                ) : (
                  <Text style={styles.nameUnset}>{t('profile.nicknameUnset')}</Text>
                )}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {!!me.nationality && (
                    <View style={styles.pill} testID="nation-pill">
                      {/* P-181 ⑤: 코드 생짜 → 국기(FlagEmoji — 기채택 예외)+국가명(온보딩 목록 재사용) */}
                      <FlagEmoji code={me.nationality} size={13} />
                      <Text style={styles.pillText}>{countryByCode(me.nationality)?.name ?? me.nationality}</Text>
                    </View>
                  )}
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{lang.split('-')[0].toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              {/* P-181 ④: 박스 배경 제거 — SVG만, 터치 44pt는 hitSlop */}
              <Pressable style={styles.edit} hitSlop={14} onPress={() => router.push('/profile/edit' as Href)} testID="profile-edit-pencil">
                <IconEdit size={18} color={C.ink2} />
              </Pressable>
            </View>

            {/* 미완료 프로필(서버 플래그) — 온보딩 이어하기 유도 행 */}
            {me.onboardingCompleted === false && (
              <Pressable style={styles.finishRow} onPress={() => resetToOnboarding(router)}>
                <Text style={styles.finishText}>{t('onboarding.resumeTitle')}</Text>
                <Text style={styles.finishCta}>{t('onboarding.resumeCta')}</Text>
              </Pressable>
            )}

            {/* ranking → tap opens the ranking-detail screen (7-tier FR-025 data) */}
            <Section title={t('profile.rankingTitle')}>
              <Pressable style={styles.rank} onPress={() => router.push('/profile/ranking' as Href)}>
                <View style={styles.rankTop}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {/* KB-125→P-158: 메달 뱃지 자산 전면 통일 — 구 Rosette 노출처 0(정의 보존) */}
                    <MedalEmblem level={me.rank.level} size={42} />
                    <View>
                      <Text style={styles.rankTier}>{t(`ranking.tier.${me.rank.tier}`)}</Text>
                      <Text style={styles.tag}>{t('profile.levelPts', { level: me.rank.level, score: me.rank.score })}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {me.rank.nextTier && me.rank.pointsToNext != null && (
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{t('profile.toNext', { points: me.rank.pointsToNext, tier: t(`ranking.tier.${me.rank.nextTier}`) })}</Text>
                      </View>
                    )}
                    <IconChevron size={16} color={C.ink3} />
                  </View>
                </View>
                <View style={styles.rankProg}>
                  {TIERS.map((tier) => (
                    <View key={tier.key} style={[styles.rankSeg, tier.level <= curLevel && styles.rankSegOn]} />
                  ))}
                </View>
              </Pressable>
            </Section>

            {/* P-176: dietary restrictions = 사진 미니 타일 4열(선택분만·플랫 — 카테고리 섹션 없음,
                프로필 탭은 요약 표면). 타일 탭 = Edit 진입(재량 — 읽기 전용 표시 + 수정 유도).
                8개(2줄) 초과는 접기 + "Show all n" 토글(38종 수용). */}
            <Section
              title={t('profile.restrictionsTitle')}
              action={
                <Pressable style={styles.linkRow} hitSlop={8} onPress={() => router.push('/profile/restrictions' as Href)}>
                  <IconEdit size={14} color={C.primary} />
                  <Text style={styles.link}>{t('profile.edit')}</Text>
                </Pressable>
              }
            >
              <View style={styles.dietGrid}>
                {(showAllAvoid ? me.restrictions : me.restrictions.slice(0, 8)).map((r) => {
                  const item = INGREDIENTS.find((i) => i.code === r.code);
                  return (
                    <Pressable key={r.code} style={styles.dietTileWrap} onPress={() => router.push('/profile/restrictions' as Href)}>
                      <AvoidTile
                        code={r.code}
                        imageUrl={ingCat.imageUrl(r.code)}
                        abbr={(item?.name ?? r.code).replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
                        tint={FB_TINT[(item ? INGREDIENTS.indexOf(item) : 0) % FB_TINT.length]}
                      />
                      <Text style={styles.dietTileLabel} numberOfLines={1}>
                        {ingCat.name(r.code)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {me.restrictions.length > 8 && (
                <Pressable style={styles.dietMore} hitSlop={8} onPress={() => setShowAllAvoid((v) => !v)} testID="avoid-toggle">
                  <Text style={styles.dietMoreText}>
                    {showAllAvoid ? t('profile.showLess') : t('profile.showAll', { count: me.restrictions.length })}
                  </Text>
                </Pressable>
              )}
              <Pressable style={styles.dietAdd} hitSlop={6} onPress={() => router.push('/profile/restrictions' as Href)}>
                <IconPlus size={13} color={C.primary} />
                <Text style={styles.dietAddText}>{t('profile.add')}</Text>
              </Pressable>
            </Section>

            {/* P-181 ②: Recently scanned — 홈과 동일 데이터(useHome().recent)·카드(RecentRow)
                재사용, 배치 = 개인 콘텐츠 클러스터(Saved/My reviews) 위 재량. 빈 상태 = 홈
                규칙(미노출), 게스트는 프로필 자체가 로그인 임베드라 미도달. */}
            {recentScans.length > 0 && (
              <Section title={t('home.recentTitle')}>
                <View style={{ gap: 10 }}>
                  {recentScans.map((d) => (
                    <RecentRow
                      key={d.foodId}
                      food={d}
                      hasRestrictions={(me.restrictions.length ?? 0) > 0}
                      guest={false}
                      reviewLabel={t('home.review')}
                      onPress={() => router.push(`/food/${d.foodId}?src=list` as Href)}
                    />
                  ))}
                </View>
              </Section>
            )}

            {/* P-150 ⑤①: Spice tolerance 섹션 제거 — 맵기 수정은 프로필 수정 화면만 */}

            {/* saved (Bookmark Mods A) — My reviews 바로 위: 개인 콘텐츠 클러스터.
                카운트는 조용한 tag(“My reviews · 12”와 동일 톤), 뱃지 아님 */}
            {/* P-157 ①: Saved + My reviews = 같은 카드의 AcctRow 행 2개(컴포넌트 공용).
                구 "My reviews · n | See all" 텍스트 헤더+인라인 리스트 소멸.
                P-157 ②: 저장 아이콘 = 별(P-129 상세와 동일 SVG 통일). */}
            <View style={styles.acctList}>
              <AcctRow
                icon={<IconStar size={17} color={C.ink2} />}
                label={t('profile.saved')}
                value={String(bookmarks?.length ?? 0)}
                onPress={() => router.push('/profile/saved' as Href)}
              />
              {FLAGS.reviewsEnabled && (
                <AcctRow
                  icon={<IconSpeech size={17} color={C.ink2} />}
                  label={t('myReviews.title')}
                  value={String(reviews?.length ?? 0)}
                  onPress={() => router.push('/profile/reviews' as Href)}
                />
              )}
            </View>

            {/* account */}
            <Section title={t('profile.accountTitle')}>
              <View style={styles.acctList}>
                {canOpenLangSettings && (
                  <AcctRow icon={<IconGlobe size={18} color={C.ink2} />} label={t('profile.language')} value={LANG_ENDONYM[lang] ?? lang} onPress={() => void Linking.openSettings()} />
                )}
                {/* P-192: 알림 설정 — 푸시 빌드 전 플래그 뒤(진입점 자체 숨김) */}
                {FLAGS.pushEnabled && (
                  <AcctRow icon={<IconBell size={18} color={C.ink2} />} label={t('notif.title')} onPress={() => router.push('/profile/notifications' as Href)} />
                )}
                {/* P-061③: 안전 고지 페이지(EN/KO) — 미설정=BE 그대로(v2.1.0) 고지 포함 */}
                <AcctRow icon={<IconGear size={18} color={C.ink2} />} label={t('profile.safetyNotice')} onPress={() => void Linking.openURL('https://team-skyjs.github.io/kbap-legal/safety.html')} />
                {/* P-087(KB-251): 차단 목록 — Apple 1.2 해제 수단 (설정 내 1화면) */}
                {FLAGS.communityEnabled && (
                  <AcctRow icon={<IconUserX size={18} color={C.ink2} />} label={t('community.blockedTitle')} onPress={() => router.push('/community/blocked' as Href)} />
                )}
                <AcctRow
                  // 멘토링 ②: 좌측 화살표 → 로그아웃 아이콘 (우측 chevron은 행 통일 유지 — 예진 확인).
                  // 로그아웃 chevron은 유지 확정 (2026-07-15 예진 — 과거 이중 아이콘 정리 건과 무관). 재제거 금지.
                  // ⑪-1: 확인 모달 + 진행 중 스피너(무반응 연타 방지).
                  icon={loggingOut ? <Spinner size={18} /> : <IconLogout size={18} color={C.ink2} />}
                  label={t('profile.logout')}
                  onPress={confirmLogout}
                />
                <AcctRow
                  icon={<IconTrash size={18} color={C.riskDanger} />}
                  label={t('profile.deleteAccount')}
                  danger
                  onPress={() => router.push('/delete-account' as Href)}
                />
              </View>
            </Section>
          </View>
        )}
      </Animated.ScrollView>

      <StickyHeader hidden={hidden} mode="brand" />
    </View>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.sec}>
      <View style={styles.secHead}>
        <Text style={styles.secTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}


function AcctRow({ icon, label, value, danger, onPress }: { icon: React.ReactNode; label: string; value?: string; danger?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={styles.acctRow} onPress={onPress}>
      <View style={styles.acctIc}>{icon}</View>
      <Text style={[styles.acctLabel, danger && { color: C.riskDanger }]}>{label}</Text>
      {value && <Text style={styles.tag}>{value}</Text>}
      <IconChevron size={16} color={danger ? C.riskDanger : C.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  finishRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fdf3e7', borderWidth: 1, borderColor: '#f3ddc0', borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  finishText: { flex: 1, fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink, lineHeight: 18 },
  finishCta: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  // 게스트 가입 유도 (KB-78)
  guestAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  guestTitle: { fontFamily: font.displayBlack, fontSize: 20, color: C.ink, textAlign: 'center' },
  guestSub: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 20 },

  id: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(226,88,12,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  name: { fontFamily: font.display, fontSize: 20, color: C.ink },
  nameUnset: { fontFamily: font.body, fontSize: 17, color: C.ink3 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  pillText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  edit: { padding: 4, alignItems: 'center', justifyContent: 'center' }, // P-181 ④: 박스 소멸 — 아이콘만(hitSlop 14 = 44pt)

  sec: { gap: 11 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  link: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // ranking
  rank: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow.sh1 },
  rankTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankTier: { fontFamily: font.display, fontSize: 16, color: C.ink },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  rankProg: { flexDirection: 'row', gap: 4 },
  rankSeg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.surface2 },
  rankSegOn: { backgroundColor: C.primary },
  rankTiers: { flexDirection: 'row', justifyContent: 'space-between' },
  rt: { fontFamily: font.body, fontSize: 10, color: C.ink3 },
  rtOn: { fontFamily: font.bodyBold, color: C.primaryText },

  // dietary
  spiceUnset: { fontFamily: font.body, fontSize: 13.5, color: C.ink3 },
  dietGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  dietTileWrap: { width: '22.5%', alignItems: 'center', gap: 4 },
  dietTileLabel: { fontFamily: font.bodyBold, fontSize: 10.5, color: C.ink2, maxWidth: '100%' },
  dietMore: { alignSelf: 'flex-start', marginTop: 10 },
  dietMoreText: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  dietAdd: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', paddingHorizontal: 12, paddingVertical: 8 },
  dietAddText: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },

  // my reviews
  myrev: { flexDirection: 'row', gap: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },

  // account
  acctList: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sh1 },
  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  acctIc: { width: 30, alignItems: 'center' },
  acctLabel: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
});
