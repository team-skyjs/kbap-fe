/**
 * 가공식품 스캔 v4 화면 부품(KB-865 ③, Figma 12371:70304 시안 16~19·24·25·27~29b·41·44·45·48·50).
 * 흐름(단계·요청·차감 판정)은 PackagedScanFlow가 갖고, 여기는 그리는 것만. 차감·불꽃 문구 없음(README — 정책은 무변).
 * - 후보 카드(16·19·45): 사진 128×144 r12 + 제조사·이름·한국어명·평점(목록 카드와 같은 글자·평점 부품) · 판정 리본(회피 1개 이상 회원만) ·
 *   **선택 = 주황 테두리 + 회색 바탕 — 테두리는 미선택에도 같은 폭 투명으로 자리 유지(프레임 불변 P-151)**
 * - 안내 페이지(17·18·29b·39): 아트 상자 + 제목 + 본문 + 아래 버튼 둘
 * - 성분표 면 검토(24·25·50) · 결과(27·28·29·41·44·48) — 결과 사진 칸 = 마지막으로 찍은 성분표 사진(없으면 자리표시, Q3)
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { SubHeader } from '@/components/SubHeader';
import { RiskBadge } from '@/components/RiskBadge';
import { RemoteImage } from '@/components/RemoteImage';
import { IconCamera, IconSearch, Input, OverallRating } from '@/components';
import { useAppLanguage } from '@/lib/i18n/useAppLanguage';
import { color as C, font, radius } from '@/lib/theme';
import { restrictionLabel } from '@/lib/onboarding/data';
import { VERDICT_RISK, type LabelScanResult, type ProcessedFoodSummary } from '@/lib/api/processedFoodAdapter';
import { PackagedPlaceholder } from '@/features/processedFood/PackagedExplorer';

const namesOf = (codes: string[]) => codes.map((c) => restrictionLabel(c)).join(', ');

/** 시안 16 실측: 카드 335×168 r16 · 안쪽 12 · 사진 128×144 r12 #F7F8FA(상품 8 안쪽 contain) · 글자 열 x172 · 카드 사이 16 */
export function CandidateCard({ item, selected, personalized, onPress, testID, disabled = false }: { item: ProcessedFoodSummary; selected: boolean; personalized: boolean; onPress: () => void; testID: string; disabled?: boolean }) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);
  const risk = personalized && item.verdict ? VERDICT_RISK[item.verdict] : null;
  // 비회원·회피 0개(시안 45): 판정 대신 주요 알레르기 함유 줄 — 응답에 없으면 줄 숨김(없음 단정 0)
  const contains = !personalized && item.majorAllergens && item.majorAllergens.length > 0 ? t('packaged.containsNames', { names: namesOf(item.majorAllergens) }) : null;
  return (
    <Pressable
      style={[sc.card, selected ? sc.cardOn : sc.cardOff]}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected, disabled }}
      // SAFE_WITH_NOTE = 리본은 safe지만 스크린리더엔 단서(ProductCard와 같은 규칙 — Codex #339)
      accessibilityLabel={[item.name, item.nameKo, item.maker, risk && t(`risk.${risk}`), risk && item.verdict === 'SAFE_WITH_NOTE' && t('packaged.unclearNoteA11y'), contains].filter(Boolean).join(', ')}
      testID={testID}
      uiTarget="pscan-candidate"
    >
      <View style={sc.photo}>
        {item.imageUrl && !failed ? (
          <RemoteImage uri={item.imageUrl} style={sc.photoImage} contentFit="contain" recyclingKey={`pc-${item.id}`} hideUntilLoaded onError={() => setFailed(true)} />
        ) : (
          <PackagedPlaceholder type={item.type} foodType={item.foodType} style={StyleSheet.absoluteFill} />
        )}
        {risk && <View style={sc.badge}><RiskBadge state={risk} size={22} flat testID={`pscan-verdict-${item.id}`} /></View>}
      </View>
      <View style={sc.textCol}>
        {!!item.maker && <Text style={sc.maker} numberOfLines={1}>{item.maker}</Text>}
        <Text style={sc.name} numberOfLines={2} lineBreakStrategyIOS="hangul-word">{item.name}</Text>
        {!!item.nameKo && <Text style={sc.nameKo} numberOfLines={1}>{item.nameKo}</Text>}
        {item.rating && <OverallRating average={item.rating.average} count={item.rating.count} style={sc.rating} />}
        {!!contains && <Text style={sc.contains} testID={`pscan-contains-${item.id}`}>{contains}</Text>}
      </View>
    </Pressable>
  );
}

