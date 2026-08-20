/**
 * P-201: 리뷰 장소 태그 실연결 — 고정 좌표(강남역) 호출·MANUAL 전송·좌표/이름
 * 딥링크 분기·수정 왕복(프리필·해제)·플래그 게이트(prod 무노출).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/data/useReviewMutations', () => ({ useToggleReviewLike: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn() }, apiLang: () => 'en' }));

import { _mapUrlsForTest } from '@/features/community/placeMap';
import { fetchNearbyPlaces, fetchSearchPlaces, REVIEW_PLACE_FALLBACK_COORD } from '@/lib/api/places';
import { buildReviewUpdate } from '@/lib/api/reviewAdapter';
import { PlacePickerSheet, ReviewEditSheet, ReviewPlaceLine } from '../ReviewCellParts';
import type { Review } from '@/lib/api/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client') as { api: { get: jest.Mock } };
const t = (k: string) => k;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (t2: ReactTestRenderer) => JSON.stringify(t2.toJSON());

beforeEach(() => jest.clearAllMocks());

it('nearby/search — 고정 좌표(강남역 스웨거 예시) 쿼리로 실호출', async () => {
  api.get.mockResolvedValue([]);
  await fetchNearbyPlaces();
  const { latitude, longitude } = REVIEW_PLACE_FALLBACK_COORD;
  expect(api.get).toHaveBeenCalledWith(`/api/places/nearby?latitude=${latitude}&longitude=${longitude}&lang=en`); // P-240
  await fetchSearchPlaces('김밥 천국');
  expect(api.get).toHaveBeenLastCalledWith(
    `/api/places/search?query=${encodeURIComponent('김밥 천국')}&latitude=${latitude}&longitude=${longitude}&lang=en`,
  );
});

it('딥링크 분기 — 좌표 보유 = 좌표 딥링크(이름 라벨) · MANUAL(좌표 無) = 이름 검색 폴백', () => {
  const coord = _mapUrlsForTest({ name: '한식당', roadAddress: '서울', latitude: 37.5, longitude: 127.02 });
  expect(coord.naver.app).toBe(`nmap://place?lat=37.5&lng=127.02&name=${encodeURIComponent('한식당')}`);
  expect(coord.kakao.app).toBe('kakaomap://look?p=37.5,127.02');
  expect(coord.google.app).toContain('query=37.5,127.02');
  const manual = _mapUrlsForTest({ name: '한식당', roadAddress: '' });
  expect(manual.naver.app).toBe(`nmap://search?query=${encodeURIComponent('한식당')}`);
  expect(manual.kakao.app).toContain('kakaomap://search');
  expect(manual.google.app).toContain(`query=${encodeURIComponent('한식당')}`);
});

it('전송 시맨틱(buildReviewUpdate) — 유지 재전송·MANUAL name만·해제 생략', () => {
  const cur = { rating: 4, body: 'b', photos: [], place: { name: 'A', roadAddress: '주소', latitude: 37.5, longitude: 127.0 } };
  // 유지(changes.place undefined) = 현행 재전송 — 소실 방지
  expect(buildReviewUpdate(cur, {}).place).toEqual({ name: 'A', address: '주소', latitude: 37.5, longitude: 127.0 });
  // MANUAL 교체 = name만
  expect(buildReviewUpdate(cur, { place: { name: '손글씨집', roadAddress: null } }).place).toEqual({ name: '손글씨집' });
  // 해제(null) = 생략(제거 시맨틱)
  expect(buildReviewUpdate(cur, { place: null }).place).toBeUndefined();
});

it('픽커 — 검색 결과 선택 = 좌표 포함 태그 · 직접 입력(MANUAL) 행 = 이름만', async () => {
  api.get.mockResolvedValue([{ name: '강남 김밥', address: '강남대로 1', latitude: 37.49, longitude: 127.02 }]);
  const onPick = jest.fn();
  // gcTime 0 — 캐시 gc 타이머가 jest 프로세스를 붙잡는 것 방지(오픈 핸들)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = render(
    <QueryClientProvider client={qc}>
      <PlacePickerSheet open onClose={jest.fn()} onPick={onPick} t={t} />
    </QueryClientProvider>,
  );
  // react-query 알림 배칭 플러시 — 결과 렌더까지 두 틱
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  // nearby 프리로드 결과 선택 → 좌표 포함
  await act(async () => tree.root.findAll((n) => n.props?.testID === 'place-pick-강남 김밥')[0].props.onPress());
  expect(onPick).toHaveBeenCalledWith({ name: '강남 김밥', roadAddress: '강남대로 1', latitude: 37.49, longitude: 127.02, placeId: null }); // P-240: placeId 관통(응답 부재 = null)
  // 검색어 입력 → MANUAL 행 → 이름만
  const input = tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
  await act(async () => input.props.onChangeText('우리집앞 분식'));
  await act(async () => tree.root.findAll((n) => n.props?.testID === 'place-manual')[0].props.onPress());
  expect(onPick).toHaveBeenLastCalledWith({ name: '우리집앞 분식', roadAddress: null });
  act(() => tree.unmount());
  qc.clear();
});

it('셀 장소 줄 — 무태그 = 미렌더 · 태그 = 핀 줄 렌더 + 탭 = 지도 시트(3사)', () => {
  const none = render(<ReviewPlaceLine place={null} />);
  expect(none.toJSON()).toBeNull();
  const tree = render(<ReviewPlaceLine place={{ name: '강남 김밥', roadAddress: '강남대로 1', latitude: 37.49, longitude: 127.02 }} />);
  expect(flat(tree)).toContain('강남 김밥');
  act(() => tree.root.findAll((n) => n.props?.testID === 'review-place' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(flat(tree)).toContain('community.map.naver'); // 3사 시트 도달
});

it('수정 왕복 — 프리필 칩 · 해제(X) 후 저장 = place null(제거 의도)', () => {
  const onSave = jest.fn();
  const review = {
    id: 'r1', foodId: '7', rating: 4, body: 'b', anonymized: false, createdAt: '2026-08-13',
    authorNationality: null, authorRankTier: null,
    place: { name: '강남 김밥', roadAddress: '강남대로 1', latitude: 37.49, longitude: 127.02 },
  } as Review;
  const tree = render(<ReviewEditSheet review={review} onClose={jest.fn()} onSave={onSave} t={t} />);
  expect(flat(tree)).toContain('강남 김밥'); // 프리필 칩
  act(() => tree.root.findAll((n) => n.props?.testID === 'edit-place-clear')[0].props.onPress()); // 해제
  act(() => tree.root.findAll((n) => n.props?.testID === 'edit-save' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(onSave).toHaveBeenCalledWith({ rating: 4, body: 'b', place: null, extras: { speed: null, service: null } }); // P-236: extras 동반
});

it('플래그 게이트 — reviewPlaceEnabled = 채널 분기(prod 무노출) 소스 잠금', () => {
  const fs = require('fs');
  expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('reviewPlaceEnabled: !PROD_CHANNEL');
  const parts = fs.readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8') as string;
  expect(parts).toContain('!FLAGS.reviewPlaceEnabled || !place?.name) return null'); // 셀 줄 게이트(표면 공통 — 한 곳)
});

/* ---- P-240(KB-350): 구글 전환 — placeId 전송·MANUAL 미전송 ---- */
it('P-240: placeWire — 검색 선택(좌표+placeId) = placeId 동반 · MANUAL = name만 · placeId 없는 좌표 장소 = 미전송', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildReviewUpdate } = require('@/lib/api/reviewAdapter') as typeof import('@/lib/api/reviewAdapter');
  const withId = buildReviewUpdate(
    { rating: 4, body: null, photos: [], place: { name: '히뎅', roadAddress: '주소', latitude: 37.5, longitude: 127.0, placeId: 'ChIJabc123' } },
    {},
  );
  expect(withId.place).toEqual({ name: '히뎅', address: '주소', latitude: 37.5, longitude: 127.0, placeId: 'ChIJabc123' });
  const manual = buildReviewUpdate({ rating: 4, body: null, photos: [], place: { name: '우리집앞 분식' } }, {});
  expect(manual.place).toEqual({ name: '우리집앞 분식' }); // MANUAL — placeId 없음(현행)
  const noId = buildReviewUpdate(
    { rating: 4, body: null, photos: [], place: { name: '옛집', roadAddress: null, latitude: 37.5, longitude: 127.0, placeId: null } },
    {},
  );
  expect(noId.place).not.toHaveProperty('placeId'); // null = 미전송(source도 계속 미전송 — 서버 유도)
});

it('P-240: 페이징 제거 회귀 — 픽커에 더보기/hasNext 배선 부재(단일 20건 응답)', () => {
  const fs = require('fs');
  const parts = fs.readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8') as string;
  // PlacePickerSheet 블록에 페이지네이션 배선이 없다(원래 없음 — 회귀 잠금)
  expect(parts).not.toMatch(/fetchNextPage.*[Pp]lace/);
  expect(fs.readFileSync('src/lib/api/places.ts', 'utf8')).toContain('&lang=${apiLang()}'); // lang 필수 핫픽스
});
