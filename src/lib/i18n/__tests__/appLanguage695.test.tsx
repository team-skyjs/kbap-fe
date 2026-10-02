/**
 * KB-695 — 쿼리 키의 언어는 구독(useAppLanguage)으로. 렌더 중 모듈 싱글턴 `i18n.language` 직접 읽기는 React Compiler가
 * 의존으로 못 잡아 키가 첫 렌더 언어로 굳는다(세션 중 언어 전환 시 다른 언어 데이터). 실제 i18n 모듈 + 컴파일된 소스로 검증.
 */
import * as React from 'react';
import * as fs from 'fs';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import i18n from '@/lib/i18n';
import { useAppLanguage } from '../useAppLanguage';

function Probe() {
  const lang = useAppLanguage();
  const key = React.useMemo(() => ['home', lang], [lang]);
  return <Text testID="k">{key.join('|')}</Text>;
}

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

it('언어 전환 → 같은 컴포넌트의 키가 새 언어로(재마운트 없이)', async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(<Probe />);
  });
  expect(t.root.findByProps({ testID: 'k' }).props.children).toBe('home|en');
  await act(async () => {
    await i18n.changeLanguage('ja');
  });
  expect(t.root.findByProps({ testID: 'k' }).props.children).toBe('home|ja');
});

it.each([
  ['src/lib/data/useFoods.ts', 4],
  ['src/lib/data/useHome.ts', 1],
  ['src/lib/data/useIngredientCatalog.ts', 1],
  ['src/lib/data/useMe.ts', 1],
  ['src/lib/data/bookmarks.ts', 1],
])('%s — 렌더 중 쿼리 키는 useAppLanguage 값(queryKey 안 i18n.language 0) · 훅 %i곳', (file, hooks) => {
  const src = fs.readFileSync(file, 'utf8');
  expect(src.match(/const lang = useAppLanguage\(\);/g) ?? []).toHaveLength(hooks as number);
  expect(src).not.toMatch(/queryKey:[^\n]*i18n\.language/);
});
