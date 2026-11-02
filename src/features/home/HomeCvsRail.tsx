/**
 * KB-955(P-571, 예진 11/2): 홈 편의점 인기 가공식품 가로 줄 — Popular|Saved|Food 레일 바로 아래, 아이돌 픽·큐레이션 위.
 * 데이터 = Packaged 탭 둘러보기와 같은 쿼리(useProcessedSearch('') — 서버 대표 인기순, 같은 키 = 캐시 공유, verdictKey = 회피 반영) 첫 10개.
 * 카드 = Packaged ProductCard 그대로(리본 규칙·평점 줄 KB-947·948) · 폭 = 홈 음식 레일 카드(railCardW).
 * 로딩 = 카드 스켈레톤 · 실패·0개 = 섹션째 없음(가짜 빈 상태 금지). 노출 = home_section_view(section cvs) · 탭 = home_card_click(position·product_id).
 * 운영 채널(processedFoodEnabled off)은 호출측(홈)이 마운트하지 않는다.
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SectionHead } from '@/components/SectionHead';
import { SeeAllCircle } from '@/components/SeeAllCircle';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { useProcessedSearch } from '@/lib/data/useProcessedFoods';
import { ProductCard, ProductCardSkeleton } from '@/features/processedFood/PackagedExplorer';
import { RAIL_EDGE, RAIL_GAP, railCardW } from '@/features/food/railLayout';
import { trackHomeCardClick, useImpressionRef } from './homeImpressions';

export const CVS_RAIL_N = 10;

export function HomeCvsRail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = railCardW(width);
  const guest = useIsGuest();
  const { data: me } = useMe();
  // 리본 규칙 = Packaged 탭과 같음(회피 1개 이상 = 서버 판정 · 미설정 확인 = labelKnown일 때 safe · 프로필 대기 = 리본 0)
  const personalized = !guest && !!me && me.restrictions.length > 0;
  const unset = guest || (!!me && me.restrictions.length === 0);
  const q = useProcessedSearch('');
  const sectionRef = useImpressionRef('cvs');
  const items = (q.data ?? []).slice(0, CVS_RAIL_N);
  if (q.isError || (q.isSuccess && items.length === 0)) return null;
  return (
    <View ref={sectionRef} collapsable={false} testID="home-cvs-section">
      <View style={st.head}>
        <View style={st.headText}>
          <SectionHead label={t('packaged.segmentPackaged')} title={t('home.cvsTitle')} testID="home-cvs-head" />
        </View>
        {/* KB-962(예진 11/2): See all = 홈 공용 원형 화살표 버튼(탭 줄과 같은 부품) — 이동 = 음식 탭 Packaged */}
        <SeeAllCircle onPress={() => router.push(`/food?view=packaged&t=${Date.now()}` as Href)} style={st.seeAll} testID="home-cvs-see-all" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.rail} contentContainerStyle={st.railContent} testID="home-cvs-rail">
        {q.isPending
          ? [0, 1, 2].map((i) => <ProductCardSkeleton key={i} width={cardW} />)
          : items.map((item, i) => (
              <ProductCard
                key={item.id}
                item={item}
                width={cardW}
                personalized={personalized}
                unset={unset}
                onOpen={() => {
                  trackHomeCardClick('cvs', i, item.id);
                  router.push(`/processed-foods/${item.id}` as Href);
                }}
              />
            ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end' },
  headText: { flex: 1, minWidth: 0 },
  seeAll: { marginRight: RAIL_EDGE, marginBottom: 8, flexShrink: 0 }, // 제목 줄 아래쪽에 맞춤(SectionHead paddingBottom 8)
  rail: { flexGrow: 0 }, // P-319: 세로 목록 헤더 안 가로 ScrollView가 화면 높이만큼 늘어나지 않게
  railContent: { paddingHorizontal: RAIL_EDGE, gap: RAIL_GAP },
});
