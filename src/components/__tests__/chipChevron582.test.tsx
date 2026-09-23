/**
 * P-391(KB-582) — 위험도 칩 색 = 마크/배지 색 · chevron 방향.
 *
 * 예진 실기 2건: ① 위험도 필터 칩이 `RiskMark`와 다른 색 ② 온보딩·음식 상세 백버튼 chevron이
 * 반대 방향. ②의 **근본 원인은 아이콘 래퍼가 `style`을 버린 것** — 호출부는 180° 회전을
 * 주고 있었는데 D4 에셋에 전달되지 않아 오른쪽 chevron이 그대로 그려졌다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-svg', () => {
  const R = require('react') as typeof import('react');
  const mk = (name: string) => (props: Record<string, unknown>) => R.createElement(name, props, props.children as never);
  return { __esModule: true, default: mk('Svg'), Svg: mk('Svg'), Path: mk('Path'), Rect: mk('Rect'), Defs: mk('Defs'), ClipPath: mk('ClipPath'), Circle: mk('Circle'), G: mk('G'), Line: mk('Line'), Polyline: mk('Polyline') };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));

import { Chip } from '../Chip';
import { RISK, RiskMark } from '../RiskMark';
import { IconChevron, IconArrowLeft } from '../icons';
import { riskTone, riskTextStrong, type RiskState } from '@/lib/theme';

/** WCAG 상대 휘도 대비 — 눈대중 대신 계산해서 잠근다(Codex #167 2R: 흰 글자 대비 1.97~2.99였다). */
const lum = (hex: string) => {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const flat = (s: unknown) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
const render = (el: React.ReactElement): ReactTestRenderer => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return t;
};
const hostStyle = (t: ReactTestRenderer, id: string) =>
  flat(t.root.findAll((n) => typeof n.type === 'string' && n.props?.testID === id)[0].props.style);

