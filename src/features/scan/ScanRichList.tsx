/**
 * ScanRichList (P-136 → P-138 반려 재작업) — 결과 리치 리스트 (콰이엇 스타일).
 *
 * P-138 판정 기준 = emo 스샷(mockups/refs)의 밀도·정돈:
 * - **행 프레임 절대 불변**: 우측 열 = 고정 폭(썸네일 72) + 그 하단 우측의
 *   고정 풋프린트 슬롯(ADD_SLOT) — [+] ↔ 컴팩트 스테퍼가 같은 자리에서 교체,
 *   담기 탭 시 어떤 요소도 밀리지 않는다(P-103 원칙). 담김 틴트 제거 —
 *   담김 표시 = 스테퍼 존재만.
 * - 카테고리 헤더 미렌더(스캔 API에 카테고리 없음 — 플랫 리스트).
 * - 미매칭 행 = unable 마크+이름+가격만(행 내 안내문 0 — 안내는 탭 시 시트 +
 *   하단 안내문 1회). **미매칭도 [+] 담기 가능**(미등록 실명 주문, P-045).
 *
 * 행 상세(설명·사진·기피 재료)는 useFoodDetail 프리페치 — **매칭 항목만** 조회
 * (react-query 캐시 공유·dedupe로 과호출 방어). 경고 칩 = 개인화 ingredients를
 * 통합 회피 칩으로(1줄 고정·+n 접기 — P-223).
 */
import * as React from 'react';
import { RemoteImage } from '@/components/RemoteImage';
import { CardPhoto } from '@/components/CardPhoto';
import { IconChevron, IconPlus, IconSparkles, RiskBadge, RiskMark } from '@/components';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { openWebPage } from '@/lib/openExternal';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, shadow, type RiskState, radius } from '@/lib/theme';
import type { AiPendingItem } from '@/lib/api/scanAdapter';
import { SkBar } from '@/components/Skeleton';
import { SpicePeppers } from '@/components/SpicePeppers';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing, type SharedValue } from 'react-native-reanimated';
import { scanCartKey } from './scanCartStore';
import { restrictionLabel } from '@/lib/onboarding/data';

/** P-171 ① → P-223: 칩 폭 근사 — 통합 칩 메트릭(패딩 8×2·보더·RiskMark 11) 기반.
 *  CJK ≈ 폰트폭, 라틴/숫자 ≈ 절반. ponytail: 문자폭 근사 휴리스틱 — 오차는 이르게
 *  접히는 쪽(1줄 보장은 nowrap+overflow hidden이 이중 방어), 실측 레이아웃 패스 불요. */
export function estChipW(label: string): number {
  // KB-432: 시안 칩 = 패딩 6×2 + 보더 1×2 + RiskMark(16) + gap(4)
  let w = 34;
  for (const ch of label) w += ch.charCodeAt(0) > 0x2e80 ? 12.5 : 7;
  return w;
}

/** P-171 ①: 1줄에 들어가는 칩만(danger 우선 정렬 전제) + 초과분 "+n" 접기.
 *  availW 미측정(0)이면 전부 표시(측정 전 1프레임 — nowrap이 밀림 방지). */
export function fitAvoidChips<T extends { name: string }>(
  warns: T[],
  availW: number,
  gap = 5,
): { shown: T[]; rest: number } {
  if (availW <= 0 || warns.length <= 1) return { shown: warns, rest: 0 };
  for (let n = warns.length; n >= 1; n--) {
    const moreW = n < warns.length ? gap + estChipW(`+${warns.length - n}`) : 0;
    let w = moreW;
    for (let i = 0; i < n; i++) w += (i > 0 ? gap : 0) + estChipW(warns[i].name);
    if (w <= availW) return { shown: warns.slice(0, n), rest: warns.length - n };
  }
  return { shown: warns.slice(0, 1), rest: warns.length - 1 };
}
import { BrandGoogleMark, D4Minus } from '@/components/design4Assets';
import { useFoodDetail } from '@/lib/data/useFoods';
import { convertKrw, type ServerFx } from '@/lib/exchange';
import { formatKrw, type ResultDish } from '@/lib/scan/segmentMenu';

/** KB-992: 'AI 추정' 섹션 한 줄 — ai = null이면 도착 전(스켈레톤). */
export interface AiRow {
  dish: ResultDish;
  ai: AiPendingItem | null;
}

type TFn = (k: string, o?: Record<string, unknown>) => string;

/** 우측 열·담기 슬롯 고정 치수 — [+]↔스테퍼 교체 시 프레임 불변(P-138 ①) */
export const RIGHT_COL_W = 83; // P-285: 스테퍼 83 폭 기준
export const ADD_SLOT_H = 36; // P-285: add 36 기준(스테퍼 31은 슬롯 내 센터)

