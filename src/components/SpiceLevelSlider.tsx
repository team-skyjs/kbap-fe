/**
 * SpiceLevelSlider — 맵기 5스톱 히트 슬라이더 (P-080 → P-088⑤ → P-098② 제스처
 * 재작업).
 *
 * Q-23 실기 반려 보정:
 *  - **드래그 중 손가락 1:1 추종** — 스냅 없이 pageX를 그대로 따라감. grant
 *    시점의 (pageX − locationX)로 트랙 절대 오프셋을 동기 확보(measure 비동기
 *    레이스 없음) — 손가락과 노브 어긋남 금지. **스냅은 릴리즈 순간에만**
 *    (최근접 스톱, LayoutAnimation 짧은 스프링). 라벨/🌶️/히어로는 드래그 중
 *    통과 스톱 기준 실시간(onChange).
 *  - **부모 스크롤 잠금** — onPanResponderTerminationRequest 거부 + 드래그
 *    상태를 onDragStateChange로 부모에 알림(부모 ScrollView scrollEnabled 토글).
 *  - **히트 영역 확대** — P-262: 팬 핸들러를 트랙+라벨 전체 래퍼로 승격(라벨 줄이
 *    음수 마진 확장 영역을 도로 덮어 히트를 뺏던 문제 해소) + 상하 ±32pt
 *    (마진 음수로 레이아웃 자리 무변). 라벨 터치도 pageX 기반이라 자연 동작.
 *
 * 시안(D-11) 문법 유지: 얇은 그라데이션 트랙·중간 미선택 흰 틱·흰 원+잉크
 * 보더 노브·라벨 5개(선택 볼드). 절대 위치 = 선택 전환 시 타 요소 이동 0
 * (P-088 유닛 잠금 유지). JS 스레드 PanResponder — 워클릿 없음.
 * 온보딩·프로필 수정 공용 — 여기 한 곳 수정으로 양쪽 반영.
 */
import { useRef, useState } from 'react';
import { LayoutAnimation, PanResponder, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { SPICE_LEVEL_LABEL, SPICE_LEVELS, spiceRank, type SpiceLevel } from '@/lib/spice';

const KNOB = 28; // KB-433(4150:14286): 썸 28 흰 원
const STOPS = 4; // 구간 수 (스톱 5개)
const TOUCH_PAD = 32; // 히트 영역 상하 확장(pt) — P-262: 20 → 32(전체 ≈130pt)

export function SpiceLevelSlider({
  level,
  onChange,
  onDragStateChange,
}: {
  level: SpiceLevel | null;
  onChange: (l: SpiceLevel) => void;
  /** 드래그 시작/종료 — 부모 ScrollView scrollEnabled 토글용 (P-098②a). */
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { t } = useTranslation();
  const [trackW, setTrackW] = useState(0);
  const [dragX, setDragX] = useState<number | null>(null); // 드래그 중 노브 = 손가락 1:1
  const rank = level == null ? -1 : spiceRank(level);

  const ref = useRef({ trackW, onChange, onDragStateChange, offsetX: 0, liveRank: rank });
  ref.current.trackW = trackW;
  ref.current.onChange = onChange;
  ref.current.onDragStateChange = onDragStateChange;

  const clampX = (x: number, w: number) => Math.min(w, Math.max(0, x));
  const nearest = (x: number, w: number) => Math.min(STOPS, Math.max(0, Math.round((x / w) * STOPS)));

  /** 드래그 중 실시간 — 노브는 자유 추종, 통과 스톱이 바뀌면 히어로/라벨 갱신. */
  const moveTo = (pageX: number) => {
    const { trackW: w, offsetX, onChange: change } = ref.current;
    if (!w) return;
    const local = clampX(pageX - offsetX, w);
    setDragX(local);
    const r = nearest(local, w);
    if (r !== ref.current.liveRank) {
      ref.current.liveRank = r;
      change(SPICE_LEVELS[r]);
    }
  };

  const finish = (pageX: number) => {
    const { trackW: w, offsetX, onChange: change, onDragStateChange: lock } = ref.current;
    if (w) {
      const r = nearest(clampX(pageX - offsetX, w), w);
      ref.current.liveRank = r;
      change(SPICE_LEVELS[r]);
    }
    // 릴리즈 스냅 — 최근접 스톱으로 짧은 스프링 (드래그 자유 위치 → 스톱)
    LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.spring, LayoutAnimation.Properties.opacity));
    setDragX(null);
    lock?.(false);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // 부모 ScrollView가 제스처를 뺏어가지 못하게 (iOS/안드 공통 1차 방어)
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        // 절대 오프셋 = pageX − locationX (터치 래퍼 기준) — 동기·measure 불요
        ref.current.offsetX = e.nativeEvent.pageX - e.nativeEvent.locationX;
        ref.current.onDragStateChange?.(true);
        moveTo(e.nativeEvent.pageX);
      },
      onPanResponderMove: (e) => moveTo(e.nativeEvent.pageX),
      onPanResponderRelease: (e) => finish(e.nativeEvent.pageX),
      onPanResponderTerminate: (e) => finish(e.nativeEvent.pageX),
    }),
  ).current;

  const toX = (i: number) => (trackW * i) / STOPS;
  const knobX = dragX != null ? dragX : rank >= 0 && trackW > 0 ? toX(rank) : null;
  const labelW = trackW > 0 ? trackW / 4 : 0;

  return (
    // P-262: 팬 = 트랙+라벨 전체 래퍼(±32pt 확장) — 내부는 전부 pointerEvents none
    <View style={styles.hitArea} {...pan.panHandlers}>
      <View
        style={styles.trackWrap}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        pointerEvents="none"
      >
        <View style={styles.trackBox}>
          <LinearGradient colors={['#f2c14e', '#e2580c', '#c22d20']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.track} />
          {/* 시안: 5개 스텝 점 6px 흰 60% — absolute 고정(선택 전환 이동 0) */}
          {trackW > 0 && [0, 1, 2, 3, 4].map((i) => <View key={i} style={[styles.tick, { left: toX(i) - 3 }]} />)}
          {knobX != null && <View style={[styles.knob, { left: knobX - KNOB / 2 }]} />}
        </View>
      </View>
      {/* 라벨 5개 전부 — 선택 볼드 잉크·비선택 회색. 끝 라벨은 안쪽 정렬(오버플로 방지).
          P-262: 팬 영역 안(터치 통과) — 라벨 위 터치도 슬라이더가 먼저 받는다 */}
      <View style={styles.labels} pointerEvents="none">
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
  // P-262: 히트 = 트랙(44)+라벨(22)+상하 확장(64) ≈ 130pt — 음수 마진 = 레이아웃 자리 무변
  hitArea: { paddingVertical: TOUCH_PAD, marginVertical: -TOUCH_PAD },
  trackWrap: { justifyContent: 'center' },
  trackBox: { height: 44, justifyContent: 'center' },
  // KB-433(4150:14286): 트랙 8 r7(그라데이션 유지 — 발주) · 점 6 흰 60% · 노브 28 흰
  // border #B1B5BD 0.5 + 그림자 2/4 blur6 25% · 라벨 12/500(활성 primary/나머지 #B1B5BD)
  track: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 7, top: 18 },
  tick: { position: 'absolute', top: 19, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  knob: {
    position: 'absolute',
    top: (44 - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: C.inkMute,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 4 },
    elevation: 3,
  },
  labels: { height: 18, marginTop: 6 },
  label: { position: 'absolute', fontSize: 12, fontWeight: '500', color: C.inkMute },
  labelOn: { color: C.primary },
});

export default SpiceLevelSlider;
