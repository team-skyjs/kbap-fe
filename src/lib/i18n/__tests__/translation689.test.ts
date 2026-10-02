/** KB-689 — 번역 라벨 문구 × 10로케일 + 앱 10개 언어 이름 × 10로케일 표. 옛 키(translate·seeOriginal) 삭제. */
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.join(__dirname, '..');
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
const tr = (l: string) => (JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), 'utf8')) as { translation: Record<string, unknown> }).translation;

it.each(LOCALES)('%s — showTranslation · translatedFrom({{language}}) · translated · translateFailed · 언어 이름 10종 · 옛 키 없음 · 이모지 0', (l) => {
  const t = tr(l);
  for (const k of ['showTranslation', 'translatedFrom', 'translated', 'translateFailed']) expect(String(t[k] ?? '').trim()).not.toBe('');
  expect(t.translatedFrom).toContain('{{language}}');
  const names = t.lang as Record<string, string>;
  expect(Object.keys(names).sort()).toEqual([...LOCALES].sort());
  for (const v of Object.values(names)) expect(v.trim()).not.toBe('');
  expect(t.translate).toBeUndefined();
  expect(t.seeOriginal).toBeUndefined();
  expect(/\p{Extended_Pictographic}/u.test(JSON.stringify(t))).toBe(false);
});

it('ko 문구(K-큐 대상 · 상태 문구는 해요체 — Codex #223 P1) — 번역 보기 · {{language}}에서 번역했어요 · 번역했어요 · 영어', () => {
  const t = tr('ko');
  expect([t.showTranslation, t.translatedFrom, t.translated, (t.lang as Record<string, string>).en]).toEqual(['번역 보기', '{{language}}에서 번역했어요', '번역했어요', '영어']);
});

it('ko 가장 긴 라벨("중국어(번체)에서 번역했어요")도 1줄에 들어간다 — 320pt 카드 내부 폭(280) × 글자 배율 1.3 기준 보수 추정', () => {
  const t = tr('ko');
  const names = Object.values(t.lang as Record<string, string>);
  const longest = names.map((n) => String(t.translatedFrom).replace('{{language}}', n)).sort((a, b) => b.length - a.length)[0];
  expect(longest.length).toBe('중국어(번체)에서 번역했어요'.length); // 간체·번체 동률 최장(15자)
  // 한글 1자 ≈ 글자 크기 폭(12.5) · 괄호·공백도 1자로 보수 계산 → 15자 × 12.5 × 1.3 = 243.75 < 280
  expect(longest.length * 12.5 * 1.3).toBeLessThan(280);
});
