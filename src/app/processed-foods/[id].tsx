/**
 * KB-945(P-564·565, 예진 10/31): 섹션 순서 = 음식 상세(Registered) — 사진 → 판정 띠(화면 폭) → 이름 → 굵은 구분선 → What's inside(음식 상세 칩 필터 + 재료 타일 한 그리드:
 * 감지·일치 + 주요 알레르기 + 혼입 가능 — 구 감지 카드·Major allergens 문단·원재료 미리보기를 합침) → 원재료 원문·출처는 접힌 "Ingredients and source"로만 → 굵은 구분선 → 리뷰.
 * 피할 재료 설정·로그인 유도 버튼 제거. KB-947: 비회원·회피 0개 회원 = Safe 띠(예진 결정) — 단 표시 근거 없는 제품(labelSource NONE = 목록 labelKnown false)은 회원과 같이 "확인 못 함"(false-safe 0).
 * 가공식품 상세 — KB-865 v4(P-523 ②, Figma 12371:70304 시안 08~13·34~38·51·52, 예진 10/22 Q1~Q4): 아래 v4 규칙이 위 KB-812 규칙을 대체한다.
 * - 판정 = 서버 verdict(+ avoidMatches·mayContainMatches·unclearIngredients). 회원 SAFE = 원재료 미리보기 + See detail /
 *   AVOID·CAUTION·SAFE_WITH_NOTE = 판정 제목·문장 + Ingredients and source. 둘 다 같은 제자리 펼침(처음 접힘) → See less.
 *   verdict null(원재료·표시 둘 다 없음) = 리본 없이 "확인 못 함". 비회원·회피 0개 = 주요 알레르기 + 혼입 가능 + 가입·설정 유도.
 * - 원재료 = 번역(#462, 없으면 생략) + 한국어 원문. 출처 = HACCP | C002(#455). "성분표 직접 확인" 버튼 제거(결정 4).
 * (이하 KB-812 원 설명 — 구 Verdict 부품은 성분표 결과 화면이 ③단계까지 쓴다)
 * 가공식품 상세 (KB-812, D-32 Product details 12338:36272 · 전체 12338:37427 · R-95 확정 메모) — `/processed-foods/[id]`.
 * 사진 335×223(없으면 유형 플레이스홀더, 출처 캡션) → 제조사·제품명·유형 → 판정 → 원재료 원문(접기) → 알레르기 표시(표시란 있을 때만)
 * → 출처 고지(접히지 않는 본문 — 자료·사진·상표 3종) → 리뷰(KB-812 2차 — PackagedReviews, 음식 상세 리뷰 부품 재사용).
 *
 * 판정 규칙(R-95 · 헌법 III false-safe 금지):
 * - **가공식품엔 Safe 배지 없음**, "안전·없음" 문구 금지. 검출 = 빨간 X, 미매핑 원문 = 노란 느낌표(서버 unmapped[]가 올 때만),
 *   검출 안 됨·대조 미확인 = 회색 물음표("일치 없음이 적합을 뜻하지 않음").
 * - labelSource별 상단 문구 필수(DECLARED·INGREDIENTS_ONLY·NONE) — 빈 detections를 "검출 없음"으로 그리지 않는다.
 * - 회원 = 내 회피 재료 대조(avoidance: DETECTED 빨강 / UNCONFIRMED 회색), 비회원(avoidance null) = 로그인 유도 1줄.
 * - 원재료·알레르기 원문은 한국어 그대로(번역하지 않는다 — 원문이 근거).
 * 상태: 로딩 = 스켈레톤 · 404 = 없음 · 410 = 생산종료(캐시가 있어도 이긴다 — 판정 화면, cached-data-vs-server-refusal) ·
 * 그 밖 실패 = 다시 시도.
 */
