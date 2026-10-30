/**
 * KB-945(P-564·565, 예진 10/31): 섹션 순서 = 음식 상세(Registered) — 사진 → 판정 띠(화면 폭) → 이름 → 굵은 구분선 → What's inside(음식 상세 칩 필터 + 재료 타일 한 그리드:
 * 감지·일치 + 주요 알레르기 + 혼입 가능 — 구 감지 카드·Major allergens 문단·원재료 미리보기를 합침) → 원재료 원문·출처는 접힌 "Ingredients and source"로만 → 굵은 구분선 → 리뷰.
 * 피할 재료 설정·로그인 유도 버튼 제거. KB-947: 비회원·회피 0개 회원 = Safe 띠(예진 결정) — 단 원재료·알레르기 표시가 둘 다 없는 제품은 회원과 같이 "확인 못 함"(false-safe 0).
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
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubHeader } from '@/components/SubHeader';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { RemoteImage } from '@/components/RemoteImage';
import { Shimmer } from '@/components/Skeleton';
import { Chip } from '@/components/Chip';
import { color as C, font, radius } from '@/lib/theme';
import { MessageErrorBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { useAppLanguage } from '@/lib/i18n/useAppLanguage';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { restrictionLabel } from '@/lib/onboarding/data';
import { processedUnavailable, useProcessedDetail } from '@/lib/data/useProcessedFoods';
import { packagedTypeKey, type ProcessedFoodDetail } from '@/lib/api/processedFoodAdapter';
import { PackagedPlaceholder } from '@/features/processedFood/PackagedExplorer';
import { PackagedReviews } from '@/features/processedFood/PackagedReviews';
import { ProductName } from '@/features/processedFood/ProductName';
import { IngredientsText, insideCodes, PackagedDetectedTiles, PackagedUnableBand, PackagedVerdictBand } from '@/features/processedFood/PackagedVerdict';

const GUTTER = 20;
type IngChip = 'all' | 'safe' | 'danger' | 'caution';
const ING_CHIPS: IngChip[] = ['all', 'safe', 'danger', 'caution']; // 음식 상세와 같은 순서
export const PHOTO_RATIO = 223 / 335; // 시안 사진 슬롯 335×223(원본 500×333 비율)
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

/** 판정 근거(KB-901 T-053 — "Egg: 난각칼슘") — 띠 아래 작은 글자. 근거가 없으면 줄 없음 */
function MatchEvidence({ d }: { d: ProcessedFoodDetail }) {
  const { t } = useTranslation();
  const matches = d.verdict === 'AVOID' ? d.avoidMatches : d.verdict === 'CAUTION' ? d.mayContainMatches : [];
  const evidence = matches.filter((m) => m.evidence.length > 0);
  if (evidence.length === 0) return null;
  return (
    <View testID="pf-evidence">
      {evidence.map((m) => (
        <Text key={m.code} style={s.disclaimer} testID={`pf-evidence-${m.code}`}>
          {t('packaged.matchEvidence', { name: restrictionLabel(m.code), evidence: m.evidence.join(', ') })}
        </Text>
      ))}
    </View>
  );
}

