/**
 * KB-986 — 문의 작성 입력칸(본문 + 사진 ≤3 + 보내기). 문의 화면(profile/feedback/new)과 재방문 피드백 시트가 같이 쓴다.
 * 옮긴 그대로(P-394/KB-586): 공용 제출 가드 · useSubmitFeedback · 업로드 취소(KB-711) · 사진 중복 제거(Codex #196) · 권한 문구(Codex #170).
 * P-387: 완료 안내는 응답 성공 후에만 — 실패면 본문·사진 유지(재시도). 치수는 리뷰 작성과 동일값(새 스타일 상수 0).
 */
import * as React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/engagement/occlusionSurfaces';
import { launchImageLibraryAsync } from '@/lib/engagement/occlusionPickers';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Btn, IconCamera, IconClose } from '@/components';
import { Input } from '@/components/KeyboardDismissBar';
import { showTopToast } from '@/components/topToastStore';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { openAppSettings } from '@/lib/openExternal';
import { needsPhotoLibraryPermission } from '@/lib/mediaPermissions';
import { FEEDBACK_MAX_LEN, FEEDBACK_MAX_PHOTOS, useSubmitFeedback } from '@/lib/data/useFeedback';
import { color as C, radius } from '@/lib/theme';
import { useUploadAbort } from '@/lib/useUploadAbort';
import { isUploadAborted } from '@/lib/api/uploadAbort';
import { withPermissionPrompt } from '@/lib/permissionPrompt';

export type FeedbackSent = { photoCount: number };

export function useFeedbackForm(initialBody = '') {
  const { t } = useTranslation();
  const [body, setBody] = React.useState(initialBody);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [importing, setImporting] = React.useState(false);
  const submit = useSubmitFeedback();
  const guard = useSubmitGuard(); // P-173: 동기 ref + busy — 같은 틱 더블탭 1건만
  const nextUploadSignal = useUploadAbort(); // KB-711: 전송 중 떠나면(언마운트) 사진 업로드 취소

  const pickPhoto = async () => {
    const remaining = FEEDBACK_MAX_PHOTOS - photos.length;
    if (remaining <= 0 || importing) return;
    setImporting(true);
    try {
      // KB-600(P-408): Android는 시스템 Photo Picker — READ_MEDIA 권한을 제거했으므로 요청하면 즉시 denied. iOS만 요청.
      if (needsPhotoLibraryPermission()) {
        const perm = await withPermissionPrompt(() => ImagePicker.requestMediaLibraryPermissionsAsync());
        if (!perm.granted) {
          // 사진 라이브러리 권한 문구(카메라 문구 금지 — Codex #170)
          Alert.alert(t('photo.libraryPermTitle'), t('photo.libraryPermBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('photo.openSettings'), onPress: () => void openAppSettings() },
          ]);
          return;
        }
      }
      const res = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: remaining });
      if (!res.canceled && res.assets?.length) {
        // Codex #196: 같은 사진 중복 선택 = Set으로 제거
        setPhotos((cur) => [...new Set([...cur, ...res.assets.map((a) => a.uri)])].slice(0, FEEDBACK_MAX_PHOTOS));
      }
    } finally {
      setImporting(false);
    }
  };

  const canSend = body.trim().length > 0;
  /** 성공 응답 뒤에만 onSent(완료 토스트 포함) · 실패 = 오류 토스트, 입력 유지 */
  const send = (onSent: (s: FeedbackSent) => void) =>
    void guard.run(async () => {
      try {
        await submit.mutateAsync({ content: body.trim(), photoUris: photos, signal: nextUploadSignal() });
        showTopToast(t('feedback.sent')); // 토스트 호스트는 루트 — 어느 화면이든
        onSent({ photoCount: photos.length });
      } catch (e) {
        if (isUploadAborted(e)) return; // KB-711: 떠나서 취소 — 다른 화면 위 실패 토스트 금지
        const code = (e as { code?: string })?.code; // 429(일일 한도) 전용 안내
        showTopToast(t(code === 'FEEDBACK-003' ? 'feedback.rateLimited' : 'feedback.sendFailed'), { error: true });
      }
    });

  return {
    body,
    setBody: (v: string) => setBody(v.slice(0, FEEDBACK_MAX_LEN)),
    photos,
    removePhoto: (uri: string) => setPhotos((cur) => cur.filter((u) => u !== uri)),
    pickPhoto,
    canSend,
    send,
    busy: guard.busy,
  };
}

export type FeedbackFormState = ReturnType<typeof useFeedbackForm>;

/** 입력칸·사진 스트립·보내기 — 부모의 gap 안에 펼친다(문의 화면 본문 gap 16 그대로) */
export function FeedbackFields({ form, onSend }: { form: FeedbackFormState; onSend: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Input
        value={form.body}
        onChangeText={form.setBody}
        placeholder={t('feedback.placeholder')}
        placeholderTextColor={C.ink3}
        multiline
        style={styles.input}
        textAlignVertical="top"
        testID="feedback-body"
      />
      {/* 사진 = 리뷰 작성과 같은 스트립 문법(슬롯 100 r8, 개별 삭제) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
        {form.photos.map((uri) => (
          <View key={uri} style={styles.photoThumbWrap}>
            <Image source={{ uri }} style={styles.photoThumb} />
            <Pressable testID="feedback-photo-remove" accessibilityLabel={t('review.removePhoto')} style={styles.photoDel} hitSlop={8} onPress={() => form.removePhoto(uri)}>
              <IconClose size={10} color="#fff" />
            </Pressable>
          </View>
        ))}
        {form.photos.length < FEEDBACK_MAX_PHOTOS && (
          <Pressable accessibilityLabel={t('review.addPhoto')} style={styles.photoAdd} onPress={() => void form.pickPhoto()} testID="feedback-photo-add">
            <IconCamera size={24} color={C.ink3} />
          </Pressable>
        )}
      </ScrollView>
      <Btn variant={form.canSend ? 'ink' : 'off'} /* KB-635: 검정(알약과 같은 C.ink) · 비활성은 기존 off 그대로 */ onPress={form.canSend ? onSend : undefined} busy={form.busy} testID="feedback-send">
        {t('feedback.send')}
      </Btn>
    </>
  );
}

const styles = StyleSheet.create({
  // 치수는 리뷰 작성 화면과 동일값(새 시안 없음 — 기존 문법 이식)
  input: { minHeight: 160, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, padding: 12, fontSize: 16 },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoThumbWrap: { width: 100, height: 100 },
  photoThumb: { width: 100, height: 100, borderRadius: radius.md },
  photoDel: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 100, height: 100, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
});
