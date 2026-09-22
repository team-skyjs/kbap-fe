/**
 * KB-620(9/22 예진) — 음식 일시 숨김(`FOOD-001`) 판별 + 안내 문구.
 *
 * ① `isFoodHidden`은 **ApiError.code** 한 곳으로만 판별한다(메시지 문자열 매칭 금지 — BE 문구는 바뀐다)
 * ② 안내 문구 2종이 10개 로케일 전부에 있다
 * ③ 문구에 **안전 판정 어휘가 없다** — 이 앱의 판정(안전/주의/위험)은 재료 대조 결과에만 쓴다.
 *    "잠시 못 쓴다"는 안내에 그 어휘가 섞이면 음식 자체에 대한 판정으로 읽힌다(헌법 III).
 */
import * as fs from 'fs';
import * as path from 'path';
import { ApiError, isFoodHidden } from '../client';

describe('isFoodHidden — 판별은 ApiError.code 한 곳', () => {
  it('FOOD-001 ApiError만 참', () => {
    expect(isFoodHidden(new ApiError('해당 음식 정보를 찾을 수 없습니다', 400, 'FOOD-001'))).toBe(true);
  });

  it('다른 코드·코드 없음은 거짓', () => {
    expect(isFoodHidden(new ApiError('x', 400, 'FOOD-010'))).toBe(false);
    expect(isFoodHidden(new ApiError('x', 500, 'COMMON-001'))).toBe(false);
    expect(isFoodHidden(new ApiError('x', 400))).toBe(false);
  });

  it('메시지에 FOOD-001이 들어간 일반 Error는 거짓 — 문자열 매칭으로 새지 않는다', () => {
    expect(isFoodHidden(new Error('FOOD-001'))).toBe(false);
    expect(isFoodHidden({ code: 'FOOD-001' })).toBe(false); // 모양만 닮은 객체도
  });

  it('에러가 아닌 값은 거짓', () => {
    for (const v of [null, undefined, 'FOOD-001', 0, {}]) expect(isFoodHidden(v)).toBe(false);
  });
});

const I18N = path.join(__dirname, '../../i18n');
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'] as const;
const read = (l: string) => JSON.parse(fs.readFileSync(path.join(I18N, `${l}.json`), 'utf8')) as Record<string, Record<string, string>>;
const COPY = (l: string) => {
  const j = read(l);
  // KB-626: 북마크 추가 안내(saved.foodHidden)도 같은 FOOD-001 문구 — 같은 가드를 받는다
  return { review: j.review?.foodHidden, detail: j.detail?.foodHidden, saved: j.saved?.foodHidden };
};

describe('안내 문구 — 10개 로케일', () => {
  it('로케일 파일 목록이 이 테스트가 보는 목록과 같다(새 로케일이 검사에서 빠지지 않게)', () => {
    // 열거형 잠금의 사각(9/15 메모): 목록을 손으로 적으면 나중에 생긴 로케일은 영영 검사 안 된다.
    const onDisk = fs.readdirSync(I18N).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
    expect(onDisk).toEqual([...LOCALES].sort());
  });

  it.each(LOCALES)('%s — review·detail·saved .foodHidden 셋 다 비어 있지 않다', (l) => {
    const c = COPY(l);
    expect(c.review?.trim()).toBeTruthy();
    expect(c.detail?.trim()).toBeTruthy();
    expect(c.saved?.trim()).toBeTruthy();
  });

  it.each(LOCALES)('%s — 두 문구가 서로 다르다(리뷰 쪽은 "쓴 글이 남아 있다"를 담는다)', (l) => {
    const c = COPY(l);
    expect(c.review).not.toBe(c.detail);
  });
});

/** 로케일별 안전 판정 어휘. 판정 배지·재료 대조에만 쓰는 말들이다. 소문자로 비교한다. */
const VERDICT_WORDS: Record<(typeof LOCALES)[number], string[]> = {
  en: ['safe', 'caution', 'danger', 'risk', 'warning', 'allerg', 'avoid', 'harm'],
  ko: ['안전', '주의', '위험', '경고', '알레르기', '기피'],
  ja: ['安全', '注意', '危険', '警告', 'アレルギー'],
  'zh-Hans': ['安全', '注意', '危险', '警告', '过敏'],
  'zh-Hant': ['安全', '注意', '危險', '警告', '過敏'],
  vi: ['an toàn', 'nguy hiểm', 'cảnh báo', 'dị ứng', 'thận trọng'],
  id: ['aman', 'bahaya', 'peringatan', 'alergi', 'hati-hati'],
  th: ['ปลอดภัย', 'อันตราย', 'เตือน', 'แพ้', 'ระวัง'],
  ru: ['безопас', 'опасн', 'осторож', 'предупрежд', 'аллерг'],
  es: ['segur', 'peligro', 'precaución', 'advertencia', 'alerg'],
};

describe('안내 문구에 안전 판정 어휘가 없다(헌법 III)', () => {
  it.each(LOCALES)('%s', (l) => {
    const c = COPY(l);
    const text = `${c.review} ${c.detail} ${c.saved}`.toLowerCase();
    const hits = VERDICT_WORDS[l].filter((w) => text.includes(w.toLowerCase()));
    expect(hits).toEqual([]);
  });
});

/* Codex #184 3R — 서버가 **숨김과 삭제를 같은 FOOD-001로** 준다(`getReadyFood`). 삭제된 음식은
   푸시 딥링크·내 리뷰(수정 포함)로 **반복해서** 도달한다. 이 코드 위에서 "잠시 후 다시"는 영원히
   못 지키는 약속이 되고, 리뷰 수정은 절대 성공하지 않는 재시도 반복에 갇힌다.
   → 둘 다 참인 중립 문구. **FOOD-018(KB-625)로 숨김이 따로 오면** 그 분기에서만 회복 문구를
   되살리고, 이 가드는 FOOD-001 문구에 대해서만 유지한다. */
describe('FOOD-001 문구는 원인 단정·회복 약속을 하지 않는다(숨김·삭제 미구분 동안)', () => {
  const PROMISE: Partial<Record<(typeof LOCALES)[number], string[]>> = {
    en: ['again', 'later', 'moment', 'check back', 'updat', 'refresh'],
    ko: ['잠시 후', '다시', '새로 고치', '업데이트', '곧'],
  };
  it.each(Object.keys(PROMISE) as (typeof LOCALES)[number][])('%s', (l) => {
    const c = COPY(l);
    const text = `${c.review} ${c.detail} ${c.saved}`.toLowerCase();
    expect(PROMISE[l]!.filter((w) => text.includes(w.toLowerCase()))).toEqual([]);
  });
});
