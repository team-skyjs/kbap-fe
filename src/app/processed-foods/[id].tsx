/**
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
import { RiskBadge } from '@/components/RiskBadge';
import { Shimmer } from '@/components/Skeleton';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { IconLock } from '@/components/icons';
import { color as C, font, riskTone, type RiskState } from '@/lib/theme';
import { MessageErrorBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { useAppLanguage } from '@/lib/i18n/useAppLanguage';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { restrictionLabel } from '@/lib/onboarding/data';
import { processedUnavailable, useProcessedDetail } from '@/lib/data/useProcessedFoods';
import { packagedTypeKey, VERDICT_RISK, type LabelSource, type ProcessedFoodDetail, type ProcessedMayContain } from '@/lib/api/processedFoodAdapter';
import { PackagedPlaceholder } from '@/features/processedFood/PackagedExplorer';
import { FlameShape } from '@/components/FlameShape';
import { PackagedReviews } from '@/features/processedFood/PackagedReviews';

const GUTTER = 20;
export const PHOTO_RATIO = 223 / 335; // 시안 사진 슬롯 335×223(원본 500×333 비율)
export const RAW_CLAMP_LINES = 4;
export const LABEL_SOURCE_KEY: Record<LabelSource, string> = {
  DECLARED: 'packaged.labelDeclared',
  INGREDIENTS_ONLY: 'packaged.labelIngredientsOnly',
  NONE: 'packaged.labelNone',
};
/** 출처 고지 키 → 문구 키. 모르는 키도 자료 출처 문구는 항상(고지 3종 상시). */
const IMAGE_CREDIT: Record<string, string> = { 'processedFood.image.haccp': 'packaged.imageHaccp', 'processedFood.image.off': 'packaged.imageOff' };

// 상태 행 틴트 — 음식 상세 riskRow와 같은 값(theme riskTone: 붉은 틴트 = caution.bg, 노란 틴트 = danger.bg — 시안 인스턴스 이름 뒤바뀜을 그대로 둔 기존 매핑)
const ROW_BG: Record<'danger' | 'caution' | 'unable', string> = { danger: riskTone.caution.bg, caution: riskTone.danger.bg, unable: riskTone.unable.bg };

function StatusRow({ state, title, body, testID }: { state: Extract<RiskState, 'danger' | 'caution' | 'unable'>; title: string; body: string; testID: string }) {
  return (
    <View style={[s.row, { backgroundColor: ROW_BG[state] }]} testID={testID}>
      <RiskBadge state={state} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSub}>{body}</Text>
      </View>
    </View>
  );
}

