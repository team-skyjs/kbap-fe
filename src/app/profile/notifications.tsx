/**
 * Notification settings (KB-497) — 프로필 > 알림 설정. **서버 정본**(P-147) 2그룹.
 *
 * ① 내 활동 알림 — 「활동 알림」 토글(`activity`: 리뷰 도움됨 + 리뷰 리마인더 통합).
 * ② K-Bap 소식(광고성) — 「소식 알림」 토글(`news.enabled`) + 하위 「식사 시간 알림」(`news.mealTime`).
 *    소식 OFF→ON = 동의 시트(NotificationSheet consent: 마케팅 개인정보·광고성 수신 동의 2종,
 *    둘 다 체크 시에만 확인) → `news.enabled:true` + 문구 버전 2종. 소식 ON→OFF = 이 기기만 OFF.
 *    식사 시간은 소식 ON일 때만 조작(끄기 = 동의 철회 아님). 동의 캡션(일시·버전·전문)은 소식 ON일 때만.
 * 토글 = 낙관 반영(멱등 — useSubmitGuard 예외 계열), 실패 = 롤백 + 배너. 읽기 = 스켈레톤/재시도.
 * 게스트 = AuthGateSheet(saved.tsx 선례, 딥링크 이중 방어). FLAGS.pushEnabled off = 라우트 가드.
 * 단위(KB-544): 토글은 (회원, 기기), 동의는 회원. 시안: 피그마 「KB-497 알림 설정 시안」 1·1b.
 */
import * as React from 'react';
import { AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, IconBell } from '@/components';
import { Btn } from '@/components/Btn';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { Shimmer } from '@/components/Skeleton';
import { FLAGS } from '@/lib/flags';
import { useIsGuest } from '@/lib/auth/useSession';
import { EVENTS, track } from '@/lib/analytics';
import { openWebPage } from '@/lib/openExternal';
import { consentUrl, PRIVACY_CONSENT_VERSION, RECEIVE_CONSENT_VERSION } from '@/lib/push/consent';
import { useNotificationSettings, useUpdateNotificationSettings, type NotificationSettings as Settings } from '@/lib/data/useNotificationSettings';
import { NotificationSheet } from '@/features/push/NotificationSheet';
import { getPermissionStatus, registerPushToken, type PushPermission } from '@/lib/push/pushAdapter';

export default function NotificationSettings() {
  // 컴파일 상수 가드 — 훅 순서 무영향 (reviews.tsx 문법)
  if (!FLAGS.pushEnabled) return <Redirect href="/" />;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return <NotificationSettingsScreen />;
}

