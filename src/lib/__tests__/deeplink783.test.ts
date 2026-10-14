/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-783 — 딥링크 한 곳 처리: 허용 표만(미지 경로 무시) · 두 입구(+native-intent·에어브릿지 콜백) 중복 이동 0
 * · 게이트(탭 진입 전) 보류 → 탭 진입 시 1회 · OS URL 중 맡지 않는 것(개발 클라이언트)은 라우터 기존 동작.
 */
const mockPush = jest.fn();
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (h: string) => mockPush(h), dismissTo: (h: string) => mockDismissTo(h) } }));

import { handleDeeplink, isEntryResolved, isOwnedSystemUrl, markEntryResolved, markEntryResolvedAfterLeavingTabs, resolveDeeplink, setDeeplinkGate, setDeeplinkReady, SUPPORTED_DEEPLINKS, __resetDeeplinkForTest } from '../deeplink';
import { redirectSystemPath } from '../../app/+native-intent';

/** KB-786: 이동 = 스택 push 또는 탭 dismissTo — 순서 그대로 */
const navs = () => [...mockPush.mock.calls.map((c, i) => ({ o: mockPush.mock.invocationCallOrder[i], to: c[0] })), ...mockDismissTo.mock.calls.map((c, i) => ({ o: mockDismissTo.mock.invocationCallOrder[i], to: c[0] }))].sort((a, b) => a.o - b.o).map((x) => x.to);

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
  __resetDeeplinkForTest(false); // 콜드 스타트: 스택·진입 전
  markEntryResolved(); // 일반 부팅 — 정착은 됐어도 탭(네비게이터)이 아직 없다 → 보류
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

it('#278 Codex 4R: 신규 설치 실제 순서 — /login 교체 직후(탭 아직 focused) 정착 예약 → 이동 0 · 탭 blur에서 정착 · 다음 탭 포커스에서 1회', () => {
  __resetDeeplinkForTest(false);
  handleDeeplink('kbap://food/7', 1);
  setDeeplinkReady(true); // (tabs) 먼저 포커스
  // 루트 effect: router.replace('/login') — state는 즉시, 탭 blur는 다음 렌더. 그 사이에 정착 호출
  markEntryResolvedAfterLeavingTabs();
  expect(mockPush).not.toHaveBeenCalled(); // 로그인 위로 밀어 넣기 0(전엔 여기서 /food/7)
  setDeeplinkReady(false); // 탭 blur → 이제 정착
  expect(isEntryResolved()).toBe(true);
  expect(mockPush).not.toHaveBeenCalled();
  setDeeplinkReady(true); // 로그인·온보딩 뒤 탭
  expect(mockPush.mock.calls).toEqual([['/food/7']]);
});

it('정착 예약 시 탭이 포커스가 아니면 즉시 정착', () => {
  __resetDeeplinkForTest(false);
  markEntryResolvedAfterLeavingTabs();
  expect(isEntryResolved()).toBe(true);
});

it('일반 부팅(로그인 리다이렉트 없음) = 스택 렌더 전 정착 → 첫 탭 포커스에서 바로 이동', () => {
  __resetDeeplinkForTest(false);
  handleDeeplink('kbap://scan', 1);
  markEntryResolved(); // gateSplash.then: needsLogin 아님
  expect(mockPush).not.toHaveBeenCalled(); // 탭이 아직 없다
  setDeeplinkReady(true);
  expect(mockPush.mock.calls).toEqual([['/scan']]);
});

