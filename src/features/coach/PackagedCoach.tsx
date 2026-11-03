/**
 * PackagedCoach (KB-968, P-581) — 가공식품 출시 홍보 코치마크 2단계.
 *   1단계(홈) = 딤 + 탭바 스캔 버튼만 밝게 + 말풍선 → 아무 곳 탭 = 음식 탭(Dishes)으로
 *   2단계(음식 탭) = 딤 + 헤더 Packaged 탭만 밝게 + 말풍선 → 탭 = Packaged 선택 후 끝
 *   X = 전체 건너뛰기. 1회(표시 즉시 기록 — ScanCoachMark 패턴). FLAGS.processedFoodEnabled일 때만.
 * 말풍선 = 홈 스캔 툴팁 v3(12358:45547) 검정 말풍선·스캔 아이콘·X·꼬리(두 줄 허용).
 * 구멍 위치 = 대상의 measureInWindow(기기·큰 글자·안전영역 그대로). 못 재면 딤 없이 말풍선만(흐름 방해 금지).
 * 오버레이 = RN Modal + react-native-svg evenodd 경로(새 네이티브 의존성 0 — 지문 무변).
 */
import * as React from 'react';
import { Platform, StyleSheet, View, type LayoutRectangle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { IconClose, IconTabScan } from '@/components/icons';
import { color as C, font, radius, type as T } from '@/lib/theme';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { measureCoachTarget, type CoachTarget } from '@/lib/coachTargets';
import { whenAdsSettled } from '@/lib/ads/adsSession';
import { isOccluded } from '@/lib/engagement/occlusion';
import { waitStep } from '@/lib/oneShotQueue';

const SEEN_KEY = 'kbap.packagedCoach.v1';

export async function shouldShowPackagedCoach(): Promise<boolean> {
  if (!FLAGS.processedFoodEnabled) return false;
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) == null;
  } catch {
    return false; // 스토리지 오류 — 코치마크로 흐름 방해 금지
  }
}

export function markPackagedCoachSeen(): void {
  void AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
}

/** 기동 동의 흐름 대기 상한 — 넘기면 이번 포커스는 건너뜀(기록 안 함 → 다음 홈 포커스에 다시 판정) */
export const ADS_SETTLE_CAP_MS = 20000;

/** 홈 큐 스텝(1단계). 첫 실행 = 탭 진입 직후 UMP 동의 폼·ATT가 뜬다 — 그 위에 Modal을 올리면 iOS가 present를 버려
 *  "봤음"만 기록되고 안 보였다(시뮬 실측). 광고 기동이 끝나고(준비·불가) 다른 덮개·백그라운드가 없을 때만 띄운다. */
export async function presentHomeCoach(show: (done: () => void) => void, done: () => void, signal: AbortSignal): Promise<boolean> {
  if (!(await shouldShowPackagedCoach())) return false;
  const settled = await waitStep(whenAdsSettled(), signal, ADS_SETTLE_CAP_MS);
  if (!settled.ok || signal.aborted || isOccluded()) return false;
  show(done);
  return true;
}

/** 1단계 탭 → 음식 탭 진입 시 2단계(모듈 상태 — 홈 오버레이가 완전히 닫힌 뒤 음식 탭이 가져간다) */
let step2Pending = false;

/** #398 Codex P2: 코치마크 흐름이 화면에 있음(1단계 표시 ~ 2단계 끝, 단계 사이 전환 포함). 저장 키("봤음")는 표시 즉시 써지므로
 *  그 키만 보면 떠 있는 동안 스캔 뒤 넛지·리뷰 유도가 겹친다 — 다른 일회성 시트는 이 상태로 비켜 준다 */
let flowActive = false;
export function isPackagedCoachActive(): boolean {
  return flowActive;
}
export function queuePackagedCoachStep2(): void {
  step2Pending = true;
}
export function takePackagedCoachStep2(): boolean {
  const v = step2Pending;
  step2Pending = false;
  if (!v) flowActive = false; // 2단계 예약 없이 음식 탭 = 흐름 없음(잔존 방지)
  return v;
}

