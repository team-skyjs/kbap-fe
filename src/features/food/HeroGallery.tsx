/**
 * HeroGallery (P-383/KB-566) — 음식 상세 히어로의 이미지 2장 이상 캐러셀.
 * 1장 이하는 이 컴포넌트를 쓰지 않는다(화면이 현행 정적 히어로를 그대로 렌더).
 *
 * - 가로 페이징 FlatList, 장마다 CardPhoto(원격 이미지 규칙 — 스켈레톤·실패 폴백 포함)
 * - 5초 자동 넘김(useAutoSlide) — 화면 blur·앱 background·reduce motion이면 멈춘다
 * - 자동 넘김 전환 = SLIDE_MS 동안 직접 그리는 이징 스크롤(플랫폼 animated 스크롤은 시간 조절 불가)
 * - 하단 도트는 View로 그린다(이모지 금지), 히어로 안쪽 하단
 */
import * as React from 'react';
import { Easing, FlatList, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { CardPhoto } from '@/components';
import { color as C, radius } from '@/lib/theme';
import { useAutoSlide } from './useAutoSlide';
import { useMotionPaused } from '@/lib/useMotionPaused';

/** 현재 장 도트 색 — 발주 "primary". 비활성은 ink 계열(사진 위 가독성 위해 ink3). */
export const DOT_ACTIVE = C.primary;
export const DOT_INACTIVE = C.ink3;
/** 손을 뗀 뒤 스크롤 이벤트가 이만큼 끊기면 스냅 완료로 본다(스로틀 16ms의 충분한 배수). */
export const QUIET_MS = 250;
/** KB-965(예진 11/5 실기): 자동 넘김 전환 시간 — 플랫폼 기본 animated 스크롤(~300ms, 시간 인자 없음)의 약 2배.
 *  ponytail: 프레임마다 JS가 scrollToOffset(animated:false) — UI 스레드 구동(reanimated scrollTo)은 끊김이 실기에서 보이면. */
export const SLIDE_MS = 600;
/** 이징 = 플랫폼 기본 페이지 스크롤과 같은 계열(가속 후 감속). 시간만 늘린다. */
const SLIDE_EASE = Easing.inOut(Easing.ease);

/** renderPage(KB-965) = 장 하나 그리기 — 없으면 CardPhoto(음식 상세 cover). 가공식품 상세는 누끼·실사진을 같은 바탕에 contain으로 */
export function HeroGallery({ urls, overlay, renderPage }: { urls: string[]; /** 사진 위·도트 아래 레이어(그라데이션) */ overlay?: React.ReactNode; renderPage?: (url: string, index: number) => React.ReactNode }) {
  const { width } = useWindowDimensions();
  const paused = useMotionPaused();
  // KB-965(P-609, 예진 11/5 실기 — 첫 장 뒤 장마다 ~2초 로딩): 들어오는 즉시 **전부** 미리 받고(장마다 따로 — 준비 시점을 장 단위로 안다),
  // 자동 넘김은 다음 장이 준비될 때까지 기다린다. 실패도 "준비"로 친다 — 깨진 장 하나에 캐러셀이 멈추지 않게(그 장은 CardPhoto 폴백).
  const [ready, setReady] = React.useState<ReadonlySet<string>>(() => new Set());
  const isReady = (i: number) => ready.has(urls[i]);
  const { index, onUserSwipe, pause, notifyReady } = useAutoSlide(urls.length, paused, isReady);
  const listRef = React.useRef<FlatList<string>>(null);
  // 제스처 상태는 **손가락 기준 두 가지뿐**이다: 누르고 있나(touching), 뗐나(released).
  // Codex 2R~6R은 전부 "이 스크롤 이벤트가 사용자 것인가 타이머 것인가"를 분류하려다 난 경합이었다
  // (관성 콜백 유무·스로틀 순서·타이머 애니메이션의 늦은 종료 이벤트가 플랫폼마다 다르다).
  // 그래서 분류를 없앴다 — 재개는 **손을 뗀 뒤 스크롤이 멈춘 순간** 하나로만 일어난다.
  const touchingRef = React.useRef(false);
  const releasedRef = React.useRef(false);
  const offsetRef = React.useRef(0); // 최신 스크롤 오프셋
  const quietTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideRef = React.useRef<number | null>(null); // 진행 중인 전환 프레임
  const stopSlide = () => {
    if (slideRef.current != null) cancelAnimationFrame(slideRef.current);
    slideRef.current = null;
  };

  React.useEffect(() => () => {
    if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
  }, []);

  React.useEffect(() => {
    if (urls.length < 2) return;
    let alive = true;
    const done = (u: string) => alive && setReady((s) => (s.has(u) ? s : new Set(s).add(u)));
    for (const u of urls) void Image.prefetch(u, 'memory-disk').then(() => done(u), () => done(u));
    return () => {
      alive = false;
    };
  }, [urls]);
  // 장이 준비될 때마다 — 기다리던 자동 넘김을 풀어 준다
  React.useEffect(() => {
    notifyReady();
  }, [ready, notifyReady]);

  // 타이머가 넘긴 장으로 스크롤(사용자가 넘긴 경우엔 이미 그 위치라 사실상 무동작)
  // Codex P2(5R): 마지막 → 처음 순환을 애니메이션으로 스크롤하면 중간 장을 전부 **거꾸로**
  // 훑고 지나간다(도트는 이미 1번인데 화면은 뒤로 감기는 중). 순환 순간만 즉시 이동한다.
  const prevIndexRef = React.useRef(index);
  React.useEffect(() => {
    if (urls.length < 2) return;
    const wrapped = index === 0 && prevIndexRef.current === urls.length - 1;
    prevIndexRef.current = index;
    const to = index * width;
    if (wrapped) {
      listRef.current?.scrollToOffset({ offset: to, animated: false });
      return;
    }
    // KB-965: SLIDE_MS 동안 이징으로 직접 그린다 — 사용자가 이미 그 장에 있으면(스와이프 안착) 그릴 게 없다
    const from = offsetRef.current;
    if (Math.abs(to - from) < 1) return;
    const t0 = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / SLIDE_MS);
      const x = from + (to - from) * SLIDE_EASE(p);
      offsetRef.current = x; // 다음 전환·재개 판단의 출발점(스로틀된 onScroll을 기다리지 않는다)
      listRef.current?.scrollToOffset({ offset: x, animated: false });
      slideRef.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    slideRef.current = requestAnimationFrame(step);
    return () => {
      if (slideRef.current != null) cancelAnimationFrame(slideRef.current);
      slideRef.current = null;
    };
  }, [index, width, urls.length]);

  /** 손을 뗀 뒤 스크롤 이벤트가 QUIET_MS 동안 없으면 = 스냅이 끝났다 → 그 자리에서 재개. */
  const armQuiet = () => {
    if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
    quietTimerRef.current = setTimeout(() => {
      if (!touchingRef.current || !releasedRef.current) return; // 새 드래그가 시작됐다
      touchingRef.current = false;
      releasedRef.current = false;
      const page = Math.max(0, Math.min(urls.length - 1, Math.round(offsetRef.current / width))); // 스크롤이 멈춘 뒤라 최종 오프셋이다
      // Codex #432 P2: 자동 전환을 절반 넘어 닿았다 떼면 가까운 장 = 이미 넘긴 index — setIndex가 같은 값이라 스크롤 effect가
      // 다시 안 돌아 두 장 사이에 멈춘다. 장 경계가 아니면 그 장으로 직접 맞춘다(사용자 놓음 = 네이티브 스냅 애니메이션).
      if (Math.abs(offsetRef.current - page * width) >= 1) {
        offsetRef.current = page * width;
        listRef.current?.scrollToOffset({ offset: page * width, animated: true });
      }
      onUserSwipe(page);
    }, QUIET_MS);
  };

  // **손가락이 닿는 순간** 멈춘다(Codex P2 7R) — 드래그 인식(onScrollBeginDrag)은 임계 거리를
  // 넘어야 오므로, 손을 올려만 두거나 조금만 움직이면 그 전에 틱이 화면을 끌어간다.
  // 드래그 인식도 같은 처리로 받는다(터치 이벤트가 네이티브 스크롤에 뺏기는 경우 대비).
  const press = () => {
    stopSlide(); // 전환 중에 닿으면 그 자리에서 손가락에 넘긴다
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
        // Codex P2(8R): 손가락마다 onTouchEnd가 온다 — 남은 손가락이 있으면 아직 누르고 있는 것
        onTouchEnd={(e) => {
          if ((e.nativeEvent.touches?.length ?? 0) === 0) release();
        }}
        onTouchCancel={() => release()}
        onScrollBeginDrag={press}
        onScrollEndDrag={onDragEnd}
        renderItem={({ item, index: i }) => (
          <View style={{ width, height: '100%' }}>
            {renderPage ? renderPage(item, i) : <CardPhoto uri={item} transition={200} borderRadius={0} />}
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
  dot: { width: 6, height: 6, borderRadius: radius.pill },
});

export default HeroGallery;