/** P-160(예진 확정, 목업 B안): 프로필 체크 줄 — surface2 바탕+하단 보더로 리스트와
 *  톤 분리, 캡션 소형 대문자(**✓ 없음** — 전부 통과로 오독 방지), 아래 회피 재료
 *  개별 칩 가로 스트립. 스크롤 시 상단 고정은 배치 몫(scan.tsx — ScrollView 밖 상단).
 *  P-180(회의 결정 6, 8/12): 우측 Edit 소멸 — 스캔 후 주문 플로우에서 회피 수정
 *  진입 차단(앞으로도 미개방). 회피 수정은 프로필 경유만. */
export function ScanProfileBar({ avoidNames, t }: { avoidNames: string[]; t: TFn }) {
  return (
    <View style={styles.bar} testID="profile-bar">
      <View style={styles.barCap}>
        <Text style={styles.barCapText}>{t('scan.checkedAgainst')}</Text>
      </View>
      {avoidNames.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barStrip} testID="profile-strip">
          {avoidNames.map((n) => (
            <View key={n} style={styles.barChip}>
              <Text style={styles.barChipText}>{n}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function ScanRichList({
  dishes,
  currency,
  fx,
  cart,
  onAdd,
  onRemove,
  onOpen,
  onMarkPress,
  onClosestMatch,
  aiRows = [],
  onOpenAi,
  addOns = [],
  t,
}: {
  dishes: ResultDish[];
  currency: string;
  fx?: ServerFx; // P-242: v2 서버 실환율(undefined = v1 테이블)
  cart: ReadonlyMap<string, number>;
  /** KB-1006: opt = 수량 옵션 index(옵션 없는 줄 = 생략) — 카트 키 scanCartKey(itemId, opt) */
  onAdd: (d: ResultDish, opt?: number) => void;
  onRemove: (d: ResultDish, opt?: number) => void;
  onOpen: (d: ResultDish) => void;
  /** P-149: 행 RiskMark 탭 = 코치마크 재열람(P-134 표면 — 캡슐 철거 후 리스트가 담당) */
  onMarkPress?: () => void;
  /** KB-789: 대체 행(substituted) Closest match 칩 탭 → 설명 카드(행 탭 = 상세 그대로) */
  onClosestMatch?: (d: ResultDish) => void;
  /** KB-992 → KB-1006: DB 매칭 목록 아래 'AI 추정' 섹션 — 일반 줄과 같은 RichRow(가격·담기·맵기), 탭 = AI 상세 시트 */
  aiRows?: AiRow[];
  onOpenAi?: (r: AiRow) => void;
  /** P-616(S-970): 주문 옵션·단일 재료어(notMenu) — 맨 아래 칩 블록. 배지·사진·탭·담기 없음 */
  addOns?: ResultDish[];
  t: TFn;
}) {
  return (
    <View style={styles.body}>
      {/* P-138 ④: 카테고리 헤더 없음 — 스캔 API에 카테고리 부재 → 플랫 리스트 */}
      {dishes.map((d) => (
        <RichRow key={d.itemId} dish={d} currency={currency} fx={fx} cart={cart} onAdd={(o) => onAdd(d, o)} onRemove={(o) => onRemove(d, o)} onOpen={() => onOpen(d)} onMarkPress={onMarkPress} onClosestMatch={onClosestMatch ? () => onClosestMatch(d) : undefined} t={t} />
      ))}

      {aiRows.length > 0 && (
        <View testID="ai-section">
          <View style={styles.aiHead}>
            <View style={styles.aiHeadTitleRow}>
              <IconSparkles size={16} color={C.primary} />
              <Text style={styles.aiHeadTitle}>{t('scan.aiSectionTitle')}</Text>
            </View>
            <Text style={styles.aiHeadNote}>{t('scan.aiSectionNote')}</Text>
          </View>
          {/* KB-1006: 도착 전(ai null)도 같은 줄 — 이름·가격·담기는 바로, 사진 자리만 생성 중 점·판정 자리만 스켈레톤(레퍼런스 emo) */}
          {aiRows.map((r) => (
            <RichRow key={r.dish.itemId} dish={r.dish} ai={r.ai} currency={currency} fx={fx} cart={cart} onAdd={(o) => onAdd(r.dish, o)} onRemove={(o) => onRemove(r.dish, o)} onOpen={r.ai ? () => onOpenAi?.(r) : undefined} t={t} />
          ))}
        </View>
      )}

      {addOns.length > 0 && <AddOnBlock items={addOns} t={t} />}

      <Text style={styles.footNote}>{t('scan.listFootNote')}</Text>
    </View>
  );
}

function RichRow({
  dish,
  ai,
  currency,
  fx,
  cart,
  onAdd,
  onRemove,
  onOpen,
  onMarkPress,
  onClosestMatch,
  t,
}: {
  dish: ResultDish;
  /** KB-1006: undefined = 일반 줄 · null = AI 추정 도착 전 · 값 = AI 추정 줄(배지 caution|unable만 — safe 0) */
  ai?: AiPendingItem | null;
  currency: string;
  fx?: ServerFx;
  cart: ReadonlyMap<string, number>;
  onAdd: (opt?: number) => void;
  onRemove: (opt?: number) => void;
  onOpen?: () => void;
  onMarkPress?: () => void;
  onClosestMatch?: () => void;
  t: TFn;
}) {
  const isAi = ai !== undefined;
  // 매칭 항목만 상세 프리페치 — 설명·사진·기피 재료(개인화 ingredients)
  const detail = useFoodDetail(dish.matched && dish.foodId ? dish.foodId : '');
  const food = dish.matched ? detail.data : undefined;
  // P-171 → P-223: 회피 칩 줄 **단일화**. 데이터는 서버 겹침(avoidances) 우선.
  //  - dish.avoidances = overlapped만·서버 번역명·성분별 riskLevel
  //    (결측 CAUTION 강등은 어댑터가 이미 처리 — P-219)
  //  - 클라 조인 폴백: KB-418 검수 — v1 전용이 **아니라** v2에서도 도달한다
  //    (avoidances 빈 배열 = 무겹침·게스트·온보딩 미완료, mapAvoidances가 항상
  //    배열 반환). 상세 ingredients의 danger/caution을 보수적으로 표면화하는
  //    안전망(헌법 III — 지우면 경고 표면이 줄어든다)이라 존치.
  // 정렬은 양쪽 동일 — danger 우선(접혀도 위험한 것부터 보인다)
  const warnSource: { code: string; name: string; risk: RiskState }[] = dish.avoidances?.length
    ? dish.avoidances
    : (food?.ingredients ?? [])
        .filter((i) => i.risk === 'danger' || i.risk === 'caution')
        .map((i) => ({ code: i.code, name: i.name, risk: i.risk }));
  const warns: WarnItem[] = isAi
    ? aiWarns(ai)
    : [...warnSource].sort((a, b) => (a.risk === b.risk ? 0 : a.risk === 'danger' ? -1 : 1));
  const spice = isAi ? ai?.spice ?? 0 : dish.spice ?? 0; // KB-1006: 일반 줄도(예진 승인) — 0 = 표시 안 함
  const id = dish.itemId;

  const thumb = dish.imageUrl ?? (dish.matched ? food?.photoUrl ?? null : null);
  if (isAi) {
    const ko = ai?.koreanName ?? dish.koreanName ?? dish.rawMenuName;
    const name = ai?.name ?? dish.displayName ?? ko;
    return (
      <Pressable style={styles.row} onPress={onOpen} disabled={!onOpen} testID={ai ? `ai-${id}` : `ai-pending-${id}`}>
        <View style={styles.thumbWrap}>
          <AiThumb ai={ai} itemId={id} t={t} />
          {!!ai && (
            <View style={styles.thumbBadge} testID={`ai-badge-${id}`}>
              <RiskBadge state={ai.risk} />
            </View>
          )}
        </View>
        <View style={styles.textCol}>
          {!!ko && ko !== name && <Text style={styles.nameSubKo} numberOfLines={1}>{ko}</Text>}
          <Text style={styles.nameTitle} numberOfLines={1}>{name}</Text>
          {ai ? (
            <>
              <View style={styles.closestChip} testID={`ai-chip-${id}`}>
                <IconSparkles size={12} color={C.primary} />
                <Text style={styles.closestChipText} numberOfLines={1}>{t('scan.aiSectionTitle')}</Text>
              </View>
              {!!ai.description && <Text style={styles.desc} numberOfLines={1}>{ai.description}</Text>}
            </>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }} testID={`ai-sk-${id}`}>
              <SkBar w={140} />
              <SkBar w={90} />
            </View>
          )}
          {spice > 0 && <View testID={`spice-${id}`}><SpicePeppers rank={spice} size={14} /></View>}
          <WarnChips warns={warns} testID={`ai-warn-${id}`} moreTestID={`ai-warn-more-${id}`} />
          <PriceAndAdd dish={dish} currency={currency} fx={fx} cart={cart} onAdd={onAdd} onRemove={onRemove} />
        </View>
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.row} onPress={onOpen} testID={`rich-${dish.itemId}`}>
      {/* KB-432 §1-1(4150:16254): 좌측 썸네일 100 r4 + RiskBadge(@3,0) — 배지 탭 = 코치 재열람.
          P-366 ①(KB-529): 매칭·미매칭 분기 통합 — 미매칭 = 같은 CardPhoto(기본 이미지 폴백)
          + RiskBadge(unable — 어댑터가 강제). 구 오버레이는 thumb 배경색이 이미지를 덮어
          회색 박스가 되던 결함(9/10 실기). */}
      <View style={styles.thumbWrap}>
        <View style={styles.thumb}>
          {/* QA #428: 행 key = itemId(스캔마다 0부터 재사용) → 다시 찍으면 같은 인스턴스가 직전 스캔 사진을 ~0.5초 보여 줬다.
              recyclingKey가 바뀌면 expo-image가 옛 사진을 즉시 비운다 — 매칭 = foodId(상세 로딩 중 thumb null→URL로 깜빡이지 않게), 미매칭 = thumb. */}
          <CardPhoto uri={thumb} recyclingKey={dish.foodId ?? thumb ?? undefined} borderRadius={radius.md} />
        </View>
        <Pressable style={styles.thumbBadge} hitSlop={8} onPress={onMarkPress} disabled={!onMarkPress} testID={`mark-${dish.itemId}`}>
          <RiskBadge state={dish.risk} />
        </Pressable>
      </View>
      {/* Codex #47 7차: 320pt(썸 118+스테퍼 83) — 텍스트 열 축소 허용, 이름 말줄임·가격 wrap */}
      {/* P-366 ⑥: 칩 없는 행도 가격+담기 줄 = 썸네일 밑변 정렬(minHeight 118 + mt auto) */}
      <View style={{ flex: 1, minWidth: 0, flexShrink: 1, gap: 3, minHeight: 118 }}>
        {/* ko 원문 14/500 → 영문명 15/500 + chevron(→ 상세) — 시안 위계 */}
        {!!(dish.koreanName ?? dish.rawMenuName) && dish.displayName !== (dish.koreanName ?? dish.rawMenuName) && (
          <Text style={styles.nameSubKo} numberOfLines={1}>{dish.koreanName ?? dish.rawMenuName}</Text>
        )}
        {/* P-366 ②: chevron 소멸 — 행 전체 탭이 상세 진입(현행 Pressable) */}
        <View style={styles.nameLine}>
          <Text style={styles.nameTitle} numberOfLines={1}>
            {dish.displayName || (dish.koreanName ?? dish.rawMenuName)}
          </Text>
        </View>
        {/* KB-789(시안 B 14289:8235): 유사 음식 대체 행 — 이름 줄 아래 Closest match 칩(sparkles 12 +
            11/600 primary · primary 12% 틴트 · pad 2/8 · pill) + "Menu says {{scanned}}" 1줄(missNote 자리).
            칩 탭 = 설명 카드(행 탭은 그대로 상세). 긍정 프레임 — "못 찾음" 류 문구 금지(헌법 III). */}
        {dish.substituted && (
          <>
            <Pressable
              style={styles.closestChip}
              hitSlop={8}
              onPress={onClosestMatch}
              disabled={!onClosestMatch}
              accessibilityRole="button"
              accessibilityLabel={t('scan.closestMatchChip')}
              testID={`closest-${dish.itemId}`}
            >
              <IconSparkles size={12} color={C.primary} />
              <Text style={styles.closestChipText} numberOfLines={1}>{t('scan.closestMatchChip')}</Text>
            </Pressable>
            {!!dish.originalScannedName && (
              <Text style={styles.missText} numberOfLines={1} testID={`closest-line-${dish.itemId}`}>
                {t('scan.closestMatchLine', { scanned: dish.originalScannedName })}
              </Text>
            )}
          </>
        )}
        {/* P-285(최종본 2200:21512): 설명 1줄 13/400 #9196A1 — 매칭 = 음식 설명(프리페치) */}
        {dish.matched && !!food?.description && (
          <Text style={styles.desc} numberOfLines={1} testID={`desc-${dish.itemId}`}>{food.description}</Text>
        )}
        {/* KB-1006: 맵기(고추 ceil(s/2)개) — 일반 줄도 results[].spiciness(예진 승인) */}
        {spice > 0 && <View testID={`spice-${id}`}><SpicePeppers rank={spice} size={14} /></View>}
        {/* 기피 경고 — 칩 1줄(들어가는 만큼 + "+n") · KB-914: 공용 WarnChips(가공식품 후보 줄과 같은 부품) */}
        <WarnChips warns={warns} testID={`warn-${dish.itemId}`} moreTestID={`warn-more-${dish.itemId}`} />
        {/* P-226 ⑤: 미등록 행 — 등록 예정 안내 + 외부 검색 딥링크(구글/네이버, 한글 키워드) */}
        {!dish.matched && (
          <View style={styles.missRow} testID={`miss-${dish.itemId}`}>
            <Text style={styles.missText}>{t('scan.missNote')}</Text>
            {/* P-366 ⑦(KB-529): 네이버 삭제 — Google 단독 텍스트 칩(회피 칩 프레임 문법) */}
            <View style={styles.missLinks}>
              <Pressable
                style={styles.googleChip}
                hitSlop={6}
                accessibilityLabel={t('scan.searchOnGoogle')} /* Codex #45 P1 */
                onPress={() => void openWebPage(`https://www.google.com/search?q=${encodeURIComponent(dish.koreanName ?? dish.rawMenuName)}`)}
                testID={`miss-google-${dish.itemId}`}
              >
                <BrandGoogleMark size={16} />
                <Text style={styles.googleChipText}>Google</Text>
                <IconChevron size={12} color={C.ink3} />
              </Pressable>
            </View>
          </View>
        )}
        {/* P-366 ②(KB-529): rightCol 폐기 — 텍스트 열 전폭 + 하단 행(좌 가격/우 담기, **항상 렌더** — 가격 없어도 담기 가능).
            KB-1006: AI 줄과 공용(PriceAndAdd) — 수량 옵션이면 옵션마다 가격·담기 한 줄 */}
        <PriceAndAdd dish={dish} currency={currency} fx={fx} cart={cart} onAdd={onAdd} onRemove={onRemove} />
      </View>
    </Pressable>
  );
}

/** KB-1006: 가격 줄 + 담기 — 옵션 없음 = 좌 가격(환산 선행)/우 담기 1줄(P-366 ②), 옵션 = 옵션마다 "라벨 가격 · 담기" 한 줄씩
 *  (가운데 점 금지 — 줄로 나눈다). 담기 키 = scanCartKey(itemId, 옵션 index). 슬롯 프레임 불변(P-103) */
function PriceAndAdd({ dish, currency, fx, cart, onAdd, onRemove }: { dish: ResultDish; currency: string; fx?: ServerFx; cart: ReadonlyMap<string, number>; onAdd: (opt?: number) => void; onRemove: (opt?: number) => void }) {
  const id = dish.itemId;
  const opts = dish.priceOptions;
  if (opts && opts.length >= 2) {
    return (
      <View style={styles.optList} testID={`opts-${id}`}>
        {opts.map((o, i) => (
          <View key={i} style={styles.bottomRowOpt} testID={`opt-${id}-${i}`}>
            <Text style={[styles.price, { flexShrink: 1, flexWrap: 'wrap' }]}>
              <Text style={styles.optLabel}>{o.label} </Text>
              <PriceText krw={o.priceKrw} currency={currency} fx={fx} />
            </Text>
            <AddSlot qty={cart.get(scanCartKey(id, i)) ?? 0} onAdd={() => onAdd(i)} onRemove={() => onRemove(i)} tid={`${id}-o${i}`} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.bottomRow}>
      {dish.priceKrw != null ? (
        <Text style={[styles.price, { flexShrink: 1, flexWrap: 'wrap' }]}>
          <PriceText krw={dish.priceKrw} currency={currency} fx={fx} />
        </Text>
      ) : (
        <View />
      )}
      <AddSlot qty={cart.get(scanCartKey(id)) ?? 0} onAdd={() => onAdd()} onRemove={() => onRemove()} tid={String(id)} />
    </View>
  );
}

/** KB-1006: 가격 한 줄 텍스트(환산 선행 + ₩) — AI 상세 시트용(줄 안 스타일 분리가 필요 없는 곳) */
export function priceLineText(krw: number, currency: string, fx?: ServerFx): string {
  const c = convertKrw(krw, currency, fx);
  return `${c ? `${c.replace(/^= /, '')} ` : ''}${formatKrw(krw)}`;
}

/** 시안(16254): 환산가 선행 — convertKrw의 '= ' 접두(P-249, 후행 표기용)는 표시에서 제거. P-242: v2 = 실환율 */
function PriceText({ krw, currency, fx }: { krw: number; currency: string; fx?: ServerFx }) {
  const converted = convertKrw(krw, currency, fx);
  return (
    <>
      {converted ? <Text style={styles.priceConv}>{converted.replace(/^= /, '')} </Text> : null}
      {formatKrw(krw)}
    </>
  );
}

/** 담기 슬롯 — [+]와 스테퍼가 같은 풋프린트(RIGHT_COL_W × ADD_SLOT_H). testID 접미 tid = itemId(옵션이면 itemId-o{i}) */
function AddSlot({ qty, onAdd, onRemove, tid }: { qty: number; onAdd: () => void; onRemove: () => void; tid: string }) {
  return (
    <View style={styles.addSlot} testID={`slot-${tid}`}>
      {qty > 0 ? (
        <View style={styles.stepper} testID={`stepper-${tid}`}>
          <Pressable hitSlop={10} onPress={onRemove} testID={`dec-${tid}`}>
            <D4Minus size={16} color={C.ink} />
          </Pressable>
          <Text style={styles.qty}>{qty}</Text>
          <Pressable hitSlop={10} onPress={onAdd} testID={`inc-${tid}`}>
            <IconPlus size={16} color={C.ink} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.addBtn} hitSlop={12} onPress={onAdd} testID={`add-${tid}`}>
          <IconPlus size={24} color={C.ink} />
        </Pressable>
      )}
    </View>
  );
}

type WarnItem = { code: string; name: string; risk: RiskState | 'neutral' };

/** KB-1006: AI 칩 = 추정 재료 전체 — 회원 겹침(avoidCodes)은 caution(형태+색, 앞), 나머지는 중립 칩(마크 없음). 도착 전 = 없음 */
function aiWarns(ai: AiPendingItem | null | undefined): WarnItem[] {
  if (!ai) return [];
  const hit = new Set(ai.avoidCodes);
  return [
    ...ai.avoidCodes.map((code) => ({ code, name: restrictionLabel(code), risk: 'caution' as const })),
    ...ai.estimatedCodes.filter((c) => !hit.has(c)).map((code) => ({ code, name: restrictionLabel(code), risk: 'neutral' as const })),
  ];
}

/** KB-1006: AI 줄 사진 자리 — 생성 중·도착 전 = 연한 틴트 + 점 3개(레퍼런스 emo), ready = 생성 사진(+ 'AI 생성' 칩), none = 기본 이미지 */
export function AiThumb({ ai, itemId, t, size = 118 }: { ai: AiPendingItem | null | undefined; itemId: number; t: TFn; size?: number | '100%' }) {
  const box = { width: size, height: typeof size === 'number' ? size : 180 } as const;
  if (!ai || ai.image === 'generating') {
    return <GeneratingPhoto style={box} label={t('scan.aiPhotoGenerating')} testID={`ai-gen-${itemId}`} />;
  }
  return (
    <View style={[styles.thumb, box]}>
      <CardPhoto uri={ai.image === 'ready' ? ai.imageUrl : null} recyclingKey={ai.pendingId} borderRadius={radius.md} />
      {ai.image === 'ready' && ai.aiImage && (
        <View style={styles.aiPhotoChip} testID={`ai-photo-chip-${itemId}`}>
          <Text style={styles.aiPhotoChipText} numberOfLines={1}>{t('scan.aiGeneratedPhoto')}</Text>
        </View>
      )}
    </View>
  );
}

/** KB-1006: 사진 생성 중 — 점 3개가 차례로 밝아진다(1.2초 주기). 모션 줄이기 = 정적 점. 네트워크 로딩(CardPhoto shimmer)과 다른 상태 */
const DOT_MS = 1200;
function GeneratingPhoto({ style, label, testID }: { style: object; label: string; testID: string }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  React.useEffect(() => {
    if (reduced) return;
    p.set(withRepeat(withTiming(1, { duration: DOT_MS, easing: Easing.linear }), -1, false));
  }, [reduced, p]);
  return (
    <View style={[styles.genBox, style]} accessible accessibilityLabel={label} testID={testID}>
      <View style={styles.genDots}>
        {[0, 1, 2].map((i) => (
          <GenDot key={i} i={i} p={p} still={reduced} />
        ))}
      </View>
    </View>
  );
}

function GenDot({ i, p, still }: { i: number; p: SharedValue<number>; still: boolean }) {
  const a = useAnimatedStyle(() => {
    if (still) return { opacity: 0.6 };
    // 점 i는 주기의 i/3 지점에서 가장 밝다 — 원형 거리 0 → 1, 1/3 이상 → 0.25
    const x = (p.get() - i / 3 + 1) % 1;
    const near = Math.min(x, 1 - x);
    return { opacity: Math.max(0.25, 1 - near * 3) };
  });
  return <Animated.View style={[styles.genDot, a]} />;
}

/** P-616(S-970): "추가·옵션" — 판정 대상이 아닌 주문 옵션·단일 재료어(사리·추가·소스·곱빼기 …). 원문 이름 칩(가격 있으면 칩 안 ₩,
 *  가운데 점 없이 간격) + "직원에게 확인" 1줄. 배지·Unknown·사진·탭·담기 없음 — 안전 단정 문구 금지(헌법 III: 회피 재료가 든 옵션이 있다) */
function AddOnBlock({ items, t }: { items: ResultDish[]; t: TFn }) {
  return (
    <View style={styles.addOns} testID="addons">
      <Text style={styles.addOnsTitle}>{t('scan.addOnsTitle')}</Text>
      <View style={styles.addOnChips}>
        {items.map((d) => (
          <View key={d.itemId} style={styles.addOnChip} testID={`addon-${d.itemId}`}>
            <Text style={styles.addOnName}>{d.koreanName ?? d.rawMenuName}</Text>
            {d.priceKrw != null && <Text style={styles.addOnPrice}>{formatKrw(d.priceKrw)}</Text>}
          </View>
        ))}
      </View>
      <Text style={styles.addOnsNote}>{t('scan.addOnsNote')}</Text>
    </View>
  );
}

/** 기피 경고 칩 1줄(KB-432 §1-1 · P-171 접기 · P-223 색+형태) — 메뉴판 결과 줄과 가공식품 후보 줄(KB-914 R-138)이 같이 쓴다.
 *  warns는 호출측이 danger 우선으로 정렬해 넘긴다. 칩 = 마크 16 + 이름 · 넘치면 "+n" */
export function WarnChips({ warns, testID, moreTestID }: { warns: { code: string; name: string; risk: RiskState | 'neutral' }[]; testID: string; moreTestID: string }) {
  const [warnW, setWarnW] = React.useState(0);
  const { shown, rest } = fitAvoidChips(warns, warnW);
  if (warns.length === 0) return null;
  return (
    <View style={styles.warnWrap} testID={testID} onLayout={(e) => setWarnW(e.nativeEvent.layout.width)}>
      {shown.map((w) => (
        // KB-1006: 중립 = 회원 회피와 무관한 추정 재료 — 마크 없이 회색 글자(경고와 형태로 구분)
        <View key={w.code} style={[styles.warnChip, w.risk === 'neutral' && styles.warnChipNeutral]} testID={`chip-${w.risk}-${w.code}`}>
          {w.risk !== 'neutral' && <RiskMark state={w.risk} size={16} />}
          <Text style={w.risk === 'neutral' ? styles.warnChipTextNeutral : styles.warnChipText} numberOfLines={1}>{w.name}</Text>
        </View>
      ))}
      {rest > 0 && (
        <View style={styles.moreChip} testID={moreTestID}>
          <Text style={styles.moreChipText}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

/** 하단 sticky 필 — 리스트·캡슐 뷰 공유(담김 카운트 동기). */
export function OrderPill({ count, onPress, t, bottom }: { count: number; onPress: () => void; t: TFn; bottom: number }) {
  if (count <= 0) return null;
  return (
    <Pressable style={[styles.pill, { bottom }]} onPress={onPress} testID="order-pill">
      {/* KB-907(T-103): "2 items, View order" 쉼표 연결 → 개수와 동작을 두 덩어리로(간격 구분) */}
      <View style={styles.pillRow}>
        <Text style={styles.pillCount}>{t('scan.orderCount', { count })}</Text>
        <Text style={styles.pillText}>{t('scan.viewOrderAction')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // P-226 ⑤: 미등록 안내 + 외부 검색 링크
  missRow: { marginTop: 4, gap: 5 },
  missText: { fontSize: 14, fontWeight: '400', color: C.ink3, lineHeight: 14 }, // A-SC-10(이탤릭 제거)
  missLinks: { flexDirection: 'row', gap: 4 }, // A-SC-09
  // P-285: 외부 검색 아이콘 칩 34×30(border #EAEBEE r37 pad 4/6)
  googleChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#EAEBEE', borderRadius: radius.pill, backgroundColor: '#FFFFFF' }, // P-366 ⑦: 회피 칩 프레임 문법
  googleChipText: { fontSize: 13, fontWeight: '700', color: '#2F3137' },
  // KB-789(14289:8235): Closest match 칩 — primary 12% 틴트 · pad 2/8 · pill · 11/600 primary. 보더 없음(상태 전환 없는 정적 칩).
  closestChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,113,52,0.12)' },
  closestChipText: { fontSize: 12, fontWeight: '600', color: C.primary },
  body: { paddingHorizontal: 20, paddingBottom: 120 },
  // KB-992: 'AI 추정' 섹션 머리 — 위 목록과 구분선 + sparkles 16 + 제목 + 안내 1~2줄
  aiHead: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 20, gap: 4 },
  aiHeadTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiHeadTitle: { fontSize: 16, fontWeight: '700', color: '#2F3137' },
  aiHeadNote: { fontSize: 13, lineHeight: 18, color: C.ink3 }, // A-SC-05(KB-486)
  // P-160 B안(.bnrB 전사): surface2 바탕 + 하단 보더 + 대문자 캡션 + 칩 스트립
  bar: { backgroundColor: C.surface2, borderBottomWidth: 1, borderBottomColor: C.line, paddingTop: 10, paddingBottom: 11, paddingHorizontal: 16 },
  barCap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barCapText: { flex: 1, fontFamily: font.displayBlack, fontSize: 12, color: C.ink3, letterSpacing: 0.5, textTransform: 'uppercase' },
  barStrip: { flexDirection: 'row', gap: 6, marginTop: 7 },
  barChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 4 },
  barChipText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  editLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText },
  // KB-432 §1-1(4150:16254): h136 pad 16/20 gap 16, 하단 line 1px
  row: { flexDirection: 'row', gap: 16, minHeight: 150, paddingVertical: 16, paddingHorizontal: 0 }, // A-SC-05: 하단 보더 제거
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  thumbWrap: { width: 118, height: 118 }, // P-285: 118×118(2200:21512) — P-362: height 명시(퍼센트 순환 봉쇄)
  thumbFb: { backgroundColor: C.surface2 },
  thumbBadge: { position: 'absolute', top: -4, left: 3 },
  nameTitle: { fontSize: 16, fontWeight: '500', color: '#2F3137', flexShrink: 1 },
  nameSubKo: { fontSize: 16, fontWeight: '500', color: C.ink2 },
  desc: { fontSize: 14, fontWeight: '400', color: C.ink3 }, // P-285: 설명 1줄(2200:21512)
  // P-171: 1줄 고정 — nowrap+hidden(근사 오차 이중 방어), 행 높이 균일 회복
  warnWrap: { flexDirection: 'row', flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center', gap: 4, marginTop: 5 }, // A-SC-06/07(이름→칩 8 = col gap 3+5)
  moreChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 4 }, // A-SC-08(warnChip 동일)
  moreChipText: { fontSize: 13, fontWeight: '700', color: '#2F3137' }, // A-SC-08
  // P-223: 통합 칩(색+형태) — 구 avoidRow 섹션 스타일 대체
  warnChip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 26, borderWidth: 1, borderColor: C.line, borderRadius: radius.pill, paddingVertical: 4, paddingLeft: 3, paddingRight: 6, backgroundColor: '#FFFFFF' }, // A-SC-07
  warnChipText: { fontSize: 13, fontWeight: '700', color: '#2F3137' },
  warnChipNeutral: { paddingLeft: 8, paddingRight: 8 }, // KB-1006: 마크 자리 없음 → 좌우 같은 여백
  warnChipTextNeutral: { fontSize: 13, fontWeight: '500', color: C.ink2 },
  textCol: { flex: 1, minWidth: 0, flexShrink: 1, gap: 3, minHeight: 118 }, // KB-1006: AI 줄 = 일반 줄과 같은 텍스트 열(가격·담기 밑변 정렬)
  // KB-1006: 수량 옵션 — 옵션마다 한 줄(라벨 + 가격 · 담기 슬롯), 묶음은 썸 밑변 정렬
  optList: { marginTop: 'auto', gap: 2 },
  bottomRowOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optLabel: { fontSize: 14, fontWeight: '600', color: '#2F3137' },
  // KB-1006: 'AI 생성' 사진 칩 — 사진 좌하단, 어두운 반투명 바탕 흰 글자(사진 위 대비)
  aiPhotoChip: { position: 'absolute', left: 6, bottom: 6, paddingVertical: 2, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)', maxWidth: '90%' },
  aiPhotoChipText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  // KB-1006: 사진 생성 중 자리 — primary 연한 틴트 + 점 3개(8, gap 8)
  genBox: { borderRadius: radius.md, backgroundColor: 'rgba(255,113,52,0.08)', alignItems: 'center', justifyContent: 'center' },
  genDots: { flexDirection: 'row', gap: 8 },
  genDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  price: { fontSize: 14, fontWeight: '500', color: C.inkInfo, marginTop: 2, fontVariant: ['tabular-nums'] }, // P-284
  priceConv: { fontSize: 16, fontWeight: '600', color: '#6B95FF' },
  // P-366 ②: 하단 행 — 좌 가격 / 우 담기 슬롯(텍스트 열 전폭)
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }, // P-366 ⑥: 썸 밑변 정렬
  thumb: { width: 118, height: 118, borderRadius: radius.md, backgroundColor: C.surface2 },
  // 담기 슬롯 — [+]와 스테퍼가 같은 풋프린트(RIGHT_COL_W × ADD_SLOT_H)를 공유
  addSlot: { width: RIGHT_COL_W, height: ADD_SLOT_H, alignItems: 'flex-end', justifyContent: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 }, // P-285: add 36(4003:5796) · A-DS-02: 기본 보더 제거(흰+sh1)
  stepper: { width: 83, height: 31, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, borderRadius: radius.xs, paddingHorizontal: 6, ...shadow.sh1 }, // P-285: 스테퍼 83×31(2162:9658)
  qty: { fontSize: 16, fontWeight: '500', color: '#262C31', fontVariant: ['tabular-nums'], textAlign: 'center' },
  // P-616: 추가·옵션 블록 — AI 섹션 머리와 같은 구분선 문법, 칩 = 회피 칩 프레임(보더 line·pill)
  addOns: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 20, marginTop: 8, gap: 10 },
  addOnsTitle: { fontSize: 16, fontWeight: '700', color: '#2F3137' },
  addOnChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addOnChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, borderWidth: 1, borderColor: C.line, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#FFFFFF' },
  addOnName: { fontSize: 14, fontWeight: '500', color: '#2F3137' },
  addOnPrice: { fontSize: 13, color: C.ink3, fontVariant: ['tabular-nums'] },
  addOnsNote: { fontSize: 13, lineHeight: 18, color: C.ink3 },
  footNote: { fontFamily: font.body, fontSize: 12, lineHeight: 17, color: C.ink3, paddingVertical: 14 },
  pill: { position: 'absolute', left: 20, right: 20, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  pillText: { fontFamily: font.bodyBold, fontSize: 16, color: '#fff' },
  pillRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  pillCount: { fontFamily: font.body, fontSize: 16, color: '#fff', opacity: 0.85 },
});

export { styles as richStyles }; // KB-914(R-138): 가공식품 후보 줄이 같은 줄 치수(썸네일 118·배지 자리·줄 간격)를 쓴다
