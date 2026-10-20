/**
 * 큐레이션 모음 상세 (KB-796, D-29 공통 템플릿) — `/curations/[key]`.
 * 표지(+ 출처 캡션은 있을 때만) · 설명 · 항목 10개(position 순): 사진 335:176(+ 출처 캡션 있을 때만 사진 아래 회색 한 줄) ·
 * 이름 · 지역 · 소개 · 선정 이유 · 주변(역 모음만 — 일반 텍스트 줄바꿈) · 외부 링크 버튼 1개("View guide", 인앱 브라우저 —
 * 화면이 그대로 남아 돌아오면 스크롤 위치 유지). 이름·사진은 누르는 대상이 아니다.
 *
 * 상태: 로딩 = 스켈레톤 · 404(CURATION-001, 미게시·내림) = "더 이상 볼 수 없어요" + 홈으로 · 그 밖 실패(503 등)·캐시 없음 =
 * "불러오지 못했어요" + 다시 시도 + 홈으로 · 실패·캐시 있음 = 목록 유지 + 한 줄 안내 · fallbackUsed = 상단 "일부 영어" 안내.
 * 외부 링크 = lib/openExternal openWebPage(실패 시 토스트 — `void Linking.*` 직접 호출 금지 규칙).
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubHeader } from '@/components/SubHeader';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { RemoteImage } from '@/components/RemoteImage';
import { Shimmer } from '@/components/Skeleton';
import { color as C, font } from '@/lib/theme';
import { openWebPage } from '@/lib/openExternal';
import { EVENTS, track } from '@/lib/analytics';
import { isCurationUnavailable, useCurationDetail, type CurationItem } from '@/lib/data/useCurations';

const GUTTER = 20;
export const ITEM_PHOTO_RATIO = 176 / 335;

export default function CurationDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ key?: string }>();
  const key = typeof params.key === 'string' ? params.key : undefined;
  const q = useCurationDetail(key);
  const goHome = () => router.navigate('/(tabs)' as Href);
  const back = () => (router.canGoBack() ? router.back() : goHome());
  const detail = q.data;

  let body: React.ReactNode;
  if (q.isPending) {
    body = (
      <View style={styles.pad} testID="curation-detail-skeleton">
        <Shimmer style={styles.skelLine} />
        <Shimmer style={[styles.skelPhoto]} />
        <Shimmer style={styles.skelLine} />
        <Shimmer style={[styles.skelLine, { width: '60%' }]} />
      </View>
    );
  } else if (!detail) {
    const unavailable = isCurationUnavailable(q.error);
    body = (
      <View style={[styles.pad, styles.stateBox]} testID={unavailable ? 'curation-unavailable' : 'curation-detail-error'}>
        <Text style={styles.stateTitle} accessibilityRole="header">{t(unavailable ? 'curation.unavailableTitle' : 'curation.errorTitle')}</Text>
        <Text style={styles.stateBody}>{t(unavailable ? 'curation.unavailableBody' : 'curation.errorBody')}</Text>
        {!unavailable && <Btn variant="ghost" onPress={() => void q.refetch()} testID="curation-detail-retry">{t('common.tryAgain')}</Btn>}
        <Btn variant="ghost" onPress={goHome} testID="curation-back-home">{t('curation.backHome')}</Btn>
      </View>
    );
  } else {
    body = (
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 32 }]} testID="curation-detail">
        {q.isError && (
          <Pressable onPress={() => void q.refetch()} style={styles.staleRow} accessibilityRole="button" testID="curation-detail-stale">
            <Text style={styles.staleText}>{t('curation.refreshFailed')}</Text>
            <Text style={styles.staleRetry}>{t('common.tryAgain')}</Text>
          </Pressable>
        )}
        {detail.fallbackUsed && <Text style={styles.fallback} testID="curation-fallback">{t('curation.fallbackNotice')}</Text>}
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID="curation-cover">
          <RemoteImage uri={detail.coverImageUrl} style={styles.photo} recyclingKey={`cover-${detail.key}`} />
        </View>
        {detail.coverAttribution && <Text style={styles.caption} testID="curation-cover-attribution">{detail.coverAttribution}</Text>}
        <Text style={styles.description}>{detail.description}</Text>
        {detail.items.map((item, i) => (
          <React.Fragment key={item.id}>
            {i > 0 && <View style={styles.divider} />}
            <ItemCard item={item} collectionKey={detail.key} />
          </React.Fragment>
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={styles.root}>
      <SubHeader title={detail?.title ?? ''} onBack={back} />
      {body}
    </View>
  );
}

function ItemCard({ item, collectionKey }: { item: CurationItem; collectionKey: string }) {
  const { t } = useTranslation();
  const open = () => {
    track(EVENTS.home_curation_link_click, { collection_key: collectionKey, position: item.position });
    void openWebPage(item.externalUrl);
  };
  return (
    <View style={styles.item} testID={`curation-item-${item.position}`}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <RemoteImage uri={item.imageUrl} style={styles.photo} recyclingKey={item.id} />
      </View>
      {item.imageAttribution && <Text style={styles.caption} testID={`curation-item-attribution-${item.position}`}>{item.imageAttribution}</Text>}
      <Text style={styles.name} accessibilityRole="header">{item.name}</Text>
      <Text style={styles.area}>{item.area}</Text>
      <Text style={styles.intro}>{item.introduction}</Text>
      <Text style={styles.reason}>{item.reason}</Text>
      {item.nearby.length > 0 && (
        <View style={styles.nearby} testID={`curation-item-nearby-${item.position}`}>
          <Text style={styles.nearbyHead}>{t('curation.exploreNearby')}</Text>
          {item.nearby.map((n, i) => <Text key={i} style={styles.nearbyLine}>{n}</Text>)}
        </View>
      )}
      <Btn
        variant="ghost"
        onPress={open}
        accessibilityLabel={t('curation.viewGuideA11y', { name: item.name })}
        accessibilityHint={t('curation.viewGuideHint')}
        testID={`curation-item-link-${item.position}`}
      >
        {t('curation.viewGuide')}
      </Btn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  pad: { paddingHorizontal: GUTTER, paddingTop: 16, gap: 12 },
  stateBox: { gap: 16 },
  stateTitle: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 28, color: C.ink },
  stateBody: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: C.ink2 },
  fallback: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink3 },
  description: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: C.ink2, marginBottom: 8 },
  photo: { width: '100%', aspectRatio: 1 / ITEM_PHOTO_RATIO, borderRadius: 12, backgroundColor: C.surface2 },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16, color: C.ink3, marginTop: -4 },
  item: { gap: 8 },
  name: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 28, color: C.ink, marginTop: 4 },
  area: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: C.ink3 },
  intro: { fontFamily: font.body, fontSize: 16, lineHeight: 24, color: C.ink },
  reason: { fontFamily: font.body, fontSize: 16, lineHeight: 24, color: C.ink2 },
  nearby: { gap: 4, marginTop: 4 },
  nearbyHead: { fontFamily: font.bodyBold, fontSize: 16, lineHeight: 24, color: C.ink },
  nearbyLine: { fontFamily: font.body, fontSize: 16, lineHeight: 24, color: C.ink2 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 20 },
  staleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, minHeight: 44 },
  staleText: { fontFamily: font.body, fontSize: 13, color: C.ink3 },
  staleRetry: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  skelLine: { height: 16, borderRadius: 4, width: '100%' },
  skelPhoto: { width: '100%', aspectRatio: 1 / ITEM_PHOTO_RATIO, borderRadius: 12 },
});
