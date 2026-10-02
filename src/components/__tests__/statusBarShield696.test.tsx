/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-696(P-438) — 스크롤하면 상태 표시줄·헤더 뒤로 내용이 비침.
 * ① 공용 StickyHeader: 숨을 때 상태 표시줄 영역째 -H로 빠진다(3e60f69부터) → 고정 불투명 가림막(헤더 위 z, 슬라이드 밖).
 * ② 음식 상세: 헤더 바 배경이 4% 투명(시안 0.96) → 스크롤 뒤 상태 표시줄 영역은 불투명 가림막(solidFade).
 */
import * as React from 'react';
import * as fs from 'fs';
import { StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const TOP = 47;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (f: () => unknown) => f(),
    useReducedMotion: () => false,
    interpolate: (v: number, input: number[], output: number[]) => (v >= input[1] ? output[1] : output[0]),
    Extrapolation: { CLAMP: 'clamp' },
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { StickyHeader } from '../StickyHeader';
import { color as C } from '@/lib/theme';

function render(hidden: number): ReactTestRenderer {
  let t!: ReactTestRenderer;
  act(() => {
    t = renderer.create(<StickyHeader hidden={{ value: hidden } as never} atTop={{ value: 0 } as never} mode="brand" />);
  });
  return t;
}
const flat = (s: unknown) => StyleSheet.flatten(s as never) as Record<string, unknown>;

describe('① StickyHeader 상태 표시줄 가림막', () => {
  it.each([
    ['보임', 0],
    ['숨음(스크롤 아래)', 1],
  ])('%s — 가림막 = 고정·불투명(C.surface)·높이 insets.top·헤더 위 z·터치 통과 · 슬라이드 층 밖', (_n, hidden) => {
    const t = render(hidden as number);
    const shield = t.root.findAll((n) => n.props?.testID === 'status-bar-shield' && typeof n.type === 'string')[0];
    const s = flat(shield.props.style);
    expect(s).toEqual(expect.objectContaining({ position: 'absolute', top: 0, left: 0, right: 0, height: TOP, backgroundColor: C.surface }));
    expect(shield.props.pointerEvents).toBe('none');
    expect(s.transform).toBeUndefined(); // 고정 — 슬라이드 안 함
    // 슬라이드하는 헤더 루트(transform translateY)의 자손이 아니다 + 그보다 위 z
    let p = shield.parent;
    while (p) {
      expect(flat(p.props?.style ?? {}).transform).toBeUndefined();
      p = p.parent;
    }
    const header = t.root.findAll((n) => typeof n.type === 'string' && Array.isArray(flat(n.props?.style ?? {}).transform))[0];
    const hs = flat(header.props.style);
    expect(Number(s.zIndex)).toBeGreaterThan(Number(hs.zIndex));
    expect(hs.backgroundColor).toBe(s.backgroundColor); // 헤더와 같은 배경 — 보일 때 이음매 없음
    if (hidden) expect((hs.transform as { translateY: number }[])[0].translateY).toBeLessThan(0); // 헤더는 그대로 빠진다(애니메이션 무변)
  });

  // ⚠️ 문자열 확인 — 루트 스타일이 **실제로 적용되는지는 안 본다**. 실제 불변식(가림막 색 == 헤더 색)은 위 렌더 단언이 잡고,
  //    이 칸은 "사용처가 늘거나 다른 배경 화면이 생기면 알림"용 그물이다.
  it('StickyHeader 사용 화면 루트 배경 = 전부 C.surface(가림막 색과 같음) — 다른 배경 화면이 생기면 red', () => {
    const users = ['src/app/(tabs)/food.tsx', 'src/app/(tabs)/index.tsx', 'src/app/(tabs)/profile.tsx', 'src/app/food/[id]/reviews.tsx', 'src/features/community/ReviewFeed.tsx'];
    const all = require('child_process').execSync("git grep -l '<StickyHeader' -- src ':!**/__tests__/**'", { encoding: 'utf8' }).split('\n').filter((f: string) => f && !f.endsWith('StickyHeader.tsx') && !f.endsWith('SubHeader.tsx'));
    expect([...all].sort()).toEqual([...users].sort()); // 사용처 목록 = 표(새 사용처는 배경 확인 후 추가)
    for (const f of users) expect(fs.readFileSync(f, 'utf8')).toMatch(/\n {2}root: \{ flex: 1, backgroundColor: C\.surface \}/);
  });
});

// ⚠️ ②는 **소스 문자열 대조**뿐이다(상세 화면 렌더는 무거워서) — 구조·값이 소스에 그대로 있는지만 잠그고, 실제 화면은 QA 시뮬레이터 확인으로.
describe('② 음식 상세 — 스크롤 뒤 상태 표시줄 영역 불투명', () => {
  const src = fs.readFileSync('src/app/food/[id]/index.tsx', 'utf8');
  it('fhead 안 상태 표시줄 가림막 = 높이 insets.top · solidFade(히어로 위 투명 → 스크롤 뒤 불투명) · 터치 통과 · 불투명 C.surface', () => {
    expect(src).toContain('<Animated.View style={[styles.fheadStatusShield, { height: insets.top }, solidFade]} pointerEvents="none" testID="fhead-status-shield" />');
    expect(src).toContain("fheadStatusShield: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.surface }");
    // fhead-bg 뒤(위 z)에 온다
    expect(src.indexOf('testID="fhead-status-shield"')).toBeGreaterThan(src.indexOf('testID="fhead-bg"'));
  });
  it('헤더 바 배경 = 상수 한 곳 · 불투명 화면 배경 토큰(예진 10/2 결정 — 시안 96% 투명 폐기)', () => {
    expect(src).toContain('const FHEAD_BAR_BG = C.surface;');
    expect(src).toContain('fheadBg: { backgroundColor: FHEAD_BAR_BG,');
    expect(src).not.toMatch(/rgba\(255,255,255,0\.96\)/); // 반투명 값이 다시 들어오면 red
  });
});
