/**
 * P-305(KB-461) — 탭바 프로필 아이콘 = 프로필 사진: 있음 = 원형 RemoteImage(활성 링),
 * 없음/게스트/로드 실패 = 현행 플레이스홀더. 소스 = ['me'] 쿼리 하나.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockMe() }));
const mockIsGuest = jest.fn();
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));
const mockRemote = jest.fn();
jest.mock('../RemoteImage', () => ({
  RemoteImage: (p: { uri: string; onError?: () => void }) => {
    mockRemote(p);
    return null;
  },
}));

import { TabBar } from '../TabBar';

const LABELS = { home: 'H', food: 'F', scan: 'S', reviews: 'R', profile: 'P' };

function render(active: 'home' | 'profile' = 'home'): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<TabBar active={active} labels={LABELS} onPress={jest.fn()} onScan={jest.fn()} />);
  });
  return tree;
}
const photo = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'tab-avatar-photo');

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest.mockReturnValue(false);
  mockMe.mockReturnValue({ data: { profileImageUrl: 'https://cdn.kbap.site/p/9.jpg' } });
});

it('profileImageUrl 있음 = 원형 사진(RemoteImage uri 실측) + 비활성 링 투명(프레임 불변)', () => {
  const t = render('home');
  expect(photo(t).length).toBeGreaterThanOrEqual(1);
  expect(mockRemote.mock.calls[0][0].uri).toBe('https://cdn.kbap.site/p/9.jpg');
  const ring = photo(t)[0].props.style;
  const flatRing = Array.isArray(ring) ? Object.assign({}, ...ring) : ring;
  expect(flatRing.borderColor).toBe('transparent'); // 비활성 = 같은 폭 투명(P-151)
  expect(flatRing.borderWidth ?? 1.5).toBe(1.5);
});

it('활성 탭 = 링 색 INK_ACTIVE(#2F3137) — 사진일 땐 링으로 구분', () => {
  const t = render('profile');
  const ring = photo(t)[0].props.style;
  const flatRing = Array.isArray(ring) ? Object.assign({}, ...ring) : ring;
  expect(flatRing.borderColor).toBe('#2F3137');
});

it('null(사진 없음) = 플레이스홀더(RemoteImage 0) · 게스트도 동일', () => {
  mockMe.mockReturnValue({ data: { profileImageUrl: null } });
  expect(photo(render()).length).toBe(0);
  expect(mockRemote).not.toHaveBeenCalled();
  mockMe.mockReturnValue({ data: { profileImageUrl: 'https://cdn.kbap.site/p/9.jpg' } });
  mockIsGuest.mockReturnValue(true);
  expect(photo(render()).length).toBe(0); // 게스트 = 사진 있어도 플레이스홀더
});

it('로드 실패(onError) = 플레이스홀더 폴백 · URL 변경 = 재시도(갱신)', () => {
  const t = render();
  act(() => mockRemote.mock.calls[0][0].onError());
  expect(photo(t).length).toBe(0); // 실패 → 플레이스홀더
  // 사진 변경(['me'] invalidate 재조회 재현) → failed 리셋·새 uri
  mockMe.mockReturnValue({ data: { profileImageUrl: 'https://cdn.kbap.site/p/9-v2.jpg' } });
  act(() => {
    t.update(<TabBar active="home" labels={LABELS} onPress={jest.fn()} onScan={jest.fn()} />);
  });
  expect(photo(t).length).toBeGreaterThanOrEqual(1);
  expect(mockRemote.mock.calls.at(-1)![0].uri).toBe('https://cdn.kbap.site/p/9-v2.jpg');
});
