/**
 * 큐레이션 항목 사진 갤러리 바텀시트 (KB-832, D-29 v5 Gallery 12344:30633~31193).
 * - 화면 위 64부터 바닥까지(시안 375×812 = 높이 748), 사진 영역 = 시트의 68%(시안 510) 가로 스와이프 페이저(네이티브 페이징 스냅, 양방향, 장수 가변).
 * - 사진 하단 가운데 점 인디케이터(KB-846 — 1장이면 숨김·스와이프 없음) · 이름 · 지역 · 소개 최대 4줄 · 현재 사진의 출처(없으면 숨김) · Outline Guide.
 * - KB-846: 닫기 = 그래버(위 가운데 바)를 아래로 끌기(시트 높이 25% 또는 속도 임계) · 배경 탭 · 뒤로가기. X 버튼 없음.
 *   아래 텍스트 영역은 스크롤 없이 고정 — 시트 높이 = 콘텐츠(짧은 화면·큰 글씨면 사진이 줄어 Guide가 늘 보인다).
 * - Guide = 인앱 브라우저(openWebPage) — 시트는 닫지 않는다(돌아오면 같은 사진·같은 시트). 닫기 = 목록 그대로(스크롤 유지 — 화면은 언마운트되지 않음).
 * - 사진 0장 = 플레이스홀더 1장.
 * 접근성: 열리면 그래버(닫기 버튼 역할 — 스크린리더 활성화로 닫힘)에 포커스, 페이저에 이전/다음 사진 대체 액션, 시트 escape 제스처 = 닫기.
 */