describe('위험도 칩 색 = 마크 색', () => {
  it.each(['safe', 'caution', 'danger'] as RiskState[])('선택된 %s 칩 = 틴트 배경 + 상태 원색 보더(마크와 같은 토큰)', (risk) => {
    const st = hostStyle(render(<Chip label="x" selected risk={risk} testID="c" />), 'c');
    expect(st.backgroundColor).toBe(riskTone[risk].bg); // 틴트(대비 확보용)
    expect(st.borderColor).toBe(RISK[risk].color); // 보더 = 마크·배지와 같은 원색
    expect(st.borderColor).toBe(riskTone[risk].fg); // 토큰 경유(하드코딩 아님)
  });

  it.each(['safe', 'caution', 'danger'] as RiskState[])('선택된 %s 칩 라벨 대비 ≥ 4.5 (WCAG AA)', (risk) => {
    // 원색 배경 + 흰 글자였을 때 1.97~2.99였다 — 그 조합으로 되돌아가면 이 테스트가 잡는다
    expect(contrast(riskTextStrong[risk], riskTone[risk].bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', riskTone[risk].fg)).toBeLessThan(4.5); // 구 조합이 왜 안 되는지 고정
  });

  it('비선택은 기존 중립 · all(risk 미지정)은 종전 그대로', () => {
    const off = hostStyle(render(<Chip label="x" risk="danger" testID="c" />), 'c');
    expect(off.backgroundColor).toBe('#FFFFFF');
    const all = hostStyle(render(<Chip label="All" selected testID="c" />), 'c');
    expect(all.backgroundColor).toBe('#2F3137'); // 중립 유지
  });

  it('Codex #167: 색만이 아니라 **형태**도 함께 — 위험도 칩에 RiskMark 글리프(헌법 게이트)', () => {
    for (const risk of ['safe', 'caution', 'danger'] as RiskState[]) {
      for (const selected of [true, false]) {
        const t = render(<Chip label="x" selected={selected} risk={risk} testID="c" />);
        expect(t.root.findAllByType(RiskMark)).toHaveLength(1); // 선택·비선택 모두 형태 유지
        expect(t.root.findAllByType(RiskMark)[0].props.state).toBe(risk);
      }
    }
    // all(중립)·일반 칩은 마크 없음 — 위험도 의미가 없는 칩에 상태 형태를 붙이지 않는다
    expect(render(<Chip label="All" selected testID="c" />).root.findAllByType(RiskMark)).toHaveLength(0);
  });

  it('Codex #167 3R: **글리프 대비**도 4.5 이상 — 형태 단서가 안 보이면 의미 없다', () => {
    for (const risk of ['safe', 'caution', 'danger'] as RiskState[]) {
      for (const selected of [true, false]) {
        const t = render(<Chip label="x" selected={selected} risk={risk} testID="c" />);
        const mark = t.root.findAllByType(RiskMark)[0];
        expect(mark.props.color).toBe(riskTextStrong[risk]); // 원색 아님(원색이면 흰 글리프 대비 2.0~3.0)
        const bg = selected ? riskTone[risk].bg : '#FFFFFF';
        expect(contrast(mark.props.color as string, bg)).toBeGreaterThanOrEqual(4.5); // 마크 원 ↔ 칩 배경
        expect(contrast('#FFFFFF', mark.props.color as string)).toBeGreaterThanOrEqual(4.5); // 흰 글리프 ↔ 원
      }
    }
    // 원색으로 되돌리면 글리프 대비가 무너진다 — 그 사실을 함께 고정
    for (const risk of ['safe', 'caution', 'danger'] as RiskState[]) {
      expect(contrast('#FFFFFF', RISK[risk].color)).toBeLessThan(4.5);
    }
  });

  it('큰 마크(카드·배지)는 원색 무변 — 색 주입은 선택 prop', () => {
    const src = read('src/components/RiskMark.tsx');
    expect(src).toContain('const c = color ?? RISK[state].color;'); // 미지정 = 기존 동작
  });

  it('칩 색은 토큰에서만 온다 — 하드코딩 위험도 hex 0', () => {
    const src = read('src/components/Chip.tsx');
    expect(src).toContain('riskTone[risk].fg');
    expect(src).not.toMatch(/#(1FA[0-9A-F]|E2580C|CF3A2C)/i); // 위험도 계열 hex 직접 사용 금지
  });

  it('두 호출처(홈 embedded·음식 탭)가 같은 배선', () => {
    const src = read('src/features/food/FoodExplorer.tsx');
    expect(src.match(/risk=\{c === 'all' \? undefined : c\}/g)).toHaveLength(2);
  });
});

describe('chevron 방향', () => {
  it('근본 원인 회귀 잠금 — 아이콘 래퍼가 style을 버리지 않는다', () => {
    const t = render(<IconChevron size={16} style={{ transform: [{ rotate: '180deg' }] }} />);
    const rotated = t.root.findAll((n) => {
      if (typeof n.type !== 'string') return false;
      const st = flat(n.props?.style) as { transform?: { rotate?: string }[] };
      return Array.isArray(st.transform) && st.transform.some((x) => x.rotate === '180deg');
    });
    expect(rotated.length).toBe(1); // 버려지면 0
    expect(read('src/components/icons.tsx')).toContain('styled(<D4'); // 관통 헬퍼 경유
  });

  it('뒤로가기 표면은 좌향 아이콘을 직접 쓴다(회전 의존 금지)', () => {
    for (const f of ['src/app/onboarding/index.tsx', 'src/app/food/[id]/index.tsx', 'src/app/scan.tsx', 'src/app/scan-order.tsx']) {
      const src = read(f);
      expect(src).toContain('<IconArrowLeft'); // 좌향 = D4ChevronLeft
      expect(src).not.toMatch(/<IconChevron [^>]*rotate: '180deg'/); // 회전 의존 잔재 0
    }
  });

  it('IconArrowLeft = 좌향 에셋 · IconChevron = 우향 에셋(의미 고정)', () => {
    const icons = read('src/components/icons.tsx');
    expect(icons).toMatch(/IconArrowLeft = \(p: IconProps\) => styled\(<D4ChevronLeft/);
    expect(icons).toMatch(/IconChevron = \(p: IconProps\) => styled\(<D4ChevronRight/);
    // 에셋 자체가 서로 다른 path를 그리는지(좌우 뒤바뀐 에셋 방지)
    const assets = read('src/components/design4Assets.tsx');
    const left = assets.slice(assets.indexOf('D4ChevronLeft'), assets.indexOf('D4ChevronLeft') + 900);
    const right = assets.slice(assets.indexOf('export const D4ChevronRight'), assets.indexOf('export const D4ChevronRight') + 900);
    expect(left).not.toBe(right);
    expect(render(<IconArrowLeft size={16} />).toJSON()).toBeTruthy();
  });
});
