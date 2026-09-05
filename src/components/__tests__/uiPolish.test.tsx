/**
 * P-031(KB-206) UI 폴리시 잠금.
 *  - 대비: ink3·primaryText가 카드(white) 위 4.5:1 이상 — WCAG 계산 자체를 테스트로
 *  - 위험도 4색 불변 (헌법 III — 이 파일이 diff 나면 헌법 위반)
 *  - Txt: maxFontSizeMultiplier 기본 1.3 (시스템 큰글씨 잘림 방지)
 *  - Btn: onPressIn 즉시 scale 스프링 (릴리스 대기 금지)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockWithSpring = jest.fn((v: unknown) => v);
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => mockWithSpring(v),
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    Easing: { linear: () => 0, out: () => () => 0, quad: 0 },
  };
});
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));

import { color } from '@/lib/theme';
import { PRESS_SCALE } from '@/lib/motion';
import { Txt } from '../Txt';
import { Btn } from '../Btn';
import { Spinner } from '../Spinner';
import { PressScale } from '../PressScale';

/** WCAG 2.x 상대 휘도 대비 */
function contrast(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

describe('대비 (A1→KB-429) — 소형 텍스트 토큰 카드(white) 대비', () => {
  // ⚠️ KB-429: 시안이 ink3=#9196A1(2.97:1)을 12px 섹션 라벨에 지정 — P-031의
  // 4.5:1 계약과 충돌(시안값 우선, 예진 육안 게이트 — REPORTS [P-274] 기재).
  // 여기선 시안값 잠금으로 전환, 대비 회귀는 primaryText·ink2가 담당.
  it('ink3 = 시안값 잠금(#9196A1 — 대비 2.97:1, 예진 게이트 항목)', () => {
    expect(color.ink3).toBe('#9196A1');
  });
  it('primaryText = 시안 원색 잠금(9/5 예진 확정 — 대비 변형 폐기)', () => {
    expect(color.primaryText).toBe('#FF7134');
  });
  it('ink2 ≥ 4.5:1 유지 (회귀 방지)', () => {
    expect(contrast(color.ink2, color.card)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('위험도 4색 불변 (헌법 III) — KB-429 시안 4차 값으로 갱신·재잠금', () => {
  it('safe/caution/danger/unable 고정 hex 유지', () => {
    expect(color.riskSafe).toBe('#00BE65');
    expect(color.riskCaution).toBe('#FFA526');
    expect(color.riskDanger).toBe('#F76661');
    expect(color.riskUnable).toBe('#B1B5BD');
  });
});

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

describe('Txt (A2) — 시스템 큰글씨 상한', () => {
  it('기본 maxFontSizeMultiplier 1.3, 명시 prop이 우선', () => {
    const t1 = render(<Txt>hi</Txt>);
    expect(t1.root.findAllByProps({ maxFontSizeMultiplier: 1.3 }).length).toBeGreaterThanOrEqual(1);
    const t2 = render(<Txt maxFontSizeMultiplier={2}>hi</Txt>);
    expect(t2.root.findAllByProps({ maxFontSizeMultiplier: 2 }).length).toBeGreaterThanOrEqual(1);
  });
});

describe('Spinner (P-036/Q-08 ②) — 회전 래퍼 크기 고정', () => {
  it('래퍼 width/height = size + alignSelf center (전폭 stretch → 공전 버그 방지)', () => {
    const tree = render(<Spinner size={16} />);
    const wrappers = tree.root.findAll((n) => JSON.stringify(n.props?.style ?? '').includes('"alignSelf":"center"'));
    expect(wrappers.length).toBeGreaterThanOrEqual(1);
    const style = JSON.stringify(wrappers[0].props.style);
    expect(style).toContain('"width":16');
    expect(style).toContain('"height":16');
  });
});

describe('PressScale (P-042) — 생 Pressable 버튼용 공용 press 피드백', () => {
  it('onPressIn 즉시 0.97 스프링, onPressOut 복귀 — Btn과 동일 프리셋', () => {
    mockWithSpring.mockClear();
    const tree = render(<PressScale onPress={() => {}} />);
    const node = tree.root.findAll((n) => !!n.props?.onPressIn && !!n.props?.onPressOut)[0];
    expect(node).toBeTruthy();
    act(() => {
      node.props.onPressIn({});
    });
    expect(mockWithSpring).toHaveBeenCalledWith(PRESS_SCALE);
    act(() => {
      node.props.onPressOut({});
    });
    expect(mockWithSpring).toHaveBeenLastCalledWith(1);
  });
});

describe('Btn (B4) — press 즉시 피드백', () => {
  it('onPressIn에서 바로 scale 스프링 (릴리스 대기 금지)', () => {
    mockWithSpring.mockClear();
    const tree = render(<Btn onPress={() => {}}>go</Btn>);
    // Pressable은 memo라 findByType 불가 — press 핸들러 보유 노드로 탐색
    const pressable = tree.root.findAll((n) => !!n.props?.onPressIn && !!n.props?.onPressOut)[0];
    expect(pressable).toBeTruthy();
    act(() => {
      pressable.props.onPressIn();
    });
    expect(mockWithSpring).toHaveBeenCalledWith(PRESS_SCALE);
    act(() => {
      pressable.props.onPressOut();
    });
    expect(mockWithSpring).toHaveBeenLastCalledWith(1);
  });
});
