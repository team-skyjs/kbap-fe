/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-783 — 에어브릿지 이벤트 래퍼: 표준 카테고리만(ABR_CORE) · PII 0 · 주문 금액 0 · 검색어 프라이버시(P-214와 같은 규칙)
 * · 해제 경로(ad 즉시 / review = 같은 회원 프로필 전이, 광고 직후 전이 1회 건너뜀) · 식별(회원 번호만) · 배선 잠금.
 */
const mockTrack = jest.fn();
const mockSetUserID = jest.fn();
const mockClearUser = jest.fn();
const mockOnDeeplink = jest.fn();
jest.mock('airbridge-react-native-sdk', () => {
  const actual = jest.requireActual('airbridge-react-native-sdk');
  return {
    ...actual,
    Airbridge: {
      trackEvent: (...a: unknown[]) => mockTrack(...a),
      setUserID: (id: string) => mockSetUserID(id),
      clearUser: () => mockClearUser(),
      setOnDeeplinkReceived: (cb: (u: string) => void) => mockOnDeeplink(cb),
    },
  };
});
const mockHandle = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import * as fs from 'fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as path from 'path';
import { AirbridgeCategory } from 'airbridge-react-native-sdk';
import {
  ATTRIBUTE,
  CATEGORY,
  airbridge,
  clearAirbridgeUser,
  initAirbridgeDeeplinks,
  noteAdUnlock,
  observeScanQuota,
  setAirbridgeUser,
  __resetAirbridgeStateForTest,
} from '../airbridge';

const STANDARD = new Set(
  Object.getOwnPropertyNames(AirbridgeCategory)
    .map((k) => (AirbridgeCategory as unknown as Record<string, unknown>)[k])
    .filter((v): v is string => typeof v === 'string' && v.startsWith('airbridge.')),
);
const PII_KEYS = /email|nick|nationality|country|phone|avoid|restriction|allerg|name_en|user_?name/i;
const keysDeep = (v: unknown): string[] =>
  v && typeof v === 'object' ? Object.entries(v as object).flatMap(([k, x]) => [k, ...keysDeep(x)]) : [];

beforeEach(async () => {
  jest.clearAllMocks();
  __resetAirbridgeStateForTest();
  await AsyncStorage.clear();
});
const flush = () => new Promise((r) => setTimeout(r, 0));

it('15개 지점 래퍼 = 전부 표준 카테고리(커스텀 0) · 속성 키에 PII 0', () => {
  airbridge.signUp();
  setAirbridgeUser('1'); // 가입·로그인은 식별 뒤 발사
  airbridge.signIn();
  setAirbridgeUser('1');
  airbridge.signOut();
  airbridge.completeTutorial({ guest: true });
  airbridge.homeView();
  airbridge.scanSpend({ remaining: 2, unlocked: false });
  airbridge.scanResults(7);
  airbridge.searchResults({ keyword: 'bibimbap', resultCount: 3 });
  airbridge.productView({ id: '12', name: '비빔밥' });
  airbridge.wishlist({ id: '12', name: '비빔밥' });
  airbridge.addToCart({ id: '12', name: '비빔밥' });
  airbridge.orderComplete({ lines: 2, units: 3 });
  airbridge.rate({ foodId: '12', rating: 4, hasPhoto: true });
  airbridge.share('save');
  airbridge.adImpression('banner', 'home_banner');
  airbridge.adClick('native', 'feed_native');
  airbridge.unlock('ad');
  expect(mockTrack).toHaveBeenCalledTimes(17);
  const cats = mockTrack.mock.calls.map((c) => c[0] as string);
  for (const c of cats) expect({ c, standard: STANDARD.has(c) }).toEqual({ c, standard: true });
  expect(cats).toEqual([
    'airbridge.user.signup', 'airbridge.user.signin', 'airbridge.user.signout', 'airbridge.completeTutorial',
    'airbridge.ecommerce.home.viewed', 'airbridge.spendCredits', 'airbridge.ecommerce.productList.viewed',
    'airbridge.ecommerce.searchResults.viewed', 'airbridge.ecommerce.product.viewed', 'airbridge.addToWishlist',
    'airbridge.ecommerce.product.addedToCart', 'airbridge.ecommerce.order.completed', 'airbridge.rate', 'airbridge.share',
    'airbridge.adImpression', 'airbridge.adClick', 'airbridge.unlockAchievement',
  ]);
  for (const call of mockTrack.mock.calls) {
    const keys = [...keysDeep(call[1]), ...keysDeep(call[2])];
    expect({ cat: call[0], pii: keys.filter((k) => PII_KEYS.test(k)) }).toEqual({ cat: call[0], pii: [] });
  }
});

