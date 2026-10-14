/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-783 — 딥링크 한 곳 처리: 허용 표만(미지 경로 무시) · 두 입구(+native-intent·에어브릿지 콜백) 중복 이동 0
 * · 게이트(탭 진입 전) 보류 → 탭 진입 시 1회 · OS URL 중 맡지 않는 것(개발 클라이언트)은 라우터 기존 동작.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (h: string) => mockPush(h) } }));

import { handleDeeplink, isEntryResolved, isOwnedSystemUrl, markEntryResolved, resolveDeeplink, setDeeplinkReady, SUPPORTED_DEEPLINKS, __resetDeeplinkForTest } from '../deeplink';
import { redirectSystemPath } from '../../app/+native-intent';

beforeEach(() => {
  jest.clearAllMocks();
  __resetDeeplinkForTest();
});

it('지원 딥링크 표(URL → 화면) — 광고 링크 작성용, 바뀌면 PR 본문 표도 같이', () => {
  expect(Object.fromEntries(SUPPORTED_DEEPLINKS.map((u) => [u, resolveDeeplink(u.replace(':id', '123'))]))).toEqual({
    'kbap://': '/(tabs)',
    'kbap://home': '/(tabs)',
    'kbap://food': '/(tabs)/food',
    'kbap://reviews': '/(tabs)/community',
    'kbap://profile': '/(tabs)/profile',
    'kbap://food/:id': '/food/123',
    'kbap://food/:id/reviews': '/food/123/reviews',
    'kbap://search': '/search',
    'kbap://scan': '/scan',
    'kbap://notifications': '/notifications',
  });
});

it('정규화 — 대소문자 스킴·앞뒤 슬래시·쿼리 무시', () => {
  expect(resolveDeeplink('KBAP://food/42/')).toBe('/food/42');
  expect(resolveDeeplink('kbap:///search?q=x&utm=1')).toBe('/search');
});

it.each([
  ['미지 경로', 'kbap://delete-account'],
  ['게이트 화면', 'kbap://onboarding'],
  ['로그인', 'kbap://login'],
  ['회원 전용 편집', 'kbap://profile/edit'],
  ['id 형식 위반', 'kbap://food/../../x'],
  ['id 특수문자', 'kbap://food/1%3Bdrop'],
  ['다른 스킴', 'https://example.com/food/1'],
  ['에어브릿지 원본 https(SDK가 kbap://로 다시 준다)', 'https://kbap.abr.ge/abc'],
])('무시: %s', (_l, url) => {
  setDeeplinkReady(true);
  expect(handleDeeplink(url)).toBe(false);
  expect(mockPush).not.toHaveBeenCalled();
});

it('준비됨 = 즉시 이동 · 같은 링크가 두 입구로 연달아 = 1회 · 창이 지나면 다시 이동', () => {
  setDeeplinkReady(true);
  handleDeeplink('kbap://food/7', 1000);
  handleDeeplink('kbap://food/7', 1500); // 에어브릿지 콜백 재전달
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/food/7');
  handleDeeplink('kbap://food/7', 10_000);
  expect(mockPush).toHaveBeenCalledTimes(2);
});

it('게이트 전 도착(지연 딥링크·콜드 스타트) = 보류 → 탭 진입 시 1회(마지막 것만) · 재진입에 재이동 0', () => {
  handleDeeplink('kbap://scan', 1);
  handleDeeplink('kbap://food/9', 2);
  expect(mockPush).not.toHaveBeenCalled();
  setDeeplinkReady(true);
  expect(mockPush.mock.calls).toEqual([['/food/9']]);
  setDeeplinkReady(false);
  setDeeplinkReady(true);
  expect(mockPush).toHaveBeenCalledTimes(1);
});

it('+native-intent: 맡은 URL = 처리기로 + 라우터 이동 없음(null) · 맡지 않는 URL = 그대로(기존 동작)', () => {
  setDeeplinkReady(true);
  expect(redirectSystemPath({ path: 'kbap://food/5', initial: false })).toBeNull();
  expect(mockPush).toHaveBeenCalledWith('/food/5');
  expect(redirectSystemPath({ path: 'https://kbap.airbridge.io/x', initial: true })).toBeNull();
  expect(redirectSystemPath({ path: 'kbap://unknown', initial: false })).toBeNull(); // 미지 = +not-found로도 가지 않음
  const dev = 'kbap://expo-development-client/?url=http%3A%2F%2F192.168.0.2%3A8081';
  expect(redirectSystemPath({ path: dev, initial: true })).toBe(dev);
  expect(redirectSystemPath({ path: '/food/1', initial: false })).toBe('/food/1');
  expect(mockPush).toHaveBeenCalledTimes(1);
});

it('#278 Codex 3R: 신규 설치 → 로그인 → 온보딩 → 홈 — 진입 정착 전 탭 포커스는 보류 링크를 쓰지 않고, 정착 뒤 탭 포커스에서 1회', () => {
  __resetDeeplinkForTest(false); // 콜드 스타트: 진입 미정착
  handleDeeplink('kbap://food/7', 1); // 설치 후 첫 실행 링크(콜드·지연 딥링크)
  // RootLayout: entryChecked → 스택 렌더 → (tabs) 먼저 마운트·포커스(자식 effect가 먼저)
  setDeeplinkReady(true);
  expect(isEntryResolved()).toBe(false);
  expect(mockPush).not.toHaveBeenCalled(); // 로그인 교체 직전 소비 금지
  // 루트 effect: /login으로 교체 → 탭 언마운트(블러) → 그 다음 정착 표시
  setDeeplinkReady(false);
  markEntryResolved();
  expect(mockPush).not.toHaveBeenCalled(); // 로그인 화면 위로 이동 금지
  // 로그인 → 온보딩(탭 없음) → 완료 후 탭 포커스
  setDeeplinkReady(true);
  expect(mockPush.mock.calls).toEqual([['/food/7']]);
  setDeeplinkReady(false);
  setDeeplinkReady(true);
  expect(mockPush).toHaveBeenCalledTimes(1);
});

it('일반 부팅(로그인 리다이렉트 없음) = 스택 렌더 전 정착 → 첫 탭 포커스에서 바로 이동', () => {
  __resetDeeplinkForTest(false);
  handleDeeplink('kbap://scan', 1);
  markEntryResolved(); // gateSplash.then: needsLogin 아님
  expect(mockPush).not.toHaveBeenCalled(); // 탭이 아직 없다
  setDeeplinkReady(true);
  expect(mockPush.mock.calls).toEqual([['/scan']]);
});

it('isOwnedSystemUrl — 스킴·에어브릿지 호스트만', () => {
  expect(isOwnedSystemUrl('kbap://food/1')).toBe(true);
  expect(isOwnedSystemUrl('http://KBAP.ABR.GE/a')).toBe(true);
  expect(isOwnedSystemUrl('https://kbap.airbridge.io')).toBe(true);
  expect(isOwnedSystemUrl('https://evil.kbap.abr.ge.example.com/a')).toBe(false);
  expect(isOwnedSystemUrl('exp+kbap://expo-development-client')).toBe(false);
});
