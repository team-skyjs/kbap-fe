/**
 * P-305(KB-461) — 탭바 프로필 아이콘 = 프로필 사진: 있음 = 원형 RemoteImage(활성 링),
 * 없음/게스트/로드 실패 = 현행 플레이스홀더. 소스 = ['me'] 쿼리 하나.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// KB-695: 앱의 useMe = react-query **구독**(데이터가 바뀌면 그 컴포넌트에 통지). 옛 목은 "반환값 교체 + 부모 재렌더"로
// 구동했는데, React Compiler가 부모 Tab의 <Icon/> 요소를 [Icon, active, color]로 캐시해 아이콘이 다시 그려지지 않았다
// (테스트 산출물 — 앱은 구독이라 정상). 목도 구독형 스토어로: 값 변경 = 리스너 통지.
type MockMe = { data: { profileImageUrl: string | null } };
let mockMeState: MockMe = { data: { profileImageUrl: null } };
const mockMeListeners = new Set<() => void>();
const setMe = (v: MockMe) => {
  mockMeState = v;
  act(() => mockMeListeners.forEach((l) => l()));
};
jest.mock('@/lib/data/useMe', () => ({
  useMe: () =>
    (jest.requireActual('react') as typeof import('react')).useSyncExternalStore(
      (cb: () => void) => {
        mockMeListeners.add(cb);
        return () => mockMeListeners.delete(cb);
      },
      () => mockMeState,
    ),
}));
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
  mockMeState = { data: { profileImageUrl: 'https://cdn.kbap.site/p/9.jpg' } };
});

it('profileImageUrl 있음 = 원형 사진(RemoteImage uri 실측) + 비활성 링 투명(프레임 불변)', () => {
  const t = render('home');
  expect(photo(t).length).toBeGreaterThanOrEqual(1);
  expect(mockRemote.mock.calls[0][0].uri).toBe('https://cdn.kbap.site/p/9.jpg');
  const ring = photo(t)[0].props.style;
  const flatRing = Array.isArray(ring) ? Object.assign({}, ...ring) : ring;
  expect(flatRing.borderColor).toBe('transparent'); // 비활성 = 같은 폭 투명(P-151)
  expect(flatRing.borderWidth).toBe(2); // P-313: 2px(활성·비활성 동일 폭)
});

it('P-313: 활성 탭 = 오렌지 링 2px(사진) · 활성 아이콘 색 = primary', () => {
  const t = render('profile');
  const ring = photo(t)[0].props.style;
  const flatRing = Array.isArray(ring) ? Object.assign({}, ...ring) : ring;
  expect(flatRing.borderColor).toBe('#FF7134'); // C.primary
  expect(flatRing.borderWidth).toBe(2);
  const src = require('fs').readFileSync('src/components/TabBar.tsx', 'utf8');
  expect(src).toContain('color={active ? C.primary : C.inkDisabled}'); // 활성 = 라벨 동색
});

it('null(사진 없음) = 플레이스홀더(RemoteImage 0) · 게스트도 동일', () => {
  setMe({ data: { profileImageUrl: null } });
  expect(photo(render()).length).toBe(0);
  expect(mockRemote).not.toHaveBeenCalled();
  setMe({ data: { profileImageUrl: 'https://cdn.kbap.site/p/9.jpg' } });
  mockIsGuest.mockReturnValue(true);
  expect(photo(render()).length).toBe(0); // 게스트 = 사진 있어도 플레이스홀더
});

it('P-313: 기본 프사 URL도 헤더와 동일하게 이미지 렌더(정본 = useMyAvatarUrl 한 함수)', () => {
  setMe({ data: { profileImageUrl: 'https://cdn.kbap.site/images/webp/default_profile/3.webp' } });
  const t = render();
  expect(photo(t).length).toBeGreaterThanOrEqual(1); // #66 플레이스홀더 분기 제거
  expect(mockRemote.mock.calls[0][0].uri).toBe('https://cdn.kbap.site/images/webp/default_profile/3.webp');
  // 정본 공유 소스 잠금 — 탭·헤더 모두 useMyAvatarUrl
  const fs = require('fs');
  expect(fs.readFileSync('src/components/TabBar.tsx', 'utf8')).toContain('useMyAvatarUrl()');
  expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).toContain('useMyAvatarUrl(); // P-313');
  expect(fs.readFileSync('src/components/TabBar.tsx', 'utf8')).not.toContain('isDefaultProfileImage');
});

/* Codex #208 P2(KB-603): 소스 **전이마다** 실패 해제 — A 실패 → null(로그아웃) → 다시 A(같은 계정 재로그인) = 재시도. */
it('A 실패 → null → 다시 A = 재시도(사진 다시 마운트)', () => {
  const t = render();
  act(() => mockRemote.mock.calls[0][0].onError());
  expect(photo(t).length).toBe(0);
  setMe({ data: { profileImageUrl: null } }); // 구독 통지(로그아웃) — 부모 재렌더 없이
  expect(photo(t).length).toBe(0);
  setMe({ data: { profileImageUrl: 'https://cdn.kbap.site/p/9.jpg' } }); // 재로그인
  expect(photo(t).length).toBeGreaterThanOrEqual(1); // 옛 실패가 남아 있으면 0
});

it('로드 실패(onError) = 플레이스홀더 폴백 · URL 변경 = 재시도(갱신)', () => {
  const t = render();
  act(() => mockRemote.mock.calls[0][0].onError());
  expect(photo(t).length).toBe(0); // 실패 → 플레이스홀더
  // 사진 변경(['me'] invalidate 재조회 재현) → failed 리셋·새 uri
  setMe({ data: { profileImageUrl: 'https://cdn.kbap.site/p/9-v2.jpg' } }); // ['me'] 재조회 = 구독 통지
  expect(photo(t).length).toBeGreaterThanOrEqual(1);
  expect(mockRemote.mock.calls.at(-1)![0].uri).toBe('https://cdn.kbap.site/p/9-v2.jpg');
});