it('카테고리·속성 사본 = SDK 실상수와 이름별 일치(사본이 어긋나면 표준 밖 문자열이 나간다)', () => {
  const actual = jest.requireActual('airbridge-react-native-sdk') as { AirbridgeCategory: Record<string, string>; AirbridgeAttribute: Record<string, string> };
  for (const [k, v] of Object.entries(CATEGORY)) expect({ k, v }).toEqual({ k, v: actual.AirbridgeCategory[k] });
  for (const [k, v] of Object.entries(ATTRIBUTE)) expect({ k, v }).toEqual({ k, v: actual.AirbridgeAttribute[k] });
});

it('react-native 통째 목(NativeModules 없음)에서도 import·호출이 던지지 않는다(beAuth 경유 유닛 — 계측만 빠짐)', () => {
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    jest.doMock('airbridge-react-native-sdk', () => { throw new TypeError("Cannot read properties of undefined (reading 'EventInteractor')"); });
    const m = jest.requireActual('../airbridge') as typeof import('../airbridge');
    expect(() => { m.airbridge.signIn(); m.setAirbridgeUser('1'); m.clearAirbridgeUser(); m.initAirbridgeDeeplinks(() => {}); }).not.toThrow();
  });
});

describe('①② 가입·로그인 = 식별 뒤(#278 Codex P1)', () => {
  it('로그인 직후엔 보내지 않고, members/me 성공(setAirbridgeUser)에서 setUserID **다음에** 1회', () => {
    airbridge.signUp();
    expect(mockTrack).not.toHaveBeenCalled();
    setAirbridgeUser('42');
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack.mock.calls[0][0]).toBe('airbridge.user.signup');
    expect(mockSetUserID.mock.invocationCallOrder[0]).toBeLessThan(mockTrack.mock.invocationCallOrder[0]);
  });
  it('세션 복원(로그인 없는 members/me) = 재발사 0 · 식별 전에 세션이 끝나면 버림(저장분 포함)', async () => {
    airbridge.signIn();
    setAirbridgeUser('42');
    await flush();
    setAirbridgeUser('42'); // 앱 재시작 복원 등
    await flush();
    expect(mockTrack).toHaveBeenCalledTimes(1);
    airbridge.signIn();
    await flush();
    clearAirbridgeUser();
    await flush();
    setAirbridgeUser('43');
    await flush();
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('airbridge.pendingAuth.v1')).toBeNull();
  });
  it('#278 Codex P2: 온보딩 중 앱 종료(메모리 유실) → 다음 실행의 식별에서 저장분 SIGN_UP 1회, setUserID 다음 · 발사 뒤 저장 비움', async () => {
    airbridge.signUp();
    await flush();
    expect(await AsyncStorage.getItem('airbridge.pendingAuth.v1')).toBe('airbridge.user.signup');
    __resetAirbridgeStateForTest(); // 프로세스 재시작 = 메모리만 사라짐(기기 저장소 유지)
    setAirbridgeUser('42');
    await flush();
    await flush();
    expect(mockTrack.mock.calls.map((c) => c[0])).toEqual(['airbridge.user.signup']);
    expect(mockSetUserID.mock.invocationCallOrder[0]).toBeLessThan(mockTrack.mock.invocationCallOrder[0]);
    expect(await AsyncStorage.getItem('airbridge.pendingAuth.v1')).toBeNull();
    setAirbridgeUser('42');
    await flush();
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });
});

it('저장소 부분 목(removeItem 없음)·동기 throw에도 세션 경계·식별·가입이 던지지 않는다(로그아웃 경로 — freshInstall 유닛 실측)', async () => {
  await new Promise<void>((done) => {
    jest.isolateModules(() => {
      jest.doMock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null, setItem: async () => {} }));
      const m = jest.requireActual('../airbridge') as typeof import('../airbridge');
      expect(() => { m.airbridge.signUp(); m.setAirbridgeUser('1'); m.clearAirbridgeUser(); }).not.toThrow();
      done();
    });
  });
  await new Promise<void>((done) => {
    jest.isolateModules(() => {
      jest.doMock('@react-native-async-storage/async-storage', () => ({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } }));
      const m = jest.requireActual('../airbridge') as typeof import('../airbridge');
      expect(() => { m.airbridge.signIn(); m.clearAirbridgeUser(); m.setAirbridgeUser('2'); }).not.toThrow();
      done();
    });
  });
  await flush();
});

it('⑪ 주문 완료 = 금액·통화 0(예상 합계는 실결제 아님) · totalQuantity = 수량 합 · item_count = 줄 수(#278 Codex P2)', () => {
  airbridge.orderComplete({ lines: 2, units: 3 }); // 비빔밥 2 + 국 1
  const [, semantic, custom] = mockTrack.mock.calls[0];
  const keys = [...keysDeep(semantic), ...keysDeep(custom)];
  expect(keys).not.toContain('value');
  expect(keys).not.toContain('currency');
  expect(keys).not.toContain('price');
  expect(semantic).toEqual({ totalQuantity: 3 });
  expect(custom).toEqual({ item_count: 2 });
});