/* ---- 오버레이 ---- */
export type CoachStep = 'home' | 'food';
const CONTENT: Record<CoachStep, { target: CoachTarget; title?: string; body: string }> = {
  home: { target: 'scan', title: 'packagedCoach.homeTitle', body: 'packagedCoach.homeBody' },
  food: { target: 'packaged', body: 'packagedCoach.foodBody' },
};
const HOLE_PAD = 6;
const GAP = 12; // 구멍 ↔ 말풍선(꼬리 포함)
const TAIL_W = 16;
const TAIL_H = 8;
const SIDE = 16;
const MAX_W = 320;

/** 화면 전체 사각형 + 둥근 구멍(evenodd) */
export function holePath(w: number, h: number, hole: LayoutRectangle, r: number): string {
  const { x, y, width: hw, height: hh } = hole;
  const rr = Math.min(r, hw / 2, hh / 2);
  return [
    `M0 0H${w}V${h}H0Z`,
    `M${x + rr} ${y}H${x + hw - rr}A${rr} ${rr} 0 0 1 ${x + hw} ${y + rr}V${y + hh - rr}A${rr} ${rr} 0 0 1 ${x + hw - rr} ${y + hh}`,
    `H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + hh - rr}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`,
  ].join('');
}

/** 말풍선 가로 위치 — 구멍 가운데에 맞추되 화면 여백 안 · 꼬리 x = 말풍선 안 좌표 */
export function bubbleX(screenW: number, cx: number, bubbleW: number): { left: number; tailX: number } {
  const left = Math.min(Math.max(cx - bubbleW / 2, SIDE), Math.max(screenW - SIDE - bubbleW, SIDE));
  const tailX = Math.min(Math.max(cx - left - TAIL_W / 2, radius.lg), bubbleW - radius.lg - TAIL_W);
  return { left, tailX };
}

