/**
 * Notification settings (P-192/KB-39) — 프로필 > 알림 설정.
 *
 * 종류별 토글 3: Helpful(기본 on) · 리뷰 리마인더(로컬, 기본 on) · 추천 넛지
 * (광고성 — 기본 off, 켠 시각 = 동의 일시 로컬 기록, 서버 저장은 계약 후).
 * OS 권한 꺼짐이면 상단 안내 + 설정 앱 딥링크. 토글 = 낙관 즉시 저장(멱등 —
 * useSubmitGuard 예외 계열) 후 토큰 upsert(설정 동기, 계약 전 no-op).
 * FLAGS.pushEnabled off = 라우트 가드(진입점도 없지만 딥링크 이중 방어).
 */
import * as React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, IconBell } from '@/components';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import {
  getPermissionStatus,
  getPushSettings,
  registerPushToken,
  savePushSettings,
  DEFAULT_PUSH_SETTINGS,
  type PushPermission,
  type PushSettings,
} from '@/lib/push/pushAdapter';

export default function NotificationSettings() {
  // 컴파일 상수 가드 — 훅 순서 무영향 (reviews.tsx 문법)
  if (!FLAGS.pushEnabled) return <Redirect href="/" />;

  const router = useRouter();
  const { t } = useTranslation();
  const [settings, setSettings] = React.useState<PushSettings>(DEFAULT_PUSH_SETTINGS);
  const [permission, setPermission] = React.useState<PushPermission>('unavailable');

  React.useEffect(() => {
    void getPushSettings().then(setSettings);
    void getPermissionStatus().then(setPermission);
  }, []);

  const toggle = (key: 'helpful' | 'reviewReminder' | 'nudge') => {
    // 낙관 즉시 반영(로컬 저장 멱등) — 저장 결과(nudgeOptInAt 스탬프 포함)로 재동기
    track(EVENTS.notif_pref_toggle, { key, on: !settings[key] }); // P-214: 옵트아웃률
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    void savePushSettings(next).then((saved) => {
      setSettings(saved);
      void registerPushToken(); // 설정 변경 upsert — BE 계약 전 no-op+로그
    });
  };

  const osOff = permission === 'denied';

  return (
    <View style={styles.root}>
      <SubHeader title={t('notif.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {osOff && (
          /* OS 권한 꺼짐 — 토글은 보이되 실수신 불가 안내 + 설정 딥링크 */
          <Pressable style={styles.osBanner} onPress={() => void Linking.openSettings()} testID="notif-os-off">
            <IconBell size={16} color={C.riskCaution} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.osBannerText}>{t('notif.osOff')}</Text>
              <Text style={styles.osBannerCta}>{t('notif.osOffCta')}</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.card}>
          <ToggleRow
            label={t('notif.helpful')}
            sub={t('notif.helpfulSub')}
            on={settings.helpful}
            onPress={() => toggle('helpful')}
            testID="notif-helpful"
          />
          <View style={styles.hair} />
          <ToggleRow
            label={t('notif.reminder')}
            sub={t('notif.reminderSub')}
            on={settings.reviewReminder}
            onPress={() => toggle('reviewReminder')}
            testID="notif-reminder"
          />
          <View style={styles.hair} />
          <ToggleRow
            label={t('notif.nudge')}
            sub={t('notif.nudgeSub')}
            on={settings.nudge}
            onPress={() => toggle('nudge')}
            testID="notif-nudge"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ToggleRow({ label, sub, on, onPress, testID }: { label: string; sub: string; on: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable style={styles.row} onPress={onPress} hitSlop={4} testID={testID}>
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
    <View style={[styles.sw, on && styles.swOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32, gap: 12 },

  osBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 13, ...shadow.sh1 },
  osBannerText: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, lineHeight: 17 },
  osBannerCta: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, paddingHorizontal: 15, ...shadow.sh1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowLabel: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  rowSub: { fontFamily: font.body, fontSize: 12, color: C.ink3, lineHeight: 16 },
  hair: { height: 1, backgroundColor: C.hair },

  sw: { width: 34, height: 20, borderRadius: 10, backgroundColor: C.line, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
});
