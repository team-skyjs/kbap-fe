/**
 * VerdictBand — 판정 띠(음식 상세 §1-3에서 옮김, KB-914 R-137: 가공식품 상세·성분표 결과도 같은 부품).
 * 리본(RiskBadge) + 제목 + 이유 한 줄 · 바탕 = riskTone[state].bg(KB-908 리본 계열). 위험도 4상태 색·형태는 이 부품 하나가 정한다.
 * 탭 동작은 호출측(음식 상세 = 코치마크 재열람) — 없으면 눌리지 않는 띠.
 */
import * as React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { RiskBadge } from '@/components/RiskBadge';
import { IconLock } from '@/components/icons';
import { color as C, riskTone, type, type RiskState } from '@/lib/theme';

/** 음식 상세 띠 제목 키 — 가공식품은 서버 판정별 제목을 따로 넘긴다(문구 무변) */
export const VERDICT_TITLE: Record<RiskState, string> = {
  safe: 'detail.verdictSafe',
  caution: 'detail.verdictCaution',
  danger: 'detail.verdictDanger',
  unable: 'detail.verdictUnable',
};

export function VerdictBand({ state, title, reason, onPress, style, testID = 'detail-verdict' }: {
  state: RiskState; title: string; reason: string | null; onPress?: () => void; style?: ViewStyle; testID?: string;
}) {
  const content = (
    <>
      <RiskBadge state={state} />
      <View style={st.text}>
        <Text style={st.title}>{title}</Text>
        {!!reason && <Text style={st.reason}>{reason}</Text>}
      </View>
    </>
  );
  const boxStyle = [st.band, { backgroundColor: riskTone[state].bg }, style];
  return onPress ? (
    <Pressable style={boxStyle} onPress={onPress} testID={testID}>{content}</Pressable>
  ) : (
    <View style={boxStyle} testID={testID} accessible accessibilityLabel={[title, reason].filter(Boolean).join(', ')}>{content}</View>
  );
}

const st = StyleSheet.create({
  band: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 12, paddingHorizontal: 20, minHeight: 63, borderBottomWidth: 0.5, borderBottomColor: '#D5DFE7' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...type.button, color: C.ink }, // 16/600(구 음식 상세 riskRowTitle과 같은 값)
  reason: { ...type.meta, color: C.ink2, lineHeight: 19 }, // 14/500
});

/** KB-974: 비회원 = 판정 띠 자리의 잠금 행(음식 상세 §1-3에서 옮김 — 가공식품 상세가 같은 부품·같은 키). 탭 = 호출측 가입 게이트(AuthGateSheet context risk) */
export function VerdictLockRow({ onPress, style, testID = 'verdict-lock' }: { onPress: () => void; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { t } = useTranslation();
  return (
    <Pressable style={[lockStyles.slot, style]} onPress={onPress} accessibilityRole="button" testID={testID}>
      <IconLock size={16} color={C.ink2} />
      <Text style={lockStyles.text}>{t('detail.lockVerdict')}</Text>
      <Text style={lockStyles.cta}>{t('intro.signUp')}</Text>
    </Pressable>
  );
}

const lockStyles = StyleSheet.create({
  slot: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: C.surface2, borderBottomWidth: 0.5, borderBottomColor: '#D5DFE7' },
  text: { flex: 1, fontSize: 14, fontWeight: '400', color: C.ink2 },
  cta: { fontSize: 14, fontWeight: '700', color: C.primaryText },
});
