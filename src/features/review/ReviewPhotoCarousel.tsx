/**
 * ReviewPhotoCarousel (KB-802) — 리뷰 탭 카드·리뷰 상세 공용 peek 캐러셀(02_designer_spec 화면 ②).
 *
 * - 2장 이상: 가로 FlatList(HeroGallery 구조) — 사진 311×233, 간격 8, snapToInterval 319(pagingEnabled 아님), 한 번에 한 장.
 *   스크롤 영역은 부모 패딩 20 을 넘어 화면 끝까지(marginHorizontal −20, 콘텐츠 인셋 20). 첫 장 = 다음 사진 peek,
 *   마지막 장 = 오른쪽 여백 20 에 붙고 이전 사진 peek. 자동 넘김·페이지 점 없음.
 * - 1장: 부모 폭(335) × 233 단일 사진, 배지 없음. 0장: null.
 * - "i/n" 배지는 **현재 장 아이템에만** 그린다(마지막 장에서 보이는 이전 사진에 배지 조각이 비치지 않게).
 * - 실패 폴백 = surface2 + IconGallery(CardPhoto 의 음식 기본 이미지는 리뷰 사진처럼 보여 쓰지 않는다).
 * - 셀 재사용 리셋은 부모가 key={review.id} 로 한다.
 */
import * as React from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { RemoteImage } from '@/components/RemoteImage';
import { IconGallery } from '@/components';
import { color as C, radius, type as type_ } from '@/lib/theme';

export const PHOTO_W = 311; // 375 디자인 캔버스 기준 최대 폭
export const PHOTO_H = 233;
export const PHOTO_GAP = 8;
const INSET = 20; // 카드·상세 좌우 패딩(스크롤 영역 인셋)
const PEEK = 36; // 다음(이전) 사진이 보이는 폭

/** 화면 폭 → 사진 폭·스냅 간격. 375 이상 = 311/319(디자인 수치), 좁은 화면(320 등) = 인셋 20 + 간격 8 + peek 36 을 남기고 줄인다. */
export function carouselMetrics(viewportW: number): { photoW: number; snap: number } {
  const photoW = Math.min(PHOTO_W, viewportW - INSET - PHOTO_GAP - PEEK);
  return { photoW, snap: photoW + PHOTO_GAP };
}

/** 장 i 의 스크롤 오프셋 — 마지막 장은 콘텐츠 끝(오른쪽 여백 20)에서 멈추도록 클램프. viewportW = 스크롤 영역 폭(화면 폭). */
export function snapOffset(i: number, n: number, viewportW: number, photoW: number): number {
  const contentW = INSET * 2 + photoW * n + PHOTO_GAP * (n - 1);
  return Math.min((photoW + PHOTO_GAP) * i, Math.max(0, contentW - viewportW));
}

/** 오프셋 → 현재 장(끝 클램프 때문에 마지막 장 오프셋이 snap·(n−1) 보다 작아도 반올림으로 n−1). */
export function snapIndex(offsetX: number, n: number, snap: number): number {
  return Math.max(0, Math.min(n - 1, Math.round(offsetX / snap)));
}

function Photo({ uri, width }: { uri: string; width: number | '100%' }) {
  const [failed, setFailed] = React.useState(false);
  const box = { width, height: PHOTO_H, borderRadius: radius.sm };
  if (failed) {
    return (
      <View style={[box, styles.fallback]} testID="review-photo-fallback">
        <IconGallery size={24} color={C.inkDisabled} />
      </View>
    );
  }
  return <RemoteImage uri={uri} style={[box, { backgroundColor: C.surface2 }]} onError={() => setFailed(true)} />;
}

function Badge({ index, total }: { index: number; total: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.badge} pointerEvents="none" testID="review-photo-badge">
      <Text style={styles.badgeText}>{t('reviews.photoCount', { index: index + 1, total })}</Text>
    </View>
  );
}

