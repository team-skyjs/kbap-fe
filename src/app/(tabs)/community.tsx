/**
 * Community tab — LOCKED in the MVP (mockup B4). The tab is reserved; boards,
 * comments and per-nationality feeds arrive in phase 2 (handoff §10).
 * Shows the shell placeholder dimmed behind a "coming soon" card.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { ShellPlaceholder, Btn, IconLock } from '@/components';

export default function Community() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <View style={{ flex: 1, opacity: 0.5 }} pointerEvents="none">
        <ShellPlaceholder />
      </View>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <View style={styles.ic}>
            <IconLock size={26} color={C.accent} />
          </View>
          <Text style={styles.title}>{t('community.lockedTitle')}</Text>
          <Text style={styles.body}>{t('community.lockedBody')}</Text>
          <View style={{ width: '100%', marginTop: 4 }}>
            <Btn variant="ghost">{t('common.gotIt')}</Btn>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(42,33,27,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '86%',
    backgroundColor: C.card,
    borderRadius: radius.lg,
    padding: 26,
    alignItems: 'center',
    gap: 9,
    ...shadow.shPop,
  },
  ic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(14,154,167,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.display, fontSize: 18, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
});