import * as React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { usePullRefresh } from '@/lib/data/usePullRefresh';
import { Redirect, useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VerdictLockRow } from '@/components/VerdictBand';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { IconArrowLeft, IconEdit } from '@/components/icons';
import { PILL_MAX_SCALE, pillCta, useBottomBand } from '@/features/food/pillCta';
import { Txt as Text } from '@/components/Txt';
import { Pressable } from '@/components/Pressable';
import { RemoteImage } from '@/components/RemoteImage';
import { HeroGallery } from '@/features/food/HeroGallery';
import { Shimmer } from '@/components/Skeleton';
import { Chip } from '@/components/Chip';
import { color as C, font, radius } from '@/lib/theme';
import { MessageErrorBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { useAppLanguage } from '@/lib/i18n/useAppLanguage';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track, packagedDetailSource } from '@/lib/analytics';
import { restrictionLabel } from '@/lib/onboarding/data';
import { processedUnavailable, useProcessedDetail } from '@/lib/data/useProcessedFoods';
import { processedReviewsKey } from '@/lib/data/useFoodReviews';
import { packagedTypeKey, type ProcessedFoodDetail } from '@/lib/api/processedFoodAdapter';
import { PackagedPlaceholder } from '@/features/processedFood/PackagedExplorer';
import { PackagedReviews } from '@/features/processedFood/PackagedReviews';
import { ProductName } from '@/features/processedFood/ProductName';
import { IngredientsText, insideCodes, PackagedDetectedTiles, PackagedUnableBand, PackagedVerdictBand, safeBasis } from '@/features/processedFood/PackagedVerdict';

const GUTTER = 20;
type IngChip = 'all' | 'safe' | 'danger' | 'caution';
const ING_CHIPS: IngChip[] = ['all', 'safe', 'danger', 'caution']; // 음식 상세와 같은 순서
/** 출처 고지 키 → 문구 키. 모르는 키도 자료 출처 문구는 항상(고지 3종 상시). */
const IMAGE_CREDIT: Record<string, string> = { 'processedFood.image.haccp': 'packaged.imageHaccp', 'processedFood.image.off': 'packaged.imageOff' };

/** KB-870(Codex #335): 운영 채널(운영 서버 processed-foods 404) = 직접 링크·공유 링크로 와도 상세 0(모듈 상수로 고름 — 감싸는 컴포넌트 없음) */
const GoneHome = () => <Redirect href="/" />;
export default FLAGS.processedFoodEnabled ? ProcessedFoodDetailScreen : GoneHome;

/** 코드 → 표시 이름 목록(회피 재료 라벨) */
const namesOf = (codes: string[]) => codes.map((c) => restrictionLabel(c)).join(', ');

/** 펼침(시안 09·38·51·52) — 제자리. KB-914(R-137): 판정은 위 띠가 말한다(구 SAFE "Your avoid list" 블록 소멸) · 원재료 = 한 체계(IngredientsText) */
function Expanded({ d, showTranslation }: { d: ProcessedFoodDetail; showTranslation: boolean }) {
  const { t } = useTranslation();
  const imageCredit = d.image ? IMAGE_CREDIT[d.image.attributionKey] : undefined;
  const c002 = d.sourceProvider === 'C002';
  return (
    <View style={s.expanded} testID="pf-expanded">
      <View style={s.block} testID="pf-ingredients">
        <Text style={s.h2}>{t('packaged.ingredientsHeading')}</Text>
        <IngredientsText translated={d.ingredients.translated} original={d.ingredients.original} showTranslation={showTranslation} emptyLabel={t('packaged.noIngredients')} testID="pf-raw" />
      </View>
      {!!d.allergenStatement && (
        <View style={s.block} testID="pf-allergens">
          <Text style={s.h2}>{t('packaged.allergenTitle')}</Text>
          <View>
            {showTranslation && !!d.allergenStatement.translated && <Text style={s.body}>{d.allergenStatement.translated}</Text>}
            <Text style={s.body}>{d.allergenStatement.original}</Text>
          </View>
        </View>
      )}
      {/* 출처 고지 — 자료(출처별: HACCP | C002 #455) · 사진(있을 때) · 제조사 무관·상표 */}
      <View style={s.block} testID="pf-source">
        <Text style={s.h2}>{t('packaged.sourceTitle')}</Text>
        <View>
          {c002 ? (
            <Text style={s.body} testID="pf-source-c002">{t('packaged.sourceC002')}</Text>
          ) : (
            <>
              <Text style={s.body}>{t('packaged.sourceData1')}</Text>
              <Text style={s.body}>{t('packaged.sourceData2')}</Text>
            </>
          )}
          {!!imageCredit && <Text style={s.body} testID="pf-source-image">{t(imageCredit)}</Text>}
        </View>
        <Text style={s.disclaimer} testID="pf-source-disclaimer">{t('packaged.disclaimer')}</Text>
      </View>
    </View>
  );
}

const PREVIEW_LINES = 3;

