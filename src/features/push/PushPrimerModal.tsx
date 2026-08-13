/**
 * PushPrimerModal (P-192/KB-39) — 푸시 권한 **사전 안내** 모달 (P-162 확인 모달 문법).
 *
 * iOS OS 팝업은 1회성이라 바로 띄우지 않는다 — 이 모달에서 수락한 경우에만
 * requestPermission()(OS 팝업) → 토큰 등록. 거절(Not now)은 기록만 하고 재노출 0
 * (설정 화면에서 언제든 켤 수 있음). 진입점: 회원 = 온보딩 제출 성공 직후 ·
 * 게스트 = 첫 스캔 완료 후 1회 — 노출 조건 판정(getPrimerResult)은 호출측.
 */
import * as React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, shadow } from '@/lib/theme';
import { Btn, IconBell } from '@/components';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { markPrimerResult, registerPushToken, requestPermission } from '@/lib/push/pushAdapter';

export function PushPrimerModal({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const { busy, run } = useSubmitGuard();

  const accept = () =>
    run(async () => {
      await markPrimerResult('accepted');
      const granted = await requestPermission(); // 여기서만 OS 팝업
      if (granted) await registerPushToken();
      onDone();
    });
  const decline = () =>
    run(async () => {
      await markPrimerResult('declined');
      onDone();
    });

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={decline}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="push-primer">
          <View style={styles.ic}>
            <IconBell size={26} color={C.primary} />
          </View>
          <Text style={styles.title}>{t('push.primerTitle')}</Text>
          <Text style={styles.body}>{t('push.primerBody')}</Text>
          <View style={{ marginTop: 6, gap: 9, alignSelf: 'stretch' }}>
            <Btn busy={busy} onPress={accept} testID="push-primer-yes">
              {t('push.primerYes')}
            </Btn>
            <Btn variant="ghost" onPress={decline} testID="push-primer-later">
              {t('push.primerLater')}
            </Btn>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 28 },
  card: { backgroundColor: C.card, borderRadius: 26, padding: 22, alignItems: 'center', gap: 10, ...shadow.shPop },
  ic: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 20, textAlign: 'center' },
});
