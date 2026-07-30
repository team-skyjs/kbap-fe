/**
 * SpiceLevelSlider — 맵기 5스톱 히트 그라데이션 스냅 슬라이더 (P-080 온보딩 →
 * P-081 프로필 수정 공용 승격). 노랑→빨강 그라데이션은 의미색(열) — 위험도
 * 4색과 무관, 맵기 트랙 한정 허용(헌법 v2.2.0).
 *
 * level=null → 선택 스톱 없음(미설정 상태로 편집 진입). 스톱 탭 + JS 스레드
 * PanResponder 드래그(워클릿 없음 — P-065 계열 리스크 회피). 🌶️ 히어로/값
 * 표시는 사용처 몫.
 */
import { useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, shadow } from '@/lib/theme';
import { SPICE_LEVEL_LABEL, SPICE_LEVELS, spiceRank, type SpiceLevel } from '@/lib/spice';

export function SpiceLevelSlider({ level, onChange }: { level: SpiceLevel | null; onChange: (l: SpiceLevel) => void }) {
  const { t } = useTranslation();
  const trackW = useRef(0);
  const rank = level == null ? -1 : spiceRank(level);
  const rankRef = useRef(rank);
  rankRef.current = rank;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const snapTo = (x: number) => {
    if (!trackW.current) return;
    const i = Math.min(4, Math.max(0, Math.round((x / trackW.current) * 4)));
    if (i !== rankRef.current) changeRef.current(SPICE_LEVELS[i]);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => snapTo(e.nativeEvent.locationX),
      onPanResponderMove: (e) => snapTo(e.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View>
      <View
        style={styles.trackBox}
        onLayout={(e) => {
          trackW.current = e.nativeEvent.layout.width;
        }}
        {...pan.panHandlers}
      >
        <LinearGradient colors={['#f2c14e', '#e2580c', '#c22d20']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.track} />
        <View style={styles.stopsRow}>
          {SPICE_LEVELS.map((l, i) => (
            <Pressable key={l} onPress={() => changeRef.current(l)} hitSlop={12} style={[styles.stop, i === rank && styles.stopOn]} />
          ))}
        </View>
      </View>
      <View style={styles.labels}>
        <Text style={styles.tag}>{t(SPICE_LEVEL_LABEL.NONE)}</Text>
        <Text style={styles.tag}>{t(SPICE_LEVEL_LABEL.EXTREME)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackBox: { height: 40, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 10, borderRadius: 6 },
  stopsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 1 },
  stop: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  stopOn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', borderWidth: 3, borderColor: C.primary, ...shadow.sh1 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  tag: { fontFamily: font.body, fontSize: 11, color: C.ink3 },
});

export default SpiceLevelSlider;
