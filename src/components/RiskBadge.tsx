/**
 * RiskBadge (KB-429 → 9/5 시안 원본 SVG) — 썸네일 좌상단 리본형 위험도 배지.
 * 26×34, 경로 = 스펙 bridge/design/4th/icons/risk-badge-safe.svg 그대로(형태·치수
 * 무수정): 제비꼬리 리본(상태색) + 흰 1.5 보더(확장 경로) + 흰 원 14 + 상태색
 * 글리프(RiskMark 공용 RiskGlyph, +6/+7 오프셋). 그림자 = shBadge(컨테이너).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { color as C, shadow, type RiskState } from '@/lib/theme';
import { RiskGlyph } from './RiskMark';

const STATE_COLOR: Record<RiskState, string> = {
  safe: C.riskSafe,
  caution: C.riskCaution,
  danger: C.riskDanger,
  unable: C.riskUnable,
};

const RIBBON =
  'M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 29.137C22 29.935 21.112 30.412 20.447 29.971L11.553 24.075C11.218 23.853 10.782 23.853 10.447 24.075L1.553 29.971C0.888 30.412 0 29.935 0 29.137L0 1Z';
const RIBBON_BORDER =
  'M11.553 24.075L10.724 25.325L11.553 24.075ZM10.447 24.075L11.276 25.325L10.447 24.075ZM1.553 29.971L2.381 31.221L1.553 29.971ZM20.447 29.971L19.619 31.221L20.447 29.971ZM1 0L1 1.5L21 1.5L21 0L21 -1.5L1 -1.5L1 0ZM22 1L20.5 1L20.5 29.137L22 29.137L23.5 29.137L23.5 1L22 1ZM0 29.137L1.5 29.137L1.5 1L0 1L-1.5 1L-1.5 29.137L0 29.137ZM20.447 29.971L21.276 28.721L12.381 22.824L11.553 24.075L10.724 25.325L19.619 31.221L20.447 29.971ZM10.447 24.075L9.619 22.824L0.724 28.721L1.553 29.971L2.381 31.221L11.276 25.325L10.447 24.075ZM11.553 24.075L12.381 22.824C11.544 22.269 10.456 22.269 9.619 22.824L10.447 24.075L11.276 25.325C11.109 25.436 10.891 25.436 10.724 25.325L11.553 24.075ZM0 29.137L-1.5 29.137C-1.5 31.131 0.719 32.323 2.381 31.221L1.553 29.971L0.724 28.721C1.056 28.5 1.5 28.739 1.5 29.137L0 29.137ZM22 29.137L20.5 29.137C20.5 28.739 20.944 28.5 21.276 28.721L20.447 29.971L19.619 31.221C21.281 32.323 23.5 31.131 23.5 29.137L22 29.137ZM21 0L21 1.5C20.724 1.5 20.5 1.276 20.5 1L22 1L23.5 1C23.5 -0.381 22.381 -1.5 21 -1.5L21 0ZM1 0L1 -1.5C-0.381 -1.5 -1.5 -0.381 -1.5 1L0 1L1.5 1C1.5 1.276 1.276 1.5 1 1.5L1 0Z';

export function RiskBadge({ state, testID }: { state: RiskState; testID?: string }) {
  const c = STATE_COLOR[state];
  return (
    <View style={styles.shadow} testID={testID ?? `risk-badge-${state}`}>
      <Svg width={26} height={34} viewBox="0 0 26 34">
        <Path d={RIBBON} fill={c} fillRule="nonzero" transform="matrix(1,0,0,1,2,2)" />
        <Path d={RIBBON_BORDER} fill="#FFFFFF" transform="matrix(1,0,0,1,2,2)" />
        <Circle cx={13} cy={14} r={7} fill="#FFFFFF" />
        <G transform="matrix(1,0,0,1,6,7)">
          <RiskGlyph state={state} fill={c} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { width: 26, height: 34, ...shadow.shBadge },
});

export default RiskBadge;
