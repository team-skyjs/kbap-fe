/**
 * KB-573 — 푸시 탭·알림함 항목 탭 공용 이동 헬퍼 openNotificationRoute.
 * 홈('/(tabs)') = 스택 리셋(dismissAll) → navigate(탭 점프) 순서 · 그 외 = navigate 1회(맨 위 같은 화면이면 재사용).
 * expo-router 56 StackRouter는 getId 없으면 name이 현재 최상단과 다를 때 무조건 push라, 홈을 push/navigate만으로 가면 (tabs)가 한 장 더 쌓인다(research R-2).
 */
import { openNotificationRoute } from '@/lib/nav';

const makeRouter = (canDismiss: boolean) => ({
  canDismiss: jest.fn(() => canDismiss),
  dismissAll: jest.fn(),
  navigate: jest.fn(),
  push: jest.fn(),
});
type R = Parameters<typeof openNotificationRoute>[0];

it('홈: canDismiss true → dismissAll 1회 뒤 navigate("/(tabs)") 1회, push 0회', () => {
  const r = makeRouter(true);
  openNotificationRoute(r as unknown as R, '/(tabs)');
  expect(r.dismissAll).toHaveBeenCalledTimes(1);
  expect(r.navigate).toHaveBeenCalledTimes(1);
  expect(r.navigate).toHaveBeenCalledWith('/(tabs)');
  expect(r.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(r.navigate.mock.invocationCallOrder[0]);
  expect(r.push).not.toHaveBeenCalled();
});

it('홈: canDismiss false(이미 루트) → dismissAll 0회, navigate 1회', () => {
  const r = makeRouter(false);
  openNotificationRoute(r as unknown as R, '/(tabs)');
  expect(r.dismissAll).not.toHaveBeenCalled();
  expect(r.navigate).toHaveBeenCalledWith('/(tabs)');
});

it('홈: canDismiss가 throw해도 navigate는 진행', () => {
  const r = makeRouter(true);
  r.canDismiss.mockImplementation(() => { throw new Error('no stack'); });
  openNotificationRoute(r as unknown as R, '/(tabs)');
  expect(r.navigate).toHaveBeenCalledWith('/(tabs)');
});

it('내 리뷰: navigate("/profile/reviews") 1회, dismissAll·push 0회', () => {
  const r = makeRouter(true);
  openNotificationRoute(r as unknown as R, '/profile/reviews');
  expect(r.navigate).toHaveBeenCalledTimes(1);
  expect(r.navigate).toHaveBeenCalledWith('/profile/reviews');
  expect(r.dismissAll).not.toHaveBeenCalled();
  expect(r.push).not.toHaveBeenCalled();
});

it('음식 상세: navigate("/food/7") 1회', () => {
  const r = makeRouter(true);
  openNotificationRoute(r as unknown as R, '/food/7');
  expect(r.navigate).toHaveBeenCalledWith('/food/7');
  expect(r.dismissAll).not.toHaveBeenCalled();
});
