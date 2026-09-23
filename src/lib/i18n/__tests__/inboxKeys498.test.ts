/**
 * KB-498 → KB-499 개정 — inbox 네임스페이스 10로케일 키 집합 일치.
 * KB-499(서버 알림함 전환): 제목·본문은 서버 문자열이라 유형별 문구 키 10종 + 모두 읽음(전체 읽음 계약 없음)을 제거했다.
 * 상대 시각은 커뮤니티 공용 4키를 재사용(ko justNow = "방금 전", zh 일 단위 공백 0). 게이트 시트 문구 신설 없음(로그인 직행).
 */
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
const dir = path.join(__dirname, '..');
const load = (l: string) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')) as Record<string, Record<string, string>>;

const REQUIRED = ['title', 'empty', 'emptyBody', 'newBadge'];
const OLD_KEYS = [
  'nudgeTitle', 'nudgeBody', 'noticeTitle', 'noticeBody', // KB-498
  'markAllRead', 'helpfulTitle', 'helpfulBody', 'reminderTitle', 'reminderBody', // KB-499
  'scanSuggestionTitle', 'scanSuggestionBody', 'newsTitle', 'newsBody', 'mealTimeTitle', 'mealTimeBody',
];
const TIME_KEYS: [string, string, boolean][] = [
  ['community', 'justNow', false],
  ['community', 'minsAgo', true],
  ['community', 'hoursAgo', true],
  ['reviews', 'daysAgo', true],
];

it('inbox 키 집합이 10로케일 전부 ko와 일치하고 필수 키가 비어 있지 않다', () => {
  const ko = load('ko');
  expect(Object.keys(ko.inbox).sort()).toEqual([...REQUIRED].sort());
  for (const l of LOCALES) {
    const d = load(l);
    expect({ locale: l, inbox: Object.keys(d.inbox).sort() }).toEqual({ locale: l, inbox: Object.keys(ko.inbox).sort() });
    for (const k of REQUIRED) expect({ locale: l, key: k, ok: typeof d.inbox[k] === 'string' && d.inbox[k].length > 0 }).toEqual({ locale: l, key: k, ok: true });
  }
});

it('구 유형별 문구·모두 읽음·nudge/notice 키가 어느 로케일에도 남지 않는다', () => {
  for (const l of LOCALES) {
    const d = load(l);
    for (const k of OLD_KEYS) expect({ locale: l, key: k, present: k in d.inbox }).toEqual({ locale: l, key: k, present: false });
  }
});

it('상대 시각 공용 4키 — 10로케일 존재·{{count}} 보간·ko "방금 전"·zh 일 단위 공백 0', () => {
  for (const l of LOCALES) {
    const d = load(l);
    for (const [ns, k, hasCount] of TIME_KEYS) {
      const v = d[ns]?.[k];
      expect({ locale: l, key: `${ns}.${k}`, ok: typeof v === 'string' && v.length > 0 }).toEqual({ locale: l, key: `${ns}.${k}`, ok: true });
      if (hasCount) expect({ locale: l, key: `${ns}.${k}`, v }).toMatchObject({ v: expect.stringContaining('{{count}}') });
    }
  }
  expect(load('ko').community.justNow).toBe('방금 전');
  for (const l of ['zh-Hans', 'zh-Hant']) expect({ locale: l, v: load(l).reviews.daysAgo }).toEqual({ locale: l, v: '{{count}}天前' });
});

it('게이트 시트 알림 문구는 만들지 않는다(게스트 = 로그인 직행)', () => {
  for (const l of LOCALES) {
    const g = load(l).gate ?? {};
    expect({ locale: l, notifTitle: 'notifTitle' in g, notifSub: 'notifSub' in g }).toEqual({ locale: l, notifTitle: false, notifSub: false });
  }
});
