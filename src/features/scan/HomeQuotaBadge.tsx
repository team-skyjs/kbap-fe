/**
 * HomeQuotaBadge (KB-680, P-432) — 홈 플로팅(KB-701: 스캔 버튼 바로 아래) "무료 스캔 N회 남음" 불꽃 + 안내 시트.
 * 스펙 = spec specs/001-personalized-menu-mvp/countdown-badge-2026-10-02.md (예진 10/2 결정).
 *
 * - 정본 = `me.scanQuota`(서버) — 클라는 횟수를 세지 않는다. 노출 = 남은 횟수가 숫자인 회원(0 포함 — 꺼진 불꽃).
 *   숨김 = 무제한 · 게스트 · scanQuota null(구서버 — 판별 불가는 막지도 보여주지도 않는다) · 플래그 off.
 * - 탭 = 안내 시트(남은 횟수 · "리뷰를 쓰면 무제한" · 리뷰 쓰기) → 스캔 잠금 화면과 같은 TagPickerSheet(context=review).
 * - 숫자 → 해금(리뷰 작성 후) = 마지막 숫자로 폭죽 1회 후 사라짐 — 시작은 홈이 보일 때(CountdownBadge). 축하 조건은
 *   `unlocked === true` + **같은 회원**(remaining 누락·음수 → 'unlimited' 판별 불가 응답, 계정 전환은 축하 아님).
 */
import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { SheetShell } from '@/components/SheetShell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { CountdownBadge } from '@/components/CountdownBadge';
import { BADGE_EDGE, BADGE_POS_KEY, DRAG_SLOP, cachedBadgePos, rememberBadgePos, badgeBounds, badgeMinTop, clampTop, edgeX, nearestSide, parseBadgePos, type BadgePos } from './badgePosition';
import { TagPickerSheet } from '@/app/community/compose';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { FLAGS } from '@/lib/flags';
import { color as C, font, type as type_ } from '@/lib/theme';
import type { ScanQuota } from '@/lib/api/types';

export interface QuotaBadgeModel {
  value: number;
  state: 'active' | 'empty';
}

/** 쿼터 → 뱃지 값. null = 숨김. */
export function quotaBadgeModel(quota: ScanQuota | null | undefined, isGuest: boolean): QuotaBadgeModel | null {
  if (isGuest || !quota || quota.unlocked || quota.remaining === 'unlimited') return null;
  return { value: quota.remaining, state: quota.remaining > 0 ? 'active' : 'empty' };
}

/** KB-701(예진 10/2): 위치 = **홈 우상단, 검색 줄 스캔 버튼 바로 아래**(탭 줄·칩 줄 오른쪽 끝 위로 뜬다 — 예진 표시 자리).
 *  top은 홈이 **실제 렌더된 검색 줄을 측정해** 내려 준다(헤더 + FoodExplorer 위치(넛지 유무) + 검색 줄 아래 끝 + BADGE_GAP — Codex #229:
 *  고정 오프셋은 넛지가 뜨면 스캔 버튼과 겹쳤다). 오른쪽 = 검색 줄 paddingHorizontal 20(스캔 버튼 오른쪽 끝과 정렬).
 *  화면 고정 플로팅(스크롤해도 같은 자리 — 축하가 보이게). */
export const BADGE_GAP = 4;
export const BADGE_RIGHT = BADGE_EDGE; // 기본 자리 = 오른쪽 가장자리(KB-706 끌어 놓기의 가장자리 여백과 같은 값)

/** KB-699: 회원별 마지막 숫자 쿼터 — 세션 메모리(앱 재시작 시 비움). 해금 축하를 재조회 빈 렌더·홈 트리 재마운트 너머로 잇는다. */
const lastNumericQuota = new Map<string, QuotaBadgeModel>();
const lastNumericListeners = new Set<() => void>();
function subscribeLastNumeric(cb: () => void): () => void {
  lastNumericListeners.add(cb);
  return () => lastNumericListeners.delete(cb);
}
function rememberNumeric(id: string, m: QuotaBadgeModel) {
  const cur = lastNumericQuota.get(id);
  if (cur && cur.value === m.value && cur.state === m.state) return;
  lastNumericQuota.set(id, m);
  lastNumericListeners.forEach((l) => l());
}
function forgetNumeric(id: string) {
  if (!lastNumericQuota.delete(id)) return;
  lastNumericListeners.forEach((l) => l());
}
/** 유닛용 리셋 */
export function _resetQuotaCelebrationMemoryForTest() {
  lastNumericQuota.clear();
}

