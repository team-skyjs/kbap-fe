/**
 * IdolPosterCard (KB-836, 02_designer_spec 화면 2) — `/idol-picks` 2열 포스터 카드.
 * 사진 전체(3:4) + 하단 그라데이션 + 흰 이름. 좌상단 RiskBadge(회원만) · 우상단 primary 원 + 물음표.
 * 눌림 = 검정 12% 오버레이 opacity 만(크기·보더 불변). 사진 실패·URL 없음 = 바탕 + IconQuestion.
 * 아이돌·그룹 이름·영상 정보는 이 카드에 없다(법무 잠금).
 */
import * as React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { RemoteImage } from '@/components/RemoteImage';
import { RiskBadge } from '@/components/RiskBadge';
import { IconQuestion } from '@/components/icons';
import { color as C, font, type RiskState } from '@/lib/theme';
import type { FoodCard } from '@/lib/api/types';

/** 물음표 티저 공통 그라데이션(디자인 스펙 "공통 시각 언어") */
export const IDOL_SHADE = { colors: ['rgba(28,30,33,0)', 'rgba(28,30,33,0.85)'] as const, locations: [0.35, 1] as const };
const WHITE_50 = 'rgba(255,255,255,0.5)';

/** 원격 사진 + 실패/없음 폴백(바탕 + 가운데 물음표). 배너 콜라주와 포스터 카드가 공유. */
export function IdolPhoto({ uri, recyclingKey, fallbackBg, iconSize, style }: { uri: string | null; recyclingKey: string; fallbackBg: string; iconSize: number; style: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = React.useState(false);
  // Codex #313 P2: 소스 전환마다 실패 리셋 — CardPhoto 와 같은 렌더 중 키 비교(A→B→A 에도 재시도)
  const key = `${recyclingKey}\u0000${uri ?? ''}`;
  const [prevKey, setPrevKey] = React.useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setFailed(false);
  }
  if (!uri || failed) {
    return (
      <View style={[style, { backgroundColor: fallbackBg, alignItems: 'center', justifyContent: 'center' }]} testID={`idol-photo-fallback-${recyclingKey}`}>
        <IconQuestion size={iconSize} color={WHITE_50} />
      </View>
    );
  }
  return <RemoteImage uri={uri} style={style} recyclingKey={recyclingKey} onError={() => setFailed(true)} />;
}

export function IdolPosterCard({ food, risk, width, onOpen }: { food: FoodCard; risk: RiskState | null; width: number; onOpen: () => void }) {
  const { t } = useTranslation();
  const label = t('idolPicks.cardA11y', { name: food.name }) + (risk ? `, ${t(`risk.${risk}`)}` : '');
  return (
    <Pressable onPress={onOpen} style={[styles.card, { width }]} accessibilityRole="button" accessibilityLabel={label} testID={`idol-poster-${food.foodId}`} uiTarget="idol-poster">
      {({ pressed }) => (
        <>
          <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <IdolPhoto uri={food.photoUrl} recyclingKey={food.foodId} fallbackBg={C.ink} iconSize={40} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={IDOL_SHADE.colors} locations={IDOL_SHADE.locations} style={StyleSheet.absoluteFill} pointerEvents="none" />
            {/* 게스트 = 개인화 배지 미렌더(guest-access-policy §1) */}
            {risk && (
              <View style={styles.badge}>
                <RiskBadge state={risk} />
              </View>
            )}
            <View style={styles.mark}>
              <IconQuestion size={14} color="#FFFFFF" />
            </View>
            <View style={styles.caption}>
              <Text style={styles.name} numberOfLines={2}>{food.name}</Text>
              {food.nameKo !== food.name && <Text style={styles.ko} numberOfLines={1}>{food.nameKo}</Text>}
            </View>
          </View>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.press, { opacity: pressed ? 1 : 0 }]} testID="idol-poster-press" />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: C.ink },
  badge: { position: 'absolute', top: 4, left: 8 },
  mark: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 2 },
  name: { fontFamily: font.bodyBlack, fontSize: 16, lineHeight: 20, color: '#FFFFFF' },
  ko: { fontFamily: font.koMed, fontSize: 12, lineHeight: 16, color: '#FFFFFF', opacity: 0.7 },
  press: { backgroundColor: 'rgba(0,0,0,0.12)' },
});
