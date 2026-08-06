/**
 * P-135(멘토 #1·25): 시스템 폰트 전환 잠금 — font 맵 키 구조 무변 ·
 * resolveFont 전 토큰 시스템 치환(weight 위계) · 워드마크만 Baloo 잔존 ·
 * nunito 패키지 참조 0.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

import { font } from '@/lib/theme';
import { resolveFont } from '../fonts';
import { BrandWordmark } from '@/components/Brand';

it('font 맵 — 키 구조 무변(호출처 무수정 요건)', () => {
  for (const k of ['display', 'displaySemi', 'displayBlack', 'body', 'bodySemi', 'bodyBold', 'bodyBlack', 'ko', 'koMed', 'koBold']) {
    expect(typeof (font as Record<string, string>)[k]).toBe('string');
  }
});

it('resolveFont — 전 토큰이 시스템 weight로 치환 (라틴 포함, fontFamily 없음)', () => {
  const CASES: [string, string][] = [
    [font.display, '700'], [font.displaySemi, '600'], [font.displayBlack, '800'],
    [font.body, '400'], [font.bodySemi, '600'], [font.bodyBold, '700'], [font.bodyBlack, '800'],
    [font.ko, '400'], [font.koMed, '500'], [font.koBold, '700'],
  ];
  for (const [fam, weight] of CASES) {
    for (const script of ['latin', 'kr', 'cyrillic', 'jp'] as const) {
      const o = resolveFont(fam, script);
      expect(o).toEqual({ fontWeight: weight }); // fontFamily 미지정 = 시스템
    }
  }
});

it('resolveFont — 미지 패밀리(로고 Baloo 직접 지정 등)는 손대지 않음', () => {
  expect(resolveFont('SomeCustomFamily', 'latin')).toBe(null);
  expect(resolveFont(undefined, 'latin')).toBe(null);
});

it('워드마크 — raw Text + Baloo2_800 잔존(Txt 우회로 시스템 치환 미적용)', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<BrandWordmark />);
  });
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('Baloo2_800ExtraBold');
});

it('nunito 패키지 참조 0 (번들 제거)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../../../../package.json') as { dependencies: Record<string, string> };
  expect(pkg.dependencies['@expo-google-fonts/nunito-sans']).toBeUndefined();
  expect(pkg.dependencies['@expo-google-fonts/baloo-2']).toBeTruthy(); // 워드마크 잔류
});
