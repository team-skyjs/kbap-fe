/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-603(P-418) — `react-hooks/set-state-in-effect` 소진: effect에서 세우던 "리셋" 상태를 파생값·
 * 렌더 중 비교로 옮긴다. 이 파일은 **동작 동일성 잠금** — 수정 전 초록, 수정 후에도 초록이어야 한다.
 * 잠그는 성질(전부 "기준이 바뀌면 리셋"):
 *  - VersionGate(게이팅): 스토어 열기 실패 문구는 게이트가 바뀌면 사라진다 · 옛 시도의 늦은 결과는 버린다
 *  - AvoidTile(원격 이미지 표면): 소스가 바뀌면 스켈레톤 복귀 · 체인 인덱스 리셋
 *  - useAutoSlide: 장수가 줄어 index가 범위를 벗어나면 0, 다음 틱은 1(두 틱 연속 0 금지)
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
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }) }));
const mockGate = jest.fn();
jest.mock('@/lib/versionGate', () => ({ useVersionGate: () => mockGate(), startVersionGate: jest.fn() }));
const mockOpen = jest.fn();
jest.mock('@/lib/openExternal', () => ({ openStoreLink: (...a: unknown[]) => mockOpen(...a), openAppSettings: jest.fn() }));

import { VersionGateOverlay } from '../VersionGate';
import { AvoidTile } from '../AvoidTile';
import { useAutoSlide, AUTO_SLIDE_MS } from '@/features/food/useAutoSlide';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id);

describe('VersionGate — 스토어 실패 문구는 게이트 기준으로 리셋', () => {
  const blocked = (storeUrl: string) => ({ mode: 'blocked', storeUrl, latestVersion: '9.9.9' });
  const press = (t: ReactTestRenderer) => {
    const btn = byId(t, 'version-gate')[0].findAll((n) => typeof n.props?.onPress === 'function')[0];
    act(() => btn.props.onPress());
  };
  beforeEach(() => {
    mockGate.mockReset();
    mockOpen.mockReset();
  });

  it('열기 실패 → 인라인 실패 문구 · 게이트(storeUrl)가 바뀌면 사라진다', async () => {
    mockGate.mockReturnValue(blocked('https://store/a'));
    mockOpen.mockResolvedValue(false);
    const tree = render(<VersionGateOverlay />);
    press(tree);
    await act(async () => {});
    expect(byId(tree, 'version-gate-store-error').length).toBeGreaterThan(0);

    mockGate.mockReturnValue(blocked('https://store/b'));
    act(() => tree.update(<VersionGateOverlay />));
    expect(byId(tree, 'version-gate-store-error')).toHaveLength(0);
  });

  it('옛 시도의 늦은 실패는 게이트가 바뀐 뒤 도착하면 버린다', async () => {
    mockGate.mockReturnValue(blocked('https://store/a'));
    let resolve!: (ok: boolean) => void;
    mockOpen.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));
    const tree = render(<VersionGateOverlay />);
    press(tree);
    mockGate.mockReturnValue(blocked('https://store/b'));
    act(() => tree.update(<VersionGateOverlay />));
    await act(async () => {
      resolve(false);
    });
    expect(byId(tree, 'version-gate-store-error')).toHaveLength(0);
  });

  it('게이트 A→B→A로 되돌아와도 옛 실패 문구가 되살아나지 않는다(전환 리셋 — 값 키 파생 금지)', async () => {
    mockGate.mockReturnValue(blocked('https://store/a'));
    mockOpen.mockResolvedValue(false);
    const tree = render(<VersionGateOverlay />);
    press(tree);
    await act(async () => {});
    expect(byId(tree, 'version-gate-store-error').length).toBeGreaterThan(0);
    mockGate.mockReturnValue(blocked('https://store/b'));
    act(() => tree.update(<VersionGateOverlay />));
    mockGate.mockReturnValue(blocked('https://store/a'));
    act(() => tree.update(<VersionGateOverlay />));
    expect(byId(tree, 'version-gate-store-error')).toHaveLength(0);
  });

  /* Codex #208 3R — "새 게이트 렌더 뒤·세대 effect 전"에 옛 시도가 끝나는 창: 실패를 **시도가 속한 게이트 키**로 저장하고
     현재 키와 같을 때만 표시한다(failedFor === gateKey — 렌더 데이터, effect 타이밍 무관). 이 창은 act 아래에선 열리지 않는다
     (동기 레인 렌더의 passive effect는 커밋 직후 동기 flush — update 안/밖·resolve 순서 3가지 실측 전부 2d6542a에서도 초록)
     → 유닛으로 red를 만들 수 없어 소스 잠금(linkingFallback541)으로 형태를 고정한다. */
  it('같은 게이트에서 재시도 성공 → 실패 문구 소거(대조군: 실패 표시 경로가 살아 있다)', async () => {
    mockGate.mockReturnValue(blocked('https://store/a'));
    mockOpen.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const tree = render(<VersionGateOverlay />);
    press(tree);
    await act(async () => {});
    expect(byId(tree, 'version-gate-store-error').length).toBeGreaterThan(0);
    press(tree);
    await act(async () => {});
    expect(byId(tree, 'version-gate-store-error')).toHaveLength(0);
  });
});

