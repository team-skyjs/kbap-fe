/**
 * CurationSection (KB-796, D-28 v2 B 채택안) — 홈 "Explore Korea" 큰 배너 3장 수동 슬라이드.
 * 375 기준 좌우 20 · 배너 폭 = 화면 − 40(335) · radius 16 · 배너 간 12 · 다음 장 가장자리 노출 · 아래 "1 / 3" 카운터 + 48 이전/다음 버튼.
 * 자동 회전 없음. 배너 전체 = 해당 모음 상세로.
 * KB-861(예진): 배너 = 모음 상세 장소 카드와 **같은 부품**(BlurCaptionCard) — 사진이 카드 전체 + 하단 점진 흐림 띠(8단·로딩 전 회색 0·페이드) 위
 * 흰 설명(지역 스타일, 위)·제목(이름 스타일, 아래 — 예진 결정: 홈 기존 순서) + 박스 없는 흰 chevron. 검정 제목 영역·흰 네모 화살표 박스 소멸. 흐림 띠 = 현재 장 ± 1장만 마운트(근접).
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
import { Shimmer } from '@/components/Skeleton';
import { Btn } from '@/components/Btn';
import { IconArrowLeft, IconChevron } from '@/components/icons';
import { color as C, font, radius } from '@/lib/theme';
import { useCurationCoverPrefetch, useCurationIndex, type CurationCard } from '@/lib/data/useCurations';
import { trackHomeCardClick, useImpressionRef } from '@/features/home/homeImpressions';
import { BlurCaptionCard, CARD_SPACER } from '@/features/curation/BlurCaptionCard';

export const BANNER_GUTTER = 20;
export const BANNER_GAP = 12;
/** 스켈레톤 높이 = 카드 기본 높이(사진 자리 236 + 캡션 64 = 300 — 상세 장소 카드와 같음) */
const BANNER_SKEL_H = CARD_SPACER + 64;

export function CurationSection() {
  const { t } = useTranslation();
  const q = useCurationIndex();
  const sectionRef = useImpressionRef(q.data?.published ? 'curation' : null);
  const bannerW = useWindowDimensions().width - BANNER_GUTTER * 2;
  // KB-931: 섹션이 공개 상태로 그려지면 상세 첫 화면 사진(모음당 2장 = 최대 6장)을 미리 받는다 — 진입 직후 카드 사진 대기 줄이기
  useCurationCoverPrefetch(q.data?.published ? q.data.cards.map((c) => c.key) : null);

  if (q.isPending) {
    // 첫 로딩 = 스켈레톤(공백 금지). 미게시로 판명되면 사라진다
    return (
      <View style={styles.section} testID="curation-skeleton">
        <Shimmer style={[styles.titleSkel]} />
        <Shimmer style={{ marginHorizontal: BANNER_GUTTER, width: bannerW, height: BANNER_SKEL_H, borderRadius: radius.lg }} />
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
          <View style={{ width: bannerW }}>
            <BlurCaptionCard
              photoUri={item.coverImageUrl || null}
              recyclingKey={item.key}
              title={item.title}
              subtitle={item.description}
              subtitleFirst /* 예진 결정(KB-861): 홈은 지금처럼 설명 위 · 제목 아래 */
              blur={Math.abs(i - index) <= 1 /* 근접 마운트(#320 규칙의 가로판) — 보이는 장 ± 1장 */}
              radius={radius.lg}
              onPress={() => open(item, i)}
              accessibilityLabel={`${item.title}, ${item.description}`}
              testPrefix="curation-banner"
              testKey={i}
              overlay={
                item.coverAttribution ? (
                  <Text style={styles.attribution} numberOfLines={1} testID={`curation-banner-attribution-${i}`} importantForAccessibility="no" accessibilityElementsHidden>
                    {item.coverAttribution}
                  </Text>
                ) : null
              }
            />
          </View>
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
  titleSkel: { marginHorizontal: BANNER_GUTTER, width: 160, height: 24, borderRadius: radius.xs },
  attribution: { position: 'absolute', top: 8, right: 10, left: 10, textAlign: 'right', fontFamily: font.body, fontSize: 12, lineHeight: 15, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: BANNER_GUTTER },
  counter: { fontFamily: font.body, fontSize: 16, color: C.ink2 },
  navBtns: { flexDirection: 'row', gap: 8 },
  navBtn: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  navBtnOff: { borderColor: C.line },
  errorBox: { marginHorizontal: BANNER_GUTTER, padding: 16, gap: 12, borderRadius: radius.md, backgroundColor: C.surface2 },
  errorText: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink2 },
  staleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, paddingHorizontal: BANNER_GUTTER, minHeight: 44 },
  staleText: { fontFamily: font.body, fontSize: 14, color: C.ink3 },
  staleRetry: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText },
});