/** top = 홈이 측정한 앵커(null = 아직 측정 전 → 그리지 않는다. 축하 상태는 이 컴포넌트에 남아 측정 뒤 이어진다). */
export function HomeQuotaBadge({ top, headerH }: { top: number | null; headerH: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const model = FLAGS.countdownBadge ? quotaBadgeModel(me?.scanQuota, isGuest) : null;

  // KB-699: 축하 판정을 **회원별 마지막 숫자 쿼터(세션 메모리)**로 잇는다. 옛 렌더 중 전이 비교(prev → 지금)는 전이를 한 컴포넌트
  // 인스턴스의 연속 렌더에서만 봤다 — ① 재조회 중 me가 잠깐 비면(memberId null) "계정 전환"으로 오인해 기억을 지웠고
  // ② 홈 트리가 다시 마운트되면(홈 재조회 에러 블록 등) prev가 지금 값(숨김)으로 초기화돼 해금 전이를 영영 못 봤다(QA: 폭죽 0).
  // 저장소는 표시 상태(서버 사실 아님 — 서버 정본은 me.scanQuota 그대로)이고 useSyncExternalStore로 읽는다(렌더 중 바깥 값 직접 읽기 금지 — KB-694/695).
  const memberId = me?.id ?? null;
  const unlockedNow = FLAGS.countdownBadge && !isGuest && me?.scanQuota?.unlocked === true;
  const getLast = React.useCallback(() => (memberId ? lastNumericQuota.get(memberId) ?? null : null), [memberId]);
  const last = React.useSyncExternalStore(subscribeLastNumeric, getLast, getLast);
  // 축하의 **주인 회원**을 함께 든다(Codex #229 · 공부 #229) — 끝·취소 때 지울 기억이 "지금 me"가 아니라 이 회원의 것이어야 한다
  // (끝나는 순간 me가 비어 있거나 계정이 바뀌었어도).
  const [celebrating, setCelebrating] = React.useState<{ memberId: string; model: QuotaBadgeModel } | null>(null);
  // 숫자를 본 순간마다 기억(효과 — 바깥 저장소 쓰기)
  const modelValue = model?.value;
  const modelState = model?.state;
  React.useEffect(() => {
    if (memberId && modelValue != null && modelState) rememberNumeric(memberId, { value: modelValue, state: modelState });
  }, [memberId, modelValue, modelState]);
  // 축하 시작 = 같은 회원이 해금됐고 그 회원의 마지막 숫자를 기억하고 있을 때(중간의 빈 렌더·재마운트와 무관)
  if (unlockedNow && memberId && last && !celebrating) setCelebrating({ memberId, model: last });
  // 되돌려진 해금(대기 중 다시 숫자) = 축하 취소(공부 #221 재확인 ①) — 기억은 효과가 새 숫자로 덮는다
  if (model && celebrating) setCelebrating(null);
  // 회원이 떠남 = 그 회원의 기억 삭제(축하 중이 아니어도 — Codex #229: A가 숫자인 채 떠났다가 다른 곳에서 해금되고 돌아오면, 이 세션이
  // 본 적 없는 전이로 낡은 기억이 폭죽을 띄웠다) + 진행·보류 중 축하 취소. 떠남 = 로그아웃(게스트 — 세션 스토어라 재조회 빈 렌더와 구분됨,
  // 공부 #229 지적 1) · 실제로 다른 회원(계정 전환). 재조회 중 빈 렌더(memberId null)는 떠남이 아니다(KB-699 ①).
  // 기억 삭제는 바깥 저장소 쓰기라 효과에서 — 렌더는 "누구를 지울지"만 상태로 남긴다(매번 새 객체 = 같은 회원 반복도 다시 실행).
  const [present, setPresent] = React.useState<string | null>(memberId); // 마지막으로 본 회원(빈 렌더 너머로 유지)
  const [dropped, setDropped] = React.useState<{ memberId: string } | null>(null);
  const leaving = present != null && (isGuest || (memberId != null && memberId !== present)) ? present : null;
  if (leaving) {
    setDropped({ memberId: leaving });
    if (celebrating) setCelebrating(null);
  }
  const nextPresent = isGuest ? null : memberId ?? present;
  if (nextPresent !== present) setPresent(nextPresent);
  React.useEffect(() => {
    if (dropped) forgetNumeric(dropped.memberId);
  }, [dropped]);
  // 끝 = 그 축하 주인의 기억을 지운다(onCelebrateEnd) — 시작 때 지우면 축하 대기 중(홈 가려짐) 트리가 다시 마운트될 때 잃는다.
  // 진행 중엔 `!celebrating` 가드가 재트리거를 막는다.
  const endCelebration = () => {
    if (celebrating) forgetNumeric(celebrating.memberId);
    setCelebrating(null);
  };

  const [sheet, setSheet] = React.useState(false);
  // Codex #221 P2: 시트가 열린 채 노출 자격이 사라지면(세션 만료·게스트·해금·null) 닫는다 — 렌더 중 동기화.
  // 주 경로(시트 → 리뷰 쓰기 → 해금)에선 해금 시점에 시트가 이미 닫혀 있어 축하와 순서가 엮이지 않는다
  // (리뷰 쓰기 탭이 먼저 시트를 닫고, 픽커 예약(pickerAfterDismiss)은 사용자가 고른 것이라 그대로 둔다).
  if (sheet && !model) setSheet(false);
  const [picker, setPicker] = React.useState(false);
  const pickerAfterDismiss = React.useRef(false);
  const openPicker = () => {
    setSheet(false);
    // iOS: 시트 dismiss 완료 뒤 픽커 present(같은 커밋 연쇄 = 두 번째 모달 누락 race, P-267 선례) · 안드: onDismiss 미지원 → 즉시
    if (Platform.OS === 'ios') pickerAfterDismiss.current = true;
    else setPicker(true);
  };
  const onSheetDismiss = () => {
    if (!pickerAfterDismiss.current) return;
    pickerAfterDismiss.current = false;
    setPicker(true);
  };

  // ── KB-706: 끌어 놓기 — 놓으면 가까운 좌/우 가장자리, 높이 유지, 기기 저장(놓을 때 1회). 저장값 없음 = 기본 자리(스캔 버튼 아래 측정 앵커 `top`, 오른쪽).
  const [area, setArea] = React.useState<{ w: number; h: number } | null>(null);
  // 저장 위치 상태 기계(#234 공부): 'loading'(읽는 중 — **그리지 않는다**: 기본 자리에 먼저 보였다가 저장 자리로 튀지 않게) → null(없음·읽기 실패 =
  // 기본 자리) | 값. 사용자가 끌어 놓은 뒤 늦게 온 읽기 결과는 버린다(Codex #234 ② — 사용자 변경이 최신).
  const [saved, setSaved] = React.useState<BadgePos | null | 'loading'>(() => cachedBadgePos() ?? (cachedBadgePos() === null ? null : 'loading'));
  const userMoved = useSharedValue(false);
  React.useEffect(() => {
    if (!FLAGS.countdownBadge) return; // 플래그 off(production) = 뱃지 없음 — 저장소 IO도 0
    if (cachedBadgePos() !== undefined) return; // 이번 세션에 이미 읽음(재마운트)
    let alive = true;
    const settle = (v: BadgePos | null) => {
      if (!alive || userMoved.get()) return;
      rememberBadgePos(v);
      setSaved(v);
    };
    AsyncStorage.getItem(BADGE_POS_KEY)
      .then((raw) => settle(parseBadgePos(raw)))
      .catch(() => settle(null)); // 읽기 실패 = "없음"으로 확정(안 하면 'loading'이 남아 뱃지가 영영 안 뜬다)
    return () => {
      alive = false;
    };
  }, [userMoved]);
  const restored = saved === 'loading' ? null : saved;
  // #234 QA: 위 한계 = 검색 줄 아래 끝(앵커 top − BADGE_GAP) + 여백 + 불꽃이 그려지는 높이 — 기본 자리·끌기·복원 모두 이 한계 이하
  const rowBottom = top != null ? top - BADGE_GAP : null;
  const minTop = badgeMinTop(rowBottom, headerH);
  const bounds = area ? badgeBounds(area.h, minTop) : null;
  const pos =
    area && bounds && saved !== 'loading'
      ? restored
        ? { x: edgeX(restored.side, area.w), y: clampTop(restored.top, bounds) }
        : top != null
          ? { x: edgeX('right', area.w), y: clampTop(top, bounds) }
          : null
      : null;
  const px = useSharedValue(0);
  const py = useSharedValue(0);
  // 끌기 상태도 공유값(.get/.set) — 렌더 중 만든 제스처 콜백이 ref를 읽으면 React Compiler가 "렌더 중 ref 접근"으로 컴포넌트를 건너뛴다
  const dragging = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const justDragged = useSharedValue(false);
  const ended = useSharedValue(false); // 이번 끌기에 onEnd(정상 놓기)가 왔나 — 취소(onFinalize만)와 구분
  const posX = pos?.x;
  const posY = pos?.y;
  React.useEffect(() => {
    if (posX == null || posY == null || dragging.get()) return;
    px.set(posX);
    py.set(posY);
  }, [posX, posY, px, py, dragging]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateX: px.get() }, { translateY: py.get() }] }));
  // 콜백은 JS 스레드(runOnJS(true) — 레포 제스처 관례, 워클릿 경계 0). 공유값은 JS에서 써도 UI에 반영된다.
  // 공유값은 .get()/.set() — React Compiler가 훅 반환값의 `.value =` 대입을 "수정 불가"로 보고 컴포넌트를 건너뛰지 않게(reanimated 4 권장).
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(DRAG_SLOP)
    .onStart(() => {
      dragging.set(true);
      ended.set(false);
      startX.set(px.get());
      startY.set(py.get());
    })
    .onUpdate((e) => {
      if (!bounds) return;
      px.set(startX.get() + e.translationX);
      py.set(clampTop(startY.get() + e.translationY, bounds));
    })
    .onEnd((_e, success) => {
      // 시스템이 제스처를 가져가 끝난 것(success false)·측정 전 = 취소와 같이 — 저장 없이 onFinalize가 제자리로(#234 공부)
      if (!success || !area) return;
      ended.set(true);
      const next: BadgePos = { side: nearestSide(px.get(), area.w), top: py.get() };
      px.set(withSpring(edgeX(next.side, area.w)));
      userMoved.set(true);
      rememberBadgePos(next);
      setSaved(next);
      AsyncStorage.setItem(BADGE_POS_KEY, JSON.stringify(next)).catch(() => {}); // 저장 실패 = 이번 세션만 유지
    })
    .onFinalize(() => {
      // Codex #234 ①: 끌기가 취소되면(OS 끼어들기·경쟁 제스처) onEnd 없이 여기만 온다 — 공유값 변경은 리렌더를 안 일으켜 위치 effect도
      // 다시 안 돈다 → 지금 자리(저장값·기본 자리)로 스냅(저장은 안 함)
      if (dragging.get() && !ended.get() && posX != null && posY != null) {
        px.set(withSpring(posX));
        py.set(withSpring(posY));
      }
      if (dragging.get()) {
        justDragged.set(true);
        setTimeout(() => justDragged.set(false), 300); // 놓는 순간 따라 들어올 수 있는 탭만 막는 짧은 창
      }
      dragging.set(false);
    });
  // 끌기 직후 손을 뗄 때 들어올 수 있는 탭은 시트를 열지 않는다(끌기 = 시트 안 열림)
  const openSheet = () => {
    if (justDragged.get()) return;
    setSheet(true);
  };

  const shown = celebrating?.model ?? model;
  const left = shown && shown.value > 0 ? t('scan.freeLeft', { count: shown.value }) : t('scan.quotaTitle');
  return (
    <>
      {/* 홈 영역 측정 + 뱃지 밖 터치 통과(box-none) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {shown && (pos != null || (!area && saved === null && top != null)) && (
          <GestureDetector gesture={pan}>
            {/* 저장값 읽기가 끝나야 그린다. 영역 측정 전(첫 프레임)·저장값 없음 = 옛 기본 자리(오른쪽 BADGE_RIGHT · 측정 앵커 top), 측정 뒤엔 translate(끌기·저장 위치) */}
            <Animated.View style={pos != null ? [styles.float, floatStyle] : [styles.anchor, { top: minTop }]} testID="home-quota-badge">
              <CountdownBadge
                value={shown.value}
                state={shown.state}
                onPress={openSheet}
                celebrate={celebrating != null}
                onCelebrateEnd={endCelebration}
                accessibilityLabel={left}
              />
            </Animated.View>
          </GestureDetector>
        )}
      </View>
      <SheetShell visible={sheet} onClose={() => setSheet(false)} onDismiss={onSheetDismiss}>
        <View style={styles.copy}>
          <Text style={styles.title} testID="quota-sheet-title">{left}</Text>
          <Text style={styles.body}>{t('scan.quotaBody')}</Text>
        </View>
        <View style={styles.actions}>
          <Btn onPress={openPicker} testID="quota-sheet-review">{t('scan.quotaCta')}</Btn>
          <Btn variant="ghost" onPress={() => setSheet(false)} testID="quota-sheet-later">{t('scan.later')}</Btn>
        </View>
      </SheetShell>
      {/* 열릴 때만 마운트(스캔 잠금 화면과 같은 방식) — 홈에서 픽커 검색 훅이 상시 돌지 않게 */}
      {picker && (
      <TagPickerSheet
        context="review"
        kind="food"
        foodTags={[]}
        placeTag={null}
        onToggleFood={(f) => {
          setPicker(false);
          router.push(`/food/${f.foodId}/review` as Href);
        }}
        onTogglePlace={() => {}}
        onClose={() => setPicker(false)}
        t={t}
      />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  float: { position: 'absolute', left: 0, top: 0 }, // 위치 = translate(px, py) — 기본 = 오른쪽 BADGE_RIGHT·측정 앵커
  anchor: { position: 'absolute', right: BADGE_RIGHT },
  copy: { gap: 8 },
  title: { ...type_.sectionTitle, fontFamily: font.bodyBold, color: C.ink },
  body: { ...type_.body, fontFamily: font.body, color: C.ink2 },
  actions: { gap: 8 },
});
