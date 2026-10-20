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
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubHeader } from '@/components/SubHeader';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { RemoteImage } from '@/components/RemoteImage';
import { IconChevron } from '@/components/icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CurationGallerySheet } from '@/features/curation/CurationGallerySheet';
import { Shimmer } from '@/components/Skeleton';
import { color as C, font } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';
import { isCurationUnavailable, useCurationDetail, type CurationItem } from '@/lib/data/useCurations';

const GUTTER = 20;
// KB-832 v5: 사진이 카드 전체(335 × 기본 300) — 캡션은 사진 안 하단. 큰 글씨면 캡션만큼 카드가 자란다(시안 330)
export const CARD_SPACER = 236; // 300 = 236 + 이름 26 + 4 + 지역 18 + 하단 16
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
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} testID="curation-detail">
        {q.isError && (
          <Pressable onPress={() => void q.refetch()} style={styles.staleRow} accessibilityRole="button" testID="curation-detail-stale">
            <Text style={styles.staleText}>{t('curation.refreshFailed')}</Text>
            <Text style={styles.staleRetry}>{t('common.tryAgain')}</Text>
          </Pressable>
        )}
        {detail.fallbackUsed && <Text style={styles.fallback} testID="curation-fallback">{t('curation.fallbackNotice')}</Text>}
        <Text style={styles.description}>{detail.description}</Text>
        <View style={styles.list}>
          {detail.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
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

/** v5 카드(12344:29771): 사진 전체 + 아래 흐림(어둡게) 위에 흰 이름·지역 + 오른쪽 흰 chevron(박스 없음, 44 자리). 카드 어디를 눌러도 갤러리 시트. */
function ItemCard({ item, onOpen }: { item: CurationItem; onOpen: () => void }) {
  const { t } = useTranslation();
  const p = item.position;
  const cover = item.images[0]?.url ?? null;
  const [cardH, setCardH] = React.useState<number | null>(null); // 블러 사본을 원본과 같은 높이로 정렬(큰 글씨면 카드가 자란다)
  return (
    <Pressable
      style={styles.card}
      onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.area}`}
      accessibilityHint={t('curation.openGalleryHint')}
      testID={`curation-item-${p}`}
      uiTarget="curation-item"
    >
      {cover ? (
        <RemoteImage uri={cover} style={StyleSheet.absoluteFill} recyclingKey={item.id} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noPhoto]} testID={`curation-item-nophoto-${p}`} />
      )}
      {/* v4 하단 블러(예진 "시안 그대로", 네이티브 모듈 없이): 같은 사진을 expo-image blurRadius로 한 장 더 —
          카드 높이와 같은 크기로 하단 정렬해 원본과 겹치고, 하단 96 밴드만 보이게 클립. 위 경계·글자 대비는 기존 그라데이션 */}
      {cover && cardH != null && (
        <View style={styles.blurBand} pointerEvents="none" testID={`curation-item-blur-${p}`}>
          <RemoteImage uri={cover} style={[styles.blurImg, { height: cardH }]} recyclingKey={`${item.id}-blur`} blurRadius={CARD_BLUR_RADIUS} />
        </View>
      )}
      <LinearGradient colors={CARD_SHADE} style={styles.shade} pointerEvents="none" />
      <View style={{ height: CARD_SPACER }} />
      <View style={styles.caption}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={styles.name}>{item.name}</Text>
          {/* 역 모음 = 지역 + 주변 이름을 공백 2칸으로(가운데점 금지) · 이름 안 공백은 NBSP — 줄바꿈은 이름 사이에서만(QA S3) */}
          <Text style={styles.area}>{areaLine(item.area, item.nearby)}</Text>
        </View>
        <View style={styles.arrow} testID={`curation-item-arrow-${p}`}>
          <IconChevron size={24} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}

const CARD_SHADE = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)'] as const;
// 시안 v4 하단 블러 — 밴드 = 카드 아래 96(2x PNG 눈금 근사), 흐림 = 윤곽은 지우고 색 덩어리만(시안 02b-mock)
export const CARD_BLUR_BAND = 96;
// expo-image blurRadius는 플랫폼마다 다르다(node_modules/expo-image 실측):
// - iOS: radius/2를 SDImageBlurTransformer에 — **원본 이미지 픽셀** 단위라 고해상도 사진엔 약하다(16 = 원본 8px)
// - Android: Glide BlurTransformation(min(radius, 25), sampling 4) — 1/4로 줄인 뒤 흐리므로 같은 값이 iOS보다 훨씬 세다
// iOS 45 = QA 대조 2회: 16은 윤곽 남음(pr311 03-before-after-mock), 72는 시안보다 더 흐림(dev-6caa-blur 03-r16-r72-mock) — 시안은 기둥·문 윤곽이 남는 정도.
// Android 9 = iOS와 같은 비율(72→45)로 내린 값 — Android 회귀 캡처로 확인 대상.
export const CARD_BLUR_RADIUS = Platform.OS === 'android' ? 9 : 45;

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
  // v5 실측: 카드 335×300 r12 · 캡션 하단 inset 16 · 이름 18 semibold 흰색 · 4 · 지역 13 흰색 · chevron 24(44 자리, 오른쪽 inset 16)
  card: { borderRadius: 12, overflow: 'hidden', backgroundColor: C.surface2, justifyContent: 'flex-end' },
  noPhoto: { backgroundColor: C.hair },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  blurBand: { position: 'absolute', left: 0, right: 0, bottom: 0, height: CARD_BLUR_BAND, overflow: 'hidden' },
  blurImg: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  caption: { flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 16, paddingRight: 16, paddingBottom: 16, gap: 4 },
  name: { fontFamily: font.bodySemi, fontSize: 18, lineHeight: 26, color: '#FFFFFF' },
  area: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  staleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, minHeight: 44 },
  staleText: { fontFamily: font.body, fontSize: 13, color: C.ink3 },
  staleRetry: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  skelLine: { height: 16, borderRadius: 4, width: '100%' },
  skelPhoto: { width: '100%', aspectRatio: 1 / ITEM_PHOTO_RATIO, borderRadius: 12 },
});
