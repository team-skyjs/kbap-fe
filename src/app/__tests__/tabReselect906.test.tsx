/**
 * KB-906 T-127 — 같은 탭 재탭 = 맨 위로. 커스텀 탭 바가 navigate만 해서 tabPress가 안 나갔다(useScrollToTop 무반응).
 * T-125 — 탭바 아바타 = memory-disk 캐시(안드 액티비티 재생성 뒤 빈 회색 원).
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import TabsLayout from '../(tabs)/_layout'; // jest.mock은 위로 끌어올려진다

let mockOnPress: ((k: string) => void) | undefined;
let mockTabBarProps: unknown;
jest.mock('@/components', () => ({
  TabBar: (p: { onPress: (k: string) => void }) => {
    mockOnPress = p.onPress;
    return null;
  },
}));
jest.mock('expo-router', () => {
  const Tabs = ({ tabBar }: { tabBar: (p: unknown) => React.ReactNode }) => tabBar(mockTabBarProps);
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs, useFocusEffect: () => {}, useRouter: () => ({ navigate: jest.fn() }) };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/lib/ads/adsSession', () => ({ initAds: jest.fn() }));
jest.mock('@/lib/bootGate', () => ({ whenSplashDone: () => new Promise(() => {}) }));
jest.mock('@/lib/analytics', () => ({ EVENTS: { app_tab_view: 'app_tab_view' }, track: jest.fn() }));
jest.mock('@/lib/airbridge', () => ({ airbridge: { homeView: jest.fn() } }));
jest.mock('@/lib/deeplink', () => ({ isEntryResolved: () => false, setDeeplinkReady: jest.fn() }));
jest.mock('@/lib/auth/beTokens', () => ({ isRegisteredForAnalytics: () => new Promise(() => {}) }));
jest.mock('@/components/ResumeOnboardingBanner', () => ({ ResumeOnboardingBanner: () => null }));


function setup(activeIndex: number, prevented = false) {
  const emit = jest.fn(() => ({ defaultPrevented: prevented }));
  const navigate = jest.fn();
  const routes = ['index', 'food', 'community', 'profile'].map((name) => ({ name, key: `${name}-k` }));
  mockTabBarProps = { state: { index: activeIndex, routes }, navigation: { emit, navigate } };
  act(() => {
    renderer.create(<TabsLayout />);
  });
  return { emit, navigate };
}

describe('KB-906 T-127 탭 재탭', () => {
  it('같은 탭 재탭 = tabPress만(이동 0) — 화면의 useScrollToTop이 받는다', () => {
    const { emit, navigate } = setup(0);
    act(() => mockOnPress?.('home'));
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'index-k', canPreventDefault: true });
    expect(navigate).not.toHaveBeenCalled();
  });
  it('다른 탭 = tabPress 뒤 이동 · preventDefault면 이동 0', () => {
    const a = setup(0);
    act(() => mockOnPress?.('reviews'));
    expect(a.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'community-k', canPreventDefault: true });
    expect(a.navigate).toHaveBeenCalledWith('community');
    const b = setup(0, true);
    act(() => mockOnPress?.('food'));
    expect(b.navigate).not.toHaveBeenCalled();
  });
  it('Home·Reviews 목록이 useScrollToTop에 ref를 건다', () => {
    const read = (f: string) => fs.readFileSync(`${__dirname}/../../${f}`, 'utf8');
    for (const f of ['app/(tabs)/index.tsx', 'features/community/ReviewFeed.tsx']) {
      const s = read(f);
      expect(s).toContain('useScrollToTop(listRef)');
      expect(s).toMatch(/<Animated\.FlatList\s+ref=\{listRef\}/);
    }
  });
});

describe('KB-906 T-125 탭바 아바타 캐시', () => {
  it('TabBar 아바타 = memory-disk · RemoteImage가 expo-image에 그대로 전달', () => {
    const read = (f: string) => fs.readFileSync(`${__dirname}/../../components/${f}`, 'utf8');
    expect(read('TabBar.tsx')).toMatch(/transition=\{0\}\s+cachePolicy="memory-disk"/);
    expect(read('RemoteImage.tsx')).toMatch(/cachePolicy=\{cachePolicy\}/);
  });
});
