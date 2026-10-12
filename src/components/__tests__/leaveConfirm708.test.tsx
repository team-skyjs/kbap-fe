/** KB-708 — useLeaveConfirm: 제출 중엔 막지 않음(그냥 나감 · 모달 0) · release 2회 = then 1회 · 지킬 것이 없어지면 확인 창 스스로 닫힘. */
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
function Harness({ dirty, submitting = false, onApi = exposeApi }: { dirty: boolean; submitting?: boolean; onApi?: typeof exposeApi }) {
  const leave = useLeaveConfirm(dirty, submitting);
  React.useEffect(() => onApi(leave)); // 렌더 밖에서 넘김(렌더 중 바깥 변수 재할당 = 컴파일러 위반)
  return <LeaveConfirmModal {...leave.modal} />;
}
const modalOpen = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'leave-confirm').length > 0;

beforeEach(() => mockNavDispatch.mockClear());

// #236 /review 2R: 제출 중 막으면 갇히고(상한 없는 업로드), 확인 창을 띄우면 뜬 채 성공 시 dismiss+완료 모달 present가 한 커밋(iOS 프리즈 전례)
// → 제출 중엔 막지도 띄우지도 않는다(그냥 나감). 실패로 끝나면 다시 평소 확인 창.
it('제출 중 = 막지 않음(prevent off · 모달 0) → 제출 실패로 끝나면 다시 막음 · 뒤로 = 확인 창 · 그만두기 = 나감', () => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Harness dirty submitting />); });
  expect(mockPrevent.on).toBe(false);
  expect(modalOpen(t)).toBe(false);
  act(() => t.update(<Harness dirty submitting={false} />)); // 실패 — 내용은 남음
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

// #236 /review C: 확인 창이 뜬 채 제출 성공(완료 모달) → 두 Modal 동시 visible = 겹침 프리즈 전례
it('확인 창이 떠 있는 동안 지킬 것이 없어지면(dirty 해제·release) 스스로 닫힌다', () => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Harness dirty />); });
  act(() => mockPrevent.cb!({ data: { action: { type: 'GO_BACK' } } }));
  expect(modalOpen(t)).toBe(true);
  act(() => t.update(<Harness dirty={false} />)); // 제출 성공 → 완료 상태
  expect(modalOpen(t)).toBe(false);
  act(() => t.update(<Harness dirty />));
  expect(modalOpen(t)).toBe(false); // 다시 dirty가 돼도 옛 확인 창이 되살아나지 않음
  act(() => mockPrevent.cb!({ data: { action: { type: 'GO_BACK' } } }));
  expect(modalOpen(t)).toBe(true);
  act(() => api.release(() => {})); // 저장 성공 → 복귀 경로
  expect(modalOpen(t)).toBe(false);
});
