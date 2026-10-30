/**
 * 가공식품 판정 부품(KB-914 R-137) — 가공식품 상세와 성분표 결과가 같이 쓴다. 음식 상세와 같은 판정 띠(VerdictBand) + 감지 재료 타일(IngredientTile).
 * 판정은 서버 verdict·matches 그대로(앱 판정 0). 띠 제목·이유 문구는 기존 가공식품 키(문구 무변) — 띠 모양·색만 음식 상세와 같다.
 * 타일 위험 마크 = 회원 판정이 있을 때만: 회피 일치 = danger · 혼입 가능 일치 = caution · 그 밖 감지 = safe(내 회피 목록에 없는 재료).
 * 판정이 없으면(비회원·회피 0개·확인 못 함·판정 기준이 바뀐 결과) 마크 0 — 없는 판정을 그리지 않는다(false-safe 0).
 */
import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { VerdictBand, VERDICT_TITLE } from '@/components/VerdictBand';
import { IngredientTile, tile } from '@/components/IngredientTile';
import { useIngredientCatalog } from '@/lib/data/useIngredientCatalog';
import { restrictionLabel } from '@/lib/onboarding/data';
import { color as C, font, type, type RiskState } from '@/lib/theme';
import { VERDICT_RISK, type ProcessedDetection, type ProcessedMatch, type ProcessedVerdict } from '@/lib/api/processedFoodAdapter';
import { detectedCodes, tileRisk, type VerdictFields } from './packagedVerdictLogic';

export { detectedCodes, tileRisk };

const namesOf = (codes: string[]) => codes.map((c) => restrictionLabel(c)).join(', ');


/** 서버 판정 → 띠(제목·이유). AVOID·CAUTION·SAFE_WITH_NOTE = 기존 판정 문장 키 · SAFE = 음식 상세 띠 제목 + "회피 일치 없음" */
/** reason = 호출측 문장(성분표 결과는 결과 전용 문장 키 그대로 — 문구 무변). 없으면 상세 판정 문장 */
export function PackagedVerdictBand({ d, safeReason, reason: reasonOverride, style, testID }: { d: VerdictFields & { verdict: ProcessedVerdict }; safeReason: string; reason?: string | null; style?: ViewStyle; testID: string }) {
  const { t } = useTranslation();
  const state = VERDICT_RISK[d.verdict];
  const [title, reason] =
    d.verdict === 'AVOID' ? [t('packaged.avoidMatchTitle'), t('packaged.avoidMatchBody', { names: namesOf(d.avoidMatches.map((m) => m.code)) })]
    : d.verdict === 'CAUTION' ? [t('packaged.crossContactTitle'), t('packaged.crossContactBody', { names: namesOf(d.mayContainMatches.map((m) => m.code)) })]
    : d.verdict === 'SAFE_WITH_NOTE' ? [t('packaged.unclearTitle'), t('packaged.unclearBody', { items: d.unclearIngredients.join(', ') })]
    : [t(VERDICT_TITLE.safe), safeReason];
  return <VerdictBand state={state} title={title} reason={reasonOverride ?? reason} style={style} testID={testID} />;
}

/** 판정을 확인할 수 없음 = 회색(unable) 띠 — 리본 없는 문장 블록 대신(보수적 — 확인 못 함을 확인 못 함으로) */
export function PackagedUnableBand({ title, reason, style, testID }: { title: string; reason: string; style?: ViewStyle; testID: string }) {
  return <VerdictBand state="unable" title={title} reason={reason} style={style} testID={testID} />;
}

/** 감지 재료 타일 그리드(음식 상세 재료 타일과 같은 부품·격자) — 코드가 없으면 null(호출측 섹션째 숨김). 제목은 호출측 섹션 부품이 단다 */
export function PackagedDetectedTiles({ d, personalized, testID }: {
  d: VerdictFields & { detections: ProcessedDetection[] }; personalized: boolean; testID: string;
}) {
  const cat = useIngredientCatalog();
  const codes = detectedCodes(d);
  if (codes.length === 0) return null;
  return (
    <View style={[tile.grid, st.grid]} testID={testID}>
      {codes.map((code) => (
        <IngredientTile key={code} code={code} name={restrictionLabel(code)} risk={tileRisk(code, d, personalized)} imageUrl={cat.imageUrl(code)} bare testID={`${testID}-${code}`} />
      ))}
    </View>
  );
}

/** 원재료 본문 — 한 체계(R-137 · Q-362): 섹션 제목은 호출측 한 번, 번역·원문은 작은 회색 소제목으로 같은 위계 */
export function IngredientsText({ translated, original, showTranslation, emptyLabel, testID }: {
  translated: string | null; original: string | null; showTranslation: boolean; emptyLabel: string; testID: string;
}) {
  const { t } = useTranslation();
  const tr = showTranslation ? translated : null;
  if (!tr && !original) return <Text style={st.body} testID={`${testID}-empty`}>{emptyLabel}</Text>;
  return (
    <View style={st.texts} testID={testID}>
      {!!tr && (
        <View>
          <Text style={st.sub} testID={`${testID}-translation-label`}>{t('packaged.translationLabel')}</Text>
          <Text style={st.body}>{tr}</Text>
        </View>
      )}
      {!!original && (
        <View>
          {/* 한국어 사용자 = 원문이 곧 본문(소제목 없음) · 그 밖 = "Korean original" 소제목 — 번역이 있든 없든 같은 자리·같은 위계 */}
          {showTranslation && <Text style={st.sub} testID={`${testID}-original-label`}>{t('packaged.koreanOriginal')}</Text>}
          <Text style={st.body} testID={`${testID}-original`}>{original}</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { paddingHorizontal: 0 }, // 호출측 페이지가 이미 좌우 20
  texts: { gap: 12 },
  sub: { ...type.captionMed, color: C.ink3, marginBottom: 2 },
  body: { ...type.body, fontFamily: font.body, lineHeight: 23, color: C.ink },
});
