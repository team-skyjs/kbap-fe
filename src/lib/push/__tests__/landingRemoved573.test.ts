/**
 * KB-573 — 임시 착지 화면(push-landing) 소멸 잠금 (FR-006 · SC-003).
 * 착지 전부 확정(MEAL_TIME·SCAN_SUGGESTION=홈 · HELPFUL=내 리뷰)으로 디버깅용 화면·문구 키가 존재할 이유가 없다 —
 * 부활하면 배포 앱에 "착지 미정" 화면이 노출된다.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];

it('10로케일 push 네임스페이스에 landingTbdTitle·landingTbdBody 키 없음', () => {
  for (const l of LOCALES) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/i18n', `${l}.json`), 'utf8')) as Record<string, Record<string, string>>;
    expect(d.push).toBeDefined();
    expect(Object.keys(d.push).filter((k) => k.startsWith('landingTbd'))).toEqual([]);
  }
});

it('pushAdapter 소스에 push-landing 경로 0회', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/push/pushAdapter.ts'), 'utf8');
  expect(src.includes('push-landing')).toBe(false);
});

it('src/app/push-landing.tsx 파일 부재', () => {
  expect(fs.existsSync(path.join(ROOT, 'src/app/push-landing.tsx'))).toBe(false);
});
