/**
 * KB-781(D-25 v2) — 리뷰 카드 작성 시각: 7일 미만 상대 · 이상 = 날짜 + 연도 항상 · 앱 언어 패턴 · 기기 시간대 · 스크린리더 = 전체 날짜.
 * 실제 로케일 JSON + 실제 i18next 인스턴스(10로케일)로 조립 결과를 본다(Intl 날짜 API 미사용 — Hermes 대비).
 */
import { createInstance, type TFunction } from 'i18next';
import { formatReviewTime, nextReviewTimeChange } from '@/lib/reviewTime';

const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'ru', 'id', 'th', 'vi'] as const;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON을 이름으로 순회
const load = (l: string) => require(`@/lib/i18n/${l}.json`) as Record<string, unknown>;
let i18n: ReturnType<typeof createInstance>;
beforeAll(async () => {
  i18n = createInstance();
  await i18n.init({ lng: 'en', fallbackLng: 'en', resources: Object.fromEntries(LOCALES.map((l) => [l, { translation: load(l) }])), interpolation: { escapeValue: false } });
});
const tFor = (l: string) => i18n.getFixedT(l) as TFunction as unknown as (k: string, o?: Record<string, unknown>) => string;

const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi); // 기기(로컬) 시각
const NOW = at(2026, 1, 8, 12).getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('경계값(en)', () => {
  const t = () => tFor('en');
  it.each([
    [0, 'Just now'],
    [59 * S, 'Just now'],
    [60 * S, '1m ago'],
    [59 * M + 59 * S, '59m ago'],
    [60 * M, '1h ago'],
    [23 * H + 59 * M, '23h ago'],
    [24 * H, '1d ago'],
    [6 * D + 23 * H + 59 * M, '6d ago'],
  ])('%sms 전 → %s', (ms, want) => {
    expect(formatReviewTime(ago(ms as number), t(), NOW).label).toBe(want);
  });
  it('7일 정각 = 날짜 + 연도(상대 표기 끝)', () => {
    expect(formatReviewTime(ago(7 * D), t(), NOW).label).toBe('Jan 1, 2026');
  });
  it('연말연초 — 기기 시각 12월 31일 23:30 작성, 1월 8일에 보면 "Dec 31, 2025"(연도 = 작성 연도)', () => {
    expect(formatReviewTime(at(2025, 12, 31, 23, 30).toISOString(), t(), NOW).label).toBe('Dec 31, 2025');
  });
  it('미래 시각(기기 시계 어긋남) = 방금 · 잘못된 값 = 빈 문자열', () => {
    expect(formatReviewTime(new Date(NOW + 5 * M).toISOString(), t(), NOW).label).toBe('Just now');
    expect(formatReviewTime('not-a-date', t(), NOW)).toEqual({ label: '', a11y: '' });
  });
  it('금지 표기 0 — 오래된 리뷰(125주·1년 넘음)도 "125w"·"1y ago"가 아니라 날짜 + 연도', () => {
    for (const ms of [125 * 7 * D, 400 * D, 30 * D]) {
      const { label } = formatReviewTime(ago(ms), t(), NOW);
      expect(label).not.toMatch(/\dw\b|\dy ago|weeks?|years?/i);
      expect(label).toMatch(/\b20\d\d\b/);
    }
  });
});

describe('로케일별 날짜(7일 이상) — 앱 언어 패턴, 서구권은 월 이름(숫자 월 금지), 스크린리더 = 전체 날짜', () => {
  const iso = at(2025, 10, 3).toISOString();
  it.each([
    ['en', 'Oct 3, 2025', 'October 3, 2025'],
    ['ko', '2025년 10월 3일', '2025년 10월 3일'],
    ['ja', '2025年10月3日', '2025年10月3日'],
    ['zh-Hans', '2025年10月3日', '2025年10月3日'],
    ['zh-Hant', '2025年10月3日', '2025年10月3日'],
    ['es', '3 oct 2025', '3 de octubre de 2025'],
    ['ru', '3 окт. 2025 г.', '3 октября 2025 г.'],
    ['id', '3 Okt 2025', '3 Oktober 2025'],
    ['th', '3 ต.ค. 2025', '3 ตุลาคม 2025'],
    ['vi', '3 thg 10, 2025', '3 tháng 10, 2025'],
  ])('%s → %s (a11y %s)', (l, label, a11y) => {
    expect(formatReviewTime(iso, tFor(l), NOW)).toEqual({ label, a11y });
  });
  it.each(LOCALES)('%s — 상대 표기 4종(방금·분·시간·일)이 키 그대로가 아닌 문구 · 숫자 포함 · 가운데 점 0', (l) => {
    const t = tFor(l);
    const labels = [0, 5 * M, 3 * H, 3 * D].map((ms) => formatReviewTime(ago(ms), t, NOW).label);
    for (const x of labels) {
      expect(x).not.toMatch(/reviewTime\./);
      expect(x).not.toContain('·');
    }
    expect(labels.slice(1).every((x) => /\d/.test(x))).toBe(true);
  });
});

describe('다음 표기 경계(열어 둔 화면 갱신 — 컴파일러 메모 고착 방지)', () => {
  it.each([
    [10 * S, NOW + 50 * S], // 방금 → 1분 시점
    [5 * M + 10 * S, NOW + 50 * S], // 5분 → 6분
    [3 * H + 20 * M, NOW + 40 * M], // 3시간 → 4시간
    [2 * D + 5 * H, NOW + 19 * H], // 2일 → 3일
    [6 * D + 23 * H, NOW + 1 * H], // 6일 23시간 → 7일(날짜로 전환)
  ])('%sms 전 → 다음 변경 %s', (ms, want) => {
    expect(nextReviewTimeChange(ago(ms as number), NOW)).toBe(want);
  });
  it('7일 이상 = null(날짜는 더 안 바뀜 — 타이머 0) · 잘못된 값 = null', () => {
    expect(nextReviewTimeChange(ago(7 * D), NOW)).toBeNull();
    expect(nextReviewTimeChange('x', NOW)).toBeNull();
  });
});
