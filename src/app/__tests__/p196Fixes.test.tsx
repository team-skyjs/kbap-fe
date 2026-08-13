/**
 * P-196 ②③④: 상태 블록 4탭 화면-정중앙 통일 · 스캔 X-브래킷 겹침 0 ·
 * 사용자 노출 " · " 구분자 전수 제거 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));

import { ScreenCenterFill } from '@/components/StateBlock';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('② ScreenCenterFill = absoluteFill + 세로 센터 — 헤더/스크롤 구조 무관 화면 기준', () => {
  const tree = render(
    <ScreenCenterFill>
      <React.Fragment />
    </ScreenCenterFill>,
  );
  const root = tree.root.findAllByType(ScreenCenterFill)[0].children[0] as { props: { style: unknown } };
  const st = StyleSheet.flatten(root.props.style as never) as Record<string, unknown>;
  expect(st.position).toBe('absolute');
  expect(st.top).toBe(0);
  expect(st.bottom).toBe(0);
  expect(st.justifyContent).toBe('center');
});

it('② 4탭 배선 소스 잠금 — 홈·Food·커뮤니티 피드·프로필 전부 ScreenCenterFill 경유', () => {
  const fs = require('fs');
  for (const f of [
    'src/app/(tabs)/index.tsx',
    'src/app/(tabs)/food.tsx',
    'src/features/community/ReviewFeed.tsx',
    'src/app/(tabs)/profile.tsx',
  ]) {
    expect(fs.readFileSync(f, 'utf8')).toContain('ScreenCenterFill');
  }
  // 홈·프로필: 에러 블록이 스크롤(paddingTop headerH) 안에 있던 구 배치 소멸 —
  // 루트 조기 return 분기(스크롤 밖)로만 존재
  const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
  expect(home.indexOf('ScreenCenterFill')).toBeLessThan(home.indexOf('Animated.ScrollView'));
});

it('③ 스캔 X-브래킷 겹침 0 — 상단 브래킷 = X 세이프존 아래(전 insets 범위)', () => {
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).toContain('Math.max(90, insets.top + 60)'); // inset-aware 시작점
  // 기하 검증: X = top insets.top+8, 높이 40 → 하단 insets.top+48.
  // 브래킷 top이 X 하단보다 항상 아래(겹침 0): 전 구간 샘플.
  for (const insetTop of [0, 20, 47, 59, 66]) {
    const bracketTop = Math.max(90, insetTop + 60);
    expect(bracketTop).toBeGreaterThan(insetTop + 48);
  }
});

it('④ 가운뎃점 구분자 전수 제거 — i18n 전 로케일 " · " 0 + 코드 조립부 0', () => {
  const fs = require('fs');
  for (const lang of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']) {
    expect(fs.readFileSync(`src/lib/i18n/${lang}.json`, 'utf8')).not.toContain(' · ');
  }
  // 코드 조립 구분자 — 수정 표면 잔존 0 (legalText의 "· "는 목록 불릿(구분자 아님) — 제외)
  for (const f of [
    'src/app/profile/ranking.tsx',
    'src/app/onboarding/index.tsx',
    'src/app/food/[id]/index.tsx',
    'src/app/food/[id]/reviews.tsx',
    'src/features/scan/ScanRichList.tsx',
    'src/features/order/FlippedOrderCard.tsx',
  ]) {
    const src = fs.readFileSync(f, 'utf8') as string;
    // 주석 제거 후 검사 — 사용자 노출 문자열의 " · "만 잡는다
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(noComments).not.toContain(' · ');
    expect(noComments).not.toContain('>· ');
  }
});
