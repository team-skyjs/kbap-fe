/**
 * CurationSection (KB-796, D-28 v2 B 채택안) — 홈 "Explore Korea" 큰 배너 3장 수동 슬라이드.
 * 375 기준 좌우 20 · 배너 폭 = 화면 − 40(335) · 사진 335×220 비율 · 제목 영역 최소 144(내용 따라 증가) · radius 16 · 배너 간 12 ·
 * 다음 장 가장자리 노출 · 아래 "1 / 3" 카운터 + 48 이전/다음 버튼. 자동 회전 없음. 배너 전체 = 해당 모음 상세로.
 *
 * 상태(FE 인계서): 미게시(또는 3장 아님) = 섹션 통째 숨김 · 첫 로딩 = 스켈레톤 · 실패·캐시 없음 = 작은 오류 + 다시 시도(미게시와 구별) ·
 * 실패·캐시 있음 = 3장 유지 + 갱신 실패 한 줄 · 이미지 실패 = 회색 사진 영역 유지(제목·이동 그대로).
 * 계측: 섹션 노출(home_section_view section=curation) · 배너 클릭(home_card_click section=curation, collection_key).
 */
import * as React from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'react-native-reanimated';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { RemoteImage } from '@/components/RemoteImage';
import { Shimmer } from '@/components/Skeleton';
import { Btn } from '@/components/Btn';
import { IconArrowLeft, IconChevron } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { useCurationIndex, type CurationCard } from '@/lib/data/useCurations';
import { trackHomeCardClick, useImpressionRef } from '@/features/home/homeImpressions';

export const BANNER_GUTTER = 20;
export const BANNER_GAP = 12;
export const BANNER_PHOTO_RATIO = 220 / 335;
const TITLE_MIN_H = 144;
const INK_900 = '#2F3137'; // 시안 gray-900(제목 영역 바탕 — FeedCard INK_TITLE과 같은 값)

export function CurationSection() {
  const { t } = useTranslation();
  const q = useCurationIndex();
  const sectionRef = useImpressionRef(q.data?.published ? 'curation' : null);
  const bannerW = useWindowDimensions().width - BANNER_GUTTER * 2;

  if (q.isPending) {
    // 첫 로딩 = 스켈레톤(공백 금지). 미게시로 판명되면 사라진다
    return (
      <View style={styles.section} testID="curation-skeleton">
        <Shimmer style={[styles.titleSkel]} />
        <Shimmer style={{ marginHorizontal: BANNER_GUTTER, width: bannerW, height: bannerW * BANNER_PHOTO_RATIO + TITLE_MIN_H, borderRadius: 16 }} />
      </View>
    );
  }
  if (q.isError && !q.data) {
    // 조회 실패·캐시 없음 — 미게시와 구별되는 작은 오류 + 다시 시도
    return (
      <View style={styles.section} testID="curation-error">
        <Text style={styles.title} accessibilityRole="header">{t('curation.sectionTitle')}</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t('curation.loadError')}</Text>
          <Btn variant="ghost" onPress={() => void q.refetch()} testID="curation-retry">{t('common.tryAgain')}</Btn>
        </View>
      </View>
    );
  }
  if (!q.data?.published) return null; // 최초 공개 전·내림·3장 아님 = 섹션 숨김
  return (
    <View ref={sectionRef} collapsable={false} style={styles.section} testID="curation-section">
      <Text style={styles.title} accessibilityRole="header">{t('curation.sectionTitle')}</Text>
      <BannerRail cards={q.data.cards} bannerW={bannerW} />
      {q.isError && (
        // 갱신 실패·캐시 있음 — 3장 유지 + 한 줄 안내(누르면 다시 시도)
        <Pressable onPress={() => void q.refetch()} style={styles.staleRow} testID="curation-stale-retry" accessibilityRole="button">
          <Text style={styles.staleText}>{t('curation.refreshFailed')}</Text>
          <Text style={styles.staleRetry}>{t('common.tryAgain')}</Text>
        </Pressable>
      )}
    </View>
  );
}

