/**
 * reviewTime (KB-781 · D-25 v2, 예진 10/14) — 리뷰 카드 작성 시각.
 * - 7일 미만 = 상대(방금 / n분 / n시간 / n일 전), 7일 이상 = 날짜 + **연도 항상**("125w"·"1y ago" 금지).
 * - 표기는 **앱 언어**(i18n t) 기준. Hermes Intl(toLocaleDateString·PluralRules)을 믿지 않고 로케일별 i18n 패턴 + 월 이름 키로 직접 조립
 *   (hermes-no-pluralrules 교훈 — 상대 표기도 `_one/_other`, ru는 네 형태 같은 문구).
 * - 날짜는 **기기 시간대**(Date의 로컬 getter). 미래 시각(기기 시계 어긋남)은 "방금".
 * - 스크린리더는 항상 전체 날짜(a11y).
 * - 화면에선 `useReviewTime` — "지금"을 state로 들고 다음 표기 경계(1분·1시간·1일·7일)에 갱신(KB-695 useIsNewFood와 같은 이유:
 *   렌더 중 Date.now()는 React Compiler 메모에 굳어 열어 둔 화면에서 "방금"이 그대로 남는다).
 */
import { useEffect, useState } from 'react';
type TFn = (k: string, o?: Record<string, unknown>) => string;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function fullDate(d: Date, t: TFn, monthKey: 'monShort' | 'monLong'): string {
  const m = d.getMonth() + 1;
  return t(monthKey === 'monShort' ? 'reviewTime.date' : 'reviewTime.dateLong', {
    year: d.getFullYear(),
    month: m,
    day: d.getDate(),
    mon: t(`reviewTime.${monthKey}${m}`),
  });
}

/** KB-775: 날짜만(연도 포함, 앱 언어 패턴 — 리뷰 카드 7일 이상과 같은 표기). 주문 상세 헤더 등 "그 날짜"를 말하는 곳 */
export function formatCalendarDate(at: number | string, t: TFn): { label: string; a11y: string } {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return { label: '', a11y: '' };
  return { label: fullDate(d, t, 'monShort'), a11y: fullDate(d, t, 'monLong') };
}

export function formatReviewTime(iso: string, t: TFn, now: number = Date.now()): { label: string; a11y: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: '', a11y: '' };
  const a11y = fullDate(d, t, 'monLong');
  const diff = Math.max(0, now - d.getTime());
  if (diff < MIN) return { label: t('reviewTime.justNow'), a11y };
  if (diff < HOUR) return { label: t('reviewTime.minutesAgo', { count: Math.floor(diff / MIN) }), a11y };
  if (diff < DAY) return { label: t('reviewTime.hoursAgo', { count: Math.floor(diff / HOUR) }), a11y };
  if (diff < 7 * DAY) return { label: t('reviewTime.daysAgo', { count: Math.floor(diff / DAY) }), a11y };
  return { label: fullDate(d, t, 'monShort'), a11y };
}

/** 표기가 바뀌는 다음 시점(ms, epoch) — 7일 이상(날짜) = null(더 안 바뀜). 경계: 1분 · 다음 분 · 다음 시 · 다음 날 · 7일 */
export function nextReviewTimeChange(iso: string, now: number): number | null {
  const created = Date.parse(iso);
  if (Number.isNaN(created)) return null;
  const diff = Math.max(0, now - created);
  if (diff >= 7 * DAY) return null;
  const unit = diff < HOUR ? MIN : diff < DAY ? HOUR : DAY;
  return created + (Math.floor(diff / unit) + 1) * unit;
}

/** 리뷰 카드용 — 열어 둔 화면에서도 다음 경계에 다시 계산된다. */
export function useReviewTime(iso: string, t: TFn): { label: string; a11y: string } {
  const [now, setNow] = useState(() => Date.now());
  const [prevIso, setPrevIso] = useState(iso);
  if (iso !== prevIso) {
    setPrevIso(iso);
    setNow(() => Date.now()); // 다른 리뷰로 재사용된 행 — 그 시점 기준(렌더 중 전환 비교, KB-603)
  }
  const next = nextReviewTimeChange(iso, now);
  useEffect(() => {
    if (next == null) return;
    // 타이머가 일찍 깨도 now를 경계 이상으로 — 재등록 없이 고착 방지(useIsNewFood와 같은 처리)
    const id = setTimeout(() => setNow(Math.max(Date.now(), next)), Math.max(0, next - Date.now()));
    return () => clearTimeout(id);
  }, [next]);
  return formatReviewTime(iso, t, now);
}
