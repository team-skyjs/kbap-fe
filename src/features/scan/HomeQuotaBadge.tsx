import { resetUnlockSession, isRewardedShowing, subscribeUnlock } from './unlockCelebrationStore';
import { currentGen } from '@/lib/auth/beTokens';
/**
 * HomeQuotaBadge (KB-680, P-432) — 홈 플로팅(KB-701: 스캔 버튼 바로 아래) "무료 스캔 N회 남음" 불꽃 + 안내 시트.
 * 스펙 = spec specs/001-personalized-menu-mvp/countdown-badge-2026-10-02.md (예진 10/2 결정).
 *
 * - 정본 = `me.scanQuota`(서버) — 클라는 횟수를 세지 않는다. 노출 = 남은 횟수가 숫자인 회원(0 포함 — 꺼진 불꽃).
 *   숨김 = 무제한 · 게스트 · scanQuota null(구서버 — 판별 불가는 막지도 보여주지도 않는다) · 플래그 off.
 * - 탭 = 안내 시트(남은 횟수 · "리뷰를 쓰면 무제한" · 리뷰 쓰기) → 스캔 잠금 화면과 같은 TagPickerSheet(context=review).
 * - KB760: 서버 해제 뒤 뱃지는 조용히 숨김. 전이·폭죽은 전역 UnlockCelebration이 단독 소유한다.
 */
import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { QuotaDialog } from './QuotaDialog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { CountdownBadge } from '@/components/CountdownBadge';
import { BADGE_EDGE, BADGE_POS_KEY, DRAG_SLOP, cachedBadgePos, rememberBadgePos, badgeBounds, badgeMinTop, badgePlace, clampTop, edgeX, nearestSide, parseBadgePos, type BadgePos } from './badgePosition';
import { TagPickerSheet } from '@/app/community/compose';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
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

/** Legacy test helper; celebration memory now belongs to the global transition owner. */
export function _resetQuotaCelebrationMemoryForTest() { resetUnlockSession(currentGen()); }

