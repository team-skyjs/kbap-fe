/**
 * 큐레이션 모음 상세 (KB-796 → KB-829 v2 → KB-832 D-29 v5, Figma 12344-29771) — `/curations/[key]`.
 * 설명("10 places") · 항목 10개(position 순) 카드: 첫 사진이 카드 전체(335 × 300, 큰 글씨면 캡션만큼 자람) + 하단 흐림 위에
 * 흰 이름·지역(역 모음은 area + nearby 공백 2칸) + 흰 chevron. 카드 탭 = 사진 갤러리 바텀시트(features/curation/CurationGallerySheet —
 * 가로 스와이프·카운터·사진별 출처·소개 2줄·Guide). v2의 펼침/Guide 행은 없다. 상세 표지 없음(v2부터).
 *
 * 상태: 로딩 = 스켈레톤 · 404(CURATION-001, 미게시·내림) = "더 이상 볼 수 없어요" + 홈으로 · 그 밖 실패(503 등)·캐시 없음 =
 * "불러오지 못했어요" + 다시 시도 + 홈으로 · 실패·캐시 있음 = 목록 유지 + 한 줄 안내 · fallbackUsed = 상단 "일부 영어" 안내.
 * 외부 링크 = lib/openExternal openWebPage(실패 시 토스트 — `void Linking.*` 직접 호출 금지 규칙).
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubHeader } from '@/components/SubHeader';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { CurationGallerySheet } from '@/features/curation/CurationGallerySheet';
import { BlurCaptionCard, CARD_SPACER } from '@/features/curation/BlurCaptionCard';
import { Shimmer } from '@/components/Skeleton';
import { color as C, font } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';
import { isCurationUnavailable, useCurationDetail, type CurationItem } from '@/lib/data/useCurations';

const GUTTER = 20;
// KB-861: 카드 부품·흐림 띠 계산은 features/curation/BlurCaptionCard(홈 배너와 공용) — 기존 테스트·호출 경로를 위해 여기서도 다시 내보낸다
export { CARD_SPACER };
export { blurBandOf, captionLargeText, CARD_BLUR_LEAD, CARD_BLUR_OPACITY, CARD_BLUR_RADIUS, CARD_BLUR_STRIPS, BLUR_FADE_MS } from '@/features/curation/BlurCaptionCard';
export const ITEM_PHOTO_RATIO = 300 / 335; // 스켈레톤 자리
/** 지역 행 = 지역·주변 이름을 공백 2칸으로. 이름 안 공백은 U+00A0(줄바꿈 금지)이라 "Hongdae / | streets"처럼 이름 중간에서 꺾이지 않는다. */
export const areaLine = (area: string, nearby: string[]): string => [area, ...nearby].map((n) => n.trim().replace(/\s+/g, '\u00A0')).join('  ');

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
  const [gallery, setGallery] = React.useState<CurationItem | null>(null); // KB-832: 열린 갤러리(항목) — 화면은 그대로라 닫으면 스크롤 유지
  // Codex #320 P1: 블러 8띠는 화면 ± 1화면 안 카드만 마운트(전부 마운트 = 10장 × 8 = 80 블러 비트맵). 범위가 바뀔 때만 상태 갱신(리렌더 폭주 0)
  const winH = useWindowDimensions().height;
  const geo = React.useRef({ scrollY: 0, viewH: 0, listTop: 0, cards: new Map<number, { y: number; h: number }>() });
  const [near, setNear] = React.useState<ReadonlySet<number>>(() => new Set());
  const refreshNear = React.useCallback(() => {
    const g = geo.current;
    const next = nearCards(g.cards, g.listTop, g.scrollY, g.viewH || winH);
    setNear((prev) => (sameSet(prev, next) ? prev : next));
  }, [winH]);
  const onPlace = React.useCallback((pos: number, y: number, h: number) => { geo.current.cards.set(pos, { y, h }); refreshNear(); }, [refreshNear]);

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
  } else if (!detail || isCurationUnavailable(q.error)) {
    // Codex #303 P2: 내린 모음(404 CURATION-001)은 캐시가 남아 있어도 "볼 수 없음"이 이긴다 — 캐시 유지는 일시 실패에만
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
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        onScroll={(e) => { geo.current.scrollY = e.nativeEvent.contentOffset.y; refreshNear(); }}
        scrollEventThrottle={32}
        onLayout={(e) => { geo.current.viewH = e.nativeEvent.layout.height; refreshNear(); }}
        testID="curation-detail"
      >
        {q.isError && (
          <Pressable onPress={() => void q.refetch()} style={styles.staleRow} accessibilityRole="button" testID="curation-detail-stale">
            <Text style={styles.staleText}>{t('curation.refreshFailed')}</Text>
            <Text style={styles.staleRetry}>{t('common.tryAgain')}</Text>
          </Pressable>
        )}
        {detail.fallbackUsed && <Text style={styles.fallback} testID="curation-fallback">{t('curation.fallbackNotice')}</Text>}
        <Text style={styles.description}>{detail.description}</Text>
        <View style={styles.list} onLayout={(e) => { geo.current.listTop = e.nativeEvent.layout.y; refreshNear(); }}>
          {detail.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              blur={near.has(item.position)}
              onPlace={onPlace}
              onOpen={() => {
                track(EVENTS.home_curation_gallery_open, { collection_key: detail.key, entry_id: item.id });
                setGallery(item);
              }}
            />
          ))}
        </View>
      </ScrollView>
    );
  }
  return (
    <View style={styles.root}>
      <SubHeader title={detail?.title ?? ''} onBack={back} />
      {body}
      {/* Codex #309 R2: 열린 채 재조회가 404 CURATION-001(내림)이면 갤러리도 닫힌다 — 내린 모음의 사진·외부 링크 노출 0 */}
      <CurationGallerySheet item={isCurationUnavailable(q.error) ? null : gallery} listKey={detail?.key ?? ''} area={gallery ? areaLine(gallery.area, gallery.nearby) : ''} onClose={() => setGallery(null)} />
    </View>
  );
}