export function ProcessedFoodDetailScreen() {
  const { t } = useTranslation();
  const lang = useAppLanguage(); // 구독으로(KB-695 — 렌더 중 i18n.language 직접 읽기는 컴파일러가 굳힌다)
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; scan?: string; charged?: string; free?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const q = useProcessedDetail(id);
  const guest = useIsGuest();
  const meQ = useMe();
  const me = meQ.data;
  const [ingChip, setIngChip] = React.useState<IngChip>('all'); // 음식 상세 What's inside 칩과 같은 필터
  const [expanded, setExpanded] = React.useState(false); // 처음엔 접힘(예진 10/22 Q2)
  const loadMoreReviews = React.useRef<(() => void) | null>(null); // 리뷰 섹션이 채운다 — 바닥 근처 스크롤 = 다음 페이지(무한 스크롤, Read reviews 버튼 없음)
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/food' as Href));
  const d = q.data;
  const unavailable = processedUnavailable(q.error);
  // 한국어 사용자 = 번역이 원문과 같은 언어 — 번역 줄 생략
  const showTranslation = !(lang ?? '').startsWith('ko');

  const viewed = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!d || viewed.current === d.id) return;
    viewed.current = d.id;
    track(EVENTS.food_packaged_detail_view, { product_id: d.id, label_source: d.labelSource });
  }, [d]);

  const toggle = (open: boolean, via: 'ingredients_source' | 'see_less') => {
    setExpanded(open);
    if (d) track(EVENTS.food_packaged_detail_expand, { product_id: d.id, action: via });
  };

  let body: React.ReactNode;
  if (q.isPending) {
    body = (
      <View style={s.pad} testID="pf-skeleton">
        <Shimmer style={s.photo} />
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
    // 원재료·알레르기 표시가 둘 다 없음 = 회원도 verdict null인 제품(#457) — 회피 미설정이어도 Safe로 그리지 않는다
    const noLabel = !d.ingredients.original && !d.allergenStatement;
    const canWrite = FLAGS.reviewsEnabled && FLAGS.reviewsLiveEnabled && FLAGS.packagedReviewWrite;
    const codes = insideCodes(d);
    body = (
      <ScrollView
        contentContainerStyle={[s.pad, { paddingBottom: insets.bottom + 32 }]}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) loadMoreReviews.current?.();
        }}
        testID="pf-detail"
      >
        {/* KB-865 ③(시안 20): 스캔 확정 결과 = 일반 상세와 같은 화면 — "스캔 결과" 띠·불꽃·차감 문구 없음(README) */}
        {/* 시안 08: 사진 335×223 r16 #F7F8FA(상품 8 안쪽 contain) */}
        <View style={s.photo}>
          {d.imageUrl ? (
            // QA #338: 다른 제품 사진이 잠깐 비치던 것 — 상세 전용 recyclingKey + 이번 사진이 뜰 때까지 투명(판정 화면에 엉뚱한 사진 0)
            <RemoteImage key={d.imageUrl} uri={d.imageUrl} style={s.photoImage} contentFit="contain" recyclingKey={`pf-detail-${d.id}`} hideUntilLoaded />
          ) : (
            <PackagedPlaceholder type={d.type} foodType={d.foodType} style={StyleSheet.absoluteFill} />
          )}
        </View>

        {/* KB-945: 판정 띠 = 사진 바로 아래(음식 상세 순서) · KB-914(R-137) 공용 VerdictBand — 서버 verdict 그대로. 판정을 확인할 수 없으면 회색(unable) 띠 */}
        {hasVerdict && d.verdict ? (
          <View style={s.block}>
            <PackagedVerdictBand d={{ ...d, verdict: d.verdict }} safeReason={t('packaged.noAvoidMatches')} style={s.band} testID={`pf-verdict-${d.verdict.toLowerCase()}`} />
            <MatchEvidence d={d} />
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
        ) : (guest || m0) && !noLabel ? (
          // KB-947(예진 10/31 결정): 회피 미설정(비회원·회피 0개) = Safe 띠 — 제목·이유 = 가공 SAFE 키 그대로(보장 표현 0, 새 문구 0)
          <PackagedVerdictBand d={{ ...d, verdict: 'SAFE' }} safeReason={t('packaged.noAvoidMatches')} style={s.band} testID="pf-verdict-safe-unset" />
        ) : guest || m0 || member ? (
          // 원재료·알레르기 표시가 둘 다 없는 제품 = 회원도 verdict null — 판정 없이 "확인 못 함"(#457) = 회색 띠
          <PackagedUnableBand title={t('packaged.notVerified')} reason={t('packaged.notVerifiedBody')} style={s.band} testID="pf-not-verified" />
        ) : null}

        <View style={s.titleBlock}>
          {!!d.maker && <Text style={s.maker}>{d.maker}</Text>}
          {/* KB-914(R-140): 이름 = 공용 ProductName(영어 굵게 + 한국어 작게 — 어느 경로로 와도 같은 표기) · 유형은 그 아래 */}
          <ProductName name={d.name} nameKo={d.nameKo} size="title" lines={4} header testID="pf-name" />
          {(!!d.type || !!d.foodType) && (
            <View style={s.metaRow} testID="pf-meta">
              <Text style={s.meta}>{d.type ? t(packagedTypeKey(d.type)) : d.foodType}</Text>
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

        {/* KB-945: 원재료 원문·알레르기 표시·출처 = 접힌 상태로만(처음 접힘) */}
        {expanded ? (
          <>
            <Expanded d={d} showTranslation={showTranslation} />
            <Pressable style={s.seeLess} onPress={() => toggle(false, 'see_less')} accessibilityRole="button" testID="pf-see-less">
              <Text style={s.seeLessText}>{t('packaged.seeLess')}</Text>
            </Pressable>
          </>
        ) : (
          <Btn variant="ghost" onPress={() => toggle(true, 'ingredients_source')} testID="pf-ingredients-source">{t('packaged.ingredientsAndSource')}</Btn>
        )}

        {FLAGS.reviewsEnabled && FLAGS.reviewsLiveEnabled && <View style={s.thickDivider} />}
        {/* 롤백 스위치(reviewsLiveEnabled off) = 가공식품 리뷰는 목 경로가 없어 목록이 비는데 서버 요약은 남는다 — 섹션째 숨김(Codex #314 R2) */}
        {FLAGS.reviewsEnabled && FLAGS.reviewsLiveEnabled && <PackagedReviews productId={d.id} summary={d.reviewSummary} loadMoreRef={loadMoreReviews} writeInBar={canWrite} />}
      </ScrollView>
    );
    // KB-914(R-137): 하단 고정 CTA = 음식 상세와 같은 알약(구 리뷰 섹션 텍스트 링크 — 섹션 링크는 이 바가 있을 때 숨김)
    if (canWrite) {
      body = (
        <>
          {body}
          <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
            <Btn onPress={() => { track(EVENTS.review_write_tap, { source: 'detail', target_type: 'packaged' }); router.push(`/processed-foods/${d.id}/review` as Href); }} testID="pf-write-review-bar">{t('reviews.writeReview')}</Btn>
          </View>
        </>
      );
    }
  }
  return (
    <View style={s.root}>
      <SubHeader title={t('packaged.detailTitle')} onBack={back} />
      {body}
    </View>
  );
}

// 시안 08·12 실측(2x PNG): 사진 위 20 · 335×223 r16 #F7F8FA · 제조사 13/18 gray-700(사진 아래 20) → 이름 28 bold(위 4) → "한국어명 | 유형" 15/20 gray-700
// · 섹션(제목 20 bold → 본문 15/22 위 10 → 아웃라인 버튼 48 위 12) 간격 20 · 펼침 섹션 간격 24 · See less = 테두리 없는 텍스트 동작
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  pad: { paddingHorizontal: GUTTER, paddingTop: 20, gap: 20 },
  photo: { width: '100%', aspectRatio: 1 / PHOTO_RATIO, borderRadius: radius.md, backgroundColor: C.surface2, overflow: 'hidden' },
  photoImage: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8 },
  band: { marginHorizontal: -GUTTER }, // 띠 = 화면 폭(음식 상세와 같음) — 페이지 좌우 여백 밖으로
  bar: { paddingHorizontal: GUTTER, paddingTop: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.hair },
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
