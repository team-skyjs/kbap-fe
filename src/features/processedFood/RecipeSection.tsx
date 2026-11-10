/**
 * RecipeSection — KB-990 가공식품 상세 조리법(D-34 B안 확정: B1 요약 카드 12442:46628 · B2 시트 12442:46697).
 * 수치·스타일명 = kbap-design/exports/D-34/README.md "Implementation numbers"(pt, 375 기준). 높이는 전부 hug(i18n).
 * - 위험도 색 0: 브랜드 색은 단계 번호 원(Main 12% + Main-pressed)뿐, 주의 박스는 회색 외곽선.
 * - 가운데 점 0: 카드 행 사실은 간격(12)으로만 구분.
 * - 문구: 단계·주의 = 서버 번역 원문 그대로, 타일·요약의 수치 문구(ml·분/초·W·물 선)는 FE i18n.
 * - 로딩: 조리법은 상세 응답과 같이 온다 — 상세 스켈레톤이 덮고, 섹션 자체 로딩 상태 없음.
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { Chip } from '@/components/Chip';
import { IconAlertTri, IconChevron, IconClose, IconDroplet, IconMicrowave, IconTabFood, IconTimer } from '@/components/icons';
import { color as C, radius } from '@/lib/theme';
import { useBottomInset } from '@/lib/useBottomInset';
import type { Recipe, RecipeMethod, RecipeMethodType } from '@/lib/api/recipeAdapter';

type TFn = (k: string, o?: Record<string, unknown>) => string;

// DS 팔레트(README 표의 이름) — 테마에 없는 값만 여기서 이름 붙인다
const GRAY_50 = C.surface2; // #F7F8FA
const GRAY_900 = '#2F3137'; // Chip INK_ACTIVE와 같은 값
const GRAY_800 = C.gray800;
const MAIN_12 = 'rgba(255,113,52,0.12)'; // Main color 12%(페인트 채움, 스타일 아님)
const MAIN_PRESSED = C.primaryText; // #BE460F

const METHOD_KEY: Record<RecipeMethodType, string> = { MICROWAVE: 'packaged.recipe.microwave', BOILING_WATER: 'packaged.recipe.boilingWater' };
const LINE_KEY = { INNER: 'packaged.recipe.lineInner', OUTER: 'packaged.recipe.lineOuter', COVER_NOODLES: 'packaged.recipe.lineCover' } as const;

/** 초 → "2 min" · "40 s" · "2 min 40 s"(로케일별 약어 — 단위 약어는 수량과 무관해 복수형 키 불필요). */
export function formatDuration(seconds: number, t: TFn): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m && s) return t('packaged.recipe.minSec', { min: m, sec: s });
  return m ? t('packaged.recipe.min', { value: m }) : t('packaged.recipe.sec', { value: s });
}

/** 물 = ml 우선, 없으면 물 선. 둘 다 없으면 null. */
export function waterText(m: RecipeMethod, t: TFn): string | null {
  if (m.waterMl != null) return t('packaged.recipe.ml', { value: m.waterMl });
  return m.waterLine ? t(LINE_KEY[m.waterLine]) : null;
}

/** B1 행 사실(최대 2개): 물 + 첫 전력(전자레인지) / 물 + 대기(끓는 물). */
export function summaryFacts(m: RecipeMethod, t: TFn): string[] {
  const water = waterText(m, t);
  const p = m.power[0];
  const second =
    m.type === 'MICROWAVE' && p
      ? t('packaged.recipe.atWatt', { time: formatDuration(p.seconds, t), watt: p.watt })
      : m.waitSeconds != null
        ? formatDuration(m.waitSeconds, t)
        : null;
  return [water, second].filter((x): x is string => !!x);
}

type Tile = { key: string; icon: 'water' | 'microwave' | 'timer'; label: string; value: string };
/** B2 수치 타일: 전자레인지 = 물·첫 W·둘째 W / 끓는 물 = 물·대기. 값이 없는 타일은 빠진다. */
export function methodTiles(m: RecipeMethod, t: TFn): Tile[] {
  const tiles: Tile[] = [];
  const water = waterText(m, t);
  if (water) tiles.push({ key: 'water', icon: 'water', label: t('packaged.recipe.water'), value: water });
  if (m.type === 'MICROWAVE') {
    for (const p of m.power.slice(0, 2)) tiles.push({ key: `w${p.watt}`, icon: 'microwave', label: t('packaged.recipe.watt', { value: p.watt }), value: formatDuration(p.seconds, t) });
  } else if (m.waitSeconds != null) {
    tiles.push({ key: 'wait', icon: 'timer', label: t('packaged.recipe.wait'), value: formatDuration(m.waitSeconds, t) });
  }
  return tiles;
}

/** P-645: 와트 타일 = 전자레인지(시안 D-34 B), 대기 = 타이머, 물 = 물방울 */
const TileIcon = ({ icon }: { icon: Tile['icon'] }) =>
  icon === 'water' ? <IconDroplet size={16} color={C.ink3} /> : icon === 'microwave' ? <IconMicrowave size={16} color={C.ink3} /> : <IconTimer size={16} color={C.ink3} />;

const MethodIcon = ({ type }: { type: RecipeMethodType }) =>
  type === 'MICROWAVE' ? <IconMicrowave size={24} color={GRAY_800} /> : <IconTabFood size={24} color={GRAY_800} />;

