/**
 * KB-497 소스 잠금 — 로컬 알림 설정 저장소(3토글·게스트 동의) 참조 0, 토큰 등록 언어 변경 배선 유지.
 * 서버 정본 원칙(P-147): 설정 값은 서버 응답만 표시한다. 로컬 키가 되살아나면 표시·실제가 어긋난다.
 */
import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk('src');
const read = (p: string) => fs.readFileSync(p, 'utf8');

it('로컬 설정 저장소·게스트 동의 모듈 참조가 src(테스트 제외)에 없다 (FR-003, SC-001)', () => {
  const banned = ['kbap.push.settings.v1', 'guestConsent', 'getPushSettings', 'savePushSettings', 'kbap.guestNotif'];
  const hits: string[] = [];
  for (const f of files) {
    const src = read(f);
    for (const b of banned) if (src.includes(b)) hits.push(`${f}: ${b}`);
  }
  expect(hits).toEqual([]);
  expect(fs.existsSync('src/lib/push/guestConsent.ts')).toBe(false);
});

it('_layout.tsx: 언어 변경(languageChanged) → registerPushToken 재등록 배선 유지 (FR-019)', () => {
  const layout = read('src/app/_layout.tsx');
  expect(layout).toContain("i18n.on('languageChanged', onLang)");
  expect(layout).toContain('const onLang = () => void push.registerPushToken();');
});
