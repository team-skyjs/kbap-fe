/** KB-708 — useLeaveConfirm: 제출 중엔 막기만(모달 0) · release 2회 = then 1회. */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockNavDispatch = jest.fn();
const mockPrevent: { on: boolean; cb: ((o: { data: { action: unknown } }) => void) | null } = { on: false, cb: null };
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: (a: unknown) => mockNavDispatch(a) }) }));
jest.mock('expo-router/build/react-navigation/core', () => ({
  usePreventRemove: (on: boolean, cb: (o: { data: { action: unknown } }) => void) => {
    mockPrevent.on = on;
    mockPrevent.cb = cb;
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// 버튼 자체(reanimated)는 이 테스트 대상 아님 — testID·onPress만 살린 Pressable
jest.mock('@/components/Btn', () => {
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Btn: ({ testID, onPress }: { testID?: string; onPress?: () => void }) => <Pressable testID={testID} onPress={onPress} /> };
});

// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import { LeaveConfirmModal, useLeaveConfirm } from '../LeaveConfirmModal';

let api!: ReturnType<typeof useLeaveConfirm>;
const exposeApi = (l: ReturnType<typeof useLeaveConfirm>) => {
  api = l;
};
function Harness({ dirty, submitting, onApi = exposeApi }: { dirty: boolean; submitting: boolean; onApi?: typeof exposeApi }) {
  const leave = useLeaveConfirm(dirty, submitting);
  React.useEffect(() => onApi(leave)); // 렌더 밖에서 넘김(렌더 중 바깥 변수 재할당 = 컴파일러 위반)
  return <LeaveConfirmModal {...leave.modal} />;
}
const modalOpen = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'leave-confirm').length > 0;

beforeEach(() => mockNavDispatch.mockClear());

it('제출 중 뒤로 = 막기만(모달 0 · 이동 0 · 화면 유지) → 끝나고 실패(dirty 유지)면 다시 확인 창', () => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Harness dirty submitting />); });
  expect(mockPrevent.on).toBe(true);
  act(() => mockPrevent.cb!({ data: { action: { type: 'GO_BACK' } } }));
  expect(modalOpen(t)).toBe(false);
  expect(mockNavDispatch).not.toHaveBeenCalled();
  act(() => t.update(<Harness dirty submitting={false} />)); // 요청 실패 — 내용은 남음
  act(() => mockPrevent.cb!({ data: { action: { type: 'GO_BACK' } } }));
  expect(modalOpen(t)).toBe(true);
});

it('release 2회 = then 1회 · 풀린 뒤엔 막지 않음', () => {
  act(() => { renderer.create(<Harness dirty submitting={false} />); });
  // 화면은 렌더마다 새 클로저(() => router.back())를 넘긴다 — 같은 함수로 테스트하면 옛 구현도 통과해 버림
  const backs = [jest.fn(), jest.fn(), jest.fn()];
  act(() => {
    api.release(backs[0]);
    api.release(backs[1]);
  });
  act(() => api.release(backs[2])); // 다음 틱에 또 불러도
  expect(backs.map((b) => b.mock.calls.length)).toEqual([1, 0, 0]); // 첫 then만 · 뒤로 1회
  expect(mockPrevent.on).toBe(false);
});
