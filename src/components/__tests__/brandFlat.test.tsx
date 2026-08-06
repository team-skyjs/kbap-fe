/**
 * P-133(kbap-logo-flat): 플랫 로고 잠금 — 라디얼 그라데이션(글로스)·쉐도우 잔재 0.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { BrandTile, BrandLockup } from '../Brand';

it('BrandTile — 그라데이션/쉐도우 없음, 단색 primary 타일', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<BrandTile size={40} />);
  });
  const json = JSON.stringify(tree.toJSON());
  expect(json).not.toMatch(/RadialGradient|LinearGradient|Stop/);
  expect(json).not.toMatch(/shadow/i);
});

it('BrandLockup — 렌더 그린(워드마크 포함)', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<BrandLockup />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Bap');
});
