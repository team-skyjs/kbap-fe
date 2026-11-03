/**
 * RiskBadge (KB-429 → 9/5 시안 원본 SVG) — 썸네일 좌상단 리본형 위험도 배지.
 * 26×34, 경로 = 스펙 bridge/design/4th/icons/risk-badge-safe.svg 그대로(형태·치수
 * 무수정): 제비꼬리 리본(상태색) + 흰 1.5 보더(확장 경로) + 흰 원 14 + 상태색
 * 글리프(RiskMark 공용 RiskGlyph, +6/+7 오프셋).
 * KB-926: 그림자 = 리본 실루엣(같은 경로 + 흰 보더 폭 스트로크)을 반투명 검정으로 뒤에 한 장 더 — 구 shBadge(컨테이너 View 그림자)는
 * 직사각형으로 깔려 꼬리 홈(V자)을 무시했다. SVG 필터 대신 경로라 iOS·Android 같은 모양. 시안 DROP 1,1 blur 3.7 근사 = 오프셋 두 겹.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { color as C, type RiskState } from '@/lib/theme';
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

/** KB-865: size = 폭(기본 26, 높이는 26:34 비율) · flat = 그림자 없음 — 가공식품 v4 "Personal assessment" 배지는 같은 리본을
 *  22×29로 줄이고 그림자 없이 쓴다(시안 인스턴스 리본 18.6×26.4 @1.69 = 이 경로 × 22/26). */
export function RiskBadge({ state, testID, size = 26, flat = false }: { state: RiskState; testID?: string; size?: number; flat?: boolean }) {
  const c = STATE_COLOR[state];
  const h = (size * 34) / 26;
  return (
    <View style={{ width: size, height: h }} testID={testID ?? `risk-badge-${state}`}>
      {!flat && (
        // 뒤 그림자 캔버스 — 같은 크기를 1pt 아래·오른쪽으로(부모 View는 자르지 않는다) · 바깥(넓게 옅게) + 안(좁게 진하게) 두 겹이 흐림 대신
        <Svg width={size} height={h} viewBox="0 0 26 34" style={st.shadow} pointerEvents="none" testID="risk-badge-shadow">
          <Path d={RIBBON} fill="#000000" stroke="#000000" strokeWidth={4.5} strokeLinejoin="round" opacity={0.12} transform="matrix(1,0,0,1,2,2)" />
          <Path d={RIBBON} fill="#000000" stroke="#000000" strokeWidth={3} strokeLinejoin="round" opacity={0.22} transform="matrix(1,0,0,1,2,2)" />
        </Svg>
      )}
      <Svg width={size} height={h} viewBox="0 0 26 34">
        <Path d={RIBBON} fill={c} fillRule="nonzero" transform="matrix(1,0,0,1,2,2)" />
        <Path d={RIBBON_BORDER} fill="#FFFFFF" transform="matrix(1,0,0,1,2,2)" />
        <Circle cx={13} cy={14} r={7} fill="#FFFFFF" />
        {/* Codex #30 P1: RiskGlyph는 22그리드 마크 중심(11,11) 정렬 내장 — 흰 원
            중심(13,14)으로 +2/+3만 이동(구 +6/+7은 이중 이동으로 글리프가 밀렸음) */}
        <G transform="matrix(1,0,0,1,2,3)">
          <RiskGlyph state={state} fill={c} />
        </G>
      </Svg>
    </View>
  );
}

export default RiskBadge;

const st = StyleSheet.create({
  shadow: { position: 'absolute', left: 1, top: 1 }, // 시안 DROP 오프셋 1,1
});
