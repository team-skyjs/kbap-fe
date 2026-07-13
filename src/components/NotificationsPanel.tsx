/**
 * NotificationsPanel — static notifications dropdown (mockup B3).
 * MVP ships this as static UI (handoff §10); push notifications are phase 2.
 */
import * as React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { useIsGuest } from '@/lib/auth/useSession';

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  // 게스트: 개인화 알림(리뷰 리마인더·카탈로그) 잠김 — 일반 안내(welcome)만
  // (guest-access-policy §1 헤더). 알림은 아직 mock — 실연결 시 서버 몫.
  const items = isGuest
    ? [{ t: t('notifications.welcome.title'), b: t('notifications.welcome.body') }]
    : [
        { t: t('notifications.reviewReminder.title'), b: t('notifications.reviewReminder.body') },
        { t: t('notifications.catalogUpdated.title'), b: t('notifications.catalogUpdated.body') },
        { t: t('notifications.welcome.title'), b: t('notifications.welcome.body') },
      ];

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.panel, { top: insets.top + 50 }]}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('notifications.title')}</Text>
          <Text style={styles.tag}>{t('notifications.countNew', { count: items.length })}</Text>
        </View>
        {items.map((it, i) => (
          <View key={it.t} style={[styles.row, i === 0 && styles.firstRow]}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{it.t}</Text>
              <Text style={styles.rowBody}>{it.b}</Text>
            </View>
          </View>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(42,33,27,0.42)' },
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    ...shadow.shPop,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.display, fontSize: 16, color: C.ink },
  tag: { fontFamily: font.body, fontSize: 11, color: C.ink2 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
  firstRow: { borderTopWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginTop: 5 },
  rowTitle: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  rowBody: { marginTop: 1, fontFamily: font.body, fontSize: 12.5, color: C.ink2, lineHeight: 17 },
});

export default NotificationsPanel;
