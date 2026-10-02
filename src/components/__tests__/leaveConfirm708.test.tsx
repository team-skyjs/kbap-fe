/** KB-708 — useLeaveConfirm: 제출 중에도 확인 창으로 나갈 수 있음(갇힘 방지) · release 2회 = then 1회. */
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
function Harness({ dirty, onApi = exposeApi }: { dirty: boolean; onApi?: typeof exposeApi }) {
  const leave = useLeaveConfirm(dirty);
  React.useEffect(() => onApi(leave)); // 렌더 밖에서 넘김(렌더 중 바깥 변수 재할당 = 컴파일러 위반)
  return <LeaveConfirmModal {...leave.modal} />;
}
const modalOpen = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'leave-confirm').length > 0;

beforeEach(() => mockNavDispatch.mockClear());

// #236 공부: 제출 중 이동을 막아 두면 상한 없는 사진 업로드(약한 망)에서 뒤로 가기가 무반응 = 갇힘(361fc31 대비 회귀)
it('제출 중 뒤로 = 확인 창 · 그만두기 = 막았던 이동 그대로 진행(갇히지 않음)', () => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Harness dirty />); });
  expect(mockPrevent.on).toBe(true);
  const action = { type: 'GO_BACK' };
  act(() => mockPrevent.cb!({ data: { action } }));
  expect(modalOpen(t)).toBe(true);
  act(() => t.root.findAll((n) => n.props?.testID === 'discard-go' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(mockNavDispatch).toHaveBeenCalledWith(action);
  expect(modalOpen(t)).toBe(false);
});

it('release 2회 = then 1회 · 풀린 뒤엔 막지 않음', () => {
  act(() => { renderer.create(<Harness dirty />); });
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
