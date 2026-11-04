/**
 * 문의 보내기 (P-394/KB-586) — 게스트 포함 누구나. 제목 없음, 본문 + 사진 ≤3.
 *
 * 기존 자산만 재활용(9/18 예진): 리뷰 작성 화면의 사진 스트립 문법·`uploadImage`(purpose만 교체)·
 * `SubHeader`·`Btn`·공용 제출 가드·토스트. **새 스타일 상수는 두지 않는다**(치수는 리뷰 작성과 동일값).
 *
 * P-387 규약: 완료 안내는 **응답 성공 후에만**. 실패면 본문·사진을 유지하고 재시도.
 * KB-986: 입력·사진·제출은 features/feedback/FeedbackForm(재방문 피드백 시트와 공유) — 이 화면은 헤더·키보드 회피·이탈 확인·닫기.
 */
import * as React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import { KAV_BEHAVIOR, KAV_OFFSET } from '@/lib/keyboardAvoid';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SubHeader } from '@/components';
import { LeaveConfirmModal, useLeaveConfirm } from '@/components/LeaveConfirmModal';
import { EVENTS, track } from '@/lib/analytics';
import { FeedbackFields, useFeedbackForm } from '@/features/feedback/FeedbackForm';

export default function FeedbackComposeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  // KB-739: 설정 "광고 신고" 진입 = 본문 프리필(Apple 2.5.18 신고 창구). 프리필만 있는 상태는 '비어 있음'으로 본다(이탈 확인 0)
  // KB-814 F3: 가공식품 리뷰 '사진 삭제 요청' = 제품명·리뷰 id 한 줄 프리필(초기값만 — 서버 계약 무변)
  const { prefill, product, reviewId } = useLocalSearchParams<{ prefill?: string; product?: string; reviewId?: string }>();
  const initialBody =
    prefill === 'ad' ? t('ads.reportPrefill')
    : prefill === 'photoRemoval' ? t('ugc.photoRemovalPrefill', { product: product ?? '', reviewId: reviewId ?? '' })
    : '';
  const form = useFeedbackForm(initialBody);
  // KB-708: 본문·사진이 있으면 이탈 확인(헤더 뒤로·스와이프·하드웨어 뒤로). 전송 성공 뒤엔 막지 않고 닫힘
  const leave = useLeaveConfirm((form.body.trim().length > 0 && form.body.trim() !== initialBody.trim()) || form.photos.length > 0, form.busy); // 프리필만·프리필 지운 빈 폼 = 이탈 확인 0(/review 10) // 전송 중 = 막지 않음(그냥 나감)
  // 업로드·전송이 끝나기 전에 유저가 뒤로 가거나 "내 문의"로 넘어갈 수 있다. 그때 늦게
  // 도착한 성공 콜백이 router.back()을 부르면 **지금 화면**이 닫힌다(내 문의 → 작성으로
  // 되돌아가는 역주행). 이 화면이 아직 떠 있을 때만 닫는다(Codex #170).
  const focused = React.useRef(true);
  useFocusEffect(
    React.useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );

  const onSend = () =>
    form.send(({ photoCount }) => {
      // P-387: 성공 응답 뒤에만 완료 — 계측 속성은 개수·유무만(본문·기기정보 금지)
      track(EVENTS.profile_feedback_submit, { has_photos: photoCount > 0, photo_count: photoCount });
      leave.release(() => {
        if (focused.current) router.back();
      });
    });

  return (
    // KB-710(4) → KB-768: KeyboardAvoidingView(padding, 두 플랫폼) — #228 규칙에서 "Send가 스크롤 본문 안이라 스크롤로 닿는다"는 사유로 빠져 있었지만,
    // 회피 없이는 키보드가 떠도 ScrollView가 줄지 않아 스크롤 범위가 생기지 않는다 → SE에서 Send 위 19pt만 보이고 닿을 수도 없었다.
    <KeyboardAvoidingView style={styles.root} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={KAV_OFFSET} testID="feedback-kav">
      {/* P-406: 목록이 첫 화면이 됐다 — "My inquiries" 링크 제거(뒤로 = 목록) */}
      <SubHeader title={t('feedback.newTitle')} onBack={() => router.back()} />
      <LeaveConfirmModal {...leave.modal} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <FeedbackFields form={form} onSend={onSend} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { padding: 20, gap: 16 },
});
