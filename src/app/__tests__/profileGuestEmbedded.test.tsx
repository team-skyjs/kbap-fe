/**
 * P-146: 프로필 탭 게스트 화면 — embedded 렌더 시 로고 블록·백 화살표 제거,
 * 독립 /login(라우트)은 현행 유지. 웰컴 카피·버튼·약관 줄 무변.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/auth/useSocialAuth', () => ({
  SocialAuthButtons: () => null,
  useSocialAuth: () => ({ signInGoogle: jest.fn(), signInApple: jest.fn(), busy: null }),
}));
jest.mock('@/components/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }), { virtual: true });
jest.mock('@/lib/useAppFonts', () => ({ useAppFonts: () => [true, null] }));

import Login from '../login';
import { BrandLockup } from '@/components/Brand';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('embedded(프로필 탭) — 로고 블록·백 화살표 없음, 카피·약관은 유지', () => {
  const tree = render(<Login embedded />);
  expect(tree.root.findAllByType(BrandLockup).length).toBe(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'login-back').length).toBe(0);
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('login.title');
  expect(s).toContain('login.terms');
});

it('독립 /login(embedded 미전달) — 로고·백 현행 유지', () => {
  const tree = render(<Login />);
  expect(tree.root.findAllByType(BrandLockup).length).toBe(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'login-back').length).toBeGreaterThanOrEqual(1);
});