function BannerRail({ cards, bannerW }: { cards: CurationCard[]; bannerW: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const reduced = useReducedMotion();
  const listRef = React.useRef<FlatList<CurationCard>>(null);
  const [index, setIndex] = React.useState(0);
  const step = bannerW + BANNER_GAP;
  const go = (next: number) => {
    const i = Math.max(0, Math.min(cards.length - 1, next));
    setIndex(i);
    listRef.current?.scrollToOffset({ offset: i * step, animated: !reduced });
  };
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.max(0, Math.min(cards.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))));
  };
  const open = (card: CurationCard, i: number) => {
    trackHomeCardClick('curation', i, card.key);
    router.push(`/curations/${encodeURIComponent(card.key)}` as Href);
  };
  return (
    <>
      <FlatList
        ref={listRef}
        data={cards}
        keyExtractor={(c) => c.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: BANNER_GUTTER, gap: BANNER_GAP }}
        onMomentumScrollEnd={onSettle}
        getItemLayout={(_d, i) => ({ length: step, offset: step * i, index: i })}
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => open(item, i)}
            style={[styles.banner, { width: bannerW }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.description}`}
            testID={`curation-banner-${i}`}
          >
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <RemoteImage uri={item.coverImageUrl} style={[styles.photo, { width: bannerW, height: bannerW * BANNER_PHOTO_RATIO }]} recyclingKey={item.key} />
            </View>
            <View style={styles.titleArea}>
              <View style={styles.titleText}>
                <Text style={styles.bannerDesc}>{item.description}</Text>
                <Text style={styles.bannerTitle}>{item.title}</Text>
              </View>
              <View style={styles.bannerGo} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <IconChevron size={20} color={C.ink} />
              </View>
            </View>
            {item.coverAttribution && <Text style={styles.attribution} numberOfLines={1} testID={`curation-banner-attribution-${i}`}>{item.coverAttribution}</Text>}
          </Pressable>
        )}
        testID="curation-rail"
      />
      <View style={styles.controls}>
        <Text style={styles.counter} testID="curation-counter">{`${index + 1} / ${cards.length}`}</Text>
        <View style={styles.navBtns}>
          <Pressable
            onPress={() => go(index - 1)}
            disabled={index === 0}
            style={[styles.navBtn, index === 0 && styles.navBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={t('curation.prev')}
            accessibilityState={{ disabled: index === 0 }}
            testID="curation-prev"
          >
            <IconArrowLeft size={20} color={index === 0 ? C.inkDisabled : C.ink} />
          </Pressable>
          <Pressable
            onPress={() => go(index + 1)}
            disabled={index === cards.length - 1}
            style={[styles.navBtn, index === cards.length - 1 && styles.navBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={t('curation.next')}
            accessibilityState={{ disabled: index === cards.length - 1 }}
            testID="curation-next"
          >
            <IconChevron size={20} color={index === cards.length - 1 ? C.inkDisabled : C.ink} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28, gap: 16 },
  title: { paddingHorizontal: BANNER_GUTTER, fontFamily: font.bodyBold, fontSize: 20, lineHeight: 28, color: C.ink },
  titleSkel: { marginHorizontal: BANNER_GUTTER, width: 160, height: 24, borderRadius: 4 },
  banner: { borderRadius: 16, overflow: 'hidden', backgroundColor: INK_900 },
  photo: { backgroundColor: C.surface2 },
  titleArea: { minHeight: TITLE_MIN_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 20 },
  titleText: { flex: 1, gap: 6 },
  bannerDesc: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: '#FFFFFF', opacity: 0.85 },
  bannerTitle: { fontFamily: font.bodyBold, fontSize: 24, lineHeight: 32, color: '#FFFFFF' },
  bannerGo: { width: 48, height: 48, borderRadius: 4, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  attribution: { position: 'absolute', top: 8, right: 10, left: 10, textAlign: 'right', fontFamily: font.body, fontSize: 11, lineHeight: 14, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: BANNER_GUTTER },
  counter: { fontFamily: font.body, fontSize: 14, color: C.ink2 },
  navBtns: { flexDirection: 'row', gap: 8 },
  navBtn: { width: 48, height: 48, borderRadius: 4, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  navBtnOff: { borderColor: C.line },
  errorBox: { marginHorizontal: BANNER_GUTTER, padding: 16, gap: 12, borderRadius: 12, backgroundColor: C.surface2 },
  errorText: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: C.ink2 },
  staleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, paddingHorizontal: BANNER_GUTTER, minHeight: 44 },
  staleText: { fontFamily: font.body, fontSize: 13, color: C.ink3 },
  staleRetry: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
});
