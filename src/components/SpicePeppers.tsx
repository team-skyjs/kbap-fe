/**
 * SpicePeppers (P-227 ⑤/KB-305) — 맵기 표시: 고추 5개 **상시 노출** + 미달분
 * 투명도(멘토 제안 채택). 개수 변화로 줄 폭·높이가 안 바뀐다(프레임 불변 —
 * P-119 들썩임 고정과 같은 계열). 🌶️는 헌법 "이모지 금지" 기채택 예외.
 * 온보딩 슬라이더는 불변(디자이너 개편 대기) — 프로필 표시·수정 화면 전용.
 */
import { View } from 'react-native';
import { Txt as Text } from '@/components/Txt';

const PEPPER = '\u{1F336}\u{FE0F}';
const DIM = 0.22; // 미달분 투명도 — 자리 유지가 목적(색·불투명도만 상태 표현, P-103)

export function SpicePeppers({ rank, size = 15 }: { rank: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} testID="spice-peppers">
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ fontSize: size, opacity: i <= rank ? 1 : DIM }} testID={`pepper-${i}-${i <= rank ? 'on' : 'off'}`}>
          {PEPPER}
        </Text>
      ))}
    </View>
  );
}
