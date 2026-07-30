/**
 * SpiceLevelSlider — 맵기 5스톱 히트 슬라이더 (P-080 → P-088⑤ 재작업).
 *
 * Q-23 ⚠️ 근본 수정: 구현이 space-between flex 줄에 도트를 플로우로 넣어
 * 14↔26px 전환마다 전체가 재배치됐다 — **트랙 고정 + 틱·노브 전부 absolute
 * (i×25% 기준)**로 선택 변경 시 다른 요소 이동 0 (레이아웃 유닛 잠금).
 *
 * 시안(D-11 최종 바 문법) 정확 일치:
 *  - 얇은 라운드 트랙(노랑→빨강 히트 그라데이션 — 의미색, 맵기 한정 허용)
 *  - 중간 미선택 자리(Mild·Medium·Hot) = **흰 세로 틱** (반투명 원 도트 폐기)
 *  - 노브 = **흰 원 + 잉크 보더** (주황 보더 폐기)
 *  - 트랙 아래 **라벨 5개 전부** — 선택 = 볼드 잉크·비선택 회색, 긴 라벨(러시아어
 *    등)은 셀 폭 내 자동 축소(adjustsFontSizeToFit)
 *
 * 제스처 = 트랙 컨테이너 레벨 PanResponder 단일(JS 스레드, 워클릿 없음) —
 * 탭 즉시 스냅 + 드래그 중 노브 자유 추종, 릴리즈 시 최근접 스톱 스냅.
 * 개별 Pressable 폐기(팬 가로채기 원인). level=null = 미설정(노브 없음).
 * 온보딩·프로필 수정 공용 — 여기 한 곳 수정으로 양쪽 반영.
 */
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { SPICE_LEVEL_LABEL, SPICE_LEVELS, spiceRank, type SpiceLevel } from '@/lib/spice';

const KNOB = 26;
const STOPS = 4; // 구간 수 (스톱 5개)

export function SpiceLevelSlider({ level, onChange }: { level: SpiceLevel | null; onChange: (l: SpiceLevel) => void }) {
  const { t } = useTranslation();
  const [trackW, setTrackW] = useState(0);
  const [dragX, setDragX] = useState<number | null>(null); // 드래그 중 노브 자유 위치
  const rank = level == null ? -1 : spiceRank(level);

  const stateRef = useRef({ trackW, onChange });
  stateRef.current = { trackW, onChange };

  const clampX = (x: number, w: number) => Math.min(w, Math.max(0, x));
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { trackW: w } = stateRef.current;
        if (w) setDragX(clampX(e.nativeEvent.locationX, w));
      },
      onPanResponderMove: (e) => {
        const { trackW: w } = stateRef.current;
        if (w) setDragX(clampX(e.nativeEvent.locationX, w));
      },
      onPanResponderRelease: (e) => {
        const { trackW: w, onChange: change } = stateRef.current;
        if (w) {
          const i = Math.min(STOPS, Math.max(0, Math.round((clampX(e.nativeEvent.locationX, w) / w) * STOPS)));
          change(SPICE_LEVELS[i]);
        }
        setDragX(null);
      },
      onPanResponderTerminate: () => setDragX(null),
    }),
  ).current;

  const toX = (i: number) => (trackW * i) / STOPS;
  const knobX = dragX != null ? dragX : rank >= 0 && trackW > 0 ? toX(rank) : null;
  const labelW = trackW > 0 ? trackW / 4 : 0;

  return (
    <View>
      <View style={styles.trackBox} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
        <LinearGradient colors={['#f2c14e', '#e2580c', '#c22d20']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.track} />
        {/* 중간 스톱 틱(1~3) — absolute 고정: 선택이 바뀌어도 이동 0 */}
        {trackW > 0 &&
          [1, 2, 3].map((i) => <View key={i} style={[styles.tick, { left: toX(i) - 1 }]} pointerEvents="none" />)}
        {knobX != null && <View style={[styles.knob, { left: knobX - KNOB / 2 }]} pointerEvents="none" />}
      </View>
      {/* 라벨 5개 전부 — 선택 볼드 잉크·비선택 회색. 끝 라벨은 안쪽 정렬(오버플로 방지) */}
      <View style={styles.labels}>
        {trackW > 0 &&
          SPICE_LEVELS.map((l, i) => {
            const on = i === rank;
            const pos =
              i === 0
                ? { left: 0, width: labelW, textAlign: 'left' as const }
                : i === STOPS
                  ? { right: 0, width: labelW, textAlign: 'right' as const }
                  : { left: toX(i) - labelW / 2, width: labelW, textAlign: 'center' as const };
            return (
              <Text
                key={l}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.label, on && styles.labelOn, pos]}
              >
                {t(SPICE_LEVEL_LABEL[l])}
              </Text>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackBox: { height: 44, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, top: 19 },
  tick: { position: 'absolute', top: 16, width: 2, height: 12, borderRadius: 1, backgroundColor: '#fff' },
  knob: {
    position: 'absolute',
    top: (44 - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#fff',
    borderWidth: 2.5,
    borderColor: C.ink,
  },
  labels: { height: 18, marginTop: 4 },
  label: { position: 'absolute', fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  labelOn: { fontFamily: font.bodyBold, color: C.ink },
});

export default SpiceLevelSlider;
