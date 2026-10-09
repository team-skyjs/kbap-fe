/**
 * P-215(KB-316): 계측 네이밍 도메인 접두 정합 — 개명 반영 + **구 이름 잔존 0**
 * 소스 잠금(오타·누락 방지). 태소노미 CSV와 1:1 유지가 목적.
 */
import { EVENTS, sanitizeUserProps } from '../analytics';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const SRC_FILES: string[] = require('child_process')
  .execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
  .split('\n')
  .filter((f: string) => /\.tsx?$/.test(f) && !f.includes('__tests__'));

/** 개명 8+3종 — 구 이름 → 새 이름 */
const RENAMED: Record<string, string> = {
  application_opened: 'app_opened',
  tab_view: 'app_tab_view',
  guest_enter: 'auth_guest_enter',
  login_success: 'auth_login_success',
  account_delete: 'auth_account_delete',
  bookmark_toggle: 'food_bookmark_toggle',
  translate_toggle: 'review_translate_toggle',
  post_submit: 'community_post_submit',
  comment_submit: 'community_comment_submit',
  push_primer: 'push_primer_response',
  notif_pref_toggle: 'push_pref_toggle',
};

it('개명 반영 — 새 이름이 EVENTS 값과 1:1(키 = 값)', () => {
  for (const newName of Object.values(RENAMED)) {
    expect((EVENTS as Record<string, string>)[newName]).toBe(newName);
  }
});

it('구 이름 잔존 0 — 전 소스에서 개명 전 이름이 사라졌다', () => {
  const leftovers: string[] = [];
  for (const file of SRC_FILES) {
    const src = read(file);
    for (const [oldName, newName] of Object.entries(RENAMED)) {
      // 새 이름은 구 이름을 부분 문자열로 갖지 않으므로(접두가 붙음) 단어 경계로 충분.
      // 단 tab_view ⊂ app_tab_view, post_submit ⊂ community_post_submit 형태라
      // 앞에 밑줄/영문자가 없는 경우만 구 이름으로 카운트한다.
      const re = new RegExp(`(?<![A-Za-z_])${oldName}\\b`, 'g');
      if (re.test(src)) leftovers.push(`${file}: ${oldName} (→ ${newName})`);
    }
  }
  expect(leftovers).toEqual([]);
});

it('user property = user_info_ 접두 — 구 키는 드롭(화이트리스트가 방어선)', () => {
  expect(
    sanitizeUserProps({
      user_info_country: 'KR',
      user_info_lang: 'en',
      user_info_os: 'ios',
      user_info_os_version: '18.1',
      user_info_spice_level: 'HOT',
      user_info_avoid_count: 2,
      user_info_is_registered: true,
      user_info_currency: 'KRW',
      // @ts-expect-error — 구 접두 없는 키
      country: 'US',
    }),
  ).toEqual({
    user_info_country: 'KR',
    user_info_lang: 'en',
    user_info_os: 'ios',
    user_info_os_version: '18.1',
    user_info_spice_level: 'HOT',
    user_info_avoid_count: 2,
    user_info_is_registered: true,
    user_info_currency: 'KRW',
  });
});

it('전 이벤트가 도메인 접두 규칙 준수 — 규칙 주석도 소스에 상비', () => {
  const DOMAINS = ['app', 'auth', 'onboarding', 'scan', 'order', 'owner', 'food', 'search', 'review', 'community', 'profile', 'push', 'error'];
  for (const name of Object.values(EVENTS)) {
    expect(DOMAINS.some((d) => name.startsWith(`${d}_`))).toBe(true);
  }
  const src = read('src/lib/analytics.ts');
  expect(src).toContain('네이밍 규칙');
  expect(src).toContain('user property = `user_info_` 접두');
});