export function ReviewPhotoCarousel({
  photos,
  initialIndex = 0,
  onIndexChange,
  onPressPhoto,
  a11yLabel,
  testID = 'review-photos',
}: {
  photos: string[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onPressPhoto: (index: number) => void;
  /** 상세 전용 — 캐러셀 전체를 adjustable 접근성 요소 하나로. 리스트는 부모가 통째로 숨겨 생략. */
  a11yLabel?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { width: winW } = useWindowDimensions();
  const n = photos.length;
  const { photoW, snap } = carouselMetrics(winW);
  const start = Math.max(0, Math.min(n - 1, initialIndex));
  const [rawIndex, setIndex] = React.useState(start);
  // initialIndex 가 바뀌면 그 장으로(렌더 중 전환 비교 — KB-603 패턴)
  const [prevStart, setPrevStart] = React.useState(start);
  if (start !== prevStart) {
    setPrevStart(start);
    setIndex(start);
  }
  // 갱신으로 사진이 줄면(3→2) 배지·접근성 값·activate 가 없는 장을 가리키지 않게 클램프
  const index = Math.max(0, Math.min(rawIndex, n - 1));
  const listRef = React.useRef<FlatList<string>>(null);
  const mountedStart = React.useRef(start);
  React.useEffect(() => {
    if (start === mountedStart.current) return; // 첫 장은 initialScrollIndex 가 맞춘다
    mountedStart.current = start;
    listRef.current?.scrollToOffset({ offset: snapOffset(start, n, winW, photoW), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialIndex 변경에만 반응(폭·장수 변화는 스냅이 처리)
  }, [start]);

  if (n === 0) return null;

  if (n === 1) {
    // 1장 = 넘길 장이 없다 — adjustable·increment/decrement 를 내보이지 않고 버튼(activate)만
    const single = a11yLabel
      ? { accessible: true, accessibilityRole: 'button' as const, accessibilityLabel: a11yLabel, accessibilityActions: [{ name: 'activate' as const }] }
      : {};
    return (
      <View {...single} onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onPressPhoto(0)} testID={testID}>
        <Pressable onPress={() => onPressPhoto(0)} testID={`${testID}-0`}>
          {/* URI 키 = 사진이 바뀌면 실패 상태도 새로 시작 */}
          <Photo key={photos[0]} uri={photos[0]} width="100%" />
        </Pressable>
      </View>
    );
  }

  const a11y = a11yLabel
    ? {
        accessible: true,
        accessibilityRole: 'adjustable' as const,
        accessibilityLabel: a11yLabel,
        accessibilityValue: { text: t('reviews.photoCount', { index: index + 1, total: n }) },
        accessibilityActions: [{ name: 'increment' as const }, { name: 'decrement' as const }, { name: 'activate' as const }],
      }
    : {};

  const go = (i: number) => {
    setIndex(i);
    onIndexChange?.(i);
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = snapIndex(e.nativeEvent.contentOffset.x, n, snap);
    if (i !== index) go(i);
  };
  const step = (d: number) => {
    const i = Math.max(0, Math.min(n - 1, index + d));
    listRef.current?.scrollToOffset({ offset: snapOffset(i, n, winW, photoW), animated: true });
    go(i);
  };

  return (
    <View
      {...a11y}
      onAccessibilityAction={(e) => {
        const name = e.nativeEvent.actionName;
        if (name === 'increment') step(1);
        else if (name === 'decrement') step(-1);
        else if (name === 'activate') onPressPhoto(index);
      }}
      testID={testID}
    >
      <FlatList
        ref={listRef}
        data={photos}
        extraData={index}
        horizontal
        keyExtractor={(u, i) => `${i}-${u}`}
        style={styles.list}
        contentContainerStyle={styles.content}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, i) => ({ length: snap, offset: snapOffset(i, n, winW, photoW), index: i })}
        initialScrollIndex={start}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        testID={`${testID}-list`}
        renderItem={({ item, index: i }) => (
          <Pressable onPress={() => onPressPhoto(i)} testID={`${testID}-${i}`}>
            <Photo uri={item} width={photoW} />
            {i === index && <Badge index={i} total={n} />}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: -INSET, height: PHOTO_H },
  content: { paddingHorizontal: INSET, gap: PHOTO_GAP },
  fallback: { backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { ...type_.newBadge, color: '#FFFFFF' },
});

export default ReviewPhotoCarousel;