/** KB-997(예진 11/5 실기 — 원재료가 버튼 뒤에 완전히 숨음): 접힌 상태 = "Ingredients" + 번역(없으면 한국어 원문) 최대 3줄 + See all.
 *  P-611(예진 11/5): "세 줄"은 섹션 전체(번역·원문·알레르기·출처) 기준 → 길이 측정 분기 없이 **항상 접힌 채 시작**, See all 항상
 *  (짧은 번역이어도 펼치면 원문·출처가 더 있다). 페이드는 잘림 측정 없이는 짧은 글을 흐리게 해서 뺐다. 원재료 없음 = 전체 섹션 그대로. */
function IngredientsPreview({ d, showTranslation, onSeeAll }: { d: ProcessedFoodDetail; showTranslation: boolean; onSeeAll: () => void }) {
  const { t } = useTranslation();
  const text = (showTranslation ? d.ingredients.translated : null) ?? d.ingredients.original;
  if (!text) return <Expanded d={d} showTranslation={showTranslation} />;
  return (
    <View style={s.block} testID="pf-ingredients-peek">
      <Text style={s.h2}>{t('packaged.ingredientsHeading')}</Text>
      <Text style={s.body} numberOfLines={PREVIEW_LINES} testID="pf-preview-text">{text}</Text>
      <Pressable style={s.seeLess} onPress={onSeeAll} accessibilityRole="button" testID="pf-see-all">
        <Text style={s.seeLessText}>{t('packaged.ingredients.seeAll')}</Text>
      </Pressable>
    </View>
  );
}