it('⑦ 검색 = 매칭된 카탈로그 값만 query · 미매칭은 query 없이 결과 수만(자유 텍스트 전송 0)', () => {
  airbridge.searchResults({ keyword: undefined, resultCount: 0 });
  expect(mockTrack.mock.calls[0][1]).toBeUndefined();
  expect(mockTrack.mock.calls[0][2]).toEqual({ result_count: 0, matched: false });
  airbridge.searchResults({ keyword: 'kimchi', resultCount: 5 });
  expect(mockTrack.mock.calls[1][1]).toEqual({ query: 'kimchi' });
});

it('⑥ 스캔 소모 = credits 1 + 스캔 전 남은 횟수·해제 여부(custom) · 모름은 생략', () => {
  airbridge.scanSpend({ remaining: 'unlimited', unlocked: true });
  expect(mockTrack.mock.calls[0][2]).toEqual({ credits: 1, remaining_before: 'unlimited', unlocked: true });
  airbridge.scanSpend(null); // 구서버·판별 불가
  expect(mockTrack.mock.calls[1][2]).toEqual({ credits: 1 });
});

describe('⑮ 해제 경로', () => {
  const unlockCalls = () => mockTrack.mock.calls.filter((c) => c[0] === 'airbridge.unlockAchievement').map((c) => (c[2] as { via: string }).via);
  it('리뷰 해제 = 같은 회원의 false → true 전이 1회', () => {
    observeScanQuota('7', false);
    observeScanQuota('7', true);
    observeScanQuota('7', true);
    expect(unlockCalls()).toEqual(['review']);
  });
  it('광고 해제 = 응답에서 ad 1회, 뒤따르는 프로필 전이는 리뷰로 세지 않음', () => {
    observeScanQuota('7', false);
    noteAdUnlock();
    observeScanQuota('7', true);
    expect(unlockCalls()).toEqual(['ad']);
  });
  it('광고 플래그는 첫 unlocked 관측에 소비 — 이미 해제였던 회원에게 남아 다음 리뷰 해제를 삼키지 않는다', () => {
    observeScanQuota('7', true);
    noteAdUnlock();
    observeScanQuota('7', true); // 소비
    observeScanQuota('7', false); // 재잠금(새 주기)
    observeScanQuota('7', true);
    expect(unlockCalls()).toEqual(['ad', 'review']);
  });
  it('계정 전환·이전 값 모름·구서버(null) = 보내지 않음(추측 금지)', () => {
    observeScanQuota('7', true); // 첫 관측(이전 모름)
    observeScanQuota('8', false);
    observeScanQuota('9', true); // 다른 회원
    observeScanQuota('9', null);
    expect(unlockCalls()).toEqual([]);
  });
  it('세션 끝 = 광고 해제 표식도 비움(#278 Codex P2) — 다음 회원의 리뷰 해제를 삼키지 않는다', () => {
    observeScanQuota('7', false);
    noteAdUnlock(); // 'ad' 전송, 프로필 관측 전에 로그아웃
    clearAirbridgeUser();
    observeScanQuota('8', false);
    observeScanQuota('8', true); // 다른 회원의 리뷰 해제
    expect(unlockCalls()).toEqual(['ad', 'review']);
  });
  it('세션 끝(clearAirbridgeUser) = 이전 관측 폐기 — 재로그인 첫 관측은 전이 아님', () => {
    observeScanQuota('7', false);
    clearAirbridgeUser();
    observeScanQuota('7', true);
    expect(unlockCalls()).toEqual([]);
  });
});

it('식별 = 회원 번호만 · 해제 = clearUser · 딥링크 콜백 1회 등록 → lib/deeplink', () => {
  setAirbridgeUser('123');
  expect(mockSetUserID).toHaveBeenCalledWith('123');
  clearAirbridgeUser();
  expect(mockClearUser).toHaveBeenCalledTimes(1);
  initAirbridgeDeeplinks(mockHandle);
  initAirbridgeDeeplinks(mockHandle);
  expect(mockOnDeeplink).toHaveBeenCalledTimes(1);
  mockOnDeeplink.mock.calls[0][0]('kbap://food/1');
  expect(mockHandle).toHaveBeenCalledWith('kbap://food/1');
});

