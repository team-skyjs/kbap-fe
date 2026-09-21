/**
 * 문의 보내기 (P-394/KB-586) — 게스트 포함 누구나. 제목 없음, 본문 + 사진 ≤3.
 *
 * 기존 자산만 재활용(9/18 예진): 리뷰 작성 화면의 사진 스트립 문법·`uploadImage`(purpose만 교체)·
 * `SubHeader`·`Btn`·공용 제출 가드·토스트. **새 스타일 상수는 두지 않는다**(치수는 리뷰 작성과 동일값).
 *
 * P-387 규약: 완료 안내는 **응답 성공 후에만**. 실패면 본문·사진을 유지하고 재시도.
 */
import * as React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Btn, IconCamera, IconClose, SubHeader } from '@/components';
import { Input } from '@/components/KeyboardDismissBar';
import { showTopToast } from '@/components/topToastStore';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { openAppSettings } from '@/lib/openExternal';
import { EVENTS, track } from '@/lib/analytics';
import { FEEDBACK_MAX_LEN, FEEDBACK_MAX_PHOTOS, useSubmitFeedback } from '@/lib/data/useFeedback';
import { color as C, radius } from '@/lib/theme';

export default function FeedbackComposeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [body, setBody] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [importing, setImporting] = React.useState(false);
  const submit = useSubmitFeedback();
  const guard = useSubmitGuard(); // P-173: 동기 ref + busy — 같은 틱 더블탭 1건만
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

  const pickPhoto = async () => {
    const remaining = FEEDBACK_MAX_PHOTOS - photos.length;
    if (remaining <= 0 || importing) return;
    setImporting(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        // 사진 라이브러리 권한이다 — 카메라 문구(scan.*)를 쓰면 유저가 엉뚱한 설정을
        // 바꾸고도 첨부를 못 한다(Codex #170). 권한이 다르면 문구도 달라야 한다.
        Alert.alert(t('photo.libraryPermTitle'), t('photo.libraryPermBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('photo.openSettings'), onPress: () => void openAppSettings() },
        ]);
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
      if (!res.canceled && res.assets?.length) {
        setPhotos((cur) => [...cur, ...res.assets.map((a) => a.uri)].slice(0, FEEDBACK_MAX_PHOTOS));
      }
    } finally {
      setImporting(false);
    }
  };

  const canSend = body.trim().length > 0;
  const onSend = () =>
    void guard.run(async () => {
      try {
        await submit.mutateAsync({ content: body.trim(), photoUris: photos });
        // P-387: 성공 응답 뒤에만 완료 — 계측 속성은 개수·유무만(본문·기기정보 금지)
        track(EVENTS.profile_feedback_submit, { has_photos: photos.length > 0, photo_count: photos.length });
        showTopToast(t('feedback.sent')); // 토스트 호스트는 루트에 있어 어느 화면이든 뜬다
        if (focused.current) router.back();
      } catch (e) {
        // 429(일일 한도)는 전용 안내 — 일반 실패와 구분된다
        const code = (e as { code?: string })?.code;
        showTopToast(t(code === 'FEEDBACK-003' ? 'feedback.rateLimited' : 'feedback.sendFailed'), { error: true });
      }
    });

  return (
    <View style={styles.root}>
      <SubHeader
        title={t('feedback.title')}
        onBack={() => router.back()}
        trailing={
          <Pressable onPress={() => router.push('/profile/feedback' as Href)} hitSlop={8} testID="feedback-my-link">
            <Text style={styles.link}>{t('feedback.myTitle')}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Input
          value={body}
          onChangeText={(v) => setBody(v.slice(0, FEEDBACK_MAX_LEN))}
          placeholder={t('feedback.placeholder')}
          placeholderTextColor={C.ink3}
          multiline
          style={styles.input}
          textAlignVertical="top"
          testID="feedback-body"
        />
        {/* 사진 = 리뷰 작성과 같은 스트립 문법(슬롯 100 r8, 개별 삭제) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((uri) => (
            <View key={uri} style={styles.photoThumbWrap}>
              <Image source={{ uri }} style={styles.photoThumb} />
              <Pressable
                accessibilityLabel={t('review.removePhoto')}
                style={styles.photoDel}
                hitSlop={8}
                onPress={() => setPhotos((cur) => cur.filter((u) => u !== uri))}
              >
                <IconClose size={10} color="#fff" />
              </Pressable>
            </View>
          ))}
          {photos.length < FEEDBACK_MAX_PHOTOS && (
            <Pressable
              accessibilityLabel={t('review.addPhoto')}
              style={styles.photoAdd}
              onPress={() => void pickPhoto()}
              testID="feedback-photo-add"
            >
              <IconCamera size={24} color={C.ink3} />
            </Pressable>
          )}
        </ScrollView>
        <Btn variant={canSend ? 'primary' : 'off'} onPress={canSend ? onSend : undefined} busy={guard.busy} testID="feedback-send">
          {t('feedback.send')}
        </Btn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { padding: 20, gap: 16 },
  // 치수는 리뷰 작성 화면과 동일값(새 시안 없음 — 기존 문법 이식)
  input: { minHeight: 160, borderWidth: 1, borderColor: C.line, borderRadius: radius.sm, padding: 12, fontSize: 15 },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoThumbWrap: { width: 100, height: 100 },
  photoThumb: { width: 100, height: 100, borderRadius: radius.sm },
  photoDel: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 100,
    height: 100,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // P-403 ②(예진 실기): 액센트(C.primaryText)가 아니라 본문색 — 헤더 우측 링크가 튀어 보였다
  link: { fontSize: 14, fontWeight: '600', color: C.ink },
});
