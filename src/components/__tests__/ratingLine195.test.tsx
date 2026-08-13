/**
 * P-195: 목록 카드 평점 줄 — 0건 미노출 · "★들 (n)" 형식(하이픈·가운뎃점 폐지) ·
 * 가로 캐러셀 고정 슬롯(카드 높이 균일) + 표면 배선 소스 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));

import { RatingLine, Stars } from '../Stars';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());

it('0건 = 미노출(null) — "없는 정보는 0으로 전시하지 않는다"(세로 목록)', () => {
  const tree = render(<RatingLine overall={{ average: null, count: 0 }} />);
  expect(tree.toJSON()).toBeNull();
});

it('0건 + fixedSlot = 빈 고정 슬롯(캐러셀 카드 높이 균일) — 별·수치 없음, 높이만', () => {
  const tree = render(<RatingLine overall={{ average: null, count: 0 }} fixedSlot />);
  const slot = tree.root.findAll((n) => n.props?.testID === 'rating-line');
  expect(slot.length).toBeGreaterThanOrEqual(1);
  expect(typeof (slot[0].props.style as { height?: number }).height).toBe('number'); // 고정 높이
  expect(tree.root.findAllByType(Stars).length).toBe(0);
  expect(flat(tree)).not.toContain('(0)');
});

it('1건+ = "★들 (n)" — 소괄호 카운트만, 평점 숫자·하이픈·가운뎃점 폐지', () => {
  const tree = render(<RatingLine overall={{ average: 4.3, count: 13 }} />);
  expect(tree.root.findAllByType(Stars).length).toBe(1);
  const count = tree.root.findAll((n) => n.props?.testID === 'rating-count').pop()!;
  expect(React.Children.toArray(count.props.children).join('')).toBe('(13)'); // JSX 분절 결합
  // 텍스트 노드 전수 — 평점 숫자·하이픈·가운뎃점 폐지 (SVG path 좌표는 텍스트 아님)
  const texts = tree.root
    .findAll((n) => n.type === 'Text' || (typeof n.type === 'string' && n.type.endsWith('Text')))
    .flatMap((n) => React.Children.toArray(n.props.children))
    .filter((c): c is string => typeof c === 'string')
    .join(' ');
  expect(texts).not.toContain('4.3');
  expect(texts).not.toContain('·');
  expect(texts).not.toContain('—');
});

it('표면 배선 소스 잠금 — 홈 캐러셀=fixedSlot·음식탭 목록=줄 제거, 구 형식 부재', () => {
  const fs = require('fs');
  const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
  const food = fs.readFileSync('src/app/(tabs)/food.tsx', 'utf8') as string;
  expect(home).toContain('<RatingLine overall={food.overall} fixedSlot />'); // 가로 캐러셀 = 높이 균일
  expect(food).toContain('<RatingLine overall={food.overall} />'); // 세로 목록 = 줄 제거
  for (const src of [home, food]) {
    expect(src).not.toContain("toFixed(1) ?? '—'"); // 구 "— · n" 조립 소멸
    expect(src).not.toContain('rateNum');
  }
});
