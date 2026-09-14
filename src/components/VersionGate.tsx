/**
 * VersionGate UI (P-111/KB-269) —
 *  <VersionGateOverlay/>: 하드 게이트 풀스크린(내비 전체 덮음·뒤로가기/dismiss
 *  불가) — 루트 _layout 마운트. CTA = 플랫폼 스토어 딥링크(서버 storeUrls,
 *  없으면 안내만 — 게이트는 유지).
 *  <UpdateNudgeBanner/>: 소프트 넛지 — 홈 상단, dismiss한 latestVersion은
 *  저장해 같은 버전으론 재노출 안 함.
 */
import * as React from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { Btn } from '@/components/Btn';
import { IconClose, IconDownload } from '@/components/icons';
import { startVersionGate, useVersionGate } from '@/lib/versionGate';
import { openStoreLink } from '@/lib/openExternal';

const NUDGE_DISMISS_KEY = 'kbap.versionNudge.dismissed.v1';

export function VersionGateOverlay() {
  const gate = useVersionGate();
  const { t } = useTranslation();
  // P-381 2R(Codex P2): 하드 게이트는 **인라인**으로 알린다 — 커버가 elevation 1000이라
  // 안드로이드에서 토스트(elevation 8)가 그 뒤에 깔려 사용자가 아무것도 못 본다.
  // 전역 토스트 elevation을 올려 해결하면 다른 화면의 모달·시트 위에도 뜨게 되므로,
  // 전체 화면을 막는 이 화면 안에서 보여주는 쪽을 택한다(사용자가 볼 곳도 여기뿐이다).
  const [storeFailed, setStoreFailed] = React.useState(false);

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
          <Btn
            onPress={() => {
              setStoreFailed(false);
              void openStoreLink(gate.storeUrl!, { silent: true }).then((ok) => setStoreFailed(!ok));
            }}
          >
            {t('versionGate.gateCta')}
          </Btn>
          {storeFailed && (
            <Text style={styles.gateError} testID="version-gate-store-error">
              {t('versionGate.storeFailed')}
            </Text>
          )}
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
        /* 소프트 넛지 = 커버가 없는 자리라 실패는 공용 토스트로 충분하다(하드 게이트와 경로가 다르다) */
        <Pressable hitSlop={8} onPress={() => void openStoreLink(gate.storeUrl!)}>
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
  // P-381 2R: 커버 안 인라인 실패 문구(토스트는 커버 뒤에 깔려 안 보인다)
  gateError: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.riskDangerText, textAlign: 'center', marginTop: 10 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 11, ...shadow.sh1 },
  bannerText: { flex: 1, fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink },
  bannerCta: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
});
