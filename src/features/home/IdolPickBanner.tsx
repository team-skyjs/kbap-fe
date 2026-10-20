/**
 * IdolPickBanner (KB-836 H1, 02_designer_spec 화면 1) — 홈 인기 레일 아래 K-POP & K-FOOD 다크 포스터 배너.
 * **정적**(사용자 결정 2026-10-21): 데이터·네트워크·로딩·0건 분기 없음, 음식 수 표시 없음. 배너 전체가 단일 버튼 → `/idol-picks`.
 * 콜라주 = 번들 사진 3장(로그인 콜라주와 같은 assets/images/dishes — 인물 없는 01·02·03, 용량 증가 0) + 물음표 SVG.
 * 눌림 = 흰 12% 오버레이 opacity 만(크기·보더 불변). 계측: 노출 home_section_view(idol_pick) · 클릭 home_card_click{section, position 0}(id 없음, D4).
 */
import * as React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { IconChevron, IconQuestion } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { trackHomeCardClick, useImpressionRef } from './homeImpressions';

// 번들 정적 이미지(login.tsx 와 같은 방식)
const PHOTOS = [
  require('../../../assets/images/dishes/dish-01.jpg'),
  require('../../../assets/images/dishes/dish-02.jpg'),
  require('../../../assets/images/dishes/dish-03.jpg'),
];

/** 폭 360 기준 콜라주 규격(사진 크기·슬롯 위치·회전·물음표). 슬롯 #1이 맨 아래, #3이 맨 위. */
export const COLLAGE = {
  regular: { w: 96, h: 120, height: 140, left: [4, 72, 144], top: [12, 4, 12], q: 64, qTop: 10 },
  compact: { w: 80, h: 100, height: 120, left: [4, 60, 120], top: [10, 4, 10], q: 48, qTop: 6 },
} as const;
const ROTATE = ['-6deg', '0deg', '6deg'] as const;

export function IdolPickBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const sectionRef = useImpressionRef('idol_pick');
  const g = width < 360 ? COLLAGE.compact : COLLAGE.regular;
  const open = () => {
    trackHomeCardClick('idol_pick', 0);
    router.push('/idol-picks' as Href);
  };
  return (
    <View ref={sectionRef} collapsable={false} style={styles.outer} testID="idol-pick-section">
      <Pressable onPress={open} style={styles.banner} accessibilityRole="button" accessibilityLabel={t('home.idolPick.bannerA11y')} testID="idol-pick-banner">
        {({ pressed }) => (
          <>
            <View style={styles.inner} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={{ height: g.height }} testID="idol-pick-collage">
                {PHOTOS.map((src, i) => (
                  <View key={i} style={[styles.tile, { width: g.w, height: g.h, left: g.left[i], top: g.top[i], transform: [{ rotate: ROTATE[i] }] }]} testID={`idol-pick-photo-${i}`}>
                    <Image source={src} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  </View>
                ))}
                <View style={[styles.question, { top: g.qTop }]}>
                  <IconQuestion size={g.q} color={C.primary} />
                </View>
              </View>
              <View style={styles.texts}>
                <Text style={styles.label}>{t('home.idolPick.label')}</Text>
                <Text style={styles.title}>{t('home.idolPick.title')}</Text>
                <Text style={styles.sub}>{t('home.idolPick.sub')}</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{t('home.idolPick.seeAll')}</Text>
                <IconChevron size={16} color={C.ink} />
              </View>
            </View>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.press, { opacity: pressed ? 1 : 0 }]} testID="idol-pick-press" />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 20, paddingTop: 32 },
  banner: { backgroundColor: C.ink, borderRadius: 16, overflow: 'hidden' },
  inner: { paddingTop: 24, paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  tile: { position: 'absolute', borderRadius: 12, borderWidth: 3, borderColor: C.ink, overflow: 'hidden', backgroundColor: C.ink2 },
  question: { position: 'absolute', right: 0 },
  texts: { gap: 6 },
  label: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.6, color: C.primary },
  title: { fontFamily: font.bodyBlack, fontSize: 24, lineHeight: 32, color: '#FFFFFF' },
  sub: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: '#FFFFFF', opacity: 0.7 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, borderRadius: 22, paddingHorizontal: 18, backgroundColor: '#FFFFFF' },
  pillText: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  press: { backgroundColor: 'rgba(255,255,255,0.12)' },
});