/** 원재료 원문 — 4줄을 넘을 때만 접기(같은 폭 숨김 측정 Text로 전체 줄 수 — KB-824 정확히 N줄 오판 방지). */
export function RawText({ text }: { text: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const [lines, setLines] = React.useState<number | null>(null);
  const long = lines != null && lines > RAW_CLAMP_LINES;
  return (
    <View style={{ gap: 20 }}>
      <View>
        <Text style={s.raw} numberOfLines={expanded || (lines != null && !long) ? undefined : RAW_CLAMP_LINES} testID="pf-raw">{text}</Text>
        <Text
          style={[s.raw, s.measure]}
          onTextLayout={(e) => setLines(e.nativeEvent.lines.length)}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          pointerEvents="none"
          testID="pf-raw-measure"
        >
          {text}
        </Text>
      </View>
      {long && (
        <Btn variant="ghost" onPress={() => setExpanded((v) => !v)} style={s.outlineBtn} testID="pf-raw-toggle">
          {t(expanded ? 'packaged.showLess' : 'packaged.showAll')}
        </Btn>
      )}
    </View>
  );
}

/** 판정 섹션 — 상세와 성분표 분석 결과(P-508 PackagedScanFlow)가 같이 쓴다. mayContain = 성분표 분석만(함유 가능 — 검출 아님, 회색 칩) */
export type VerdictData = Pick<ProcessedFoodDetail, 'labelSource' | 'detections' | 'avoidance'> & { mayContain?: ProcessedMayContain[] };
export function Verdict({ d, onLogin }: { d: VerdictData; onLogin: () => void }) {
  const { t } = useTranslation();
  const found = (fromLabel: boolean, evidence: string) => t(fromLabel ? 'packaged.foundOnLabel' : 'packaged.foundInIngredients', { evidence });
  return (
    <View style={s.section} testID="pf-verdict">
      <Text style={s.h2}>{t('packaged.detectedTitle')}</Text>
      {/* labelSource별 상단 문구 — 필수(판독 근거를 먼저 말한다) */}
      <Text style={s.notice} testID="pf-label-source">{t(LABEL_SOURCE_KEY[d.labelSource])}</Text>
      {d.detections.map((x) => (
        <StatusRow key={`det-${x.code}`} state="danger" title={t('packaged.detected', { name: restrictionLabel(x.code) })} body={found(x.fromLabel, x.evidence)} testID={`pf-det-${x.code}`} />
      ))}
      {/* 검출 0 = "없음"이 아니라 미확인 — 회색 */}
      {d.detections.length === 0 && (
        <StatusRow state="unable" title={t('packaged.notVerified')} body={t('packaged.notVerifiedBody')} testID="pf-none-detected" />
      )}
      {/* P-508: 함유 가능(같은 제조시설·혼입 표기) — 검출로 세지 않는 참고 정보라 판정 색이 아니라 회색 칩 */}
      {!!d.mayContain?.length && (
        <View style={s.mayBox} testID="pf-may-contain">
          <Text style={s.mayTitle}>{t('packaged.mayContainTitle')}</Text>
          <View style={s.chips}>
            {d.mayContain.map((m) => (
              <View key={m.code} style={s.chip} testID={`pf-may-${m.code}`}>
                <Text style={s.chipText}>{restrictionLabel(m.code)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {d.avoidance == null ? (
        <Pressable style={s.lock} onPress={onLogin} accessibilityRole="button" testID="pf-login-compare">
          <IconLock size={16} color={C.ink2} />
          <Text style={s.lockText}>{t('packaged.loginToCompare')}</Text>
          <Text style={s.lockCta}>{t('intro.signUp')}</Text>
        </Pressable>
      ) : d.avoidance.length > 0 ? (
        <View style={s.section} testID="pf-my-avoid">
          <Text style={s.h2}>{t('packaged.myAvoidTitle')}</Text>
          {d.avoidance.map((a) =>
            a.detected ? (
              <StatusRow key={a.code} state="danger" title={t('packaged.detected', { name: restrictionLabel(a.code) })} body={a.evidence.length ? found(false, a.evidence.join(', ')) : t('packaged.detectedNoEvidence')} testID={`pf-avoid-${a.code}`} />
            ) : (
              <StatusRow key={a.code} state="unable" title={t('packaged.notVerifiedName', { name: restrictionLabel(a.code) })} body={t('packaged.notVerifiedBody')} testID={`pf-avoid-${a.code}`} />
            ),
          )}
        </View>
      ) : null}
    </View>
  );
}

/** KB-870(Codex #335): 운영 채널(운영 서버 processed-foods 404) = 직접 링크·공유 링크로 와도 상세 0(모듈 상수로 고름 — 감싸는 컴포넌트 없음) */
const GoneHome = () => <Redirect href="/" />;
export default FLAGS.processedFoodEnabled ? ProcessedFoodDetailScreen : GoneHome;

/** 코드 → 표시 이름 목록(회피 재료 라벨) */
const namesOf = (codes: string[]) => codes.map((c) => restrictionLabel(c)).join(', ');

/** 원재료 미리보기(시안 08·12: 번역 1줄 + 원문 1줄, 말줄임) — 번역 전(#462)·한국어 사용자 = 원문 1줄 */
function IngredientsPreview({ d, showTranslation }: { d: ProcessedFoodDetail; showTranslation: boolean }) {
  const { t } = useTranslation();
  const { translated, original } = d.ingredients;
  if (!translated && !original) return <Text style={s.body} testID="pf-no-raw">{t('packaged.noIngredients')}</Text>;
  return (
    <View testID="pf-ingredients-preview">
      {showTranslation && !!translated && <Text style={s.preview} numberOfLines={1}>{translated}</Text>}
      {!!original && <Text style={s.preview} numberOfLines={1}>{original}</Text>}
    </View>
  );
}

/** 펼침(시안 09·38·51·52) — 제자리. SAFE 회원만 "Your avoid list"(나머지는 위 판정 문장이 있다 — 예진 10/22 Q4) */
function Expanded({ d, showTranslation, showAvoidList }: { d: ProcessedFoodDetail; showTranslation: boolean; showAvoidList: boolean }) {
  const { t } = useTranslation();
  const imageCredit = d.image ? IMAGE_CREDIT[d.image.attributionKey] : undefined;
  const c002 = d.sourceProvider === 'C002';
  return (
    <View style={s.expanded} testID="pf-expanded">
      {showAvoidList && (
        <View style={s.block} testID="pf-your-avoid">
          <Text style={s.h2}>{t('packaged.yourAvoidList')}</Text>
          <Text style={s.body}>{t('packaged.noAvoidMatches')}</Text>
        </View>
      )}
      <View style={s.block} testID="pf-ingredients">
        <Text style={s.h2}>{t('packaged.ingredientsHeading')}</Text>
        {showTranslation && !!d.ingredients.translated ? (
          <View>
            <Text style={s.body}>{t('packaged.translationLabel')}</Text>
            <Text style={s.body}>{d.ingredients.translated}</Text>
          </View>
        ) : null}
        {!d.ingredients.original && !d.ingredients.translated && <Text style={s.body} testID="pf-no-raw">{t('packaged.noIngredients')}</Text>}
      </View>
      {!!d.ingredients.original && (
        <View style={s.block} testID="pf-original">
          <Text style={s.h2}>{t('packaged.koreanOriginal')}</Text>
          <Text style={s.body} testID="pf-raw">{d.ingredients.original}</Text>
        </View>
      )}
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

/** 회원 판정 문장(시안 10·11·11b) — 서버 verdict + matches 그대로(앱 판정 0) */
function VerdictText({ d }: { d: ProcessedFoodDetail }) {
  const { t } = useTranslation();
  let title: string;
  let body: string;
  if (d.verdict === 'AVOID') {
    title = t('packaged.avoidMatchTitle');
    body = t('packaged.avoidMatchBody', { names: namesOf(d.avoidMatches.map((m) => m.code)) });
  } else if (d.verdict === 'CAUTION') {
    title = t('packaged.crossContactTitle');
    body = t('packaged.crossContactBody', { names: namesOf(d.mayContainMatches.map((m) => m.code)) });
  } else {
    title = t('packaged.unclearTitle');
    body = t('packaged.unclearBody', { items: d.unclearIngredients.join(', ') });
  }
  return (
    <View style={s.block} testID={`pf-verdict-${(d.verdict ?? '').toLowerCase()}`}>
      <Text style={s.h2} accessibilityRole="header">{title}</Text>
      <Text style={s.body}>{body}</Text>
    </View>
  );
}

/** 비회원·회피 0개(시안 12·13): 주요 알레르기(함유) + 혼입 가능(#457 mayContain) + 가입·설정 유도 */
function MajorAllergens({ d, guest, onAction }: { d: ProcessedFoodDetail; guest: boolean; onAction: () => void }) {
  const { t } = useTranslation();
  // 필드 없음(null) = 모름 → 보수적 폴백: 검출(detections) 코드를 함유로 · 그것도 없으면 "확인할 수 없음"(없음 단정 0, Codex #338 P1)
  const contains = d.majorAllergens ?? (d.detections.length ? [...new Set(d.detections.map((x) => x.code))] : null);
  const text =
    contains == null ? t('packaged.majorUnavailable')
    : contains.length > 0 ? t('packaged.containsNames', { names: namesOf(contains) })
    : t(d.labelSource === 'NONE' ? 'packaged.majorUnavailable' : 'packaged.majorNoneFound');
  return (
    <View style={s.block} testID="pf-major">
      <Text style={s.h2}>{t('packaged.majorAllergensTitle')}</Text>
      <View>
        {/* 비어 있어도 "없음" 단정 금지 — 판독 근거가 없으면 확인 불가, 있으면 "찾지 못함" */}
        <Text style={s.body} testID="pf-major-contains">{text}</Text>
        {d.mayContain.length > 0 && (
          <Text style={s.body} testID="pf-major-may">{t('packaged.mayContainNames', { names: namesOf(d.mayContain.map((m) => m.code)) })}</Text>
        )}
      </View>
      <Btn variant="ghost" onPress={onAction} testID={guest ? 'pf-sign-in' : 'pf-set-avoid'}>
        {t(guest ? 'packaged.signInToPersonalize' : 'packaged.setAvoidIngredients')}
      </Btn>
    </View>
  );
}

export function ProcessedFoodDetailScreen() {
  const { t } = useTranslation();
  const lang = useAppLanguage(); // 구독으로(KB-695 — 렌더 중 i18n.language 직접 읽기는 컴파일러가 굳힌다)
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; scan?: string; charged?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  // KB-813: 스캔 확정에서 온 경우 = "스캔 결과" 띠. 차감 표시는 서버 confirm 응답의 charged(파라미터로 전달)만 — 추정 0
  const fromScan = params.scan === '1';
  const charged = params.charged === '1';
  const chargeUnknown = params.charged === 'u'; // 앞선 확정 전송 실패 뒤 재확정 — 차감 여부를 단정하지 않는다(남은 횟수는 프로필에서)
  const q = useProcessedDetail(id);
  const guest = useIsGuest();
  const { data: me } = useMe();
  const [gate, setGate] = React.useState(false);
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

  const toggle = (open: boolean, via: 'see_detail' | 'ingredients_source' | 'see_less') => {
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
    const risk = member && d.verdict ? VERDICT_RISK[d.verdict] : null;
    const verdictText = member && (d.verdict === 'AVOID' || d.verdict === 'CAUTION' || d.verdict === 'SAFE_WITH_NOTE');
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
        {fromScan && (
          <View style={s.scanBanner} testID="pf-scan-result">
            <View style={s.flameBox} pointerEvents="none">
              <FlameShape scale={0.2} state={charged ? 'active' : 'empty'} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.scanTitle}>{t('packagedScan.resultTitle')}</Text>
              <Text style={s.scanSub} testID="pf-scan-charge">{t(charged ? 'packagedScan.scanUsed' : chargeUnknown ? 'packagedScan.chargeSeeHome' : 'packagedScan.noScanUsed')}</Text>
            </View>
          </View>
        )}
        {/* 시안 08: 사진 335×223 r16 #F7F8FA(상품 8 안쪽 contain) · 판정 리본 22×29 좌상단 x10 y0 그림자 없음(목록 카드와 같은 배지) */}
        <View style={s.photo}>
          {d.imageUrl ? (
            <RemoteImage uri={d.imageUrl} style={s.photoImage} contentFit="contain" recyclingKey={`pf-${d.id}`} />
          ) : (
            <PackagedPlaceholder type={d.type} foodType={d.foodType} style={StyleSheet.absoluteFill} />
          )}
          {risk && <View style={s.badge}><RiskBadge state={risk} size={22} flat testID={`pf-badge-${risk}`} /></View>}
        </View>
        <View style={s.titleBlock}>
          {!!d.maker && <Text style={s.maker}>{d.maker}</Text>}
          <Text style={s.name} accessibilityRole="header">{d.name}</Text>
          {/* 한국어명 | 유형 — 시안의 세로 막대 구분자(가운데 점 금지 규칙과 무관) */}
          {(!!d.nameKo || !!d.type || !!d.foodType) && (
            <Text style={s.meta}>{[d.nameKo, d.type ? t(packagedTypeKey(d.type)) : d.foodType].filter(Boolean).join(' | ')}</Text>
          )}
        </View>

        {guest || m0 ? (
          <MajorAllergens d={d} guest={guest} onAction={() => (guest ? setGate(true) : router.push('/profile/restrictions' as Href))} />
        ) : member && d.verdict == null ? (
          // 원재료·알레르기 표시가 둘 다 없는 제품 = 회원도 verdict null — 리본 없이 "확인 못 함"(#457)
          <View style={s.block} testID="pf-not-verified">
            <Text style={s.h2}>{t('packaged.notVerified')}</Text>
            <Text style={s.body}>{t('packaged.notVerifiedBody')}</Text>
          </View>
        ) : verdictText ? (
          <VerdictText d={d} />
        ) : null}

        {expanded ? (
          <>
            <Expanded d={d} showTranslation={showTranslation} showAvoidList={member && d.verdict === 'SAFE'} />
            <Pressable style={s.seeLess} onPress={() => toggle(false, 'see_less')} accessibilityRole="button" testID="pf-see-less">
              <Text style={s.seeLessText}>{t('packaged.seeLess')}</Text>
            </Pressable>
          </>
        ) : verdictText ? (
          <Btn variant="ghost" onPress={() => toggle(true, 'ingredients_source')} testID="pf-ingredients-source">{t('packaged.ingredientsAndSource')}</Btn>
        ) : (
          <View style={s.block}>
            <Text style={s.h2}>{t('packaged.ingredientsHeading')}</Text>
            <IngredientsPreview d={d} showTranslation={showTranslation} />
            <Btn variant="ghost" onPress={() => toggle(true, 'see_detail')} testID="pf-see-detail">{t('packaged.seeDetail')}</Btn>
          </View>
        )}

        {/* 롤백 스위치(reviewsLiveEnabled off) = 가공식품 리뷰는 목 경로가 없어 목록이 비는데 서버 요약은 남는다 — 섹션째 숨김(Codex #314 R2) */}
        {FLAGS.reviewsEnabled && FLAGS.reviewsLiveEnabled && <PackagedReviews productId={d.id} summary={d.reviewSummary} loadMoreRef={loadMoreReviews} />}
      </ScrollView>
    );
  }
  return (
    <View style={s.root}>
      <SubHeader title={t('packaged.detailTitle')} onBack={back} />
      {body}
      <AuthGateSheet context="risk" open={gate} onClose={() => setGate(false)} />
    </View>
  );
}

// 시안 08·12 실측(2x PNG): 사진 위 20 · 335×223 r16 #F7F8FA · 제조사 13/18 gray-700(사진 아래 20) → 이름 28 bold(위 4) → "한국어명 | 유형" 15/20 gray-700
// · 섹션(제목 20 bold → 본문 15/22 위 10 → 아웃라인 버튼 48 위 12) 간격 20 · 펼침 섹션 간격 24 · See less = 테두리 없는 텍스트 동작
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  pad: { paddingHorizontal: GUTTER, paddingTop: 20, gap: 20 },
  photo: { width: '100%', aspectRatio: 1 / PHOTO_RATIO, borderRadius: 16, backgroundColor: C.surface2, overflow: 'hidden' },
  photoImage: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8 },
  badge: { position: 'absolute', left: 10, top: 0 },
  titleBlock: { gap: 4 },
  maker: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  name: { fontFamily: font.bodyBold, fontSize: 28, lineHeight: 34, color: C.ink },
  meta: { fontFamily: font.body, fontSize: 15, lineHeight: 20, color: C.ink2 },
  block: { gap: 10 },
  h2: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 26, color: C.ink },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: C.ink },
  preview: { fontFamily: font.body, fontSize: 15, lineHeight: 21, color: C.ink2 },
  expanded: { gap: 24 },
  disclaimer: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  seeLess: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' },
  seeLessText: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: C.ink },
  // 구 판정 부품(성분표 결과 — ③단계에서 교체)
  section: { gap: 20 },
  notice: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2, marginTop: -12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 12, paddingHorizontal: 20, minHeight: 63, borderBottomWidth: 0.5, borderBottomColor: '#D5DFE7' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: C.ink },
  rowSub: { fontSize: 13, fontWeight: '500', color: C.ink2, lineHeight: 18 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, paddingVertical: 13, minHeight: 44, backgroundColor: C.surface2, borderBottomWidth: 0.5, borderBottomColor: '#D5DFE7' },
  lockText: { flex: 1, fontSize: 13, fontWeight: '400', color: C.ink2 },
  lockCta: { fontSize: 13, fontWeight: '700', color: C.primaryText },
  raw: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: C.ink },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  outlineBtn: { minHeight: 40, paddingVertical: 8 },
  scanBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, backgroundColor: C.surface2 },
  flameBox: { width: 24, height: 30, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  scanTitle: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 20, color: C.ink },
  scanSub: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  skelLine: { height: 14, borderRadius: 4 },
  skelRow: { height: 63, borderRadius: 4 },
  mayBox: { gap: 8 },
  mayTitle: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.surface2 },
  chipText: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
});
