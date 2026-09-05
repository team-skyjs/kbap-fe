/**
 * KB-429(P-274) D-1 — 디자인 4차 토큰·프리미티브 잠금.
 * ① 토큰 신값 스냅샷 ② TabBar 5슬롯 키·순서(reviews 교체) ③ RiskMark 4상태
 * 글리프 상이(원형 통일 후 형태 구분 = 글리프 — 헌법 게이트) ④ Btn disabled 색.
 */
import * as React from 'react';
import renderer from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useLocale: () => ({ script: 'latin', lang: 'en' }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { color, radius, riskTone, riskText, shadow, shadowGlow } from '@/lib/theme';
import { TabBar } from '@/components/TabBar';
import { RiskMark } from '@/components/RiskMark';
import { Btn } from '@/components/Btn';

it('① 토큰 스냅샷 — 4차 신값 잠금(키 유지·값 교체 + 신규 4종)', () => {
  expect({
    primary: color.primary,
    primaryPress: color.primaryPress,
    primaryText: color.primaryText,
    surface: color.surface,
    surface2: color.surface2,
    ink: color.ink,
    ink2: color.ink2,
    ink3: color.ink3,
    inkMute: color.inkMute,
    inkDisabled: color.inkDisabled,
    hair: color.hair,
    line: color.line,
    line2: color.line2,
    riskSafe: color.riskSafe,
    riskCaution: color.riskCaution,
    riskDanger: color.riskDanger,
    riskUnable: color.riskUnable,
    radius: { ...radius },
    riskToneSafeBg: riskTone.safe.bg,
    riskToneLine: riskTone.caution.line,
    riskTextSafe: riskText.safe,
    sh1: shadow.sh1,
    shBadge: shadow.shBadge,
    glow: shadowGlow('#FFC700'),
  }).toMatchSnapshot();
});

it('② TabBar — 5슬롯 키·순서: home, food, [scan], reviews, profile', () => {
  const labels = { home: 'Home', food: 'Food', scan: 'Scan', reviews: 'Reviews', profile: 'Profile' };
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(<TabBar active="home" labels={labels} onPress={() => {}} onScan={() => {}} />);
  });
  const texts = tree.root
    .findAll((n) => typeof n.props?.children === 'string')
    .map((n) => n.props.children as string)
    .filter((s, i, a) => a[i - 1] !== s); // Txt 래퍼 중첩 dedupe(연속 중복 제거)
  expect(texts).toEqual(['Home', 'Food', 'Scan', 'Reviews', 'Profile']); // 시각 순서 = 스캔 중앙
  // 구 커뮤니티 키 소멸 잠금(타입 유니언 기준)
  const src = require('fs').readFileSync('src/components/TabBar.tsx', 'utf8') as string;
  expect(src).toContain("'home' | 'food' | 'reviews' | 'profile'");
});

it('③ RiskMark — 4상태 실루엣 원형 통일 + 글리프 상이(형태 구분 = 글리프)', () => {
  const glyphs = (['safe', 'caution', 'danger', 'unable'] as const).map((state) => {
    let t!: renderer.ReactTestRenderer;
    renderer.act(() => {
      t = renderer.create(<RiskMark state={state} />);
    });
    return JSON.stringify(t.toJSON());
  });
  expect(new Set(glyphs).size).toBe(4); // 색 소거 전제로도 렌더 트리(글리프)가 전부 다름
  const src = require('fs').readFileSync('src/components/RiskMark.tsx', 'utf8') as string;
  expect(src).toContain('r="10.2"'); // 원형 실루엣
  expect(src).not.toContain('M12 2.6 L22 20 H2 Z'); // 구 삼각(실루엣 분기) 소멸
});

it('④ Btn — disabled(off) = bg line(#EAEBEE)·텍스트 inkDisabled / secondary 신설', () => {
  let t!: renderer.ReactTestRenderer;
  renderer.act(() => {
    t = renderer.create(<Btn variant="off">Off</Btn>);
  });
  const flat = JSON.stringify(t.toJSON());
  expect(flat).toContain('#EAEBEE');
  expect(flat).toContain('#D1D3D8');
  renderer.act(() => {
    t = renderer.create(<Btn variant="secondary">Cancel</Btn>);
  });
  expect(JSON.stringify(t.toJSON())).toContain('#B1B5BD');
});

it('⑥ 탭 계측(Codex #27 P1) — 이벤트 값 reviews 스키마 반영 + 화이트리스트 통과', () => {
  const { EVENTS, sanitize } = require('@/lib/analytics') as typeof import('@/lib/analytics');
  expect(sanitize(EVENTS.app_tab_view, { tab: 'reviews' })).toEqual({ tab: 'reviews' });
  const fs = require('fs') as typeof import('fs');
  // 배선: community 라우트 → 키 reviews → track({ tab: active }) 그대로 흐름
  const layout = fs.readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
  expect(layout).toContain("community: 'reviews'");
  expect(layout).toContain('track(EVENTS.app_tab_view, { tab: active })');
  // 스키마 union 문서 — reviews 추가·community 잔존(구버전 호환)
  expect(fs.readFileSync('src/lib/analytics.ts', 'utf8')).toContain('home|food|reviews|community|profile');
});

it('⑦ riskText 배선(Codex #27 P2) — 소형 위험 라벨 5곳 = riskText, fg는 아이콘·fill 전용', () => {
  const fs = require('fs') as typeof import('fs');
  for (const p of [
    'src/components/RiskPill.tsx',
    'src/features/scan/ScanRichList.tsx',
    'src/app/scan.tsx',
    'src/app/profile/saved.tsx',
    'src/app/food/[id]/index.tsx',
  ]) {
    const src = fs.readFileSync(p, 'utf8');
    expect(src).toContain('riskText[');
    expect(src).not.toMatch(/color:\s*(?:riskTone\[\w+(?:\.\w+)*\]|tone)\.fg/); // 텍스트 색으로 fg 사용 소멸
  }
});

it('i18n — tabs.reviews 10로케일 존재', () => {
  const fs = require('fs') as typeof import('fs');
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = JSON.parse(fs.readFileSync(`src/lib/i18n/${loc}.json`, 'utf8')) as { tabs: { reviews?: string } };
    expect((j.tabs.reviews ?? '').length).toBeGreaterThan(0);
  }
});
