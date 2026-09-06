/**
 * SpicePeppers (P-227 ⑤ → KB-431 디자인 4차) — 맵기: 고추 5개 **상시 노출** +
 * 미달분 회색 변형(자리 유지 — 개수 변화로 줄 폭·높이 불변, P-103/P-119 계열).
 * 고추 = 시안 .fig 원본 SVG(스펙 bridge/design/4th/icons/ic-pepper-on/off — 16
 * 그리드, 색 하드코딩 시안 그대로). 이모지 소멸(헌법 "이모지 금지" 예외 종료).
 */
import { View } from 'react-native';
import { PepperOn, PepperOff } from './design4Assets';

export function SpicePeppers({ rank, size = 16 }: { rank: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} testID="spice-peppers">
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} testID={`pepper-${i}-${i <= rank ? 'on' : 'off'}`}>
          {i <= rank ? <PepperOn height={size} /> : <PepperOff height={size} />}
        </View>
      ))}
    </View>
  );
}
