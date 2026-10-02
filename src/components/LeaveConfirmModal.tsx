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
 * `submitting` 동안은 **막지 않는다(확인 창도 없음)** — 그냥 나간다(KB-708 이전 동작). 막으면 상한 없는 사진 업로드에서 갇히고(#236 공부),
 * 확인 창을 띄우면 그 창이 뜬 채 성공 시 확인 창 dismiss + 완료 모달 present가 한 커밋 = iOS 모달 프리즈 전례(#236 /review 2R).
 * 확인 창은 제출 중이 아닐 때만 열리고, 열려 있으면 제출 버튼을 누를 수 없으니 두 모달이 겹칠 길이 없다.
 * 제출 중 이탈의 제대로 된 처리(업로드 취소·안내)는 KB-711.
 */
export function useLeaveConfirm(dirty: boolean, submitting = false) {
  const navigation = useNavigation();
  const [pending, setPending] = React.useState<NavAction | null>(null);
  const [released, setReleased] = React.useState<(() => void) | null>(null);
  usePreventRemove(dirty && !submitting && released == null, ({ data }) => setPending(data.action));
  // 지킬 것이 없어지면 대기 중인 이동도 버린다(렌더 중 전이 — 나중에 다시 dirty가 돼도 옛 확인 창이 되살아나지 않게)
  if (pending != null && (!dirty || released != null)) setPending(null);
  React.useEffect(() => {
    if (!released) return;
    released();
  }, [released]);
  return {
    modal: {
      // 지킬 것이 없어지면 스스로 닫힘 — 확인 창이 뜬 채 제출이 성공하면(리뷰 신규·커뮤니티 = 완료 모달) Modal 두 장이 겹친다(겹침 프리즈 전례)
      visible: pending != null && dirty && released == null,
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