describe('배선 잠금(소스) — 기존 Amplitude 지점 옆', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  const WIRING: [string, string[]][] = [
    ['src/lib/auth/useSocialAuth.ts', ['airbridge.signUp()', 'airbridge.signIn()']],
    ['src/app/(tabs)/profile.tsx', ['airbridge.signOut()']],
    ['src/app/onboarding/index.tsx', ['airbridge.completeTutorial(']],
    ['src/app/(tabs)/_layout.tsx', ["if (active === 'home' && isEntryResolved()) airbridge.homeView()", 'useFocusEffect(', 'setDeeplinkReady(true)', 'return () => setDeeplinkReady(false)']],
    ['src/app/scan.tsx', ['airbridge.scanSpend(quotaRef.current)', 'airbridge.scanResults(', 'airbridge.addToCart(']],
    ['src/app/search.tsx', ['airbridge.searchResults({ keyword: kw.keyword']],
    ['src/app/food/[id]/index.tsx', ['airbridge.productView(']],
    // ⑨ 찜 = 공용 뮤테이션 성공 지점 한 곳(#278 Codex P1 — 상세·검색·FoodExplorer 전 표면, 실패 저장 미집계)
    ['src/lib/data/bookmarks.ts', ['if (add) airbridge.wishlist({ id: snap.foodId', 'airbridge.wishlist({ id: snap.foodId, name: snap.nameKo }); // KB-783 ⑨: 저장 목록']],
    ['src/features/order/FlippedOrderCard.tsx', ['airbridge.orderComplete({ lines: itemCount, units: items.reduce((n, i) => n + (i.qty > 0 ? i.qty : 0), 0) })']],
    ['src/app/food/[id]/review.tsx', ['airbridge.rate(']],
    ['src/app/profile/order/[id].tsx', ["if (r === 'success') airbridge.share('save')", "if (r === 'success') airbridge.share('instagram_story')"]],
    ['src/features/ads/AdBanner.tsx', ["airbridge.adImpression('banner'", "airbridge.adClick('banner'"]],
    ['src/features/ads/FeedAd.tsx', ["airbridge.adImpression('native'", "airbridge.adClick('native'"]],
    ['src/features/ads/OrderDoneInterstitial.tsx', ["airbridge.adImpression('interstitial'", "airbridge.adClick('interstitial'"]],
    ['src/features/ads/RewardedUnlock.tsx', ["airbridge.adImpression('rewarded'", "airbridge.adClick('rewarded'"]],
    // ⑮ 광고 해제 표식 = 보상 뮤테이션 onSuccess, 프로필 재조회(await) **전**(#278 Codex P1)
    ['src/lib/data/useAdReward.ts', ["if (r.scanUnlocked) noteAdUnlock();\n      return qc.invalidateQueries({ queryKey: ['me'] })"]],
    ['src/lib/data/useMe.ts', ['setAirbridgeUser(user.id)', 'observeScanQuota(user.id, user.scanQuota?.unlocked)']],
    ['src/lib/auth/beAuth.ts', ['clearAirbridgeUser()']],
    // #278 Codex 3R: 진입 정착 = 일반 부팅은 스택 렌더 전, 신규 설치는 /login 교체 **뒤**
    ['src/app/_layout.tsx', ['initAirbridgeDeeplinks(handleDeeplink)', 'if (!needsLogin.current) markEntryResolved();\n      setEntryChecked(true);', 'markEntryResolvedAfterLeavingTabs();']],
  ];
  it.each(WIRING)('%s', (file, calls) => {
    const s = read(file);
    for (const c of calls) expect({ file, c, has: s.includes(c) }).toEqual({ file, c, has: true });
  });

  it('찜 이벤트는 화면에서 보내지 않는다(공용 뮤테이션만) · 탭 준비는 마운트가 아니라 포커스', () => {
    const wish = (f: string) => /airbridge\.wishlist\(/.test(read(f));
    expect(['src/app/food/[id]/index.tsx', 'src/app/profile/saved.tsx', 'src/app/search.tsx', 'src/features/food/FoodExplorer.tsx'].filter(wish)).toEqual([]);
    expect(read('src/app/(tabs)/_layout.tsx')).not.toMatch(/React\.useEffect\(\(\) => \{\s*setDeeplinkReady\(true\)/);
  });

  it('lib/airbridge는 라우터를 끌어오지 않는다(beAuth·useMe 경유 유닛 로드 — 처리기는 _layout이 넘긴다)', () => {
    const s = read('src/lib/airbridge.ts');
    expect(s).not.toMatch(/from 'expo-router'|from '@\/lib\/deeplink'/);
  });

  it('SDK 직접 import = lib/airbridge.ts 하나(글롭 순회 — 화면이 SDK를 부르면 커스텀 카테고리·PII 길이 열린다)', () => {
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : walk(p);
        return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
      });
    const files = walk('src');
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((f) => f !== path.join('src', 'lib', 'airbridge.ts') && /from 'airbridge-react-native-sdk'|require\('airbridge-react-native-sdk'\)/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
