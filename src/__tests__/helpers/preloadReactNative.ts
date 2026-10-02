/**
 * KB-698 — 전체 jest에서 부하 때 5000ms 타임아웃으로 흔들리던 스위트의 공통 원인.
 * react-native의 index는 컴포넌트·모듈을 **지연 export(게터)** 로 내보낸다. 화면의 첫 렌더가 그 게터를 건드리면 실제 모듈을 require하고,
 * jest 변환 캐시가 없으면(캐시 키에 파일 경로가 들어가 **새 워크트리·CI는 항상 콜드**) babel 변환까지 **첫 테스트의 타임아웃 안에서** 치른다.
 * 실측(heroGallery566 첫 테스트): 캐시 따뜻 114~156ms · 콜드 1445ms — 어느 테스트가 첫 번째든 그 테스트가 낸다. 부하(×3~5)면 5000ms를 넘는다.
 * → `beforeAll(preloadReactNative, PRELOAD_TIMEOUT_MS)`로 1회 비용을 테스트 밖으로 옮긴다(콜드 1~2.7s, 따뜻 0.2~0.3s).
 * 테스트가 검증하는 내용은 바꾸지 않는다(모듈을 먼저 불러올 뿐).
 */
export const PRELOAD_TIMEOUT_MS = 60_000;

export function preloadReactNative(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 게터를 하나씩 건드리려고 모듈 객체 그대로
  const RN = require('react-native') as Record<string, unknown>;
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); // 지원 중단 게터(ProgressBarAndroid 등)의 경고 — 소음만
  try {
    for (const k of Object.keys(RN)) {
      try {
        void RN[k];
      } catch {
        /* 테스트 환경에 없는 네이티브 모듈 — 건너뜀 */
      }
    }
    // 컴포넌트 안의 인라인 require(ScrollView 고정 헤더·리스트 셀·Modal 등)는 **첫 렌더** 때 불린다 — 대표 트리를 한 번 그렸다 지운다
    renderOnce(RN);
  } finally {
    warn.mockRestore();
  }
}

function renderOnce(RN: Record<string, unknown>) {
  /* eslint-disable @typescript-eslint/no-require-imports -- 예열용 일회 트리 */
  const React = require('react') as typeof import('react');
  const { create, act } = require('react-test-renderer') as typeof import('react-test-renderer');
  const h = React.createElement;
  const C = RN as any;
  const tree = h(C.View, null,
    h(C.ScrollView, { stickyHeaderIndices: [0] }, h(C.Text, null, 'a'), h(C.TextInput, null), h(C.Image, { source: { uri: 'x' } })),
    h(C.FlatList, { data: [1, 2], renderItem: () => h(C.Pressable, null, h(C.Text, null, 'b')), keyExtractor: String }),
    h(C.SectionList, { sections: [{ title: 's', data: [1] }], renderItem: () => h(C.Text, null, 'c'), renderSectionHeader: () => h(C.Text, null, 'h') }),
    h(C.Modal, { visible: true }, h(C.KeyboardAvoidingView, null, h(C.ActivityIndicator, null), h(C.Switch, null))),
    h(C.TouchableOpacity, null, h(C.Text, null, 'd')),
    h(C.RefreshControl, { refreshing: false }),
  );
  /* eslint-enable @typescript-eslint/no-require-imports */
  let r: ReturnType<typeof create> | undefined;
  try {
    act(() => {
      r = create(tree);
    });
    act(() => r?.unmount());
  } catch {
    /* 예열 실패는 무시 — 테스트 자체가 같은 모듈을 다시 불러온다 */
  }
}