import * as React from 'react';
import { AccessibilityInfo, findNodeHandle, FlatList, Modal, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { RemoteImage } from '@/components/RemoteImage';
import { color as C, font } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';
import { openWebPage } from '@/lib/openExternal';
import type { CurationItem } from '@/lib/data/useCurations';

export const SHEET_TOP = 64;
export const PHOTO_SHARE = 510 / 748; // 시안: 사진 510 / 시트 748
/** 끌어 닫기 임계(KB-846) — 시트 높이의 25% 이상 또는 아래로 빠르게(속도 px/s) */
export const DISMISS_SHARE = 0.25;
export const DISMISS_VELOCITY = 1000;
export const INTRO_MAX_LINES = 4;
export const shouldDismiss = (translationY: number, velocityY: number, sheetH: number): boolean =>
  translationY >= sheetH * DISMISS_SHARE || (velocityY >= DISMISS_VELOCITY && translationY > 0);

export function CurationGallerySheet({ item, listKey, area, onClose }: { item: CurationItem | null; listKey: string; area: string; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef<FlatList<CurationItem['images'][number] | null>>(null);
  const grabRef = React.useRef<View>(null);
  const [pagerH, setPagerH] = React.useState<number | null>(null); // 짧은 화면·큰 글씨에서 사진 영역이 줄면 실제 높이로 페이지를 맞춘다
  // 끌어 닫기 — 콜백은 JS 스레드(runOnJS(true), 레포 제스처 관례 — HomeQuotaBadge). 공유값 .get()/.set()(컴파일러 호환)
  const dragY = useSharedValue(0);
  const sheetMeasured = useSharedValue(0); // 실제 시트 높이(콘텐츠 맞춤) — 제스처 콜백에서 읽는다(ref면 렌더 중 읽기로 잡힘)

  // 다른 항목으로 열리면 첫 사진부터(렌더 중 전이 비교 — KB-603)
  const itemKey = item?.id ?? null;
  const [prevKey, setPrevKey] = React.useState(itemKey);
  if (itemKey !== prevKey) {
    setPrevKey(itemKey);
    setIndex(0);
  }

  const sheetH = height - SHEET_TOP; // 최대 높이(시트는 콘텐츠에 맞춰 이보다 작을 수 있다)
  const photoH = Math.round(sheetH * PHOTO_SHARE);
  const pageH = pagerH ?? photoH;
  const images = item ? (item.images.length ? item.images : [null]) : [];
  const count = images.length;
  const current = images[index] ?? null;

  const go = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i));
    if (next === index) return;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
    if (item) track(EVENTS.home_curation_gallery_swipe, { collection_key: listKey, entry_id: item.id, index: next });
  };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < count) {
      setIndex(i);
      if (item) track(EVENTS.home_curation_gallery_swipe, { collection_key: listKey, entry_id: item.id, index: i });
    }
  };
  const openGuide = () => {
    if (!item) return;
    track(EVENTS.home_curation_link_click, { collection_key: listKey, position: item.position });
    void openWebPage(item.externalUrl); // 시트 유지 — 브라우저에서 돌아오면 같은 자리
  };
  const onShow = () => {
    dragY.set(0);
    const node = findNodeHandle(grabRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };
  // 세로 끌기는 그래버 띠(사진 위쪽)에서만 시작 — 사진 캐러셀의 가로 스와이프와 겹치지 않는다(가로로 먼저 움직이면 실패)
  const drag = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(8)
    .failOffsetX([-12, 12])
    .onUpdate((e) => dragY.set(Math.max(0, e.translationY)))
    .onEnd((e, success) => {
      if (success && shouldDismiss(e.translationY, e.velocityY, sheetMeasured.get() || sheetH)) onClose();
      else dragY.set(withSpring(0, { damping: 20, stiffness: 220 }));
    })
    .onFinalize((_e, success) => {
      if (!success) dragY.set(withSpring(0, { damping: 20, stiffness: 220 })); // 취소(OS 끼어들기) = 제자리
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.get() }] }));

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose} onShow={onShow} statusBarTranslucent>
      {/* Modal은 루트 GestureHandlerRootView 밖(Android) — 자체 루트 필수(community/compose 같은 이유) */}
      <GestureHandlerRootView style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} testID="curation-gallery-backdrop" />
        {item && (
          <Animated.View
            style={[st.sheet, { maxHeight: sheetH }, sheetStyle]}
            onLayout={(e) => sheetMeasured.set(e.nativeEvent.layout.height)}
            testID="curation-gallery"
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
          >
            <View style={{ height: photoH, flexShrink: 1 }} onLayout={(e) => setPagerH(Math.round(e.nativeEvent.layout.height))} testID="curation-gallery-photo">
              <FlatList
                ref={listRef}
                data={images}
                horizontal
                pagingEnabled
                scrollEnabled={count > 1}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(img, i) => img?.url ?? `none-${i}`}
                getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                onMomentumScrollEnd={onMomentumEnd}
                accessible={count > 1}
                accessibilityRole={count > 1 ? 'adjustable' : undefined}
                accessibilityLabel={item.name}
                accessibilityValue={count > 1 ? { text: `${index + 1} / ${count}` } : undefined}
                accessibilityActions={count > 1 ? [{ name: 'increment', label: t('curation.nextPhoto') }, { name: 'decrement', label: t('curation.prevPhoto') }] : undefined}
                onAccessibilityAction={(e) => go(e.nativeEvent.actionName === 'increment' ? index + 1 : index - 1)}
                testID="curation-gallery-pager"
                renderItem={({ item: img }) => (
                  <View style={{ width, height: pageH }}>
                    {img ? (
                      <RemoteImage uri={img.url} style={st.fill} recyclingKey={img.url} />
                    ) : (
                      <View style={[st.fill, st.noPhoto]} testID="curation-gallery-nophoto">
                        <Text style={st.noPhotoText}>{t('curation.photoUnavailable')}</Text>
                      </View>
                    )}
                  </View>
                )}
              />
              {/* 그래버 띠 — 아래로 끌면 닫힘. 스크린리더 = "닫기" 버튼(활성화로 닫힘), 눈으로 탭하면 아무 일 없음(끌기 전용) */}
              <GestureDetector gesture={drag}>
                <View
                  ref={grabRef}
                  style={st.grabZone}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  accessibilityActions={[{ name: 'activate' }]}
                  onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'activate') onClose(); }}
                  testID="curation-gallery-grabber"
                >
                  <View style={st.handle} />
                </View>
              </GestureDetector>
              {/* KB-846: 숫자 카운터 → 점(Expedia). 1장이면 숨김 · 스크린리더 값은 페이저의 "n / 3" */}
              {count > 1 && (
                <View style={st.dots} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID="curation-gallery-dots">
                  {images.map((img, i) => (
                    <View key={img?.url ?? `dot-${i}`} style={[st.dot, i === index ? st.dotOn : st.dotOff]} testID={i === index ? 'curation-gallery-dot-on' : 'curation-gallery-dot'} />
                  ))}
                </View>
              )}
            </View>
            {/* KB-846: 본문 고정(스크롤·바운스 없음) — 소개 최대 4줄. 짧은 화면·큰 글씨는 위 사진 영역이 줄어(flexShrink) Guide가 가려지지 않는다 */}
            <View style={[st.body, { paddingBottom: Math.max(insets.bottom, 16) }]} testID="curation-gallery-body">
              <Text style={st.name} accessibilityRole="header">{item.name}</Text>
              <Text style={st.area}>{area}</Text>
              <Text style={st.intro} numberOfLines={INTRO_MAX_LINES} testID="curation-gallery-intro">{item.introduction}</Text>
              {!!current?.attribution && <Text style={st.credit} testID="curation-gallery-credit">{current.attribution}</Text>}
              <Btn
                variant="ghost"
                onPress={openGuide}
                style={st.guide}
                accessibilityLabel={t('curation.viewGuideA11y', { name: item.name })}
                accessibilityHint={t('curation.viewGuideHint')}
                testID="curation-gallery-guide"
              >
                {t('curation.guide')}
              </Btn>
            </View>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

// 시안 실측(2x PNG): 시트 top 64 · 위 모서리 24 · 핸들 36×4(위 12) · 본문 pad 20, 사진→이름 16, 이후 8 간격 · 이름 24 bold · 지역 13 gray-700 · 소개 15/21 · 출처 13 gray-700 · Guide 44
// KB-846: 점 인디케이터 = 사진 하단 가운데(아래 16) · 지름 6 · 간격 8 · 활성 흰 · 비활성 흰 40% · 그래버 띠 = 사진 위쪽 전폭 44(끌기 시작 영역)
const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  fill: { width: '100%', height: '100%', backgroundColor: C.surface2 },
  noPhoto: { backgroundColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { fontFamily: font.body, fontSize: 13, lineHeight: 20, color: C.ink2 },
  handle: { position: 'absolute', top: 12, alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.line2 }, // 그래버 띠 안(띠 기준 위 12 = 시트 기준 그대로)
  grabZone: { position: 'absolute', top: 0, left: 0, right: 0, height: 44 },
  dots: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { backgroundColor: C.card },
  dotOff: { backgroundColor: C.card, opacity: 0.4 },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  name: { fontFamily: font.bodyBold, fontSize: 24, lineHeight: 32, color: C.ink },
  area: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  intro: { fontFamily: font.body, fontSize: 15, lineHeight: 21, color: C.ink },
  credit: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  guide: { minHeight: 44, paddingVertical: 8, marginTop: 4 },
});
