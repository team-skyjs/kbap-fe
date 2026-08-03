/**
 * VersionGate UI (P-111/KB-269) —
 *  <VersionGateOverlay/>: 하드 게이트 풀스크린(내비 전체 덮음·뒤로가기/dismiss
 *  불가) — 루트 _layout 마운트. CTA = 플랫폼 스토어 딥링크(서버 storeUrls,
 *  없으면 안내만 — 게이트는 유지).
 *  <UpdateNudgeBanner/>: 소프트 넛지 — 홈 상단, dismiss한 latestVersion은
 *  저장해 같은 버전으론 재노출 안 함.
 */
import * as React from 'react';
import { BackHandler, Linking, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { Btn } from '@/components/Btn';
import { IconClose, IconDownload } from '@/components/icons';
import { startVersionGate, useVersionGate } from '@/lib/versionGate';

const NUDGE_DISMISS_KEY = 'kbap.versionNudge.dismissed.v1';

export function VersionGateOverlay() {
  const gate = useVersionGate();
  const { t } = useTranslation();

  React.useEffect(() => startVersionGate(), []);

  // 안드 하드웨어 백 차단 — 게이트는 dismiss 불가
  React.useEffect(() => {
    if (gate.mode !== 'blocked') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [gate.mode]);

  if (gate.mode !== 'blocked') return null;
  return (
    <View style={styles.cover} testID="version-gate">
      <View style={styles.icWrap}>
        <IconDownload size={30} color={C.primary} />
      </View>
      <Text style={styles.title}>{t('versionGate.gateTitle')}</Text>
      <Text style={styles.body}>{t('versionGate.gateBody')}</Text>
      {gate.storeUrl != null && (
        <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
          <Btn onPress={() => void Linking.openURL(gate.storeUrl!)}>{t('versionGate.gateCta')}</Btn>
        </View>
      )}
    </View>
  );
}

export function UpdateNudgeBanner() {
  const gate = useVersionGate();
  const { t } = useTranslation();
  // 'loading' 동안 미렌더 — dismiss한 버전이 잠깐 보였다 사라지는 깜빡임 방지
  const [dismissed, setDismissed] = React.useState<string | null | 'loading'>('loading');

  React.useEffect(() => {
    AsyncStorage.getItem(NUDGE_DISMISS_KEY).then(
      (v) => setDismissed(v),
      () => setDismissed(null),
    );
  }, []);

  if (gate.mode !== 'nudge' || dismissed === 'loading' || dismissed === gate.latestVersion) return null;

  const dismiss = () => {
    setDismissed(gate.latestVersion); // 같은 latestVersion으론 재노출 안 함
    void AsyncStorage.setItem(NUDGE_DISMISS_KEY, gate.latestVersion).catch(() => {});
  };

  return (
    <View style={styles.banner} testID="update-nudge">
      <IconDownload size={16} color={C.primary} />
      <Text style={styles.bannerText} numberOfLines={1}>
        {t('versionGate.nudgeText')}
      </Text>
      {gate.storeUrl != null && (
        <Pressable hitSlop={8} onPress={() => void Linking.openURL(gate.storeUrl!)}>
          <Text style={styles.bannerCta}>{t('versionGate.nudgeCta')}</Text>
        </Pressable>
      )}
      <Pressable hitSlop={8} onPress={dismiss}>
        <IconClose size={14} color={C.ink3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 12,
  },
  icWrap: { width: 74, height: 74, borderRadius: 37, backgroundColor: primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: font.display, fontSize: 21, color: C.ink, letterSpacing: -0.3, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: C.ink2, textAlign: 'center' },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 11, ...shadow.sh1 },
  bannerText: { flex: 1, fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink },
  bannerCta: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
});
