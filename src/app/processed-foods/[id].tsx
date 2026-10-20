/**
 * 가공식품 상세 (KB-812, D-32 Product details 12338:36272 · 전체 12338:37427 · R-95 확정 메모) — `/processed-foods/[id]`.
 * 사진 335×223(없으면 유형 플레이스홀더, 출처 캡션) → 제조사·제품명·유형 → 판정 → 원재료 원문(접기) → 알레르기 표시(표시란 있을 때만)
 * → 출처 고지(접히지 않는 본문 — 자료·사진·상표 3종) → (리뷰 = 2차, 자리 비움).
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
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
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
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { restrictionLabel } from '@/lib/onboarding/data';
import { processedUnavailable, useProcessedDetail } from '@/lib/data/useProcessedFoods';
import type { LabelSource, ProcessedFoodDetail } from '@/lib/api/processedFoodAdapter';
import { PackagedPlaceholder } from '@/features/processedFood/PackagedExplorer';
import { FlameShape } from '@/components/FlameShape';

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
function RawText({ text }: { text: string }) {
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

function Verdict({ d, onLogin }: { d: ProcessedFoodDetail; onLogin: () => void }) {
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
      {d.unmapped.map((u, i) => (
        <StatusRow key={`un-${i}`} state="caution" title={t('packaged.needsChecking')} body={t('packaged.unmappedBody', { text: u })} testID={`pf-unmapped-${i}`} />
      ))}
      {/* 검출 0 = "없음"이 아니라 미확인 — 회색 */}
      {d.detections.length === 0 && (
        <StatusRow state="unable" title={t('packaged.notVerified')} body={t('packaged.notVerifiedBody')} testID="pf-none-detected" />
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

export default function ProcessedFoodDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; scan?: string; charged?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  // KB-813: 스캔 확정에서 온 경우 = "스캔 결과" 띠. 차감 표시는 서버 confirm 응답의 charged(파라미터로 전달)만 — 추정 0
  const fromScan = params.scan === '1';
  const charged = params.charged === '1';
  const chargeUnknown = params.charged === 'u'; // 앞선 확정 전송 실패 뒤 재확정 — 차감 여부를 단정하지 않는다(남은 횟수는 프로필에서)
  const q = useProcessedDetail(id);
  const [gate, setGate] = React.useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/food' as Href));
  const d = q.data;
  const unavailable = processedUnavailable(q.error);

  const viewed = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!d || viewed.current === d.id) return;
    viewed.current = d.id;
    track(EVENTS.food_packaged_detail_view, { product_id: d.id, label_source: d.labelSource });
  }, [d]);

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
  } else if (unavailable || !d) {
    // 404·410은 캐시가 있어도 이긴다(내린·단종 제품의 옛 판정을 보이지 않는다)
    const kind = unavailable ?? 'error';
    body = (
      <View style={[s.pad, { gap: 16 }]} testID={`pf-${kind}`}>
        <Text style={s.stateTitle}>{t(kind === 'discontinued' ? 'packaged.discontinuedTitle' : kind === 'gone' ? 'packaged.goneTitle' : 'packaged.errorTitle')}</Text>
        <Text style={s.stateBody}>{t(kind === 'discontinued' ? 'packaged.discontinuedBody' : kind === 'gone' ? 'packaged.goneBody' : 'packaged.errorBody')}</Text>
        {kind === 'error' && <Btn variant="ghost" onPress={() => void q.refetch()} testID="pf-retry">{t('common.tryAgain')}</Btn>}
        <Btn variant="ghost" onPress={back} testID="pf-back">{t('packaged.backToList')}</Btn>
      </View>
    );
  } else {
    const imageCredit = d.image ? IMAGE_CREDIT[d.image.attributionKey] : undefined;
    body = (
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: insets.bottom + 32 }]} testID="pf-detail">
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
        <View>
          {d.imageUrl ? (
            <RemoteImage uri={d.imageUrl} style={s.photo} recyclingKey={`pf-${d.id}`} />
          ) : (
            <PackagedPlaceholder type={d.type} foodType={d.foodType} style={s.photo} />
          )}
          {!!imageCredit && <Text style={s.caption} testID="pf-photo-credit">{t(imageCredit)}</Text>}
        </View>
        {!!d.maker && <Text style={s.meta}>{d.maker}</Text>}
        <Text style={s.name} accessibilityRole="header">{d.name}</Text>
        {!!d.foodType && <Text style={s.meta}>{d.type ? t(`packaged.type.${d.type}`) : d.foodType}</Text>}

        <Verdict d={d} onLogin={() => setGate(true)} />

        <View style={s.section}>
          <Text style={s.h2}>{t('packaged.ingredientsTitle')}</Text>
          <Text style={s.meta}>{t('packaged.koreanOriginal')}</Text>
          {d.rawMaterials ? <RawText text={d.rawMaterials} /> : <Text style={s.raw} testID="pf-no-raw">{t('packaged.noIngredients')}</Text>}
        </View>

        {!!d.allergens && (
          <View style={s.section} testID="pf-allergens">
            <Text style={s.h2}>{t('packaged.allergenTitle')}</Text>
            <Text style={s.raw}>{d.allergens}</Text>
          </View>
        )}

        {/* 출처 고지 3종 — 접히지 않는 본문(R-95): 자료 출처 · 사진 출처(있을 때) · 제조사 무관·상표 */}
        <View style={s.sourceBox} testID="pf-source">
          <View>
            <Text style={s.source}>{t('packaged.sourceData1')}</Text>
            <Text style={s.source}>{t('packaged.sourceData2')}</Text>
          </View>
          {!!imageCredit && <Text style={s.source} testID="pf-source-image">{t(imageCredit)}</Text>}
          <Text style={s.source} testID="pf-source-disclaimer">{t('packaged.disclaimer')}</Text>
        </View>

        {FLAGS.packagedLabelScan && (
          // F2(KB-813)에서 성분표 촬영 진입으로 바꾼다 — 그때까지 플래그 off(숨김)
          <Btn variant="ghost" onPress={() => router.navigate('/scan' as Href)} style={s.outlineBtn} testID="pf-label-scan">{t('packaged.scanLabel')}</Btn>
        )}
        {/* 리뷰 = 2차(R-101 뒤) — 자리만 */}
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

// 시안 실측(2x PNG, 12338:37427): 블록 간격 20 · 사진 335×223 r16 · 제조사·유형 13 gray-700 · 제품명 24 bold · 소제목 16 semibold
// · 상태 행 = 음식 상세 riskRow 값 · 원문 15/22 · 출처 박스 #F7F8FA pad 16 · 접기 버튼 아웃라인 40
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  pad: { paddingHorizontal: GUTTER, paddingTop: 16, gap: 20 },
  photo: { width: '100%', aspectRatio: 1 / PHOTO_RATIO, borderRadius: 16 },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16, color: C.ink2, marginTop: 8 },
  meta: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  name: { fontFamily: font.bodyBold, fontSize: 24, lineHeight: 30, color: C.ink },
  section: { gap: 20 },
  h2: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 24, color: C.ink },
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
  sourceBox: { backgroundColor: C.surface2, padding: 16, gap: 8 },
  source: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  scanBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, backgroundColor: C.surface2 },
  flameBox: { width: 24, height: 30, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  scanTitle: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 20, color: C.ink },
  scanSub: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2 },
  stateTitle: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 28, color: C.ink },
  stateBody: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: C.ink2 },
  skelLine: { height: 14, borderRadius: 4 },
  skelRow: { height: 63, borderRadius: 4 },
});