function NotificationSettingsScreen() {
  const isGuest = useIsGuest();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const query = useNotificationSettings(!isGuest); // 게스트 = 요청 0(401 회피)
  const update = useUpdateNotificationSettings();
  const [permission, setPermission] = React.useState<PushPermission>('unavailable');
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [offConfirm, setOffConfirm] = React.useState(false); // 소식 OFF 이탈 방어(당근 선례)

  React.useEffect(() => {
    void getPermissionStatus().then(setPermission);
  }, []);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      void getPermissionStatus().then(setPermission); // OS 설정 복귀 = 배너 재판정
      void registerPushToken(); // 권한 새로 허용됐으면 등록(세션 가드는 어댑터)
    });
    return () => sub.remove();
  }, []);

  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('notif.title')} onBack={() => router.back()} />
        <AuthGateSheet context="profile" open onClose={() => router.back()} />
      </View>
    );
  }

  const s = query.data;
  const patch = (p: Parameters<typeof update.mutate>[0]) => update.mutate(p);
  const toggleActivity = () => {
    if (!s) return;
    track(EVENTS.push_pref_toggle, { key: 'activity', on: !s.activity }); // P-214
    patch({ activity: !s.activity });
  };
  const toggleNews = () => {
    if (!s) return;
    if (!s.news.enabled) {
      setConsentOpen(true); // 동의 시트 — 서버 요청 없음, 토글 OFF 유지
      return;
    }
    setOffConfirm(true); // 끄기는 확인 모달 뒤에만(이탈 방어) — 서버 요청 없음, 토글 ON 유지
  };
  const confirmNewsOff = () => {
    setOffConfirm(false);
    track(EVENTS.push_pref_toggle, { key: 'news', on: false });
    patch({ news: { enabled: false } });
  };
  const toggleMealTime = () => {
    if (!s || !s.news.enabled) return; // 소식 OFF = 비활성(탭 무동작)
    track(EVENTS.push_pref_toggle, { key: 'mealTime', on: !s.news.mealTime });
    patch({ news: { mealTime: !s.news.mealTime } });
  };
  const confirmConsent = () => {
    track(EVENTS.push_pref_toggle, { key: 'news', on: true });
    patch({ news: { enabled: true, privacyConsentVersion: PRIVACY_CONSENT_VERSION, receiveConsentVersion: RECEIVE_CONSENT_VERSION } });
    setConsentOpen(false);
  };

  const osOff = permission === 'denied';
  const consent = s?.news.enabled ? consentCaption(s, i18n.language) : null;

  return (
    <View style={styles.root}>
      <SubHeader title={t('notif.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {osOff && (
          /* OS 권한 꺼짐 — 토글은 보이되 실수신 불가 안내 + 설정 딥링크 */
          <Pressable style={styles.banner} onPress={() => void Linking.openSettings()} testID="notif-os-off">
            <IconBell size={16} color={C.riskCaution} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.bannerText}>{t('notif.osOff')}</Text>
              <Text style={styles.bannerCta}>{t('notif.osOffCta')}</Text>
            </View>
          </Pressable>
        )}

        {query.isLoading && (
          /* 읽는 중 = 스켈레톤(기본값 스위치로 위장 금지 — P-207 계열) */
          <View style={{ gap: 12 }} testID="notif-skeleton">
            <Shimmer style={{ height: 52, borderRadius: 8 }} />
            <Shimmer style={{ height: 52, borderRadius: 8 }} />
            <Shimmer style={{ height: 52, borderRadius: 8 }} />
          </View>
        )}
        {query.isError && !s && (
          /* 읽기 실패 = 스위치 미렌더(값 미표시), 탭 = 재시도 */
          <Pressable style={styles.banner} onPress={() => void query.refetch()} testID="notif-read-error">
            <IconBell size={16} color={C.riskCaution} />
            <Text style={styles.bannerText}>{t('notif.readFailed')}</Text>
          </Pressable>
        )}

        {s && (
          <>
            <View style={styles.group}>
              <Text style={styles.groupTitle}>{t('notif.activityGroup')}</Text>
              <ToggleRow label={t('notif.activity')} sub={t('notif.activitySub')} on={s.activity} onPress={toggleActivity} testID="notif-activity" />
            </View>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>{t('notif.newsGroup')}</Text>
              <ToggleRow label={t('notif.news')} sub={t('notif.newsSub')} on={s.news.enabled} onPress={toggleNews} testID="notif-news" />
              <View style={styles.hair} />
              {/* 소식 OFF = 비활성 — 색·불투명도만(P-151), 탭 무동작 */}
              <View style={[!s.news.enabled && styles.rowDisabled]} testID="notif-mealtime-row">
                <ToggleRow
                  label={t('notif.mealTime')}
                  sub={t('notif.mealTimeSub')}
                  on={s.news.mealTime}
                  onPress={toggleMealTime}
                  disabled={!s.news.enabled}
                  testID="notif-mealtime"
                />
              </View>
              {consent && (
                <View style={styles.caption} testID="notif-consent-status">
                  <Text style={styles.captionText}>{t('notif.consentStatus', consent)}</Text>
                  <Pressable onPress={() => void openWebPage(consentUrl('receive'))} hitSlop={8} testID="notif-consent-full">
                    <Text style={styles.captionLink}>{t('notif.viewFull')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}

        {update.isError && (
          /* 저장 거부 표면화(롤백은 훅) — 탭 = 배너 닫기 */
          <Pressable style={styles.banner} onPress={() => update.reset()} testID="notif-save-failed">
            <IconBell size={16} color={C.riskCaution} />
            <Text style={styles.bannerText}>{t('notif.saveFailed')}</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* 소식 OFF 확인 — P-162 확인 모달 문법(가운데 카드·취소/확정 2버튼). 취소 = 변화 없음 */}
      <Modal visible={offConfirm} transparent animationType="fade" onRequestClose={() => setOffConfirm(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard} testID="notif-off-confirm">
            <Text style={styles.confirmTitle}>{t('notif.offConfirmTitle')}</Text>
            <Text style={styles.confirmBody}>{t('notif.offConfirmBody')}</Text>
            <View style={styles.confirmActions}>
              <View style={{ flex: 1 }}>
                <Btn variant="ghost" onPress={() => setOffConfirm(false)} testID="notif-off-cancel">{t('common.cancel')}</Btn>
              </View>
              <View style={{ flex: 1 }}>
                <Btn onPress={confirmNewsOff} testID="notif-off-confirm-cta">{t('notif.offConfirmCta')}</Btn>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <NotificationSheet
        open={consentOpen}
        variant="consent"
        title={t('push.consentSheetTitle')}
        body={t('push.consentSheetBody')}
        confirmLabel={t('push.consentConfirm')}
        onConfirm={confirmConsent}
        onClose={() => setConsentOpen(false)}
      />
    </View>
  );
}

/** 동의 캡션 값 — 일시 = 두 동의 중 최근 grantedAt, 버전 = 광고성 수신 동의 버전(spec FR-001). */
function consentCaption(s: Settings, lang: string): { date: string; version: number } | null {
  const p = s.news.privacyConsent, r = s.news.receiveConsent;
  if (!p || !r) return null;
  const latest = new Date(p.grantedAt) > new Date(r.grantedAt) ? p.grantedAt : r.grantedAt;
  const d = new Date(latest);
  const date = Number.isNaN(d.getTime()) ? latest : d.toLocaleDateString(lang);
  return { date, version: r.version };
}

function ToggleRow({ label, sub, on, onPress, testID, disabled }: { label: string; sub: string; on: boolean; onPress: () => void; testID: string; disabled?: boolean }) {
  return (
    <Pressable style={styles.row} onPress={onPress} hitSlop={4} testID={testID} disabled={disabled} accessibilityRole="switch" accessibilityState={{ checked: on, disabled }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch on={on} />
    </Pressable>
  );
}

/** 토글 스위치 — reviews.tsx 필터 스위치와 동일 문법(색만 전환 — 프레임 불변). */
function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.sw, on && styles.swOn]} testID="notif-switch">
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  body: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32, gap: 20 },

  // 배너(OS 권한·읽기 실패·저장 실패) — 테두리·그림자 없는 연회색 블록(시안 1)
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: radius.sm, padding: 13 },
  bannerText: { flex: 1, fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 18 },
  bannerCta: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },

  group: { gap: 0 },
  groupTitle: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2, lineHeight: 18, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowDisabled: { opacity: 0.4 }, // 상태 = 불투명도만(P-151)
  rowLabel: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  rowSub: { fontFamily: font.body, fontSize: 12, color: C.ink3, lineHeight: 16 },
  hair: { height: 1, backgroundColor: C.hair },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12 },
  captionText: { fontFamily: font.body, fontSize: 12, color: C.ink3, lineHeight: 16 },
  captionLink: { fontFamily: font.bodyBold, fontSize: 12, color: C.primaryText },

  // P-162 확인 모달(scan.tsx·주문 완료 모달과 동일 수치)
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', gap: 8, marginTop: 8 },

  sw: { width: 34, height: 20, borderRadius: 10, backgroundColor: C.line, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
});