describe('AvoidTile — 소스 기준 리셋', () => {
  const tile = (code: string) => <AvoidTile code={code} abbr="XX" tint="rgba(0,0,0,0.1)" />;
  it('로드 완료 뒤 code가 바뀌면 스켈레톤 복귀(새 사진을 옛 loaded가 가리지 않는다)', () => {
    const tree = render(tile('EGG'));
    act(() => byId(tree, 'avtile-img-EGG')[0].props.onLoad());
    expect(byId(tree, 'avtile-skel-EGG')).toHaveLength(0);
    act(() => tree.update(tile('MILK')));
    expect(byId(tree, 'avtile-skel-MILK').length).toBeGreaterThan(0);
  });

  it('EGG 로드 완료 → MILK → 다시 EGG = 스켈레톤 복귀(전이마다 리셋 — 옛 loaded 잔존 금지)', () => {
    const tree = render(tile('EGG'));
    act(() => byId(tree, 'avtile-img-EGG')[0].props.onLoad());
    act(() => tree.update(tile('MILK')));
    act(() => tree.update(tile('EGG')));
    expect(byId(tree, 'avtile-skel-EGG').length).toBeGreaterThan(0);
  });

  it('체인 2단으로 내려간 뒤 code가 바뀌면 새 체인의 선두(누끼)부터', () => {
    const tree = render(tile('EGG'));
    const first = byId(tree, 'avtile-img-EGG')[0].props.source as string;
    act(() => byId(tree, 'avtile-img-EGG')[0].props.onError());
    expect(byId(tree, 'avtile-img-EGG')[0].props.source).not.toBe(first); // 2단
    act(() => tree.update(tile('MILK')));
    expect(byId(tree, 'avtile-img-MILK')[0].props.source).toContain('ingredients-cut/milk'); // 선두 리셋
    expect(byId(tree, 'avtile-img-MILK')[0].props.contentFit).toBe('contain'); // isCutout
  });
});

describe('useAutoSlide — 장수 축소 시 index 클램프', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('index 3에서 count 2로 줄면 0 · 다음 틱은 1(0 두 번 금지)', () => {
    const out: { current: ReturnType<typeof useAutoSlide> | null } = { current: null };
    function Probe({ c }: { c: number }) {
      out.current = useAutoSlide(c, false);
      return null;
    }
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Probe c={5} />);
    });
    act(() => jest.advanceTimersByTime(AUTO_SLIDE_MS * 3));
    expect(out.current!.index).toBe(3);
    act(() => tree.update(<Probe c={2} />));
    expect(out.current!.index).toBe(0);
    act(() => jest.advanceTimersByTime(AUTO_SLIDE_MS));
    expect(out.current!.index).toBe(1);
  });

  it('축소 뒤 정지 상태에서 장수가 다시 늘어도 옛 index(3)로 되돌아가지 않는다(저장값도 0 — Codex #208)', () => {
    const out: { current: ReturnType<typeof useAutoSlide> | null } = { current: null };
    function Probe({ c, p }: { c: number; p: boolean }) {
      out.current = useAutoSlide(c, p);
      return null;
    }
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Probe c={5} p={false} />);
    });
    act(() => jest.advanceTimersByTime(AUTO_SLIDE_MS * 3));
    expect(out.current!.index).toBe(3);
    act(() => tree.update(<Probe c={2} p={true} />)); // 축소 + 정지(타이머 없음)
    expect(out.current!.index).toBe(0);
    act(() => tree.update(<Probe c={5} p={true} />)); // 다시 늘어남 — 틱 없이
    expect(out.current!.index).toBe(0);
  });
});