export function ProcessedFoodDetailScreen() {
  const { t } = useTranslation();
  const lang = useAppLanguage(); // 구독으로(KB-695 — 렌더 중 i18n.language 직접 읽기는 컴파일러가 굳힌다)
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const band = useBottomBand(insets.bottom); // KB-977: 하단 알약 = 음식 상세와 같은 투명 띠(실높이 → 스크롤 아래 여백)
  const params = useLocalSearchParams<{ id?: string; scan?: string; charged?: string; free?: string; src?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const q = useProcessedDetail(id);
  // KB-954: 상세(판정 — 회피 코드 키 전부) + 이 제품 리뷰 + ['me']
  const pull = usePullRefresh([['processedFoods', 'detail', id], processedReviewsKey(id ?? '')]);
  const guest = useIsGuest();
  const meQ = useMe();
  const me = meQ.data;
  const [ingChip, setIngChip] = React.useState<IngChip>('all'); // 음식 상세 What's inside 칩과 같은 필터
  const [expanded, setExpanded] = React.useState(false); // 처음엔 접힘(예진 10/22 Q2)
  const [gate, setGate] = React.useState(false); // KB-974: 비회원 잠금 행 → 가입 게이트(음식 상세 context risk)
  const heroH = useWindowDimensions().width; // KB-974: 히어로 = 정방(음식 상세 hero aspectRatio 1과 같은 높이)
  const loadMoreReviews = React.useRef<(() => void) | null>(null); // 리뷰 섹션이 채운다 — 바닥 근처 스크롤 = 다음 페이지(무한 스크롤, Read reviews 버튼 없음)
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/food' as Href));
  // KB-981: 스캔 진입(PackagedScanFlow push) = 하단 Done·Scan something else — 리뷰 작성 알약 없음
  const scanEntry = params.scan === '1';
  const navigation = useNavigation();
  /** Done = 스캔 화면까지 스택째 닫기(스캔 전 화면). 스캔 화면이 없으면(딥링크 등) 뒤로 */
  const closeScan = (): boolean => {
    const n = scanFlowDepth(navigation.getState());
    if (n > 0) router.dismiss(n);
    return n > 0;
  };
  const onScanDone = () => { if (!closeScan()) back(); };
  /** 새 스캔 = 옛 스캔 화면을 닫고 새로 연다(이전 결과·단계 상태가 남지 않게 — 화면 인스턴스째 교체) */
  const onScanAnother = () => {
    closeScan();
    router.push(`/scan?mode=packaged&t=${Date.now()}` as Href);
  };
  const d = q.data;
  const unavailable = processedUnavailable(q.error);
  // 한국어 사용자 = 번역이 원문과 같은 언어 — 번역 줄 생략
  const showTranslation = !(lang ?? '').startsWith('ko');

  const viewed = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!d || viewed.current === d.id) return;
    viewed.current = d.id;
    track(EVENTS.food_packaged_detail_view, { product_id: d.id, label_source: d.labelSource, source: packagedDetailSource(params.src, params.scan) }); // KB-973 진입 출처
  }, [d, params.src, params.scan]); // 같은 제품 재발화는 viewed(d.id)가 막는다

  const toggle = (open: boolean, via: 'ingredients_source' | 'see_less') => {
    setExpanded(open);
    if (d) track(EVENTS.food_packaged_detail_expand, { product_id: d.id, action: via });
  };

  let body: React.ReactNode;
  if (q.isPending) {
    body = (
      <View style={s.pad} testID="pf-skeleton">
        <Shimmer style={[s.photo, { height: heroH }]} />
        <Shimmer style={[s.skelLine, { width: '40%' }]} />
        <Shimmer style={[s.skelLine, { height: 24, width: '70%' }]} />
        <Shimmer style={s.skelRow} />
        <Shimmer style={s.skelRow} />
      </View>
    );
  } else if (unavailable) {
    // 404·410은 캐시가 있어도 이긴다(내린·단종 제품의 옛 판정을 보이지 않는다) — 시안 36·37 = 공통 오류 화면
    body = (
      <ScreenCenterFill>
        <MessageErrorBlock
          testID={`pf-${unavailable}`}
          title={t(unavailable === 'discontinued' ? 'packaged.discontinuedTitle' : 'packaged.goneTitle')}
          body={t(unavailable === 'discontinued' ? 'packaged.discontinuedBody' : 'packaged.goneBody')}
          actionLabel={t('packaged.backToList')}
          onAction={back}
        />
      </ScreenCenterFill>
    );
  } else if (!d) {
    // 시안 34 — 공통 오류(네트워크·5xx): 다시 시도
    body = (
      <ScreenCenterFill>
        <View testID="pf-error" style={{ alignSelf: 'stretch' }}>
          <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        </View>
      </ScreenCenterFill>
    );
  } else {
    // G = 비회원 · M0 = 회피 0개 회원 · M = 회피 1개 이상(서버 프로필이 정본 — 로컬 판별 0)
    const m0 = !guest && !!me && me.restrictions.length === 0;
    const member = !guest && !!me && me.restrictions.length > 0;
    // 리본 = 회피 1개 이상 회원만(Codex #338 P1: 회피를 비운 직후 프로필이 먼저 갱신되면 옛 설정의 판정 캐시가 남아 있다 — M0·비회원 화면엔 판정 0)
    // Codex #338 R5(커맨드 규칙): 서버가 회원 기준으로 계산해 보낸 verdict가 있으면 프로필 상태와 무관하게 그린다(비회원은 서버가 늘 null).
    // 회피를 바꾼 직후의 옛 판정은 캐시 키(회피 코드·언어)가 막는다(R3) — 여기서 member로 다시 거르면 프로필이 늦을 때 판정이 통째로 빠진다
    const hasVerdict = !guest && d.verdict != null;
    // 표시 근거 없음(labelSource NONE — 서버 목록 labelKnown false와 같은 규칙, S-928) = 회원도 verdict null인 제품(#457) — 회피 미설정이어도 Safe로 그리지 않는다
    const noLabel = d.labelSource === 'NONE';
    const canWrite = FLAGS.reviewsEnabled && FLAGS.reviewsLiveEnabled && FLAGS.packagedReviewWrite && !scanEntry; // KB-981: 스캔 진입 = 작성 알약 0
    const codes = insideCodes(d);
    body = (
      <ScrollView
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={C.ink3} />}
        contentContainerStyle={[s.pad, { paddingBottom: canWrite || scanEntry ? band.scrollPad : insets.bottom + 32 }]}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) loadMoreReviews.current?.();
        }}
        testID="pf-detail"
      >
        {/* KB-865 ③(시안 20): 스캔 확정 결과 = 일반 상세와 같은 화면 — "스캔 결과" 띠·불꽃·차감 문구 없음(README) */}
        {/* 시안 08: 사진 335×223 r16 #F7F8FA(상품 8 안쪽 contain) */}
        <View style={[s.photo, { height: heroH }]}>
          {d.images.length >= 2 ? (
            // KB-965: 2장 이상 = 음식 상세 캐러셀(HeroGallery — 2초 자동·도트) · 장마다 같은 바탕(surface2)·contain·같은 안쪽 여백 = 누끼·실사진이 섞여도 배경이 어긋나지 않는다
            <HeroGallery
              urls={d.images}
              renderPage={(u, i) => <RemoteImage uri={u} style={[s.photoImage, { top: insets.top + 48 }]} contentFit="contain" recyclingKey={`pf-detail-${d.id}-${i}`} hideUntilLoaded />}
            />
          ) : d.imageUrl ? (
            // QA #338: 다른 제품 사진이 잠깐 비치던 것 — 상세 전용 recyclingKey + 이번 사진이 뜰 때까지 투명(판정 화면에 엉뚱한 사진 0)
            <RemoteImage key={d.imageUrl} uri={d.imageUrl} style={[s.photoImage, { top: insets.top + 48 }]} contentFit="contain" recyclingKey={`pf-detail-${d.id}`} hideUntilLoaded />
          ) : (
            <PackagedPlaceholder type={d.type} foodType={d.foodType} style={StyleSheet.absoluteFill} />
          )}
        </View>

        {/* KB-945: 판정 띠 = 사진 바로 아래(음식 상세 순서) · KB-914(R-137) 공용 VerdictBand — 서버 verdict 그대로. 판정을 확인할 수 없으면 회색(unable) 띠 */}
        {hasVerdict && d.verdict ? (
          <View style={s.block}>
            <PackagedVerdictBand d={{ ...d, verdict: d.verdict }} safeReason={safeBasis(t, me?.restrictions.length ?? 0)} style={s.band} testID={`pf-verdict-${d.verdict.toLowerCase()}`} />
          </View>
        ) : !guest && !me ? (
          // Codex #338: 로그인했는데 프로필 대기·실패 + verdict 없음 = 판정 영역을 비우지 않는다 — 대기 = 자리 스켈레톤, 실패 = 보수적 "확인 못 함"(주요 알레르기 있으면 함께)
          meQ.isError ? (
            <View style={s.block}>
              <PackagedUnableBand title={t('packaged.notVerified')} reason={t('packaged.notVerifiedBody')} style={s.band} testID="pf-profile-unavailable" />
              {!!d.majorAllergens?.length && <Text style={s.body} testID="pf-profile-unavailable-major">{t('packaged.containsNames', { names: namesOf(d.majorAllergens) })}</Text>}
            </View>
          ) : (
            <View testID="pf-profile-pending"><Shimmer style={s.skelRow} /></View>
          )
        ) : guest ? (
          // KB-974(예진 11/3 테플): 비회원 = 음식 상세와 같은 잠금 행(같은 부품·키) — 회피 목록이 없는 사람에게 safe 띠는 안전 보장처럼 읽힌다. 로그인하면 위 판정 띠로
          <VerdictLockRow onPress={() => setGate(true)} style={s.band} testID="pf-verdict-lock" />
        ) : m0 && !noLabel ? (
          // KB-947(예진 10/31 결정): 회피 0개 회원 = Safe 띠 — 제목·이유 = 가공 SAFE 키 그대로(보장 표현 0, 새 문구 0)
          <PackagedVerdictBand d={{ ...d, verdict: 'SAFE' }} safeReason={null} style={s.band} testID="pf-verdict-safe-unset" /> /* KB-959: 회피 없음 = 부제 없음(제목 반복 0) */
        ) : m0 || member ? (
          // 원재료·알레르기 표시가 둘 다 없는 제품 = 회원도 verdict null — 판정 없이 "확인 못 함"(#457) = 회색 띠
          <PackagedUnableBand title={t('packaged.notVerified')} reason={t('packaged.notVerifiedBody')} style={s.band} testID="pf-not-verified" />
        ) : null}

        <View style={s.titleBlock}>
          {!!d.maker && <Text style={s.maker}>{d.maker}</Text>}
          {/* KB-914(R-140): 이름 = 공용 ProductName(영어 굵게 + 한국어 작게 — 어느 경로로 와도 같은 표기) · 유형은 그 아래 */}
          <ProductName name={d.name} nameKo={d.nameKo} size="title" lines={4} header testID="pf-name" />
          {(!!d.type || !!d.foodType || d.kcal != null) && (
            <View style={s.metaRow} testID="pf-meta">
              {(!!d.type || !!d.foodType) && <Text style={s.meta}>{d.type ? t(packagedTypeKey(d.type)) : d.foodType}</Text>}
              {/* KB-989: 포장 전체 kcal — 값만, 구분은 columnGap(가운데 점 0) · 영양성분 비표시 */}
              {d.kcal != null && <Text style={s.meta} testID="pf-kcal">{t('packaged.kcal', { value: d.kcal })}</Text>}
            </View>
          )}
        </View>

        {/* KB-945: What's inside = 음식 상세와 같은 제목·칩 필터(판정 있을 때만)·재료 타일 그리드 — 마크는 회원 판정이 있을 때만 */}
        {codes.length > 0 && (
          <>
            <View style={s.thickDivider} />
            <View style={s.block} testID="pf-inside">
              <Text style={s.h2} accessibilityRole="header">{t('detail.insideTitle')}</Text>
              {hasVerdict && (
                <View style={s.chipRow}>
                  {ING_CHIPS.map((c) => (
                    <Chip key={c} label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)} selected={ingChip === c} onPress={() => setIngChip(c)} testID={`pf-ing-chip-${c}`} />
                  ))}
                </View>
              )}
              <PackagedDetectedTiles d={d} codes={codes} personalized={hasVerdict} only={hasVerdict && ingChip !== 'all' ? ingChip : null} testID="pf-detected" />
            </View>
          </>
        )}

        {/* KB-945 → KB-997: 접힘 = 원재료 3줄 미리 보기(See all) · 펼침 = 전체 섹션 제자리 + Show less. 계측 action은 기존 값 유지(퍼널 연속) */}
        {expanded ? (
          <>
            <Expanded d={d} showTranslation={showTranslation} />
            <Pressable style={s.seeLess} onPress={() => toggle(false, 'see_less')} accessibilityRole="button" testID="pf-see-less">
              <Text style={s.seeLessText}>{t('packaged.ingredients.showLess')}</Text>
            </Pressable>
          </>
        ) : (
          <IngredientsPreview d={d} showTranslation={showTranslation} onSeeAll={() => toggle(true, 'ingredients_source')} />
        )}

        {FLAGS.reviewsEnabled && FLAGS.reviewsLiveEnabled && <View style={s.thickDivider} />}
        {/* 롤백 스위치(reviewsLiveEnabled off) = 가공식품 리뷰는 목 경로가 없어 목록이 비는데 서버 요약은 남는다 — 섹션째 숨김(Codex #314 R2) */}
        {FLAGS.reviewsEnabled && FLAGS.reviewsLiveEnabled && <PackagedReviews productId={d.id} summary={d.reviewSummary} loadMoreRef={loadMoreReviews} writeInBar={canWrite || scanEntry} /* KB-981: 스캔 진입 = 섹션 작성 링크도 0(예진) */ />}
      </ScrollView>
    );
    // KB-914(R-137): 하단 고정 CTA = 음식 상세와 같은 알약(구 리뷰 섹션 텍스트 링크 — 섹션 링크는 이 바가 있을 때 숨김)
    // KB-977(예진 운영 실기): 알약 뒤 흰 띠 제거 — 음식 상세(KB-932)와 같은 투명 떠 있는 띠 + 연필 아이콘 알약. 띠 바탕 탭은 아래 콘텐츠로(box-none)
    if (scanEntry) {
      body = (
        <>
          {body}
          <View style={[pillCta.band, { paddingBottom: band.bottom }]} pointerEvents="box-none" onLayout={(e) => band.onHeight(e.nativeEvent.layout.height)} testID="pf-scan-band">
            <Pressable style={pillCta.pillPrimary} onPress={onScanDone} accessibilityRole="button" testID="pf-scan-done">
              <Text style={pillCta.pillPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={PILL_MAX_SCALE}>{t('packagedScan.done')}</Text>
            </Pressable>
            <Pressable style={pillCta.pillOutline} onPress={onScanAnother} accessibilityRole="button" testID="pf-scan-another">
              <Text style={pillCta.pillOutlineText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={PILL_MAX_SCALE}>{t('packagedScan.scanAnother')}</Text>
            </Pressable>
          </View>
        </>
      );
    } else if (canWrite) {
      body = (
        <>
          {body}
          <View style={[pillCta.band, { paddingBottom: band.bottom }]} pointerEvents="box-none" onLayout={(e) => band.onHeight(e.nativeEvent.layout.height)} testID="pf-write-band">
            <Pressable style={pillCta.pillPrimary} onPress={() => { track(EVENTS.review_write_tap, { source: 'detail', target_type: 'packaged' }); router.push(`/processed-foods/${d.id}/review` as Href); }} accessibilityRole="button" testID="pf-write-review-bar">
              <IconEdit size={20} color="#FFFFFF" />
              <Text style={pillCta.pillPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={PILL_MAX_SCALE}>{t('reviews.writeReview')}</Text>
            </Pressable>
          </View>
        </>
      );
    }
  }
  return (
    <View style={s.root}>
      {body}
      {/* KB-974: 음식 상세와 같은 상단 — "Product details" 제목 줄 없이 사진(히어로) 위 반투명 원 뒤로(음식 fBtn 값) · 모든 상태(로딩·오류 포함)에 */}
      <Pressable style={[s.back, { top: insets.top + 6 }]} onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.goBack')} testID="pf-back">
        <IconArrowLeft size={18} color="#fff" />
      </Pressable>
      <AuthGateSheet context="risk" open={gate} onClose={() => setGate(false)} />
    </View>
  );
}

// 시안 08·12 실측(2x PNG): 사진 위 20 · 335×223 r16 #F7F8FA · 제조사 13/18 gray-700(사진 아래 20) → 이름 28 bold(위 4) → "한국어명 | 유형" 15/20 gray-700
// · 섹션(제목 20 bold → 본문 15/22 위 10 → 아웃라인 버튼 48 위 12) 간격 20 · 펼침 섹션 간격 24 · See less = 테두리 없는 텍스트 동작
const HERO_INSET = 24;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  pad: { paddingHorizontal: GUTTER, paddingTop: 20, gap: 20 },
  // KB-974: 히어로 = 음식 상세 hero와 같은 정방 풀블리드(화면 폭 · 위 끝까지 — 페이지 여백·위 패딩 밖으로) · 밝은 바탕 위 누끼 contain(잘림 0)
  // 높이 = 창 폭(인라인 heroH) — aspectRatio 1 + 음수 좌우 여백은 Yoga가 여백 전 폭으로 높이를 잡아 40pt 더 컸다(시뮬 실측 442 vs 음식 402)
  photo: { marginHorizontal: -GUTTER, marginTop: -20, marginBottom: -20, backgroundColor: C.surface2, overflow: 'hidden' }, // 아래 -20 = 목록 gap 상쇄 → 판정 띠·잠금 행이 사진 바로 아래(음식 상세와 같이 붙음)
  photoImage: { position: 'absolute', left: HERO_INSET, right: HERO_INSET, bottom: HERO_INSET }, // top = 상태 표시줄 + 뒤로 원 아래(인라인 — 안전영역 실측)
  back: { position: 'absolute', left: 12, width: 36, height: 36, borderRadius: radius.pill, backgroundColor: 'rgba(20,24,31,0.38)', alignItems: 'center', justifyContent: 'center' }, // 음식 상세 fBtn과 같은 값
  band: { marginHorizontal: -GUTTER }, // 띠 = 화면 폭(음식 상세와 같음) — 페이지 좌우 여백 밖으로
  titleBlock: { gap: 4 },
  maker: { fontFamily: font.body, fontSize: 14, lineHeight: 19, color: C.ink2 },
  meta: { fontFamily: font.body, fontSize: 16, lineHeight: 21, color: C.ink2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  block: { gap: 10 },
  h2: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 26, color: C.ink },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink },
  preview: { fontFamily: font.body, fontSize: 16, lineHeight: 22, color: C.ink2 },
  expanded: { gap: 24 },
  disclaimer: { fontFamily: font.body, fontSize: 14, lineHeight: 19, color: C.ink2 },
  seeLess: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' },
  seeLessText: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: C.ink },
  thickDivider: { height: 8, backgroundColor: '#F5F5F5', marginHorizontal: -GUTTER }, // 음식 상세 thickDivider와 같은 값 — 화면 폭
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, // 음식 상세 ingChipRow(좌우 여백은 페이지가)
  skelLine: { height: 14, borderRadius: radius.xs },
  skelRow: { height: 63, borderRadius: radius.xs },
});

/** KB-981: 루트 스택에서 마지막 스캔 화면부터 현재 화면까지 개수 — 스캔 화면이 없으면 0 */
export function scanFlowDepth(state: { index?: number; routes: readonly { name: string }[] } | undefined): number {
  if (!state) return 0;
  const i = state.routes.map((r) => r.name).lastIndexOf('scan');
  const top = state.index ?? state.routes.length - 1;
  return i < 0 || i > top ? 0 : top - i + 1;
}