describe('KB-783 후속(Android QA 10/14) — 정착 뒤엔 어느 화면이든 즉시, 보류는 스플래시·로그인·온보딩 위만', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('탭 밖 스택(상세 등 — 탭 블러)에서 받은 링크 = 즉시 이동, back으로 탭 복귀 시 재점프 0', () => {
    setDeeplinkReady(true); // 홈
    setDeeplinkReady(false); // 상세 push → 탭 블러
    handleDeeplink('kbap://profile', 1);
    expect(navs()).toEqual(['/(tabs)/profile']); // KB-786: 탭 목적지 = dismissTo(기존 셸로)
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/profile');
    setDeeplinkReady(true); // back으로 탭
    expect(navs()).toHaveLength(1);
  });

  it('로그인·온보딩(게이트) 위 = 보류 → 로그인→온보딩 교체 사이엔 flush 0 → 게이트 해제 뒤 1회(탭 밖 화면 복귀여도)', () => {
    setDeeplinkReady(false); // 상세 위에서 로그인 push
    setDeeplinkGate(true); // 로그인 마운트
    handleDeeplink('kbap://food/3', 1);
    expect(mockPush).not.toHaveBeenCalled();
    setDeeplinkGate(false); // 로그인 → 온보딩 교체: 로그인 언마운트…
    setDeeplinkGate(true); // …온보딩 마운트(같은 커밋)
    jest.advanceTimersByTime(1000);
    expect(mockPush).not.toHaveBeenCalled(); // 온보딩 위 이동 0
    setDeeplinkGate(false); // 온보딩 완료 → 원래 화면
    jest.advanceTimersByTime(299);
    expect(mockPush).not.toHaveBeenCalled(); // 다음 게이트가 이어 붙을 시간
    jest.advanceTimersByTime(1);
    expect(mockPush.mock.calls).toEqual([['/food/3']]);
  });

  it('게이트 위에서 새로 받은 링크도 보류(즉시 이동 0)', () => {
    setDeeplinkGate(true);
    handleDeeplink('kbap://search', 1);
    expect(mockPush).not.toHaveBeenCalled();
    setDeeplinkGate(false);
    jest.advanceTimersByTime(300);
    expect(mockPush.mock.calls).toEqual([['/search']]);
  });

  it('3R·4R 회귀 유지 — 신규 설치: 정착 전 링크는 탭 블러·로그인 게이트 동안 보류, 온보딩 뒤 탭에서 1회', () => {
    __resetDeeplinkForTest(false);
    handleDeeplink('kbap://food/7', 1);
    setDeeplinkReady(true); // (tabs) 먼저 포커스
    markEntryResolvedAfterLeavingTabs(); // /login 교체 직후(탭 아직 focused)
    expect(mockPush).not.toHaveBeenCalled();
    setDeeplinkReady(false); // 탭 blur → 정착
    setDeeplinkGate(true); // 로그인 마운트
    handleDeeplink('kbap://scan', 5000); // 로그인 위에서 새 링크
    expect(mockPush).not.toHaveBeenCalled();
    setDeeplinkGate(false);
    setDeeplinkGate(true); // 온보딩
    jest.advanceTimersByTime(1000);
    expect(mockPush).not.toHaveBeenCalled();
    setDeeplinkGate(false); // 온보딩 끝 → 탭 교체
    setDeeplinkReady(true);
    expect(mockPush.mock.calls).toEqual([['/scan']]); // 마지막 것만 1회
    jest.advanceTimersByTime(1000);
    expect(mockPush).toHaveBeenCalledTimes(1); // 게이트 해제 타이머가 중복 이동하지 않음
  });
});

describe('KB-786', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('#278 P2: 탭 목적지(home·food·reviews·profile) = dismissTo(셸 중복 0) · 스택 목적지 = push', () => {
    for (const u of ['kbap://home', 'kbap://food', 'kbap://reviews', 'kbap://profile']) handleDeeplink(u, Math.random() * 1e9);
    handleDeeplink('kbap://food/12', 2e9);
    handleDeeplink('kbap://search', 3e9);
    expect(mockDismissTo.mock.calls.map((c) => c[0])).toEqual(['/(tabs)', '/(tabs)/food', '/(tabs)/community', '/(tabs)/profile']);
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual(['/food/12', '/search']);
  });

  it('#281 P2: 게이트 해제 지연 중 새 링크 B = 보류분 교체 → 지연 끝에 B만(옛 A가 B 위로 덮지 않음)', () => {
    setDeeplinkReady(false); // 탭 밖 화면
    setDeeplinkGate(true); // 로그인
    handleDeeplink('kbap://food/1', 1); // A 보류
    setDeeplinkGate(false); // 해제 → 300ms 대기
    jest.advanceTimersByTime(100);
    handleDeeplink('kbap://food/2', 2); // B — 지연 중 도착
    expect(navs()).toEqual([]); // 즉시 push 0
    jest.advanceTimersByTime(300);
    expect(navs()).toEqual(['/food/2']); // B 1회, A 없음
  });

  it('해제 지연 중 탭 포커스 = 안전한 착지 → 바로 flush', () => {
    setDeeplinkGate(true);
    handleDeeplink('kbap://scan', 1);
    setDeeplinkGate(false);
    setDeeplinkReady(true);
    expect(navs()).toEqual(['/scan']);
    jest.advanceTimersByTime(1000);
    expect(navs()).toHaveLength(1);
  });
});

it('isOwnedSystemUrl — 스킴·에어브릿지 호스트만', () => {
  expect(isOwnedSystemUrl('kbap://food/1')).toBe(true);
  expect(isOwnedSystemUrl('http://KBAP.ABR.GE/a')).toBe(true);
  expect(isOwnedSystemUrl('https://kbap.airbridge.io')).toBe(true);
  expect(isOwnedSystemUrl('https://evil.kbap.abr.ge.example.com/a')).toBe(false);
  expect(isOwnedSystemUrl('exp+kbap://expo-development-client')).toBe(false);
});
