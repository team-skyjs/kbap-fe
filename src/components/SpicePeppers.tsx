/**
 * SpicePeppers (P-227 ⑤ → KB-431 디자인 4차) — 맵기: 고추 5개 **상시 노출** +
 * 미달분은 회색 변형(자리 유지 — 개수 변화로 줄 폭·높이 불변, P-103/P-119 계열).
 * KB-431(4150:16891): 이모지 → SVG 2색 고추(IconPepper) — 활성 몸통 #E32939 +
 * 꼭지 #037F56 / 비활성 #D1D3D8 + #9196A1. 헌법 "이모지 금지" 예외 소멸.
 */
import { View } from 'react-native';
import { IconPepper } from './icons';

const ON = { body: '#E32939', stem: '#037F56' };
const OFF = { body: '#D1D3D8', stem: '#9196A1' };

export function SpicePeppers({ rank, size = 16 }: { rank: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} testID="spice-peppers">
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} testID={`pepper-${i}-${i <= rank ? 'on' : 'off'}`}>
          <IconPepper size={size} {...(i <= rank ? ON : OFF)} />
        </View>
      ))}
    </View>
  );
}
