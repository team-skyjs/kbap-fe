/**
 * P-303(KB-457) — 재료 이미지 3단 체인 공유: 서버 imageUrl → CDN 조립 → 폴백(null).
 * 상세 타일·시트가 AvoidTile과 같은 체인을 쓰는 배선 소스 잠금 포함.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@/lib/onboarding/ingredientImages', () => ({
  ingredientImageUrl: (code: string) => `https://cdn.kbap.site/ingredients/${code}.jpg`,
  ingredientCutoutUrl: (code: string) => `https://cdn.kbap.site/ingredients-cut/${code}.webp`, // P-341
}));
// 훅만 검증 — AvoidTile 렌더 의존(reanimated 경유 Skeleton·expo-image)은 표면 목
jest.mock('@/components/Skeleton', () => ({ Shimmer: () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));

import { useIngredientImageChain } from '../AvoidTile';

function Probe({ code, imageUrl }: { code: string; imageUrl?: string | null }) {
  const { uri, isCutout, nextSource } = useIngredientImageChain(code, imageUrl);
  void isCutout;
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

it('P-341(KB-502): 누끼본 선두 → 실패 시 서버 imageUrl → CDN 조립 → 소진(null = 폴백)', () => {
  const t = render(<Probe code="GRN-001" imageUrl="https://api.kbap.site/img/grn.jpg" />);
  expect(uriOf(t)).toBe('https://cdn.kbap.site/ingredients-cut/GRN-001.webp'); // 체인 선두 = 누끼
  fail(t); // 누끼 404 — 기존 체인으로 자연 폴백
  expect(uriOf(t)).toBe('https://api.kbap.site/img/grn.jpg');
  fail(t); // 서버 URL 404
  expect(uriOf(t)).toBe('https://cdn.kbap.site/ingredients/GRN-001.jpg');
  fail(t); // CDN도 실패
  expect(uriOf(t)).toBe('(none)'); // 체인 소진 — 호출부 폴백(IconFood/색 타일)
});

it('서버 imageUrl null = 누끼 → CDN 조립 순', () => {
  const t = render(<Probe code="MEA-002" imageUrl={null} />);
  expect(uriOf(t)).toBe('https://cdn.kbap.site/ingredients-cut/MEA-002.webp');
  fail(t);
  expect(uriOf(t)).toBe('https://cdn.kbap.site/ingredients/MEA-002.jpg');
});

it('P-341: isCutout = 선두(누끼)에서만 참 — contain/흰 배경 스타일 분기 근거', () => {
  function CutProbe() {
    const { isCutout, nextSource } = useIngredientImageChain('EGG-009', null);
    return <Text testID="cut" onPress={nextSource}>{String(isCutout)}</Text>;
  }
  const t = render(<CutProbe />);
  expect(t.root.findByProps({ testID: 'cut' }).props.children).toBe('true');
  act(() => t.root.findByProps({ testID: 'cut' }).props.onPress());
  expect(t.root.findByProps({ testID: 'cut' }).props.children).toBe('false');
});

it('P-341 소스 잠금 — 누끼 = contain+18% 인셋·흰 배경(실패만 tint), 상세 = contain 분기', () => {
  const fsx = require('fs');
  const av = fsx.readFileSync('src/components/AvoidTile.tsx', 'utf8') as string;
  expect(av).toContain("photoCut: { position: 'absolute', top: '18%', right: '18%', bottom: '18%', left: '18%' }");
  expect(av).toContain("backgroundColor: failed ? tint : '#FFFFFF'");
  expect(av).toContain("contentFit={isCutout ? 'contain' : 'cover'}");
  const fd = fsx.readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
  expect(fd).toContain("contentFit={isCutout ? 'contain' : undefined}");
  // Codex #102 P2: 상세 재료 이미지도 누끼 = 흰 바닥(부모 surface2는 실패 폴백만)
  expect(fd).toMatch(/isCutout && <View style=\{\[StyleSheet\.absoluteFill, \{ backgroundColor: '#FFFFFF' \}\]\}/);
});

it('서버 URL = CDN 조립과 동일하면 중복 제거(누끼 실패 후 1회로 소진)', () => {
  const t = render(<Probe code="EGG-003" imageUrl="https://cdn.kbap.site/ingredients/EGG-003.jpg" />);
  fail(t); // 누끼 실패
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
