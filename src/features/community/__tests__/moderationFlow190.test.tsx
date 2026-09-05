/**
 * P-190(Q-40①② ⛔️ 반려): 신고·차단 무반응 — ActionSheet 조기 onClose가 페이즈 전환을
 * 죽이던 버그. **재현 경로 유닛**: 페이즈 직접 호출이 아니라 **ActionSheet 아이템 탭 경유**로
 * 신고 시트·차단 확인 도달을 검증(같은 우회 재발 차단). 본인 수정/삭제 자동 닫힘 회귀 무사고.
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
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
let mockGuest = false;
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest }));
jest.mock('@/components/AuthGateSheet', () => {
  const { View } = require('react-native');
  return {
    AuthGateSheet: ({ open, context }: { open: boolean; context: string }) =>
      open ? <View testID={`gate-${context}`} /> : null,
  };
});
const mockReport = jest.fn();
const mockBlockAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/community/hooks', () => ({
  useSubmitReport: () => ({ mutate: mockReport, isPending: false }),
  useBlockUser: () => ({ mutateAsync: mockBlockAsync, isPending: false }),
}));

import { ModerationFlow, type ModTarget } from '../moderation';

const OTHER: ModTarget = { type: 'review', id: 'r1', author: { id: '5', nickname: 'Bob', nationality: 'US' }, mine: false };
const MINE: ModTarget = { type: 'review', id: 'r2', author: { id: '9', nickname: 'Me', nationality: 'US' }, mine: true };

function render(target: ModTarget, cbs: Partial<Record<'onClose' | 'onEdit' | 'onDelete' | 'onBlocked', jest.Mock>> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ModerationFlow
        target={target}
        onClose={cbs.onClose ?? jest.fn()}
        onEdit={cbs.onEdit ?? jest.fn()}
        onDelete={cbs.onDelete ?? jest.fn()}
        onBlocked={cbs.onBlocked ?? jest.fn()}
      />,
    );
  });
  return tree;
}
const flat = (t2: ReactTestRenderer) => JSON.stringify(t2.toJSON());
const tapItem = (tree: ReactTestRenderer, label: string) => {
  const item = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === label).length > 0).pop()!;
  act(() => item.props.onPress());
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGuest = false;
  mockBlockAsync.mockResolvedValue(undefined);
});

it('⛔️ 재현 경로: 타인 메뉴 → "신고" 아이템 탭 → 신고 시트(사유 라디오) 도달 — onClose 미발화', () => {
  const onClose = jest.fn();
  const tree = render(OTHER, { onClose });
  tapItem(tree, 'community.report');
  expect(onClose).not.toHaveBeenCalled(); // 조기 close = 플로우 언마운트였던 원인
  const s = flat(tree);
  expect(s).toContain('community.reportTitle'); // 신고 시트 도달
  expect(s).toContain('community.reason.spam');
});

it('⛔️ 재현 경로: "차단" 아이템 탭 → 차단 확인 도달 — onClose 미발화', () => {
  const onClose = jest.fn();
  const tree = render(OTHER, { onClose });
  tapItem(tree, 'community.blockUser');
  expect(onClose).not.toHaveBeenCalled();
  expect(flat(tree)).toContain('community.blockConfirmTitle');
});

it('P-194: 신고 시트 — 키보드 실측 리프트(iOS marginBottom = 키보드 높이, 숨김 시 복원)', () => {
  const { Keyboard, StyleSheet } = require('react-native') as typeof import('react-native');
  // KeyboardDismissBar도 같은 이벤트를 구독 — 배열로 수집해 전부 발화
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, cb: (e: unknown) => void) => {
    (listeners[ev] ??= []).push(cb);
    return { remove: jest.fn() } as never;
  }) as never);
  const tree = render(OTHER);
  tapItem(tree, 'community.report'); // 재현 경로 — 신고 시트 도달 후 입력 포커스 상황
  const sheetStyle = () => StyleSheet.flatten(tree.root.findAll((n) => n.props?.testID === 'mod-sheet')[0].props.style) as { marginBottom?: number };
  act(() => listeners['keyboardDidShow']?.forEach((cb) => cb({ endCoordinates: { height: 336 } })));
  expect(sheetStyle().marginBottom).toBe(336); // 시트가 키보드 위로 — 필드+제출 가시
  act(() => listeners['keyboardDidHide']?.forEach((cb) => cb({})));
  expect(sheetStyle().marginBottom).toBeUndefined();
  spy.mockRestore();
});

it('회귀 무사고: 본인 수정/삭제 = 현행 자동 닫힘(onClose) + 콜백', () => {
  const onClose = jest.fn();
  const onEdit = jest.fn();
  const tree = render(MINE, { onClose, onEdit });
  tapItem(tree, 'community.edit');
  expect(onClose).toHaveBeenCalled(); // 자동 닫힘 유지
  expect(onEdit).toHaveBeenCalled();
});

/* ---- P-281: 게스트 ⋯ 메뉴 — 차단 숨김·신고 게이트 + 차단 실패 복구 ---- */

it('P-281(a): 게스트 = block 항목 없음 · Report 탭 → AuthGateSheet(context report)', () => {
  mockGuest = true;
  const tree = render(OTHER);
  expect(flat(tree)).not.toContain('community.blockUser'); // 차단 항목 자체 미노출
  tapItem(tree, 'community.report');
  expect(tree.root.findAll((n) => n.props?.testID === 'gate-report').length).toBeGreaterThanOrEqual(1); // 게이트 대체
  expect(flat(tree)).not.toContain('community.reportTitle'); // 사유 시트 미도달(가짜 Thanks 방지)
});

it('P-281(b): 회원 = Report·Block 현행 무변(위 재현 경로 케이스가 이중 잠금) + 2차 제안 게스트 가드 소스 잠금', () => {
  const tree = render(OTHER);
  const s = flat(tree);
  expect(s).toContain('community.report');
  expect(s).toContain('community.blockUser');
  const src = require('fs').readFileSync('src/features/community/moderation.tsx', 'utf8') as string;
  expect(src).toContain('!target.mine && !isGuest &&'); // 신고 확인 상태 차단 2차 제안 = 게스트 미렌더
});

it('P-281(c): blockUser reject → "Blocking…"에 갇히지 않고 메뉴 복귀(닫기 가능) — 근본 원인 수정', async () => {
  mockBlockAsync.mockRejectedValueOnce(new Error('AUTH-003'));
  const onClose = jest.fn();
  const onBlocked = jest.fn();
  const tree = render(OTHER, { onClose, onBlocked });
  tapItem(tree, 'community.blockUser');
  expect(flat(tree)).toContain('community.blockConfirmTitle');
  await act(async () => {
    tapItem(tree, 'community.blockConfirmCta');
    await Promise.resolve();
  });
  const s = flat(tree);
  expect(s).not.toContain('community.blocking'); // 무한 Blocking… 소멸
  expect(s).toContain('community.blockUser'); // 메뉴 복귀(재시도는 사용자가)
  expect(onBlocked).not.toHaveBeenCalled(); // 실패 = 차단 완료 후처리 미발화
  expect(onClose).not.toHaveBeenCalled();
});