/** 후보·이름 찾기(16·19·45) — 제목 + 보조 줄 + (검색칸) + 카드 목록 + 확정 CTA + "None of these" 텍스트 동작 */
export function CandidateScreen({
  title, subtitle, note, search, items, selectedId, onSelect, onConfirm, onNone, onBack, personalized, busy, empty, testID, onEndReached, banner,
}: {
  title: string; subtitle: string | null; note: string | null; search?: React.ReactNode; items: ProcessedFoodSummary[]; selectedId: string | null;
  onSelect: (id: string) => void; onConfirm: () => void; onNone: (() => void) | null; onBack: () => void; personalized: boolean; busy: boolean; empty?: React.ReactNode; testID: string; onEndReached?: () => void; banner?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const viewH = React.useRef(0);
  return (
    <View style={sc.root} testID={testID}>
      {/* Codex #339: 확정 대기 중 = 뒤로도 잠금(카드·None of these와 같은 이유 — 응답이 화면 밖에서 확정·이동) */}
      <SubHeader title={t('packagedScan.chooseTitle')} onBack={busy ? () => {} : onBack} />
      <ScrollView
        contentContainerStyle={sc.page}
        keyboardShouldPersistTaps="handled"
        // 남은 높이가 화면 1.5개 이하면 다음 페이지 · 거른(reportNo 없는) 항목이 많아 화면을 못 채우면 스크롤이 없으니 내용 크기 변화로도 이어 조회
        onScroll={onEndReached ? (e) => { const { layoutMeasurement: l, contentOffset: o, contentSize: c } = e.nativeEvent; if (o.y + l.height * 2.5 >= c.height) onEndReached(); } : undefined}
        onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; }}
        onContentSizeChange={onEndReached ? (_w, h) => { if (viewH.current > 0 && h <= viewH.current * 2.5) onEndReached(); } : undefined}
        scrollEventThrottle={onEndReached ? 200 : undefined}
        testID={`${testID}-scroll`}
      >
        {banner}
        <Text style={sc.h1} accessibilityRole="header">{title}</Text>
        {!!subtitle && <Text style={sc.sub}>{subtitle}</Text>}
        {!!note && <Text style={sc.body} testID="pscan-personal-note">{note}</Text>}
        {search}
        <View style={sc.list} accessibilityRole="radiogroup">
          {items.map((c) => (
            <CandidateCard key={c.id} item={c} selected={selectedId === c.id} personalized={personalized} onPress={() => onSelect(c.id)} disabled={busy} testID={`pscan-candidate-${c.id}`} />
          ))}
        </View>
        {empty}
      </ScrollView>
      <View style={[sc.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Btn busy={busy} variant={selectedId ? 'primary' : 'off'} onPress={() => { if (selectedId) onConfirm(); }} testID="pscan-confirm">{t('packagedScan.confirmProduct')}</Btn>
        {onNone && (
          // 시안: 확인 CTA 다음 테두리 없는 텍스트 동작(README)
          // Codex #339: 확정 대기 중 = 선택·거절 잠금(늦은 응답이 다른 선택을 덮지 않게)
          <Pressable style={sc.textAction} onPress={busy ? undefined : onNone} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} testID="pscan-none-of-these">
            <Text style={sc.textActionLabel}>{t('packagedScan.noneOfThese')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** 이름 찾기 검색칸(시안 19 — 목록 검색칸과 같은 모양, 읽은 글자로 채움) */
export function NameSearchBox({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={sc.search}>
      <SearchInput value={value} onChange={onChange} onSubmit={onSubmit} placeholder={t('packaged.searchPlaceholder')} />
      <Pressable onPress={onSubmit} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('packaged.searchPlaceholder')} testID="pscan-name-search-submit">
        <IconSearch size={20} color={C.inkMute} />
      </Pressable>
    </View>
  );
}
function SearchInput({ value, onChange, onSubmit, placeholder }: { value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string }) {
  return (
    <Input value={value} onChangeText={onChange} onSubmitEditing={onSubmit} placeholder={placeholder} placeholderTextColor={C.ink2} returnKeyType="search" style={sc.searchInput} testID="pscan-name-search-input" />
  );
}

/** 안내 페이지(17·18·29b·39) — 시안 실측: 아트 상자 335×148 r16 #F7F8FA(카메라 36) → 제목 28 bold(위 24) → 본문 16/26 gray-700(위 18) · 아래 버튼 48 둘(간격 8) */
/** busy = 이 화면에서 시작한 요청(성분표 전 거절 확정) 대기 — 다른 동작·뒤로 잠금, 보조 버튼에 스피너(Codex #339) */
export function MessagePage({ headerTitle, title, body, primary, secondary, onBack, testID, busy = false }: {
  headerTitle: string; title: string; body: string; primary: { label: string; onPress: () => void; testID: string; busy?: boolean };
  secondary: { label: string; onPress: () => void; testID: string } | null; onBack: () => void; testID: string; busy?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={sc.root} testID={testID}>
      <SubHeader title={headerTitle} onBack={busy ? () => {} : onBack} />
      <ScrollView contentContainerStyle={sc.page}>
        <View style={sc.art}><IconCamera size={36} color="#000000" /></View>
        <Text style={sc.h1Big} accessibilityRole="header">{title}</Text>
        <Text style={sc.lead}>{body}</Text>
      </ScrollView>
      <View style={[sc.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Btn busy={primary.busy} disabled={busy} onPress={busy ? () => {} : primary.onPress} testID={primary.testID}>{primary.label}</Btn>
        {secondary && <Btn variant="ghost" busy={busy} onPress={busy ? () => {} : secondary.onPress} testID={secondary.testID}>{secondary.label}</Btn>}
      </View>
    </View>
  );
}

/** 사진 칸 — 찍은 사진(로컬 uri — expo-image 직접 사용은 로컬 촬영 미리보기 전용 규칙 그대로) 또는 자리표시 */
function PhotoSlot({ uri, label, style, children }: { uri: string | null; label: string; style: object; children?: React.ReactNode }) {
  return (
    <View style={[sc.slot, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={sc.slotEmpty}>
          <IconCamera size={24} color="#000000" />
          <Text style={sc.slotLabel} numberOfLines={1}>{label}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

/** 성분표 면 검토(24 = 1면 · 25 = 4면 한도 · 50 = 다시 분석 안내) — 큰 칸 = 첫 면, 아래 Side 2~4 */
export function LabelPhotosScreen({ photos, count, max, reanalyze, onRetake, onAdd, onAnalyze, onBack, busy, banner }: {
  photos: (string | null)[]; count: number; max: number; reanalyze: boolean; onRetake: () => void; onAdd: (() => void) | null; onAnalyze: () => void; onBack: () => void; busy: boolean; banner?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const full = count >= max;
  return (
    <View style={sc.root} testID="pscan-label-pages">
      <SubHeader title={t('packagedScan.labelPhotosTitle')} onBack={onBack} />
      <ScrollView contentContainerStyle={sc.page}>
        {banner}
        <Text style={sc.h1} accessibilityRole="header" testID="pscan-label-count">{t('packagedScan.labelPhotosCount', { count, max })}</Text>
        <PhotoSlot uri={photos[0] ?? null} label={t('packagedScan.labelBox')} style={sc.mainSlot} />
        {count > 1 && (
          <View style={sc.sideRow}>
            {[1, 2, 3].map((i) => (
              i < count ? <PhotoSlot key={i} uri={photos[i] ?? null} label={t('packagedScan.sideN', { n: i + 1 })} style={sc.sideSlot} /> : <View key={i} style={sc.sideSlotGap} />
            ))}
          </View>
        )}
        <Text style={sc.lead} testID={full ? 'pscan-label-full' : 'pscan-label-hint'}>{full ? t('packagedScan.labelMaxReached', { max }) : t('packagedScan.labelAddHint')}</Text>
        <Btn variant="ghost" onPress={onRetake} testID="pscan-label-retake">{t('packagedScan.retakePhoto')}</Btn>
        {reanalyze && <Text style={sc.body} testID="pscan-label-reanalyze">{t('packagedScan.reanalyzeNote')}</Text>}
      </ScrollView>
      <View style={[sc.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Btn busy={busy} onPress={onAnalyze} testID="pscan-label-analyze">{t('packagedScan.labelAnalyze')}</Btn>
        {!full && onAdd && <Btn variant="ghost" onPress={onAdd} testID="pscan-label-add">{t('packagedScan.labelAddPage')}</Btn>}
      </View>
    </View>
  );
}

/** 성분표 결과(27·28·29·41·44·48) — 판정은 서버 verdict·matches만(앱 판정 0). member = 회피 1개 이상 회원 */
/** stale = 결과 뒤 판정 기준(회피·언어)이 바뀜 — 옛 verdict는 개인 판정으로 쓰지 않는다: 리본 0 · "확인 못 함" · 면 검토(같은 분석 다시 분석)로 */
export function LabelResultScreen({ result, photoUri, pages, member, stale = false, freeStarted = false, banner, onAddSide, onReview, onSetAvoid, onDone, max }: {
  result: LabelScanResult; photoUri: string | null; pages: number; member: boolean; stale?: boolean; freeStarted?: boolean; banner?: React.ReactNode; onAddSide: () => void; onReview: () => void; onSetAvoid: () => void; onDone: () => void; max: number;
}) {
  const { t } = useTranslation();
  const lang = useAppLanguage(); // 구독으로(KB-695)
  const insets = useSafeAreaInsets();
  // Codex #339: verdict 없는 옛 응답(v4 이전 모양)이라도 서버가 확인한 회피 일치(avoidance DETECTED)는 숨기지 않는다 — 회피 문장·위험 리본
  const legacyAvoid = result.verdict == null ? result.avoidance.filter((a) => a.detected).map((a) => a.code) : [];
  const risk = !member || stale ? null : result.verdict ? VERDICT_RISK[result.verdict] : legacyAvoid.length ? VERDICT_RISK.AVOID : null;
  const showTranslation = !(lang ?? '').startsWith('ko');
  const translated = showTranslation ? result.ingredients.translated : null;
  let avoid: string | null = null;
  if (member && stale) avoid = t('packaged.notVerifiedBody');
  else if (member) {
    if (result.verdict === 'AVOID') avoid = t('packagedScan.resultAvoid', { names: namesOf(result.avoidMatches.map((m) => m.code)) });
    else if (result.verdict === 'CAUTION') avoid = t('packagedScan.resultCaution', { names: namesOf(result.mayContainMatches.map((m) => m.code)) });
    else if (result.verdict === 'SAFE_WITH_NOTE') avoid = t('packagedScan.resultUnclear', { items: result.unclearIngredients.join(', ') });
    else if (result.verdict === 'SAFE') avoid = t(pages > 1 ? 'packagedScan.resultSafeAll' : 'packaged.noAvoidMatches');
    else if (legacyAvoid.length) avoid = t('packagedScan.resultAvoid', { names: namesOf(legacyAvoid) });
    else avoid = t('packaged.notVerifiedBody');
  }
  // 옛 응답 = majorAllergens 없음 → 서버 검출(detections) 코드로(#338과 같은 폴백) · 둘 다 없으면 확인 불가(없음 단정 0)
  const majorCodes = result.majorAllergens ?? (result.detections.length ? [...new Set(result.detections.map((d) => d.code))] : null);
  const major = !member
    ? majorCodes == null
      ? t('packaged.majorUnavailable')
      : majorCodes.length
        ? t('packagedScan.resultMajorSet', { contains: t('packaged.containsNames', { names: namesOf(majorCodes) }) })
        : t(result.labelSource === 'NONE' ? 'packaged.majorUnavailable' : 'packaged.majorNoneFound')
    : null;
  const may = result.mayContain;
  return (
    <View style={sc.root} testID="pscan-label-result">
      <SubHeader title={t('packagedScan.resultTitle')} onBack={onDone} />
      <ScrollView contentContainerStyle={[sc.page, { gap: 24 }]}>
        {/* KB-877: 이번 분석이 차감하며 창을 열었으면 안내 한 줄, 아니면 남은 분(창 안이면) */}
        {freeStarted ? <Text style={sc.freeStarted} testID="pscan-free-started">{t('packagedScan.freeStarted')}</Text> : banner}
        <PhotoSlot uri={photoUri} label={t('packagedScan.labelBox')} style={sc.resultSlot}>
          {risk && <View style={sc.badge}><RiskBadge state={risk} size={22} flat testID={`pscan-result-badge-${risk}`} /></View>}
        </PhotoSlot>
        {member ? (
          <Section title={t('packaged.yourAvoidList')} testID="pscan-result-avoid"><Text style={sc.body}>{avoid}</Text></Section>
        ) : (
          <Section title={t('packaged.majorAllergensTitle')} testID="pscan-result-major"><Text style={sc.body}>{major}</Text></Section>
        )}
        <Section title={t('packaged.ingredientsHeading')} testID="pscan-result-ingredients">
          {translated ? <Text style={sc.body}>{translated}</Text> : result.ingredients.original ? <Text style={sc.body}>{result.ingredients.original}</Text> : <Text style={sc.body}>{t('packaged.noIngredients')}</Text>}
        </Section>
        {!!translated && !!result.ingredients.original && (
          <Section title={t('packaged.koreanOriginal')} testID="pscan-result-original"><Text style={sc.body}>{result.ingredients.original}</Text></Section>
        )}
        {!!result.allergenStatement && (
          <Section title={t('packaged.allergenTitle')} testID="pscan-result-allergens">
            <View>
              {showTranslation && !!result.allergenStatement.translated && <Text style={sc.body}>{result.allergenStatement.translated}</Text>}
              <Text style={sc.body}>{result.allergenStatement.original}</Text>
            </View>
          </Section>
        )}
        {may.length > 0 && (
          <Section title={t('packaged.mayContainTitle')} testID="pscan-result-may">
            <View>
              <Text style={sc.body}>{t('packaged.mayContainNames', { names: namesOf(may.map((m) => m.code)) })}</Text>
              {may.map((m) => m.evidence).filter(Boolean).map((e, i) => <Text key={i} style={sc.body}>{e}</Text>)}
            </View>
          </Section>
        )}
      </ScrollView>
      <View style={[sc.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {!member ? (
          <Btn variant="ghost" onPress={onSetAvoid} testID="pscan-result-set-avoid">{t('packaged.setAvoidIngredients')}</Btn>
        ) : stale || pages >= max ? (
          <Btn variant="ghost" onPress={onReview} testID="pscan-result-review">{t('packagedScan.reviewPhotos', { count: pages })}</Btn>
        ) : (
          <Btn variant="ghost" onPress={onAddSide} testID="pscan-label-more">{t('packagedScan.labelAddPage')}</Btn>
        )}
        <Btn variant="ghost" onPress={onDone} testID="pscan-label-done">{t('packagedScan.done')}</Btn>
      </View>
    </View>
  );
}

function Section({ title, children, testID }: { title: string; children: React.ReactNode; testID: string }) {
  return (
    <View style={sc.section} testID={testID}>
      <Text style={sc.h2} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

const sc = StyleSheet.create({
  freeStarted: { fontFamily: font.bodyBold, fontSize: 16, lineHeight: 23, color: C.primaryText }, // KB-877
  root: { flex: 1, backgroundColor: C.card },
  page: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 16 },
  h1: { fontFamily: font.bodyBold, fontSize: 22, lineHeight: 28, color: C.ink },
  h1Big: { fontFamily: font.bodyBold, fontSize: 28, lineHeight: 34, color: C.ink, marginTop: 8 },
  h2: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 26, color: C.ink },
  sub: { fontFamily: font.body, fontSize: 16, lineHeight: 21, color: C.ink2 },
  lead: { fontFamily: font.body, fontSize: 16, lineHeight: 26, color: C.ink2 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink },
  list: { gap: 16 },
  // 테두리 = 양 상태 같은 1(미선택 투명) — 선택 전환은 색만(P-151)
  card: { flexDirection: 'row', gap: 24, padding: 11, borderWidth: 1, borderRadius: radius.lg, minHeight: 168 },
  cardOn: { borderColor: C.primary, backgroundColor: C.surface2 },
  cardOff: { borderColor: 'transparent', backgroundColor: 'transparent' },
  photo: { width: 128, height: 144, borderRadius: radius.md, backgroundColor: C.surface2, overflow: 'hidden' },
  photoImage: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8 },
  badge: { position: 'absolute', left: 10, top: 0 },
  textCol: { flex: 1, minWidth: 0, paddingTop: 2 },
  maker: { fontFamily: font.body, fontSize: 14, lineHeight: 19, color: C.ink2 },
  name: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 24, color: C.ink, marginTop: 5 },
  nameKo: { fontFamily: font.ko, fontSize: 16, lineHeight: 23, color: C.ink2, marginTop: 3 },
  rating: { marginTop: 7 },
  contains: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink, marginTop: 8 },
  bottom: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: C.card, gap: 8 },
  textAction: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' },
  textActionLabel: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: C.ink },
  search: { height: 48, borderRadius: radius.md, backgroundColor: C.surface2, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  searchInput: { flex: 1, height: 48, fontSize: 16, color: C.ink, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 },
  art: { height: 148, borderRadius: radius.lg, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  slot: { borderRadius: radius.lg, backgroundColor: C.hair, overflow: 'hidden' },
  slotEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  slotLabel: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink2 },
  mainSlot: { height: 250 },
  sideRow: { flexDirection: 'row', gap: 8 },
  sideSlot: { flex: 1, height: 100 },
  sideSlotGap: { flex: 1 },
  resultSlot: { height: 180 },
  section: { gap: 10 },
});
