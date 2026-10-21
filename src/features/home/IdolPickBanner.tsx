/**
 * IdolPickBanner (KB-836 H1 → KB-856 v2 "실루엣 B", 02_designer_spec 배너 v2 절) — 홈 인기 레일 아래 K-POP & K-FOOD 다크 포스터 배너.
 * **정적**(사용자 결정 2026-10-21): 데이터·네트워크·로딩·0건 분기 없음, 음식 수 표시 없음. 배너 전체가 단일 버튼 → `/idol-picks`.
 * v2 = 카드 상단 absolute 배경 1장(번들 1170×695, 청록 틴트·상하 ink 페이드가 이미지에 구워짐 — 그라데이션·오버레이 뷰 없음).
 *  텍스트 블록은 카드폭 × 182/320(이미지가 완전한 ink 가 되는 지점)부터 시작 → 라벨이 인물 위에 걸치지 않는다. 카드 높이는 내용 따라.
 * 눌림 = 흰 12% 오버레이 opacity 만(크기·보더 불변). 계측: 노출 home_section_view(idol_pick) · 클릭 home_card_click{section, position 0}(id 없음, D4).
 */
import * as React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { IconChevron } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { trackHomeCardClick, useImpressionRef } from './homeImpressions';

const BG = require('../../../assets/images/idol_pick_banner_bg.jpg');
/** 배경 에셋 비율(1170×695) */
export const BG_ASPECT = 1170 / 695;
/** 텍스트 시작 = 카드폭 × 182/320 (카드폭 = 창 폭 − 좌우 20×2) */
export const textTop = (windowWidth: number) => ((windowWidth - 40) * 182) / 320;

export function IdolPickBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const sectionRef = useImpressionRef('idol_pick');
  const open = () => {
    trackHomeCardClick('idol_pick', 0);
    router.push('/idol-picks' as Href);
  };
  return (
    <View ref={sectionRef} collapsable={false} style={styles.outer} testID="idol-pick-section">
      <Pressable onPress={open} style={styles.banner} accessibilityRole="button" accessibilityLabel={t('home.idolPick.bannerA11y')} testID="idol-pick-banner">
        {({ pressed }) => (
          <>
            <Image source={BG} style={styles.bg} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no" testID="idol-pick-bg" />
            <View style={[styles.inner, { paddingTop: textTop(width) }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID="idol-pick-inner">
              <View style={styles.texts}>
                <Text style={styles.label}>{t('home.idolPick.label')}</Text>
                {/* 긴 로케일(es·ru·ja)은 24pt 2줄 초과 → 로케일 분기 없이 네이티브 축소(24 → 최소 21.6) */}
                <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.9}>{t('home.idolPick.title')}</Text>
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
  bg: { position: 'absolute', top: 0, left: 0, width: '100%', aspectRatio: BG_ASPECT },
  inner: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  texts: { gap: 6 },
  label: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.6, color: C.primary },
  title: { fontFamily: font.bodyBlack, fontSize: 24, lineHeight: 34, color: '#FFFFFF' }, // 34 = th 성조·모음 기호 잘림 방지(전 로케일 공통)
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, borderRadius: 22, paddingHorizontal: 18, backgroundColor: '#FFFFFF' },
  pillText: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  press: { backgroundColor: 'rgba(255,255,255,0.12)' },
});
