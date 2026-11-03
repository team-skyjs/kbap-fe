/**
 * IdolVideoCard (KB-836 V1 → KB-855 v2 E안, Figma 12358:35688 · card 12358:36175) — 음식 상세의 K-POP & K-FOOD 티저 카드.
 * 목록 쿼리 캐시(useIdolPickVideo)에 영상이 있을 때만 상세가 렌더한다. 카드 전체가 단일 링크 → 대표 영상 1개를 인앱 브라우저로 바로 연다(확인·선택 단계 없음).
 * E안: 배경 = **그 음식 사진**(상세 상단과 같은 이미지) + gray-1000 72% 오버레이 · 흰 라벨·제목 · 흰 알약 "Watch to find out"(검정 글자, 전폭).
 * v1 compact처럼 물음표 원형·부제 없음. 사진 없음 = gray-1000 단색 카드(폴백). 새 아이돌 이미지 없음(음식 사진만).
 * 눌림 = 흰 12% 오버레이(색만 — 크기·보더 불변). 진입 모션 없음.
 * 플랫폼명은 화면·접근성 라벨에 쓰지 않는다 — platform 은 계측 속성(food_idol_video_open)으로만. URL 은 계측에 넣지 않는다.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { CardPhoto } from '@/components';
import { color as C, font, radius } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';
import { openWebPage } from '@/lib/openExternal';
import type { IdolVideo } from '@/lib/api/idolPickAdapter';

/** 카드 아래 여백(다음 섹션과 간격) — 상세가 카드 "보임" 판정에서 뺀다(여백까지 카드로 세면 헤더 뒤로 숨은 뒤에도 보인다고 판정 — KB-851 QA) */
export const IDOL_CARD_BOTTOM_PAD = 20;

export function IdolVideoCard({ foodId, video, photoUrl }: { foodId: string; video: IdolVideo; photoUrl?: string | null }) {
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
            {!!photoUrl && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="idol-video-photo">
                <CardPhoto uri={photoUrl} borderRadius={0} />
                <View style={[StyleSheet.absoluteFill, styles.shade]} testID="idol-video-shade" />
              </View>
            )}
            <View style={styles.inner} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text style={styles.label}>{t('detail.idolVideo.label')}</Text>
              <Text style={styles.title}>{t('detail.idolVideo.title')}</Text>
              <View style={styles.cta} testID="idol-video-cta">
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

// 시안 실측(v1 card 335 · v2 E): padding 16 · gap 8 · radius 16 · 라벨 caption2-regular gray-00 · 제목 title3-sbold gray-00 ·
// 버튼 = Outline 44 radius full, 바탕·테두리 gray-00 · 글자 subtitle1-sbold gray-1000 · 사진 위 gray-1000 72%
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: IDOL_CARD_BOTTOM_PAD },
  card: { backgroundColor: C.ink, borderRadius: radius.lg, overflow: 'hidden' },
  shade: { backgroundColor: 'rgba(28,30,33,0.72)' }, // gray-1000 × 0.72
  inner: { padding: 16, gap: 8 },
  label: { fontFamily: font.body, fontSize: 13, lineHeight: 20, color: '#FFFFFF' },
  title: { fontFamily: font.bodySemi, fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  cta: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  ctaText: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: C.ink, textAlign: 'center' },
  press: { backgroundColor: 'rgba(255,255,255,0.12)' },
});
