/**
 * P-303(KB-457) — 재료 이미지 3단 체인 공유: 서버 imageUrl → CDN 조립 → 폴백(null).
 * 상세 타일·시트가 AvoidTile과 같은 체인을 쓰는 배선 소스 잠금 포함.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@/lib/onboarding/ingredientImages', () => ({
  ingredientImageUrl: (code: string) => `https://cdn.kbap.site/ingredients/${code}.jpg`,
}));
// 훅만 검증 — AvoidTile 렌더 의존(reanimated 경유 Skeleton·expo-image)은 표면 목
jest.mock('@/components/Skeleton', () => ({ Shimmer: () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));

import { useIngredientImageChain } from '../AvoidTile';

function Probe({ code, imageUrl }: { code: string; imageUrl?: string | null }) {
  const { uri, nextSource } = useIngredientImageChain(code, imageUrl);
  return (
    <Text testID="probe" onPress={nextSource}>
      {uri ?? '(none)'}
    </Text>
  );
}

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const uriOf = (t: ReactTestRenderer) => t.root.findByProps({ testID: 'probe' }).props.children as string;
const fail = (t: ReactTestRenderer) => act(() => t.root.findByProps({ testID: 'probe' }).props.onPress());

it('서버 imageUrl 있음 = 그대로 1순위 → 실패 시 CDN 조립 → 재실패 시 소진(null = 폴백)', () => {
  const t = render(<Probe code="GRN-001" imageUrl="https://api.kbap.site/img/grn.jpg" />);
  expect(uriOf(t)).toBe('https://api.kbap.site/img/grn.jpg');
  fail(t); // 서버 URL 404
  expect(uriOf(t)).toBe('https://cdn.kbap.site/ingredients/GRN-001.jpg');
  fail(t); // CDN도 실패
  expect(uriOf(t)).toBe('(none)'); // 체인 소진 — 호출부 폴백(IconFood/색 타일)
});

it('서버 imageUrl null = CDN 조립이 1순위(상세만 사진 안 뜨던 결함의 판별 케이스)', () => {
  const t = render(<Probe code="MEA-002" imageUrl={null} />);
  expect(uriOf(t)).toBe('https://cdn.kbap.site/ingredients/MEA-002.jpg');
});

it('서버 URL = CDN 조립과 동일하면 중복 제거(실패 1회로 소진)', () => {
  const t = render(<Probe code="EGG-003" imageUrl="https://cdn.kbap.site/ingredients/EGG-003.jpg" />);
  expect(uriOf(t)).toBe('https://cdn.kbap.site/ingredients/EGG-003.jpg');
  fail(t);
  expect(uriOf(t)).toBe('(none)');
});

it('배선 소스 잠금 — 상세 타일·시트 = IngChainImage(공유 체인) 경유·RemoteImage onError 전환', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  const detail = fs.readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
  expect(detail).toContain("import { useIngredientImageChain } from '@/components/AvoidTile';");
  expect((detail.match(/<IngChainImage /g) ?? []).length).toBe(2); // 타일(48)+시트(56)
  expect(detail).toContain('size={48} iconSize={28}');
  expect(detail).toContain('size={56} iconSize={32}');
  expect(detail).toContain('onError={nextSource}');
  // 구 단독 경로(cat.imageUrl 삼항 → RemoteImage 직행) 잔존 0
  expect(detail).not.toMatch(/img \? \(\s*<RemoteImage/);
  const remote = fs.readFileSync('src/components/RemoteImage.tsx', 'utf8') as string;
  expect(remote).toContain('onError?.(); // P-303');
  // AvoidTile도 같은 훅 소비(체인 정본 한 곳)
  const avoid = fs.readFileSync('src/components/AvoidTile.tsx', 'utf8') as string;
  expect(avoid).toContain('useIngredientImageChain(code, imageUrl)');
});
