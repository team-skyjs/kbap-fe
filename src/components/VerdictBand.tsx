/**
 * VerdictBand — 판정 띠(음식 상세 §1-3에서 옮김, KB-914 R-137: 가공식품 상세·성분표 결과도 같은 부품).
 * 리본(RiskBadge) + 제목 + 이유 한 줄 · 바탕 = riskTone[state].bg(KB-908 리본 계열). 위험도 4상태 색·형태는 이 부품 하나가 정한다.
 * 탭 동작은 호출측(음식 상세 = 코치마크 재열람) — 없으면 눌리지 않는 띠.
 */
import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { RiskBadge } from '@/components/RiskBadge';
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
