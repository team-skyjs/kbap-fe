/**
 * KB-783(#278 Codex 4R) — +native-intent가 직접 처리한 링크에 null을 돌려주는 근거 잠금: 설치된 expo-router가
 * ① 타입으로 null을 허용하고 ② 웜 링크 구독이 null을 건너뛰며(listener 미호출 = 이동 없음) ③ 콜드 스타트도 null을 그대로(= 기본 루트) 쓴다.
 * expo-router를 올렸을 때 이 계약이 바뀌면 여기서 깨진다 → +native-intent 반환값을 다시 설계할 것.
 */
import * as fs from 'fs';

const rd = (p: string) => fs.readFileSync(p, 'utf8');
const squash = (s: string) => s.replace(/\s+/g, ' ');

it('타입: redirectSystemPath 반환 = Promise<string | null> | string | null', () => {
  expect(squash(rd('node_modules/expo-router/build/types.d.ts'))).toContain('initial: boolean; }) => Promise<string | null> | string | null;');
});

it('웜 링크(link/linking subscribe): 결과가 falsy면 listener를 부르지 않는다 — 두 분기(Expo Go·일반) 모두', () => {
  const src = squash(rd('node_modules/expo-router/build/link/linking.js'));
  const pattern = /href = await nativeLinking\.redirectSystemPath\(\{ path: href, initial: false \}\); \} if \(href\) \{ listener\(href\); \}/g;
  expect((src.match(pattern) ?? []).length).toBe(2);
});

it('콜드 스타트(getLinkingConfig): 결과를 initialUrl로 그대로 — null이면 초기 URL 없음(기본 루트)', () => {
  const src = squash(rd('node_modules/expo-router/build/getLinkingConfig.js'));
  expect(src).toContain('initialUrl = nativeLinking.redirectSystemPath({ path: initialUrl, initial: true });');
});

it('소비처는 이 두 파일뿐(새 소비처가 생기면 null 처리 재확인)', () => {
  const walk = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []));
  const users = walk('node_modules/expo-router/build').filter((f) => rd(f).includes('redirectSystemPath'));
  expect(users.map((f) => f.replace('node_modules/expo-router/build/', '')).sort()).toEqual(['getLinkingConfig.js', 'link/linking.js']);
});
