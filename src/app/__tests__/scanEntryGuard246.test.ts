/**
 * P-246(KB-29): 스캔 진입 연타 가드 — push → **navigate** 전환(공용 장치 = 라우터).
 * 연타로 /scan이 스택에 여러 장 쌓여 X를 눌러도 또 나오는 레이스(예진 실기).
 * navigate는 StackRouter NAVIGATE 계약상 **현재 라우트와 같으면 push 대신 기존으로
 * 이동** — 진입로별 개별 가드(setTimeout 등) 없이 5표면 전부 한 원리로 커버.
 * 이 스위트 = ① 그 계약을 벤더 StackRouter로 실측(라이브러리 업데이트 회귀 감지)
 * ② 5표면 배선 소스 잠금(push('/scan') 잔존 0).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StackRouter, StackActions } = require('expo-router/build/react-navigation/routers/StackRouter');

type RouterState = {
  index: number;
  routes: { name: string; key: string }[];
};

function makeRouter() {
  const router = StackRouter({});
  const options = { routeNames: ['(tabs)', 'scan'], routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options) as RouterState;
  const dispatch = (action: unknown) => {
    const next = router.getStateForAction(state, action, options);
    if (next != null) state = next as RouterState;
    return state;
  };
  return { get state() { return state; }, dispatch };
}

const NAVIGATE_SCAN = { type: 'NAVIGATE', payload: { name: 'scan' } };

it('연타(NAVIGATE 2연속) = /scan 1장 — 현재 라우트와 같으면 push 안 됨(계약 실측)', () => {
  const r = makeRouter();
  r.dispatch(NAVIGATE_SCAN);
  r.dispatch(NAVIGATE_SCAN); // 두 번째 탭 — 조용히 기존으로
  r.dispatch(NAVIGATE_SCAN); // 세 번째도
  expect(r.state.routes.filter((x) => x.name === 'scan')).toHaveLength(1);
  expect(r.state.routes[r.state.index].name).toBe('scan');
});

it('대조군: PUSH 2연속 = 2장(사고 재현) — navigate 전환이 곧 가드인 이유', () => {
  const r = makeRouter();
  r.dispatch(StackActions.push('scan'));
  r.dispatch(StackActions.push('scan'));
  expect(r.state.routes.filter((x) => x.name === 'scan')).toHaveLength(2);
});

it('정상 재진입 — 닫고(GO_BACK) 다시 NAVIGATE = 새로 열림', () => {
  const r = makeRouter();
  r.dispatch(NAVIGATE_SCAN);
  r.dispatch({ type: 'GO_BACK' }); // X로 닫기
  expect(r.state.routes.some((x) => x.name === 'scan')).toBe(false);
  r.dispatch(NAVIGATE_SCAN); // 재진입
  expect(r.state.routes[r.state.index].name).toBe('scan');
});

it('배선 소스 잠금 — 진입 5표면 전부 navigate·push("/scan") 잔존 0(git 전수)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execFileSync } = require('child_process');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('fs');
  const SURFACES = [
    'src/features/food/FoodExplorer.tsx', // KB-430 후속: 홈 스캔 버튼 = FoodExplorer 이동 // 홈 CTA 2곳
    'src/app/(tabs)/_layout.tsx', // 탭바 스캔 버튼
    'src/app/profile/ranking.tsx', // 랭킹 빈 상태
    'src/app/community/compose.tsx', // 픽커 스캔 CTA(P-245)
  ];
  for (const f of SURFACES) {
    expect(readFileSync(f, 'utf8')).toContain("navigate('/scan'");
  }
  // 전수: 어느 파일에서든 push('/scan')이 다시 생기면 가드 밖(재발) — CI에서 잡는다
  const files = (execFileSync('git', ['ls-files', '*.tsx', '*.ts'], { encoding: 'utf8' }) as string)
    .split('\n')
    .filter((f: string) => f && !f.includes('__tests__'));
  const offenders = files.filter((f: string) => (readFileSync(f, 'utf8') as string).includes("push('/scan'"));
  expect(offenders).toEqual([]);
});
