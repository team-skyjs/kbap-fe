/**
 * LeaveConfirmModal + useLeaveConfirm — 작성 중 이탈 확인(KB-708: 커뮤니티 글쓰기에서 추출 — 리뷰 작성·수정·문의 작성 공유).
 * useLeaveConfirm = 변경이 있을 때 **화면을 떠나는 모든 길**(헤더 뒤로·스와이프 뒤로·Android 하드웨어 뒤로)을 막고 시트를 띄운다.
 * 시안 문법: 라운드 26 카드 · "계속 쓰기"(ghost) + "그만두기"(dangerGhost, 보더 버튼 프레임 — P-175). 문구 키 = common.leaveTitle·leaveBody·keepWriting·discard(KB-708: 네 화면 공용 — 'post' 낱말 없는 중립 제목).
 */
import * as React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useNavigation } from 'expo-router';
// expo-router가 번들한 react-navigation의 usePreventRemove — 공개 export가 없어 빌드 경로로(네이티브 스택의 스와이프·하드웨어 뒤로까지 막는 API는 이것뿐)
import { usePreventRemove } from 'expo-router/build/react-navigation/core';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { color as C, font, shadow } from '@/lib/theme';

type NavAction = Parameters<Parameters<typeof usePreventRemove>[1]>[0]['data']['action'];

/**
 * `dirty` 동안 이탈을 막는다. 성공(등록·저장·전송) 뒤 떠날 땐 `release(then)` — 막기를 먼저 풀고 **다음 렌더에서** then을 1회 실행
 * (같은 틱에 router.back()을 부르면 아직 막힌 상태라 성공한 작성에 "버릴까요?"가 뜬다). 두 번 불러도 첫 then만(뒤로 2회 = 화면 두 장 방지).
 * `submitting` 동안은 **막기만 하고 확인 창은 띄우지 않는다** — "그만두기"로 닫혀도 요청은 이미 나가 있어 등록된다(사용자는 버렸다고 믿음).
 * 끝나면 성공 = release 경로 · 실패 = 다시 dirty 확인 경로.
 */
export function useLeaveConfirm(dirty: boolean, submitting = false) {
  const navigation = useNavigation();
  const [pending, setPending] = React.useState<NavAction | null>(null);
  const [released, setReleased] = React.useState<(() => void) | null>(null);
  usePreventRemove((dirty || submitting) && released == null, ({ data }) => {
    if (submitting) return; // 제출 중 = 이동만 막음(모달 0)
    setPending(data.action);
  });
  React.useEffect(() => {
    if (!released) return;
    released();
  }, [released]);
  return {
    modal: {
      visible: pending != null,
      onKeep: () => setPending(null),
      onDiscard: () => {
        setPending(null);
        if (pending) navigation.dispatch(pending); // 막았던 그 이동(뒤로·스와이프·하드웨어)을 그대로 진행
      },
    },
    release: (then: () => void = () => {}) => setReleased((prev) => prev ?? then), // 이미 풀렸으면 무시
  };
}

export function LeaveConfirmModal({ visible, onKeep, onDiscard }: { visible: boolean; onKeep: () => void; onDiscard: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmCard} testID="leave-confirm">
          <Text style={styles.confirmTitle}>{t('common.leaveTitle')}</Text>
          <Text style={styles.confirmBody}>{t('common.leaveBody')}</Text>
          <View style={{ gap: 9, marginTop: 6 }}>
            <Btn variant="ghost" onPress={onKeep} testID="discard-keep">
              {t('common.keepWriting')}
            </Btn>
            {/* P-175: destructive도 보더 버튼 프레임(재스캔 모달과 동일 문법) */}
            <Btn variant="dangerGhost" onPress={onDiscard} testID="discard-go">
              {t('common.discard')}
            </Btn>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
});
