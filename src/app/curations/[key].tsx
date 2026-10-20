/**
 * 큐레이션 모음 상세 (KB-796 → KB-829 D-29 v2 Photo-first, Figma 12343-25224) — `/curations/[key]`.
 * 설명("10 places") · 항목 10개(position 순) 사진 중심 카드: 사진 335×208(없으면 104 회색 "Photo unavailable") · 이름 ·
 * 지역 행(area + 역 모음 nearby를 공백 2칸으로 · 오른쪽 펼침 chevron) · 오른쪽 Outline "Guide"(인앱 브라우저 — 화면이
 * 남아 돌아오면 스크롤 유지) · 출처 캡션(있을 때만, 지역 행 아래) · 소개·선정 이유는 기본 접힘(사진·이름·chevron 탭 = 인라인 펼침).
 * 상세 표지는 없다(v2 — 표지 = 1번 항목 사진 재사용이라 중복; 홈 배너 표지는 그대로). 방문 유의사항 박스는 공개 API에 필드 없음 → 없음.
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
import { IconChevronDown } from '@/components/icons';
import { Shimmer } from '@/components/Skeleton';
import { color as C, font } from '@/lib/theme';
import { openWebPage } from '@/lib/openExternal';
import { EVENTS, track } from '@/lib/analytics';
import { isCurationUnavailable, useCurationDetail, type CurationItem } from '@/lib/data/useCurations';

const GUTTER = 20;
export const ITEM_PHOTO_RATIO = 208 / 335; // KB-829 v2: 176 → 208(높이만)
const NO_PHOTO_H = 104; // 사진 없는 항목 = 자리 축소
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
          {/* 재조회(새 dataUpdatedAt) = 카드 재마운트 → 펼침 전부 접힘으로 */}
          {detail.items.map((item) => <ItemCard key={`${item.id}:${q.dataUpdatedAt}`} item={item} listKey={detail.key} />)}
        </View>
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

function ItemCard({ item, listKey }: { item: CurationItem; listKey: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const toggle = () => setExpanded((v) => !v);
  const open = () => {
    track(EVENTS.home_curation_link_click, { collection_key: listKey, position: item.position });
    void openWebPage(item.externalUrl);
  };
  const p = item.position;
  return (
    <View testID={`curation-item-${p}`}>
      {/* 사진 탭 = 펼침(스크린리더는 이름 행 버튼 하나로 — 사진은 숨김) */}
      <Pressable onPress={toggle} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={`curation-item-photo-${p}`}>
        {item.imageUrl ? (
          <RemoteImage uri={item.imageUrl} style={styles.photo} recyclingKey={item.id} />
        ) : (
          <View style={styles.noPhoto} testID={`curation-item-nophoto-${p}`}>
            <Text style={styles.noPhotoText}>{t('curation.photoUnavailable')}</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.head}>
        <Pressable
          onPress={toggle}
          style={styles.headText}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={item.name}
          testID={`curation-item-toggle-${p}`}
        >
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.areaRow}>
            {/* 역 모음 = 지역 + 주변 이름을 공백 2칸으로(가운데점 금지) · 이름 안 공백은 NBSP — 줄바꿈은 이름 사이에서만(QA S3) */}
            <Text style={styles.area}>{areaLine(item.area, item.nearby)}</Text>
            <IconChevronDown size={24} color="#000" style={expanded ? styles.chevronUp : undefined} />
          </View>
        </Pressable>
        <Pressable
          onPress={open}
          style={({ pressed }) => [styles.guide, pressed && styles.guidePressed]}
          accessibilityRole="button"
          accessibilityLabel={t('curation.viewGuideA11y', { name: item.name })}
          accessibilityHint={t('curation.viewGuideHint')}
          testID={`curation-item-link-${p}`}
        >
          <Text style={styles.guideText}>{t('curation.guide')}</Text>
        </Pressable>
      </View>
      {item.imageAttribution && <Text style={styles.caption} testID={`curation-item-attribution-${p}`}>{item.imageAttribution}</Text>}
      {expanded && (
        <View style={styles.about} testID={`curation-item-about-${p}`}>
          <Text style={styles.intro}>{item.introduction}</Text>
          <Text style={styles.reason}>{item.reason}</Text>
        </View>
      )}
    </View>
  );
}

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
  photo: { width: '100%', aspectRatio: 1 / ITEM_PHOTO_RATIO, borderRadius: 12, backgroundColor: C.surface2 },
  noPhoto: { height: NO_PHOTO_H, borderRadius: 12, backgroundColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { fontFamily: font.body, fontSize: 13, lineHeight: 20, color: C.ink2 },
  // 이름(24) + 4 + 지역 행(24) 블록 옆에 Guide(44)가 세로 가운데 — 시안 실측(2x PNG)
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  headText: { flex: 1 },
  name: { fontFamily: font.bodyBold, fontSize: 18, lineHeight: 24, color: C.ink },
  areaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, minHeight: 24 },
  area: { flex: 1, fontFamily: font.body, fontSize: 13, lineHeight: 20, color: C.ink2 },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  guide: { minHeight: 44, paddingHorizontal: 20, borderRadius: 4, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  guidePressed: { backgroundColor: C.hair },
  guideText: { fontFamily: font.body, fontWeight: '500', fontSize: 13, color: C.ink },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16, color: C.ink2, marginTop: 8 },
  about: { marginTop: 8, gap: 8 },
  intro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: '#2F3137' }, // 시안 gray-900
  reason: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: '#4B4F58' }, // 시안 gray-800
  staleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, minHeight: 44 },
  staleText: { fontFamily: font.body, fontSize: 13, color: C.ink3 },
  staleRetry: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  skelLine: { height: 16, borderRadius: 4, width: '100%' },
  skelPhoto: { width: '100%', aspectRatio: 1 / ITEM_PHOTO_RATIO, borderRadius: 12 },
});