/** top = 홈이 측정한 앵커(null = 아직 측정 전 → 그리지 않는다. 축하 상태는 이 컴포넌트에 남아 측정 뒤 이어진다). */
export function HomeQuotaBadge({ top }: { top: number | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const model = FLAGS.countdownBadge ? quotaBadgeModel(me?.scanQuota, isGuest) : null;

  const rewardedShowing = React.useSyncExternalStore(subscribeUnlock, isRewardedShowing, isRewardedShowing);
  const [sheet, setSheet] = React.useState(false);
  // Codex #221 P2: 시트가 열린 채 노출 자격이 사라지면(세션 만료·게스트·해금·null) 닫는다 — 렌더 중 동기화.
  // 주 경로(시트 → 리뷰 쓰기 → 해금)에선 해금 시점에 시트가 이미 닫혀 있어 축하와 순서가 엮이지 않는다
  // (리뷰 쓰기 탭이 먼저 시트를 닫고, 픽커 예약(pickerAfterDismiss)은 사용자가 고른 것이라 그대로 둔다).
  // Codex #291 R9: a confirmed reward unlock closes the dialog once the ad closes, even if the ['me'] refetch failed or is stale.
  const [unlockConfirmed, setUnlockConfirmed] = React.useState(false);
  if (sheet && (!model || unlockConfirmed) && !rewardedShowing) { setSheet(false); setUnlockConfirmed(false); }
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
  // 기본 자리) | 값. 읽는 중엔 뱃지가 없어 끌 수도 없으므로 "늦은 읽기가 사용자 이동을 덮는" 경로(Codex #234 ②)는 구조적으로 없다.
  const [saved, setSaved] = React.useState<BadgePos | null | 'loading'>(() => cachedBadgePos() ?? (cachedBadgePos() === null ? null : 'loading'));
  React.useEffect(() => {
    if (!FLAGS.countdownBadge) return; // 플래그 off(production) = 뱃지 없음 — 저장소 IO도 0
    if (cachedBadgePos() !== undefined) return; // 이번 세션에 이미 읽음(재마운트)
    let alive = true;
    const settle = (v: BadgePos | null) => {
      if (!alive) return;
      rememberBadgePos(v);
      setSaved(v);
    };
    AsyncStorage.getItem(BADGE_POS_KEY)
      .then((raw) => settle(parseBadgePos(raw)))
      .catch(() => settle(null)); // 읽기 실패 = "없음"으로 확정(안 하면 'loading'이 남아 뱃지가 영영 안 뜬다)
    return () => {
      alive = false;
    };
  }, []);
  // 단일 게이트(Codex #234 4R): 저장값 읽기 끝 + 영역 측정 끝 + 검색 줄 앵커 측정 끝 — 셋이 다 있어야 자리를 계산하고 그린다.
  // 위 한계 = 검색 줄 아래 끝(앵커 top − BADGE_GAP) + 여백 + 불꽃이 그려지는 높이(#234 QA). 임시 한계 경로 없음.
  // (앵커가 안 오는 상태 = 홈 로딩 스켈레톤(검색 줄·스캔 버튼 자체가 없음) — 그때 뱃지가 없는 것이 맞다. 홈 에러 상태는 뱃지를 마운트하지 않는다.)
  const ready = area != null && saved !== 'loading' && top != null;
  const bounds = ready ? badgeBounds(area.h, badgeMinTop(top - BADGE_GAP)) : null;
  const pos = ready && bounds ? badgePlace(saved, area.w, bounds) : null;
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
  // Codex #234 3R: pos가 처음 정해지는 렌더에선 px/py가 아직 0 — 그대로 그리면 (0,0)에 한 프레임 비친다. 자리를 쓴 뒤 같은 묶음에서 placed=1을
  // 세우고, 그 전엔 투명(JS에서 쓴 공유값은 UI에 비동기로 가므로 useLayoutEffect만으로는 보장이 안 된다 — 자리와 표시를 같은 반영 묶음으로).
  const placed = useSharedValue(0);
  React.useEffect(() => {
    if (posX == null || posY == null || dragging.get()) return;
    px.set(posX);
    py.set(posY);
    placed.set(1);
  }, [posX, posY, px, py, dragging, placed]);
  // KB-765 QA 2R: 다이얼로그가 열린 동안 숨김은 **애니메이션 스타일 안에서** — 정적 { opacity: 0 }을 뒤에 덧대면 useAnimatedStyle이
  // 네이티브에 매 프레임 opacity(placed)를 써서 덮는다(jest는 정적 스타일만 봐서 못 잡았다). sheet → 공유값(effect) → 같은 식 하나.
  const dialogHidden = useSharedValue(0);
  React.useEffect(() => {
    dialogHidden.set(sheet ? 1 : 0);
  }, [sheet, dialogHidden]);
  const floatStyle = useAnimatedStyle(() => ({ opacity: placed.get() * (1 - dialogHidden.get()), transform: [{ translateX: px.get() }, { translateY: py.get() }] }));
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
      // 시스템이 제스처를 가져가 끝난 것(success false)·자리 미확정 = 취소와 같이 — 저장 없이 onFinalize가 제자리로(#234 공부)
      if (!success || !area || !bounds) return;
      ended.set(true);
      const next: BadgePos = { side: nearestSide(px.get(), area.w), top: py.get() };
      px.set(withSpring(edgeX(next.side, area.w)));
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
    setUnlockConfirmed(false);
    setSheet(true);
    // KB-765: 다이얼로그 노출 — 여는 탭에서 1회(이벤트 핸들러 — effect 아님). remaining = 그 순간 남은 무료 횟수
    track(EVENTS.scan_quota_dialog_view, { remaining: model?.value ?? 0 });
  };

  const shown = model;
  const left = shown && shown.value > 0 ? t('scan.freeLeft', { count: shown.value }) : t('scan.quotaTitle');
  return (
    <>
      {/* 홈 영역 측정 + 뱃지 밖 터치 통과(box-none) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {shown && pos != null && (
          <GestureDetector gesture={pan}>
            {/* 그리는 조건 = 저장값 읽기 끝 + 영역 측정 끝(자리 확정). 처음 자리가 공유값에 실리기 전 프레임은 투명(placed) — (0,0)·다른 경로의 자리를 그리지 않는다 */}
            {/* KB-765 QA: 다이얼로그가 열린 동안 홈 뱃지는 숨김 — iOS Modal(별도 창)의 딤 아래에 있지만 0회 회색 불꽃이 딤에 어두워져
                딤 위에 뜬 것처럼 보였고, 히어로와 불꽃이 두 개가 됐다. 마운트·자리 유지(투명도만) — 닫으면 그 자리 그대로 */}
            <Animated.View style={[styles.float, floatStyle]} testID="home-quota-badge" pointerEvents={sheet ? 'none' : 'auto'}>
              <CountdownBadge
                value={shown.value}
                state={shown.state}
                onPress={openSheet}
                accessibilityLabel={left}
              />
            </Animated.View>
          </GestureDetector>
        )}
      </View>
      {/* KB-765(D-23 E2): 바텀시트 → 가운데 다이얼로그 — 표면만 교체. 2택(리뷰 / 광고 n/3)은 남은 무료 횟수와 무관하게 상시(KB-759),
          광고 타일 조건(회원·서버 adRewards·광고 준비됨)·해제 뒤 닫힘(프로필 재조회로 뱃지 모델 null)·리뷰 픽커 순서(iOS onDismiss)는 그대로 */}
      {/* 상시 마운트(바텀시트와 같음) — 자격이 사라지면 위 렌더 중 동기화가 sheet를 끄고 visible=false로 닫힌다(Codex #221 P2) */}
      {(
        <QuotaDialog
          visible={sheet}
          value={shown?.value ?? 0}
          state={shown?.state ?? 'empty'}
          title={left}
          onWriteReview={openPicker}
          onUnlocked={() => { if (!isRewardedShowing()) setSheet(false); else setUnlockConfirmed(true); }}
          onClose={() => setSheet(false)}
          onDismiss={onSheetDismiss}
        />
      )}
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
});
