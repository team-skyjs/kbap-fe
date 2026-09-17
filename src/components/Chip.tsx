/**
 * Chip (KB-429, 4064:986) — 필터 칩 공용.
 * selected = bg #2F3137 + 흰 텍스트 / unselected = 흰 bg + line 1px + #2F3137.
 * 14/500 · pad 8/14 · pill. 선택 전환은 색만(프레임 불변 P-151 — 보더는 양 상태
 * 동일 폭, selected는 bg와 동색 보더로 자리 유지).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from './Txt';
import { RiskMark } from './RiskMark';
import { color as C, radius, riskTone, riskTextStrong, type RiskState } from '@/lib/theme';

const INK_ACTIVE = '#2F3137'; // 시안 gray-900(발주 표 외 명시값)

export function Chip({
  label,
  selected = false,
  onPress,
  testID,
  risk,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  /** P-391(KB-582): 위험도 필터 칩 — 선택 시 **RiskMark와 같은 토큰**으로 칠한다(예진 실기: 색이 달랐다). */
  risk?: RiskState;
}) {
  // 선택 = **틴트 배경 + 대비 보정 텍스트**(P-284 토큰). 원색 배경 + 흰 글자는 대비가
  // 2.0~3.0에 그친다(caution 노랑 1.97) — 형태 단서를 넣어도 읽히지 않으면 소용없다(Codex #167 2R).
  // riskTone[].bg / riskTextStrong[]이 바로 이 조합(틴트 위 4.5+)을 위해 있는 토큰이다.
  // 보더는 상태 원색(RiskMark와 같은 값) — 칩 경계에서 상태색이 그대로 읽힌다.
  const onBg = risk ? riskTone[risk].bg : INK_ACTIVE;
  const onFg = risk ? riskTextStrong[risk] : '#FFFFFF';
  const onBorder = risk ? riskTone[risk].fg : INK_ACTIVE;
  return (
    <Pressable
      style={[styles.chip, risk ? styles.chipRisk : null, selected ? { backgroundColor: onBg, borderColor: onBorder } : styles.off]}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
    >
      {/* 헌법 게이트: 위험도 4상태는 **색+형태 병행**(색맹 접근성) — 색만 바꾸면 안 된다(Codex #167).
          형태는 공용 RiskMark 글리프 그대로(✓ ! ✕ ?) — 새 형태 발명 금지.
          solid 고정: 원 fill = 상태색·글리프 = 흰색이라, 선택(원색 배경)에서도 **흰 글리프**가 형태를
          드러낸다. outline은 선택 시 스트로크가 배경과 같은 색이 돼 보이지 않는다. */}
      {!!risk && (
        <View testID={testID ? `${testID}-mark` : undefined}>
          <RiskMark state={risk} size={14} />
        </View>
      )}
      <Text style={[styles.label, { color: selected ? onFg : INK_ACTIVE }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  // 마크 + 라벨 — 프레임 불변(P-151): 선택/비선택 모두 같은 슬롯·같은 패딩
  chipRisk: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  on: { backgroundColor: INK_ACTIVE, borderColor: INK_ACTIVE },
  off: { backgroundColor: '#FFFFFF', borderColor: C.line },
  // P-371: lineHeight 20 고정 — 8+20+8=36 칩 높이 유지, Android 한글 세로 중앙
  label: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
});

export default Chip;
