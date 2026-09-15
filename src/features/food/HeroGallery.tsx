/**
 * HeroGallery (P-383/KB-566) — 음식 상세 히어로의 이미지 2장 이상 캐러셀.
 * 1장 이하는 이 컴포넌트를 쓰지 않는다(화면이 현행 정적 히어로를 그대로 렌더).
 *
 * - 가로 페이징 FlatList, 장마다 CardPhoto(원격 이미지 규칙 — 스켈레톤·실패 폴백 포함)
 * - 2초 자동 넘김(useAutoSlide) — 화면 blur·앱 background·reduce motion이면 멈춘다
 * - 하단 도트는 View로 그린다(이모지 금지), 히어로 안쪽 하단
 */
import * as React from 'react';
import { AccessibilityInfo, AppState, FlatList, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { CardPhoto } from '@/components';
import { color as C } from '@/lib/theme';
import { useAutoSlide } from './useAutoSlide';

/** 현재 장 도트 색 — 발주 "primary". 비활성은 ink 계열(사진 위 가독성 위해 ink3). */
export const DOT_ACTIVE = C.primary;
export const DOT_INACTIVE = C.ink3;
/** 손을 뗀 뒤 스크롤 이벤트가 이만큼 끊기면 스냅 완료로 본다(스로틀 16ms의 충분한 배수). */
export const QUIET_MS = 250;

/** 명시적으로 뒤로 간 경우만 멈춘다. 초기값이 null·'unknown'일 수 있어서(RN AppState는 네이티브
 *  상수가 오기 전 null로 시작) === 'active'로 판정하면 자동 넘김이 영영 시작 안 할 수 있다. */
const isForeground = (s: string | null | undefined) => s !== 'background' && s !== 'inactive';

function usePaused(): boolean {
  const [focused, setFocused] = React.useState(true);
  const [active, setActive] = React.useState(isForeground(AppState.currentState));
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(isForeground(s)));
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(!!v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return !focused || !active || reduceMotion;
}

export function HeroGallery({ urls, overlay }: { urls: string[]; /** 사진 위·도트 아래 레이어(그라데이션) */ overlay?: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const paused = usePaused();
  const { index, onUserSwipe, pause } = useAutoSlide(urls.length, paused);
  const listRef = React.useRef<FlatList<string>>(null);
  // 제스처 상태는 **손가락 기준 두 가지뿐**이다: 누르고 있나(touching), 뗐나(released).
  // Codex 2R~6R은 전부 "이 스크롤 이벤트가 사용자 것인가 타이머 것인가"를 분류하려다 난 경합이었다
  // (관성 콜백 유무·스로틀 순서·타이머 애니메이션의 늦은 종료 이벤트가 플랫폼마다 다르다).
  // 그래서 분류를 없앴다 — 재개는 **손을 뗀 뒤 스크롤이 멈춘 순간** 하나로만 일어난다.
  const touchingRef = React.useRef(false);
  const releasedRef = React.useRef(false);
  const offsetRef = React.useRef(0); // 최신 스크롤 오프셋
  const quietTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
  }, []);

  // 2장째부터 미리 받아 둔다(첫 장은 CardPhoto 스켈레톤 규칙 그대로)
  React.useEffect(() => {
    if (urls.length > 1) void Image.prefetch(urls.slice(1)).catch(() => {});
  }, [urls]);

  // 타이머가 넘긴 장으로 스크롤(사용자가 넘긴 경우엔 이미 그 위치라 사실상 무동작)
  // Codex P2(5R): 마지막 → 처음 순환을 애니메이션으로 스크롤하면 중간 장을 전부 **거꾸로**
  // 훑고 지나간다(도트는 이미 1번인데 화면은 뒤로 감기는 중). 순환 순간만 즉시 이동한다.
  const prevIndexRef = React.useRef(index);
  React.useEffect(() => {
    if (urls.length < 2) return;
    const wrapped = index === 0 && prevIndexRef.current === urls.length - 1;
    prevIndexRef.current = index;
    listRef.current?.scrollToOffset({ offset: index * width, animated: !wrapped });
  }, [index, width, urls.length]);

  /** 손을 뗀 뒤 스크롤 이벤트가 QUIET_MS 동안 없으면 = 스냅이 끝났다 → 그 자리에서 재개. */
  const armQuiet = () => {
    if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
    quietTimerRef.current = setTimeout(() => {
      if (!touchingRef.current || !releasedRef.current) return; // 새 드래그가 시작됐다
      touchingRef.current = false;
      releasedRef.current = false;
      const page = Math.round(offsetRef.current / width); // 스크롤이 멈춘 뒤라 최종 오프셋이다
      onUserSwipe(Math.max(0, Math.min(urls.length - 1, page)));
    }, QUIET_MS);
  };

  // **손가락이 닿는 순간** 멈춘다(Codex P2 7R) — 드래그 인식(onScrollBeginDrag)은 임계 거리를
  // 넘어야 오므로, 손을 올려만 두거나 조금만 움직이면 그 전에 틱이 화면을 끌어간다.
  // 드래그 인식도 같은 처리로 받는다(터치 이벤트가 네이티브 스크롤에 뺏기는 경우 대비).
  const press = () => {
    touchingRef.current = true;
    releasedRef.current = false;
    if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
    pause();
  };

  /** 손을 뗐다 — 드래그로 끝났든(오프셋 동반) 그냥 뗐든 같은 재개 경로. */
  const release = (offsetX?: number) => {
    if (typeof offsetX === 'number') offsetRef.current = offsetX; // 스로틀된 onScroll보다 최신(이후 스냅 이벤트가 덮는다)
    if (!touchingRef.current) return;
    releasedRef.current = true;
    armQuiet(); // 이후 스크롤이 전혀 없어도(경계에서 놓음·드래그 없이 뗌) 반드시 재개된다
  };

  const onDragEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => release(e.nativeEvent.contentOffset.x);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = e.nativeEvent.contentOffset.x;
    // 손을 뗀 뒤 스냅이 진행되는 동안에만 대기를 연장한다. 누르고 있는 중(released=false)의
    // 이벤트 — 타이머 애니메이션의 늦은 이벤트 포함 — 는 재개를 일으키지 않는다.
    if (touchingRef.current && releasedRef.current) armQuiet();
  };

  return (
    <View style={StyleSheet.absoluteFill} testID="detail-hero-gallery">
      <FlatList
        ref={listRef}
        data={urls}
        keyExtractor={(u, i) => `${i}-${u}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onTouchStart={press}
        onTouchEnd={() => release()}
        onTouchCancel={() => release()}
        onScrollBeginDrag={press}
        onScrollEndDrag={onDragEnd}
        renderItem={({ item }) => (
          <View style={{ width, height: '100%' }}>
            <CardPhoto uri={item} transition={200} borderRadius={0} />
          </View>
        )}
      />
      {overlay}
      <View style={styles.dots} pointerEvents="none" testID="detail-hero-dots">
        {urls.map((u, i) => (
          <View
            key={`${i}-${u}`}
            style={[styles.dot, { backgroundColor: i === index ? DOT_ACTIVE : DOT_INACTIVE }]}
            testID={i === index ? 'hero-dot-active' : 'hero-dot'}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 히어로 안쪽 하단 중앙 — 위험도 표시는 히어로 밖(본문)이라 겹치지 않는다
  dots: { position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  // 상태 전환은 색만 — 크기 고정(P-151 프레임 불변)
  dot: { width: 6, height: 6, borderRadius: 3 },
});

export default HeroGallery;