export function RecipeSection({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState<RecipeMethodType | null>(null);
  return (
    <View style={s.section} testID="pf-recipe">
      <Text style={s.title} accessibilityRole="header">{t('packaged.recipe.title')}</Text>
      <View style={s.card}>
        {recipe.methods.map((m, i) => (
          <Pressable
            key={m.type}
            style={[s.row, i > 0 && s.rowDivider]}
            onPress={() => setOpen(m.type)}
            accessibilityRole="button"
            testID={`pf-recipe-row-${m.type}`}
          >
            <MethodIcon type={m.type} />
            <View style={s.rowText}>
              <Text style={s.rowName}>{t(METHOD_KEY[m.type])}</Text>
              <View style={s.facts}>
                {summaryFacts(m, t).map((f) => (
                  <Text key={f} style={s.fact}>{f}</Text>
                ))}
              </View>
            </View>
            <IconChevron size={20} color={C.gray500} />
          </Pressable>
        ))}
      </View>
      {open && <RecipeSheet recipe={recipe} initial={open} onClose={() => setOpen(null)} t={t} />}
    </View>
  );
}

function RecipeSheet({ recipe, initial, onClose, t }: { recipe: Recipe; initial: RecipeMethodType; onClose: () => void; t: TFn }) {
  const [sel, setSel] = React.useState(initial);
  const bottom = useBottomInset();
  const m = recipe.methods.find((x) => x.type === sel) ?? recipe.methods[0];
  const tiles = methodTiles(m, t);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} testID="pf-recipe-backdrop">
        <Pressable style={[s.sheet, { paddingBottom: 34 + bottom }]} noTrack onPress={() => {}} testID="pf-recipe-sheet">
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={[s.title, s.headerTitle]} accessibilityRole="header">{t('packaged.recipe.title')}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')} testID="pf-recipe-close">
              <IconClose size={24} color={GRAY_800} />
            </Pressable>
          </View>
          {recipe.methods.length > 1 && (
            <View style={s.chips}>
              {recipe.methods.map((x) => (
                <Chip key={x.type} label={t(METHOD_KEY[x.type])} selected={x.type === m.type} onPress={() => setSel(x.type)} testID={`pf-recipe-chip-${x.type}`} />
              ))}
            </View>
          )}
          {tiles.length > 0 && (
            <View style={s.tiles}>
              {tiles.map((tl) => (
                <View key={tl.key} style={s.tile} testID={`pf-recipe-tile-${tl.key}`}>
                  <View style={s.tileLabelRow}>
                    <TileIcon icon={tl.icon} />
                    <Text style={s.tileLabel}>{tl.label}</Text>
                  </View>
                  <Text style={s.tileValue}>{tl.value}</Text>
                </View>
              ))}
            </View>
          )}
          {/* P-646(Codex P2 11/4): 시트 최대 높이 85% — 손잡이·헤더(제목·X)·칩·타일은 고정, 단계·주의·출처만 스크롤(단계 12·주의 4·큰 글자에서도 X가 화면 안) */}
          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false} testID="pf-recipe-body">
          {m.steps.length > 0 && (
            <View style={s.steps}>
              {m.steps.map((st, i) => (
                <View key={i} style={s.step}>
                  <View style={s.num}>
                    <Text style={s.numText}>{i + 1}</Text>
                  </View>
                  <Text style={s.stepText}>{st}</Text>
                </View>
              ))}
            </View>
          )}
          {m.cautions.map((c, i) => (
            <View key={i} style={s.caution} testID="pf-recipe-caution">
              <IconAlertTri size={18} color={C.ink2} />
              <Text style={s.cautionText}>{c}</Text>
            </View>
          ))}
          <Text style={s.source}>{t('packaged.recipe.source')}</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// README "Implementation numbers" — 텍스트 = DS 스타일(크기/굵기), 색 = DS 페인트 이름
const s = StyleSheet.create({
  // B1: 섹션 pad 24/20/24(위아래 8 띠는 호출측) · 제목 → 카드 12
  // P-645: 좌우 = 이웃 섹션(상품명·What's inside — 상세 화면 GUTTER 20)과 같은 값. 시안은 16이지만 화면 전체 16 변경은 범위 밖이라 경계를 한 줄로 맞춘다
  section: { paddingTop: 24, paddingBottom: 24, paddingHorizontal: 20, gap: 12, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: C.ink }, // title2-bold / gray-1000
  card: { borderRadius: radius.md, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }, // r12 · gray-200
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowName: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: C.ink }, // subtitle2-sbold
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  fact: { fontSize: 13, lineHeight: 18, fontWeight: '400', color: C.ink2 }, // caption1-regular / gray-700
  // B2
  backdrop: { flex: 1, backgroundColor: 'rgba(28,30,33,0.5)', justifyContent: 'flex-end' }, // gray-1000 50%
  sheet: { maxHeight: '85%', backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 10, paddingHorizontal: 16, gap: 16 },
  body: { flexShrink: 1 }, // 시트 maxHeight 안에서 줄어들어 스크롤(헤더는 밀려나지 않음)
  bodyContent: { gap: 16 }, // 시트 gap과 같은 간격
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.pill, backgroundColor: C.line2 }, // gray-300
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tiles: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  tile: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: GRAY_50, gap: 6 },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '500', color: C.ink3 }, // caption2-medium / gray-600
  tileValue: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: C.ink }, // subtitle1-sbold
  steps: { gap: 14 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  num: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: MAIN_12, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: MAIN_PRESSED }, // caption2-sbold
  stepText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '400', color: GRAY_900 }, // subtitle2-regular / gray-900
  caution: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: C.line },
  cautionText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500', color: GRAY_800 }, // body-l3-medium / gray-800
  source: { fontSize: 12, lineHeight: 17, fontWeight: '400', color: C.ink3 }, // caption2-regular / gray-600
});
