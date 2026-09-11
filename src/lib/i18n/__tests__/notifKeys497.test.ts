/**
 * KB-497 — notif/push 네임스페이스 10로케일 키 집합 일치 + 구 키(3토글·야간 동의) 잔존 0.
 * 알림 설정 2그룹 재편으로 키가 통째로 바뀌었으므로 로케일 누락이 곧 빈 라벨이다.
 */
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
const dir = path.join(__dirname, '..');
const load = (l: string) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')) as Record<string, Record<string, string>>;

const OLD_KEYS = ['helpful', 'helpfulSub', 'reminder', 'reminderSub', 'nudge', 'nudgeSub', 'marketing', 'marketingSub', 'night', 'nightSub'];
const REQUIRED_NOTIF = ['title', 'activityGroup', 'activity', 'activitySub', 'newsGroup', 'news', 'newsSub', 'mealTime', 'mealTimeSub', 'consentStatus', 'viewFull', 'readFailed', 'osOff', 'osOffCta', 'saveFailed'];
const REQUIRED_PUSH = ['primerTitle', 'primerBody', 'primerYes', 'primerLater', 'consentSheetTitle', 'consentSheetBody', 'privacyConsent', 'receiveConsent', 'consentConfirm'];

it('notif·push 키 집합이 10로케일 전부 ko와 일치한다 (SC-007)', () => {
  const ko = load('ko');
  for (const l of LOCALES) {
    const d = load(l);
    expect({ locale: l, notif: Object.keys(d.notif).sort() }).toEqual({ locale: l, notif: Object.keys(ko.notif).sort() });
    expect({ locale: l, push: Object.keys(d.push).sort() }).toEqual({ locale: l, push: Object.keys(ko.push).sort() });
    for (const k of REQUIRED_NOTIF) expect(typeof d.notif[k]).toBe('string');
    for (const k of REQUIRED_PUSH) expect(typeof d.push[k]).toBe('string');
    for (const k of [...Object.keys(d.notif), ...Object.keys(d.push)]) expect(k).not.toBe('');
  }
});

it('구 3토글·야간 동의 키가 어느 로케일에도 남지 않는다 (FR-011)', () => {
  for (const l of LOCALES) {
    const d = load(l);
    for (const k of OLD_KEYS) expect({ locale: l, key: k, present: k in d.notif }).toEqual({ locale: l, key: k, present: false });
  }
});

it('consentStatus는 date·version 보간 자리표시자를 가진다', () => {
  for (const l of LOCALES) {
    const s = load(l).notif.consentStatus;
    expect(s).toContain('{{date}}');
    expect(s).toContain('{{version}}');
  }
});