/** v5 카드(12344:29771): 사진 전체 + 아래 흐림(어둡게) 위에 흰 이름·지역 + 오른쪽 흰 chevron(박스 없음, 44 자리). 카드 어디를 눌러도 갤러리 시트.
 *  KB-861: 카드 부품은 홈 큐레이션 배너와 공용(features/curation/BlurCaptionCard). */
function ItemCard({ item, onOpen, blur, onPlace }: { item: CurationItem; onOpen: () => void; blur: boolean; onPlace: (pos: number, y: number, h: number) => void }) {
  const { t } = useTranslation();
  const p = item.position;
  return (
    <BlurCaptionCard
      photoUri={item.images[0]?.url ?? null}
      recyclingKey={item.id}
      title={item.name}
      subtitle={areaLine(item.area, item.nearby) /* 역 모음 = 지역 + 주변 이름을 공백 2칸으로(가운데점 금지) · 이름 안 공백은 NBSP(QA S3) */}
      blur={blur}
      radius={12}
      onPress={onOpen}
      onLayout={(y, h) => onPlace(p, y, h)}
      accessibilityLabel={`${item.name}, ${item.area}`}
      accessibilityHint={t('curation.openGalleryHint')}
      testPrefix="curation-item"
      testKey={p}
      uiTarget="curation-item"
    />
  );
}

/** 블러를 붙일 카드 = 화면(스크롤 위치 ~ +화면 높이)에서 위·아래로 1화면 더 늘린 범위와 겹치는 카드. 카드 y = 목록 기준 + 목록 위치 */
export function nearCards(cards: ReadonlyMap<number, { y: number; h: number }>, listTop: number, scrollY: number, viewH: number): Set<number> {
  const from = scrollY - viewH;
  const to = scrollY + viewH * 2;
  const out = new Set<number>();
  for (const [pos, c] of cards) {
    const top = listTop + c.y;
    if (c.h > 0 && top < to && top + c.h > from) out.add(pos);
  }
  return out;
}
const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) => a.size === b.size && [...a].every((x) => b.has(x));


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  pad: { paddingHorizontal: GUTTER, paddingTop: 16, gap: 12 },
  body: { paddingHorizontal: GUTTER, paddingTop: 8, gap: 12 }, // v2: 헤더 아래 8 → 설명 → 20 → 첫 사진
  stateBox: { gap: 16 },
  stateTitle: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 28, color: C.ink },
  stateBody: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: C.ink2 },
  fallback: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink3 },
  description: { fontFamily: font.body, fontSize: 13, lineHeight: 20, color: C.ink2, marginBottom: 8 },
  list: { gap: 20 }, // v2: 구분선 없이 카드 간 20
  staleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, minHeight: 44 },
  staleText: { fontFamily: font.body, fontSize: 13, color: C.ink3 },
  staleRetry: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  skelLine: { height: 16, borderRadius: 4, width: '100%' },
  skelPhoto: { width: '100%', aspectRatio: 1 / ITEM_PHOTO_RATIO, borderRadius: 12 },
});
