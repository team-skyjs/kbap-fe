/**
 * IdolVideoCard (KB-836 V1, 02_designer_spec 화면 3) — 음식 상세의 K-POP & K-FOOD 다크 티저 카드.
 * 목록 쿼리 캐시(useIdolPickVideo)에 영상이 있을 때만 상세가 렌더한다. 카드 전체가 단일 링크 → 대표 영상 1개를 인앱 브라우저로 바로 연다(확인·선택 단계 없음).
 * 눌림 = CTA primary → primaryPress + 흰 12% 오버레이(색만 — 크기·보더 불변). 진입 모션 없음.
 * 플랫폼명은 화면·접근성 라벨에 쓰지 않는다 — platform 은 계측 속성(food_idol_video_open)으로만. URL 은 계측에 넣지 않는다.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { IconPlay, IconQuestion } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';
import { openWebPage } from '@/lib/openExternal';
import type { IdolVideo } from '@/lib/api/idolPickAdapter';

export function IdolVideoCard({ foodId, video }: { foodId: string; video: IdolVideo }) {
  const { t } = useTranslation();
  const open = () => {
    track(EVENTS.food_idol_video_open, { food_id: foodId, platform: video.platform, video_position: 0 });
    void openWebPage(video.url); // 실패 = openWebPage 내장 토스트(states.linkFailed)
  };
  return (
    <View style={styles.wrap}>
      <Pressable onPress={open} style={styles.card} accessibilityRole="link" accessibilityLabel={t('detail.idolVideo.a11y')} testID="idol-video-card">
        {({ pressed }) => (
          <>
            <View style={styles.inner} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={styles.top}>
                <View style={styles.mark}>
                  <IconQuestion size={24} color="#FFFFFF" />
                </View>
                <View style={styles.texts}>
                  <Text style={styles.label}>{t('detail.idolVideo.label')}</Text>
                  <Text style={styles.title}>{t('detail.idolVideo.title')}</Text>
                  <Text style={styles.sub}>{t('detail.idolVideo.sub')}</Text>
                </View>
              </View>
              <View style={[styles.cta, { backgroundColor: pressed ? C.primaryPress : C.primary }]} testID="idol-video-cta">
                <IconPlay size={18} color="#FFFFFF" />
                <Text style={styles.ctaText}>{t('detail.idolVideo.cta')}</Text>
              </View>
            </View>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.press, { opacity: pressed ? 1 : 0 }]} testID="idol-video-press" />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { backgroundColor: C.ink, borderRadius: 12, overflow: 'hidden' },
  inner: { padding: 16, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  label: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.6, color: C.primary },
  title: { fontFamily: font.bodyBlack, fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  sub: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: '#FFFFFF', opacity: 0.7 },
  cta: { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ctaText: { fontFamily: font.bodyBold, fontSize: 15, color: '#FFFFFF' },
  press: { backgroundColor: 'rgba(255,255,255,0.12)' },
});
