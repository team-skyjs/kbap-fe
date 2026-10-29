/**
 * ScanLeaveConfirm (KB-908 T-050) — 가공식품 후보 화면 이탈 확인. 메뉴 결과의 "Leave scan results?" 카드(scan.tsx KB-769)와 같은 문구·프레임.
 * 메뉴 결과 쪽은 다시찍기 확인과 한 Modal을 공유해 그대로 두고, 가공식품 흐름만 이걸 쓴다.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { color as C, font, shadow } from '@/lib/theme';

export function ScanLeaveConfirm({ visible, onKeep, onLeave }: { visible: boolean; onKeep: () => void; onLeave: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={st.backdrop}>
        <View style={st.card} testID="scan-leave-confirm">
          <Text style={st.title}>{t('scan.leaveTitle')}</Text>
          <Text style={st.body}>{t('scan.retakeBody')}</Text>
          <View style={{ gap: 9, marginTop: 6 }}>
            <Btn variant="ghost" onPress={onKeep} testID="scan-confirm-cancel">{t('profile.delete.cancel')}</Btn>
            <Btn variant="dangerGhost" onPress={onLeave} testID="scan-leave-go">{t('scan.leaveConfirm')}</Btn>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// scan.tsx confirmBackdrop·confirmCard·confirmTitle·confirmBody와 같은 값
const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  title: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
});
