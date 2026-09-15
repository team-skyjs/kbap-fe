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
  const draggingRef = React.useRef(false);
  const momentumRef = React.useRef(false);
  const settleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  // 2장째부터 미리 받아 둔다(첫 장은 CardPhoto 스켈레톤 규칙 그대로)
  React.useEffect(() => {
    if (urls.length > 1) void Image.prefetch(urls.slice(1)).catch(() => {});
  }, [urls]);

  // 타이머가 넘긴 장으로 스크롤(사용자가 넘긴 경우엔 이미 그 위치라 사실상 무동작)
  React.useEffect(() => {
    if (urls.length < 2) return;
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
  }, [index, width, urls.length]);

  /** 사용자 제스처가 안착한 장으로 맞추고 타이머 재개. */
  const settle = (offsetX: number) => {
    draggingRef.current = false;
    momentumRef.current = false;
    const page = Math.round(offsetX / width);
    onUserSwipe(Math.max(0, Math.min(urls.length - 1, page)));
  };

  // Codex P2: 드래그 **시작 순간** 멈춘다 — 틱이 제스처·관성 도중 scrollToOffset을 쏘면
  // 사용자가 고르던 장에서 화면이 끌려간다.
  const onDragBegin = () => {
    draggingRef.current = true;
    momentumRef.current = false;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    pause();
  };

  // 관성 없이 손을 떼는 경우엔 onMomentumScrollEnd가 안 온다 → 잠깐 기다려 관성이 시작되지
  // 않으면 여기서 안착 처리(안 그러면 타이머가 멈춘 채 영영 재개되지 않는다)
  const onDragEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      if (draggingRef.current && !momentumRef.current) settle(x);
    }, 150);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // 프로그램 스크롤(타이머)은 드래그 없이 끝나므로 사용자 스와이프로 세지 않는다
    if (!draggingRef.current) return;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settle(e.nativeEvent.contentOffset.x);
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
        onScrollBeginDrag={onDragBegin}
        onScrollEndDrag={onDragEnd}
        onMomentumScrollBegin={() => {
          momentumRef.current = true;
        }}
        onMomentumScrollEnd={onMomentumEnd}
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
