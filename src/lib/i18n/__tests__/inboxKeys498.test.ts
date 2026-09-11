/**
 * KB-498 — inbox 네임스페이스 10로케일 키 집합 일치 + 구 nudge/notice 키 잔존 0 (FR-004·005, SC-002).
 * 푸시 유형 개명(NUDGE→SCAN_SUGGESTION)·신설(NEWS·MEAL_TIME)로 알림함 문구 키가 바뀌었다 — 로케일 누락 = 빈 제목.
 * 광고성 3종 문구에 "(광고)"·수신거부 안내가 없어야 한다(FR-006 — 서버가 푸시 본문에 부착, 앱 가공 0).
 */
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
const dir = path.join(__dirname, '..');
const load = (l: string) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')) as Record<string, Record<string, string>>;

const REQUIRED = [
  'title', 'empty', 'emptyBody', 'markAllRead',
  'helpfulTitle', 'helpfulBody', 'reminderTitle', 'reminderBody',
  'scanSuggestionTitle', 'scanSuggestionBody', 'newsTitle', 'newsBody', 'mealTimeTitle', 'mealTimeBody',
  'newBadge',
];
const OLD_KEYS = ['nudgeTitle', 'nudgeBody', 'noticeTitle', 'noticeBody'];
const AD_KEYS = ['scanSuggestionTitle', 'scanSuggestionBody', 'newsTitle', 'newsBody', 'mealTimeTitle', 'mealTimeBody'];

it('inbox 키 집합이 10로케일 전부 ko와 일치하고 필수 키가 비어 있지 않다', () => {
  const ko = load('ko');
  for (const l of LOCALES) {
    const d = load(l);
    expect({ locale: l, inbox: Object.keys(d.inbox).sort() }).toEqual({ locale: l, inbox: Object.keys(ko.inbox).sort() });
    for (const k of REQUIRED) expect({ locale: l, key: k, ok: typeof d.inbox[k] === 'string' && d.inbox[k].length > 0 }).toEqual({ locale: l, key: k, ok: true });
  }
});

it('구 nudge/notice 키가 어느 로케일에도 남지 않는다', () => {
  for (const l of LOCALES) {
    const d = load(l);
    for (const k of OLD_KEYS) expect({ locale: l, key: k, present: k in d.inbox }).toEqual({ locale: l, key: k, present: false });
  }
});

it('광고성 3종 문구에 (광고)·수신거부 안내가 없다 — 서버 부착(FR-006)', () => {
  for (const l of LOCALES) {
    const d = load(l);
    for (const k of AD_KEYS) {
      expect({ locale: l, key: k, v: d.inbox[k] }).not.toMatchObject({ v: expect.stringMatching(/\(광고\)|\(Ad\)|수신거부/i) });
    }
  }
});
