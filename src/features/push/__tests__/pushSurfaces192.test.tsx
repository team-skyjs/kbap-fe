/**
 * P-192: 푸시 표면 — 실 플래그(off) 무노출 잠금 + 프라이머 시트 분기(수락=OS 팝업→토큰→
 * 회원이면 activity:true, 거절=기록만) + 주문 완료 Done 경유 예약 호출(재현 경로) + 배선 소스 잠금.
 * KB-497: 프라이머 = NotificationSheet(하단 시트), 온보딩 진입점 제거, 설정 화면 = 서버 정본 훅(목).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

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
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Redirect: (p: { href: string }) => {
    const { View } = require('react-native');
    return <View testID="redirect" accessibilityLabel={p.href} />;
  },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/components/ConfettiBurst', () => ({ ConfettiBurst: () => null, CONFETTI_DURATION_MS: 0 }));
// 팩토리 즉시 평가(호이스팅) TDZ 회피 — 목 객체는 factory 안에서 만들고 requireMock으로 취득
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
})); // P-221: 설정 화면이 실제 렌더되며 SubHeader 인셋 필요
jest.mock('@/lib/push/pushAdapter', () => ({
  markPrimerResult: jest.fn().mockResolvedValue(undefined),
  requestPermission: jest.fn().mockResolvedValue(true),
  registerPushToken: jest.fn().mockResolvedValue(undefined),
  scheduleReviewReminder: jest.fn().mockResolvedValue(undefined),
  cancelReviewReminder: jest.fn().mockResolvedValue(undefined),
  getPrimerResult: jest.fn().mockResolvedValue(null),
  REVIEW_REMINDER_SECONDS: 3600,
  getPermissionStatus: jest.fn().mockResolvedValue('granted'),
  pushAvailable: jest.fn(() => true),
}));
// KB-497: 설정은 서버 정본 훅 — 화면 렌더용 목(스위치 3개가 보이는 ON 상태)
const MOCK_SETTINGS = { activity: true, news: { enabled: true, mealTime: true, privacyConsent: { version: 1, grantedAt: '2026-09-11T00:00:00' }, receiveConsent: { version: 1, grantedAt: '2026-09-11T00:00:00' } } };
const mockPatch = jest.fn().mockResolvedValue(MOCK_SETTINGS);
jest.mock('@/lib/data/useNotificationSettings', () => ({
  useNotificationSettings: () => ({ data: MOCK_SETTINGS, isLoading: false, isError: false, refetch: jest.fn() }),
  useUpdateNotificationSettings: () => ({ mutate: jest.fn(), isError: false, reset: jest.fn() }),
  patchNotificationSettings: (...a: unknown[]) => mockPatch(...a),
  NOTIF_SETTINGS_KEY: ['notifSettings'],
}));
const mockSession = { hasBeSession: jest.fn().mockResolvedValue(true) };
jest.mock('@/lib/auth/beAuth', () => ({ get hasBeSession() { return mockSession.hasBeSession; } }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/openExternal', () => ({ openWebPage: jest.fn() }));
const mockAdapter = jest.requireMock('@/lib/push/pushAdapter') as Record<
  'markPrimerResult' | 'requestPermission' | 'registerPushToken' | 'scheduleReviewReminder' | 'cancelReviewReminder' | 'getPrimerResult',
  jest.Mock
>;

import { PushPrimerModal } from '../PushPrimerModal';
import NotificationSettings from '@/app/profile/notifications';
import { FlippedOrderCard } from '@/features/order/FlippedOrderCard';
import { FLAGS } from '@/lib/flags';
import { AppState } from 'react-native';

const t = (k: string) => k;

// 트리 상시 언마운트 — FlippedOrderCard confetti 타이머 등 실타이머가 뒤 테스트를
// 오염(마운트 밖 setState → 렌더 사망)하는 것 방지. 언마운트 = effect cleanup 발화.
beforeEach(() => {
  jest.clearAllMocks();
  mockAdapter.requestPermission.mockResolvedValue(true);
  mockAdapter.getPrimerResult.mockResolvedValue(null);
  mockSession.hasBeSession.mockResolvedValue(true);
});

const trees: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => trees.forEach((tr) => tr.unmount()));
  trees.length = 0;
});
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  trees.push(tree);
  return tree;
}
// 비동기 핸들러(run 가드)와 act 스코프 혼선 방지 — 탭은 항상 async act로 완결
const tap = async (tree: ReactTestRenderer, testID: string) => {
  const node = tree.root.findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    node.props.onPress();
  });
};

// P-192 "off 고정" → P-221: dev 계열 활성화(빌드18이 네이티브 모듈 보유).
// 🔴 prod는 여전히 차단 — 스토어 배포판에 모듈이 없어 켜면 크래시.
it('P-221: 플래그 게이트 = 채널 조건(전역 true 금지) — 설정 화면은 게이트 뒤', () => {
  expect(FLAGS.pushEnabled).toBe(true); // 유닛 = dev 계열(PROD_CHANNEL false)
  const tree = render(<NotificationSettings />);
  // 게이트가 열렸으므로 리다이렉트 없이 실제 설정 화면이 뜬다
  expect(tree.root.findAll((n) => n.props?.testID === 'redirect')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'notif-activity').length).toBeGreaterThanOrEqual(1);
});

it('배선 잠금(소스) — 전 표면이 플래그 게이트 뒤 + P-268 전 채널 개방', () => {
  const fs = require('fs');
  expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('pushEnabled: true'); // P-289(예진 9/7): 전 채널 — KB-422 재숨김 종료
  // 프로필 행(회원 분기)·스캔 프라이머·루트 배선 — 전부 플래그 게이트 뒤. 온보딩 프라이머는 제거(KB-497)
  expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).toContain('FLAGS.pushEnabled && (');
  expect(fs.readFileSync('src/app/scan.tsx', 'utf8')).toContain("!FLAGS.pushEnabled) return");
  expect(fs.readFileSync('src/app/_layout.tsx', 'utf8')).toContain('if (!FLAGS.pushEnabled) return;');
  const onboarding = fs.readFileSync('src/app/onboarding/index.tsx', 'utf8') as string;
  expect(onboarding).not.toContain('PushPrimerModal');
  expect(onboarding).not.toContain('getPrimerResult');
  expect(onboarding).not.toContain('NotificationSheet');
  expect(onboarding).not.toContain('setPushPrimer'); // US4/FR-013: 제출 성공 = 홈 직행, 프라이머 분기 0
  expect(onboarding).toContain("router.replace('/(tabs)')");
  // OTA 안전: 화면/훅에서 expo-notifications 직접 import 0 — 어댑터 lazy require만
  const adapterSrc = fs.readFileSync('src/lib/push/pushAdapter.ts', 'utf8') as string;
  expect(adapterSrc).toContain("require('expo-notifications')");
  const path = require('path') as typeof import('path');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }) as { name: string; isDirectory(): boolean }[]) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(p); // 테스트 자신(이 문자열 포함) 제외
      }
      else if (/\.tsx?$/.test(e.name) && (fs.readFileSync(p, 'utf8') as string).includes("from 'expo-notifications'")) offenders.push(p);
    }
  };
  walk('src');
  expect(offenders).toEqual([]); // 정적 import 금지(구 런타임 크래시 방지)
});

it('프라이머(시트) 수락 = 기록→OS 팝업→토큰 등록→(회원) PATCH activity:true→onDone (이 순서만 iOS 1회성 보호)', async () => {
  const onDone = jest.fn();
  const tree = render(<PushPrimerModal open onDone={onDone} surface="scan" />);
  expect(tree.root.findAll((n) => n.props?.testID === 'notif-sheet-primer').length).toBeGreaterThan(0); // 하단 시트
  await tap(tree, 'notif-sheet-confirm');
  const order = [mockAdapter.markPrimerResult, mockAdapter.requestPermission, mockAdapter.registerPushToken, mockPatch].map((m) => m.mock.invocationCallOrder[0]);
  expect(mockAdapter.markPrimerResult).toHaveBeenCalledWith('accepted');
  expect(order).toEqual([...order].sort((a, b) => a - b)); // 기록 → OS 팝업 → 토큰 → PATCH
  expect(mockPatch).toHaveBeenCalledWith({ activity: true });
  expect(onDone).toHaveBeenCalled();
});

it('프라이머 거절(나중에) = 기록만(OS 팝업 0·PATCH 0 — 재노출 없음은 기록이 소스) + onDone', async () => {
  const onDone = jest.fn();
  const tree = render(<PushPrimerModal open onDone={onDone} surface="scan" />);
  await tap(tree, 'notif-sheet-later');
  expect(mockAdapter.markPrimerResult).toHaveBeenCalledWith('declined');
  expect(mockAdapter.requestPermission).not.toHaveBeenCalled();
  expect(mockPatch).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalled();
});

it('KB-543: 게스트(세션 없음) 수락 = OS 팝업은 뜨되 PATCH 0회(토큰 등록 세션 가드는 어댑터 몫)', async () => {
  mockSession.hasBeSession.mockResolvedValue(false);
  const tree = render(<PushPrimerModal open onDone={jest.fn()} surface="scan" />);
  await tap(tree, 'notif-sheet-confirm');
  expect(mockAdapter.requestPermission).toHaveBeenCalled();
  expect(mockPatch).not.toHaveBeenCalled();
});

it('OS 권한 거부 = 토큰 등록·PATCH 0회, onDone은 호출', async () => {
  mockAdapter.requestPermission.mockResolvedValue(false);
  const onDone = jest.fn();
  const tree = render(<PushPrimerModal open onDone={onDone} surface="scan" />);
  await tap(tree, 'notif-sheet-confirm');
  expect(mockAdapter.registerPushToken).not.toHaveBeenCalled();
  expect(mockPatch).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalled();
});

it('KB-497 소스 잠금: scan.tsx 프라이머 = PushPrimerModal(시트 래퍼) + 코치마크 직렬화(maybeShowPrimer) 유지', () => {
  const scan = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(scan).toContain('<PushPrimerModal surface="scan"');
  expect(scan).toContain('maybeShowPrimer'); // KB-377: 코치마크 닫힌 뒤에만
  const primer = require('fs').readFileSync('src/features/push/PushPrimerModal.tsx', 'utf8') as string;
  expect(primer).toContain('<NotificationSheet');
  expect(primer).toContain("variant=\"primer\"");
});

it('주문 완료 재현 경로: Done → 확인 모달 → 홈 버튼 = 첫 foodId 항목 예약 + onDone', async () => {
  const onDone = jest.fn();
  const items = [
    { nameKo: '김밥', name: 'Kimbap', qty: 1, priceKrw: 3000, foodId: null }, // 미매칭 — 건너뜀
    { nameKo: '김치찌개', name: 'Kimchi Jjigae', qty: 2, priceKrw: 9000, foodId: '7' },
  ];
  const tree = render(
    <FlippedOrderCard items={items} avoidCodes={[]} avoidNames={[]} currency="USD" onDone={onDone} t={t} />,
  );
  // Done 탭 → 완료 모달
  const doneBtn = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'order.done').length > 0).pop()!;
  await act(async () => doneBtn.props.onPress());
  // 모달의 홈 버튼 탭 = 예약(foodId 보유 첫 항목) 후 onDone
  const homeBtn = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'order.doneHome').length > 0).pop()!;
  await act(async () => homeBtn.props.onPress());
  expect(mockAdapter.scheduleReviewReminder).toHaveBeenCalledWith({ foodId: '7', name: 'Kimchi Jjigae' });
  expect(onDone).toHaveBeenCalled();
});

it('리뷰 작성 성공 시 예약 취소 배선 — 소스 잠금(작성 화면 cancelReviewReminder)', () => {
  const src = require('fs').readFileSync('src/app/food/[id]/review.tsx', 'utf8') as string;
  expect(src).toContain('cancelReviewReminder(id)');
});

it('KB-496(Codex #104 P2-4): OS 설정 복귀(AppState active) = 권한 재조회 + 토큰 등록 — 재시작 없이 배너 해제·등록', () => {
  const handlers: ((s: string) => void)[] = [];
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
    handlers.push(cb);
    return { remove: jest.fn() };
  }) as never);
  const perm = jest.requireMock('@/lib/push/pushAdapter').getPermissionStatus as jest.Mock;
  render(<NotificationSettings />);
  perm.mockClear();
  mockAdapter.registerPushToken.mockClear();
  expect(handlers.length).toBeGreaterThanOrEqual(1);
  act(() => handlers.forEach((h) => h('background'))); // 비활성 전환은 무반응
  expect(mockAdapter.registerPushToken).not.toHaveBeenCalled();
  act(() => handlers.forEach((h) => h('active')));
  expect(perm).toHaveBeenCalledTimes(1);
  expect(mockAdapter.registerPushToken).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});
