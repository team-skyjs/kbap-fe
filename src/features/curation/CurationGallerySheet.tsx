/**
 * 큐레이션 항목 사진 갤러리 바텀시트 (KB-832, D-29 v5 Gallery 12344:30633~31193).
 * - 화면 위 64부터 바닥까지(시안 375×812 = 높이 748), 사진 영역 = 시트의 68%(시안 510) 가로 스와이프 페이저(네이티브 페이징 스냅, 양방향, 장수 가변).
 * - 사진 아래 가운데 카운터 "2 / 3"(1장이면 숨김·스와이프 없음) · 이름 · 지역 · 소개 2줄 · 현재 사진의 출처(없으면 숨김) · Outline Guide.
 * - Guide = 인앱 브라우저(openWebPage) — 시트는 닫지 않는다(돌아오면 같은 사진·같은 시트). 닫기 = 목록 그대로(스크롤 유지 — 화면은 언마운트되지 않음).
 * - 사진 0장 = 플레이스홀더 1장.
 * 접근성: 열리면 닫기 버튼에 포커스, 페이저에 이전/다음 사진 대체 액션(스와이프 못 하는 스크린리더 사용자).
 */
import * as React from 'react';
import { AccessibilityInfo, findNodeHandle, FlatList, Modal, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { RemoteImage } from '@/components/RemoteImage';
import { IconClose } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';
import { openWebPage } from '@/lib/openExternal';
import type { CurationItem } from '@/lib/data/useCurations';

export const SHEET_TOP = 64;
export const PHOTO_SHARE = 510 / 748; // 시안: 사진 510 / 시트 748

export function CurationGallerySheet({ item, listKey, area, onClose }: { item: CurationItem | null; listKey: string; area: string; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef<FlatList<CurationItem['images'][number] | null>>(null);
  const closeRef = React.useRef<View>(null);

  // 다른 항목으로 열리면 첫 사진부터(렌더 중 전이 비교 — KB-603)
  const itemKey = item?.id ?? null;
  const [prevKey, setPrevKey] = React.useState(itemKey);
  if (itemKey !== prevKey) {
    setPrevKey(itemKey);
    setIndex(0);
  }

  const sheetH = height - SHEET_TOP;
  const photoH = Math.round(sheetH * PHOTO_SHARE);
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
    const node = findNodeHandle(closeRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose} onShow={onShow} statusBarTranslucent>
      <View style={st.backdrop}>
        {item && (
          <View style={[st.sheet, { height: sheetH }]} testID="curation-gallery" accessibilityViewIsModal>
            <View style={{ height: photoH }}>
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
                  <View style={{ width, height: photoH }}>
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
              <View style={st.handle} pointerEvents="none" />
              {count > 1 && (
                <Text style={st.counter} pointerEvents="none" testID="curation-gallery-counter">{`${index + 1} / ${count}`}</Text>
              )}
              <Pressable ref={closeRef} style={st.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} testID="curation-gallery-close">
                <IconClose size={24} color={C.ink} />
              </Pressable>
            </View>
            {/* Codex #309 P2: 짧은 화면(667)·큰 글씨에선 사진 68% 아래 공간이 본문보다 작다 — 본문을 스크롤로(Guide 잘림·도달 불가 0) */}
            <ScrollView style={st.bodyScroll} contentContainerStyle={[st.body, { paddingBottom: Math.max(insets.bottom, 16) }]} testID="curation-gallery-body">
              <Text style={st.name} accessibilityRole="header">{item.name}</Text>
              <Text style={st.area}>{area}</Text>
              <Text style={st.intro} numberOfLines={2}>{item.introduction}</Text>
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
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

// 시안 실측(2x PNG): 시트 top 64 · 위 모서리 24 · 핸들 36×4(위 12) · 닫기 44 흰 박스(보더 gray-300, 시트 기준 left 16·top 24)
// · 카운터 사진 아래 가운데 16 위 · 본문 pad 20, 사진→이름 16, 이후 8 간격 · 이름 24 bold · 지역 13 gray-700 · 소개 15/21 · 출처 13 gray-700 · Guide 44
const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  fill: { width: '100%', height: '100%', backgroundColor: C.surface2 },
  noPhoto: { backgroundColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { fontFamily: font.body, fontSize: 13, lineHeight: 20, color: C.ink2 },
  handle: { position: 'absolute', top: 12, alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.line2 },
  close: { position: 'absolute', top: 24, left: 16, width: 44, height: 44, borderRadius: 4, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', bottom: 16, alignSelf: 'center', fontFamily: font.bodySemi, fontSize: 14, lineHeight: 20, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
  bodyScroll: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  name: { fontFamily: font.bodyBold, fontSize: 24, lineHeight: 32, color: C.ink },
  area: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  intro: { fontFamily: font.body, fontSize: 15, lineHeight: 21, color: C.ink },
  credit: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  guide: { minHeight: 44, paddingVertical: 8, marginTop: 4 },
});