export function PackagedCoachOverlay({
  step,
  open,
  onNext,
  onSkip,
  onDismiss,
}: {
  step: CoachStep;
  open: boolean;
  onNext: () => void;
  onSkip: () => void;
  /** iOS 전용 — 네이티브 dismiss 완료 후(다음 모달·화면 전환은 이 뒤) */
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const c = CONTENT[step];
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);
  // undefined = 재는 중(아무것도 안 그림 — 깜빡임 방지) · null = 못 잼(딤 없이 말풍선만)
  const [hole, setHole] = React.useState<LayoutRectangle | null | undefined>(undefined);
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    void measureCoachTarget(c.target).then((r) => {
      if (!live) return;
      setHole(r ? { x: r.x - HOLE_PAD, y: r.y - HOLE_PAD, width: r.width + HOLE_PAD * 2, height: r.height + HOLE_PAD * 2 } : null);
    });
    return () => { live = false; setHole(undefined); };
  }, [open, c.target]);

  const below = step === 'food'; // 2단계 대상(헤더) = 말풍선이 아래 · 1단계(탭바) = 위
  const title = c.title ? t(c.title) : null;
  const body = t(c.body);
  const ready = size && hole !== undefined;
  const bubbleW = size ? Math.min(size.width - SIDE * 2, MAX_W) : 0;
  const pos = ready && hole ? bubbleX(size.width, hole.x + hole.width / 2, bubbleW) : null;
  const vertical = !ready ? null : hole
    ? below ? { top: hole.y + hole.height + GAP } : { bottom: size.height - hole.y + GAP }
    : below ? { top: 96 } : { bottom: 120 }; // 못 잼 = 대략 헤더 아래 / 탭바 위(딤 없음)

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onSkip} onDismiss={onDismiss}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setSize(e.nativeEvent.layout)}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={[title, body].filter(Boolean).join(', ')}
        accessibilityViewIsModal
        testID={`packaged-coach-${step}`}
      >
        {ready && hole && (
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none" testID="packaged-coach-scrim">
            <Path d={holePath(size.width, size.height, hole, step === 'home' ? hole.height / 2 : radius.md)} fill="rgba(0,0,0,0.6)" fillRule="evenodd" />
          </Svg>
        )}
        {ready && vertical && (
          <View style={[styles.bubble, vertical, { width: bubbleW }, pos ? { left: pos.left } : { alignSelf: 'center' }]} testID="packaged-coach-bubble">
            {below && pos && <Tail up left={pos.tailX} />}
            <View style={styles.row}>
              <IconTabScan size={24} color="#FFFFFF" />
              <View style={styles.texts}>
                {title && <Text style={styles.title} accessibilityRole="header">{title}</Text>}
                <Text style={title ? styles.body : styles.title}>{body}</Text>
              </View>
              <Pressable onPress={onSkip} style={styles.close} accessibilityRole="button" accessibilityLabel={t('common.close')} testID="packaged-coach-skip">
                <IconClose size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            {!below && pos && <Tail left={pos.tailX} />}
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

function Tail({ up = false, left }: { up?: boolean; left: number }) {
  return (
    <Svg width={TAIL_W} height={TAIL_H} style={[styles.tail, up ? { top: -TAIL_H } : { bottom: -TAIL_H }, { left }]} pointerEvents="none">
      <Path d={up ? `M0 ${TAIL_H}L${TAIL_W / 2} 0L${TAIL_W} ${TAIL_H}Z` : `M0 0L${TAIL_W / 2} ${TAIL_H}L${TAIL_W} 0Z`} fill={BUBBLE} />
    </Svg>
  );
}

/** 툴팁 v3 말풍선(gray-900) */
const BUBBLE = '#2F3137';

/** 홈·음식 탭 공통 — 오버레이 열림/닫힘 + 닫힘 완료 뒤 처리(iOS = onDismiss, Android = 즉시: ScanCoachMark와 같은 순서) */
export function usePackagedCoach(step: CoachStep, after: { next: () => void }) {
  const [open, setOpen] = React.useState(false);
  const pending = React.useRef<{ done?: () => void; next: boolean; closing: boolean } | null>(null);
  const settle = () => {
    const p = pending.current;
    pending.current = null;
    // 1단계 탭 = 2단계로 이어진다(음식 탭이 가져갈 때까지 흐름 유지) · 그 밖(건너뛰기·2단계 끝) = 흐름 끝
    flowActive = step === 'home' && !!p?.next;
    p?.done?.();
    if (p?.next) after.next();
  };
  const close = (next: boolean) => {
    const p = pending.current;
    if (!p || p.closing) return; // 연타 = 한 번(다음 단계·화면 이동 중복 금지)
    p.closing = true;
    p.next = next;
    track(next ? EVENTS.food_packaged_coach_next : EVENTS.food_packaged_coach_skip, { step });
    setOpen(false);
    if (Platform.OS !== 'ios') settle();
  };
  // 포커스 효과 deps에 들어가므로 identity 고정(ref·setter만 씀)
  const show = React.useCallback((done?: () => void) => {
    markPackagedCoachSeen(); // 표시 즉시 기록 — 중간에 앱을 꺼도 다시 안 뜬다
    flowActive = true;
    pending.current = { done, next: false, closing: false };
    setOpen(true);
    track(EVENTS.food_packaged_coach_shown, { step });
  }, [step]);
  return {
    show,
    props: {
      step,
      open,
      onNext: () => close(true),
      onSkip: () => close(false),
      onDismiss: Platform.OS === 'ios' ? settle : undefined,
    },
  };
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', backgroundColor: BUBBLE, borderRadius: radius.lg, paddingLeft: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...T.button, fontFamily: font.bodyBold, color: '#FFFFFF' },
  body: { ...T.meta, fontFamily: font.body, color: C.inkDisabled },
  // 닫기 = 44pt(접근성) — 말풍선 오른쪽 안쪽 여백 겸
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tail: { position: 'absolute' },
});
