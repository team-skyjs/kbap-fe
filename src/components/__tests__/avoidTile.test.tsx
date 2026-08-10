/**
 * P-145: 회피 타일 — 실사진 렌더 + 로드 실패 시 색 폴백(약어) 유지, 프레임 불변.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k },
}));

import { AvoidTile } from '../AvoidTile';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('사진 렌더 — CDN URL(소문자 webp) 소스 + 폴백 약어는 하층에 상존(프레임 불변)', () => {
  const tree = render(<AvoidTile code="PINE_NUT" abbr="PN" tint="rgba(0,0,0,0.1)" />);
  const img = tree.root.findAll((n) => n.props?.testID === 'avtile-img-PINE_NUT')[0];
  expect(img.props.source).toEqual({ uri: 'https://d29c1cr2ng7w0.cloudfront.net/images/webp/ingredients/pine_nut.webp' });
  expect(JSON.stringify(tree.toJSON())).toContain('PN');
});

it('로드 실패(onError) → 이미지 언마운트, 색 폴백(약어)만 노출', () => {
  const tree = render(<AvoidTile code="EGG" abbr="EG" tint="rgba(0,0,0,0.1)" />);
  const img = tree.root.findAll((n) => n.props?.testID === 'avtile-img-EGG')[0];
  act(() => {
    img.props.onError();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'avtile-img-EGG').length).toBe(0);
  expect(JSON.stringify(tree.toJSON())).toContain('EG');
});
