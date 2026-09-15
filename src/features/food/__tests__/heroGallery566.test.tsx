/**
 * P-383(KB-566) — 음식 상세 히어로 갤러리.
 * 타이머 규칙은 useAutoSlide를 가짜 타이머로, 매핑은 adaptFoodImages로 실기 없이 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// HeroGallery 의존 표면 목(호이스팅) — isolateModules로 따로 부르면 React가 두 벌 로드돼
// 훅 디스패처가 null이 된다(실측). 정지 판단 자체는 실제 usePaused 경로를 탄다.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(() => Promise.resolve(true)) } }));
jest.mock('@/components', () => ({ CardPhoto: () => null }));

import { AccessibilityInfo } from 'react-native';
import { useAutoSlide, AUTO_SLIDE_MS } from '../useAutoSlide';
import { HeroGallery, QUIET_MS } from '../HeroGallery';
import { adaptFoodImages } from '@/lib/api/foodAdapter';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

/** 훅을 렌더해 최신 반환값을 밖으로 꺼내는 하네스 */
function mountSlide(count: number, paused = false) {
  const out: { current: ReturnType<typeof useAutoSlide> | null } = { current: null };
  function Probe({ c, p }: { c: number; p: boolean }) {
    out.current = useAutoSlide(c, p);
    return null;
  }
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Probe c={count} p={paused} />);
  });
  const rerender = (c: number, p: boolean) => act(() => tree.update(<Probe c={c} p={p} />));
  return { out, tree, rerender };
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useAutoSlide — 타이머 규칙', () => {
  it('1장 = 타이머를 만들지 않는다', () => {
    const spy = jest.spyOn(global, 'setInterval');
    const { out } = mountSlide(1);
    expect(spy).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS * 3); });
    expect(out.current!.index).toBe(0);
  });

  it('3장 = 2초마다 다음 장, 마지막 다음은 처음(순환)', () => {
    const { out } = mountSlide(3);
    expect(out.current!.index).toBe(0);
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); });
    expect(out.current!.index).toBe(1);
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); });
    expect(out.current!.index).toBe(2);
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); });
    expect(out.current!.index).toBe(0); // 순환
  });

  it('간격이 정확히 2000ms — 1999ms엔 안 넘어간다', () => {
    const { out } = mountSlide(3);
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS - 1); });
    expect(out.current!.index).toBe(0);
    act(() => { jest.advanceTimersByTime(1); });
    expect(out.current!.index).toBe(1);
  });

  it('사용자 스와이프 = 그 장으로 맞추고 2초를 새로 센다(직후 즉시 안 넘어감)', () => {
    const { out } = mountSlide(4);
    act(() => { jest.advanceTimersByTime(1500); }); // 다음 틱까지 500ms 남은 시점
    act(() => { out.current!.onUserSwipe(2); });
    expect(out.current!.index).toBe(2);
    act(() => { jest.advanceTimersByTime(500); }); // 옛 타이머였다면 여기서 넘어갔을 것
    expect(out.current!.index).toBe(2);
    act(() => { jest.advanceTimersByTime(1500); }); // 스와이프로부터 2초
    expect(out.current!.index).toBe(3);
  });

  it('언마운트 = clearInterval(타이머 누수 없음)', () => {
    const clear = jest.spyOn(global, 'clearInterval');
    const { tree } = mountSlide(3);
    act(() => tree.unmount());
    expect(clear).toHaveBeenCalled();
  });

  it('paused(reduce motion·blur·background) = 타이머 없음, 풀리면 재개', () => {
    const spy = jest.spyOn(global, 'setInterval');
    const { out, rerender } = mountSlide(3, true);
    expect(spy).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS * 2); });
    expect(out.current!.index).toBe(0);
    rerender(3, false); // 포커스 복귀 등
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); });
    expect(out.current!.index).toBe(1);
  });

  it('진행 중 paused로 바뀌면 멈춘다', () => {
    const { out, rerender } = mountSlide(3, false);
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); });
    expect(out.current!.index).toBe(1);
    rerender(3, true);
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS * 3); });
    expect(out.current!.index).toBe(1);
  });

  it('Codex P2(3R) — 옛 렌더에서 잡아 둔 onUserSwipe를 정지 후에 불러도 타이머가 안 생긴다', () => {
    const { out, rerender } = mountSlide(3, false);
    const staleSwipe = out.current!.onUserSwipe; // paused=false 시점의 클로저
    rerender(3, true); // 정지
    const setSpy = jest.spyOn(global, 'setInterval');
    act(() => { staleSwipe(2); }); // 뒤늦게 도착한 호출
    expect(setSpy).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS * 3); });
    expect(out.current!.index).toBe(2); // 안착은 반영, 자동 넘김은 없음
  });

  it('장수가 줄어 범위를 벗어나면 처음으로', () => {
    const { out, rerender } = mountSlide(4);
    act(() => { out.current!.onUserSwipe(3); });
    rerender(2, false);
    expect(out.current!.index).toBe(0);
  });
});

describe('adaptFoodImages — BE 필드명을 아는 유일한 곳(실계약 KB-565 PR #264)', () => {
  it('필드 부재(구 서버) = undefined → 화면이 현행 정적 히어로', () => {
    expect(adaptFoodImages({ imageRef: 'https://cdn/a.jpg' })).toBeUndefined();
  });

  it('갤러리 행 없음 = [] (서버가 imageRef로 지어내지 않음 → 정적 히어로 유지)', () => {
    expect(adaptFoodImages({ images: [] })).toEqual([]);
  });

  it('키는 url — 절대 URL만, 중복 제거', () => {
    expect(
      adaptFoodImages({
        images: [
          { url: 'https://cdn/p.jpg', isPrimary: true },
          { url: 'bare-filename.png', isPrimary: false }, // 호스트 없음 = 제외
          { url: 'https://cdn/b.jpg', isPrimary: false },
          { url: 'https://cdn/p.jpg', isPrimary: false }, // 중복 = 제외(첫 등장 유지)
          { imageUrl: 'https://cdn/old-key.jpg' }, // 옛 가정 키(imageUrl)는 계약에 없다 = 무시
          null,
        ],
      }),
    ).toEqual(['https://cdn/p.jpg', 'https://cdn/b.jpg']);
  });

  it('최종 계약 {url}만 와도 동일 — isPrimary 등 추가 키가 있든 없든 결과가 같다', () => {
    const onlyUrl = { images: [{ url: 'https://cdn/r.jpg' }, { url: 'https://cdn/s.jpg' }] };
    const withExtra = { images: [{ url: 'https://cdn/r.jpg', isPrimary: false }, { url: 'https://cdn/s.jpg', isPrimary: true, id: 9, sortOrder: 0 }] };
    expect(adaptFoodImages(onlyUrl)).toEqual(['https://cdn/r.jpg', 'https://cdn/s.jpg']);
    expect(adaptFoodImages(withExtra)).toEqual(adaptFoodImages(onlyUrl)); // 추가 키는 순서·결과에 영향 0
  });

  it('서버가 보낸 순서를 그대로 쓴다 — 재정렬 금지(isPrimary가 뒤에 와도 옮기지 않는다)', () => {
    // 서버가 대표 먼저 → sort_order → id로 이미 정렬해 보낸다. 클라가 isPrimary로 다시
    // 정렬하면 서버 정본 순서를 흐트러뜨린다 — 입력 순서가 곧 출력 순서여야 한다.
    expect(
      adaptFoodImages({
        images: [
          { url: 'https://cdn/1.jpg', isPrimary: false },
          { url: 'https://cdn/2.jpg', isPrimary: true },
          { url: 'https://cdn/3.jpg', isPrimary: false },
        ],
      }),
    ).toEqual(['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/3.jpg']);
  });
});

describe('소스 잠금 — 배선·금지 규칙', () => {
  it('상세 = 2장 이상일 때만 갤러리, 그 외 현행 CardPhoto 정적 경로 유지', () => {
    const src = read('src/app/food/[id]/index.tsx');
    expect(src).toContain('(food.images?.length ?? 0) >= 2 ? (');
    expect(src).toContain('<HeroGallery');
    expect(src).toContain('<CardPhoto uri={food.photoUrl} transition={200} borderRadius={0} />'); // 정적 경로 무변
  });

  it('갤러리 = 페이징·blur/background/reduce motion 정지·2장째부터 prefetch·도트는 View', () => {
    const g = read('src/features/food/HeroGallery.tsx');
    expect(g).toContain('pagingEnabled');
    expect(g).toContain('useFocusEffect');
    expect(g).toContain("AppState.addEventListener('change'");
    expect(g).toContain('isReduceMotionEnabled');
    expect(g).toContain('Image.prefetch(urls.slice(1))');
    expect(g).toContain('dot: { width: 6, height: 6, borderRadius: 3 }'); // 상태 전환은 색만(프레임 불변)
  });

  it('BE 필드명은 어댑터 밖에 새지 않는다', () => {
    for (const f of ['src/app/food/[id]/index.tsx', 'src/features/food/HeroGallery.tsx', 'src/features/food/useAutoSlide.ts']) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      expect(code).not.toMatch(/isPrimary|sortOrder/); // 계약 키는 어댑터 안에만
    }
  });
});

describe('HeroGallery 렌더 — 실제 정지 신호 배선', () => {
  const URLS = ['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/3.jpg'];
  const dots = (t: ReactTestRenderer) =>
    t.root.findAll((n) => typeof n.type === 'string' && /^hero-dot/.test(String(n.props?.testID)));
  const activeDot = (t: ReactTestRenderer) => dots(t).findIndex((n) => n.props.testID === 'hero-dot-active');

  const renderGallery = async (reduceMotion: boolean) => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<HeroGallery urls={URLS} />);
    });
    await act(async () => {
      await Promise.resolve(); // isReduceMotionEnabled 해소
    });
    return tree;
  };

  it('reduce motion 켜짐 = 자동 넘김 없음(수동만)', async () => {
    const tree = await renderGallery(true);
    expect(activeDot(tree)).toBe(0);
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS * 3); });
    expect(activeDot(tree)).toBe(0);
  });

  it('reduce motion 꺼짐 = 2초 뒤 도트가 다음 장으로', async () => {
    const tree = await renderGallery(false);
    expect(activeDot(tree)).toBe(0);
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); });
    expect(activeDot(tree)).toBe(1);
  });

  it('AppState 초기값이 null이어도 자동 넘김이 시작된다(네이티브 상수 도착 전 — 실측으로 잡은 결함)', () => {
    // 'active'와 같을 때만 활성으로 보면 null·'unknown'에서 영영 시작 안 한다 → 명시적 뒤로감만 정지
    const g = read('src/features/food/HeroGallery.tsx');
    expect(g).toContain("const isForeground = (s: string | null | undefined) => s !== 'background' && s !== 'inactive';");
    expect(g).not.toContain("AppState.currentState === 'active'");
  });

  it('Codex P2(8R) — 동작 줄이기 조회가 끝나기 전엔 자동 넘김이 시작되지 않는다', async () => {
    let resolveRM!: (v: boolean) => void;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>((r) => { resolveRM = r; }));
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<HeroGallery urls={URLS} />); });
    // 틱은 하나씩 따로 진행한다 — 3장에 3틱을 몰면 순환해 0으로 돌아와 '안 움직임'과 구분이 안 된다
    for (let k = 0; k < 2; k++) {
      act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); }); // 조회 미해결 상태로 시간 경과
      expect(activeDot(tree)).toBe(0); // 설정을 모르는 동안 움직이지 않는다
    }
    await act(async () => { resolveRM(false); await Promise.resolve(); }); // 꺼져 있음이 확인됨
    act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); });
    expect(activeDot(tree)).toBe(1); // 그제서야 시작
  });

  it('Codex P2(8R) — 동작 줄이기 조회가 실패하면 계속 정지(애니메이션을 먼저 내보내지 않는다)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('unavailable'));
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<HeroGallery urls={URLS} />); });
    await act(async () => { await Promise.resolve(); });
    for (let k = 0; k < 2; k++) {
      act(() => { jest.advanceTimersByTime(AUTO_SLIDE_MS); }); // 순환 착시 방지 — 틱마다 확인
      expect(activeDot(tree)).toBe(0);
    }
  });

  it('도트 = 장수만큼·현재 장만 활성(1개)', async () => {
    const tree = await renderGallery(false);
    expect(dots(tree)).toHaveLength(3);
    expect(dots(tree).filter((d) => d.props.testID === 'hero-dot-active')).toHaveLength(1);
  });
});

describe('드래그 — 누르면 멈추고, 손 뗀 뒤 스크롤이 멈춘 자리에서 재개(이벤트 분류 없음)', () => {
  const URLS = ['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/3.jpg', 'https://cdn/4.jpg'];
  const WIDTH = 375;
  const dotIdx = (t: ReactTestRenderer) =>
    t.root
      .findAll((n) => typeof n.type === 'string' && /^hero-dot/.test(String(n.props?.testID)))
      .findIndex((n) => n.props.testID === 'hero-dot-active');
  const list = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.props?.onScrollBeginDrag === 'function')[0];
  const ev = (x: number) => ({ nativeEvent: { contentOffset: { x, y: 0 } } });
  const touchEv = (remaining: number) => ({ nativeEvent: { touches: Array.from({ length: remaining }, () => ({})) } });
  const tick = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  const renderIt = async () => {
    const RN = require('react-native') as typeof import('react-native');
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: WIDTH, height: 800, scale: 2, fontScale: 1 });
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<HeroGallery urls={URLS} />); });
    await act(async () => { await Promise.resolve(); });
    return tree;
  };

  it('Codex P2(2R) — 틱 직전에 드래그를 시작하면 누르고 있는 동안 넘어가지 않는다', async () => {
    const tree = await renderIt();
    tick(AUTO_SLIDE_MS - 100);
    act(() => { list(tree).props.onScrollBeginDrag(ev(0)); });
    tick(AUTO_SLIDE_MS * 3);
    expect(dotIdx(tree)).toBe(0);
  });

  it('손 뗀 뒤 스냅이 진행되는 동안은 재개하지 않고, 스크롤이 멈춘 장에서 재개 → 2초 뒤 다음 장', async () => {
    const tree = await renderIt();
    act(() => { list(tree).props.onScrollBeginDrag(ev(0)); });
    act(() => { list(tree).props.onScrollEndDrag(ev(WIDTH * 0.4)); }); // 0.4장에서 놓음(반올림하면 0 — 틀린 값)
    act(() => { list(tree).props.onScroll(ev(WIDTH * 0.7)); }); // 스냅 진행
    tick(QUIET_MS - 50);
    act(() => { list(tree).props.onScroll(ev(WIDTH)); }); // 스냅 도착 — 대기 연장
    tick(QUIET_MS - 50);
    expect(dotIdx(tree)).toBe(0); // 아직 스크롤이 멈춘 지 QUIET_MS가 안 됨
    tick(50);
    expect(dotIdx(tree)).toBe(1); // Codex P2(3R): 손 뗀 위치(0.4→0)가 아니라 멈춘 장
    tick(AUTO_SLIDE_MS - 1);
    expect(dotIdx(tree)).toBe(1); // 재개 직후 2초는 정지
    tick(1);
    expect(dotIdx(tree)).toBe(2);
  });

  it('관성·스크롤 이벤트가 전혀 없어도(경계에서 놓음) 영영 멈추지 않는다', async () => {
    const tree = await renderIt();
    act(() => { list(tree).props.onScrollBeginDrag(ev(0)); });
    act(() => { list(tree).props.onScrollEndDrag(ev(WIDTH)); }); // 이후 이벤트 0
    tick(QUIET_MS);
    expect(dotIdx(tree)).toBe(1);
    tick(AUTO_SLIDE_MS);
    expect(dotIdx(tree)).toBe(2);
  });

  it('Codex P2(4R) — 스로틀된 onScroll보다 최신인 드래그 종료 오프셋을 쓴다', async () => {
    const tree = await renderIt();
    act(() => { list(tree).props.onScrollBeginDrag(ev(0)); });
    act(() => { list(tree).props.onScroll(ev(WIDTH * 0.45)); }); // 오래된 스로틀 값(→0)
    act(() => { list(tree).props.onScrollEndDrag(ev(WIDTH)); }); // 실제로 놓은 곳 = 1번 장, 이후 이벤트 없음
    tick(QUIET_MS);
    expect(dotIdx(tree)).toBe(1);
  });

  it('Codex P2(6R) — 누르고 있는 중 도착한 타이머 애니메이션의 늦은 이벤트는 재개를 일으키지 않는다', async () => {
    const tree = await renderIt();
    tick(AUTO_SLIDE_MS); // 타이머로 1번 장 애니메이션 시작
    expect(dotIdx(tree)).toBe(1);
    act(() => { list(tree).props.onScrollBeginDrag(ev(WIDTH * 0.6)); }); // 애니메이션 도중 잡음
    act(() => { list(tree).props.onScroll(ev(WIDTH)); }); // 타이머 스크롤의 늦은 이벤트
    act(() => { list(tree).props.onMomentumScrollEnd?.(ev(WIDTH)); }); // (핸들러 자체가 없다 — 분류 불필요)
    tick(AUTO_SLIDE_MS * 3); // 손가락은 계속 누르고 있음
    expect(dotIdx(tree)).toBe(1); // 재개되어 끌려가지 않았다
  });

  it('Codex P2(3R) — 재개 대기 중 정지(background)되면 타이머를 되살리지 않는다', async () => {
    let appListener: ((st: string) => void) | undefined;
    const RN = require('react-native') as typeof import('react-native');
    jest.spyOn(RN.AppState, 'addEventListener').mockImplementation(((_: string, cb: (st: string) => void) => {
      appListener = cb;
      return { remove: jest.fn() };
    }) as never);
    const tree = await renderIt();
    expect(appListener).toBeDefined();
    act(() => { list(tree).props.onScrollBeginDrag(ev(0)); });
    act(() => { list(tree).props.onScrollEndDrag(ev(WIDTH)); });
    act(() => { appListener!('background'); }); // 대기 창 안에서 백그라운드
    const setSpy = jest.spyOn(global, 'setInterval');
    tick(QUIET_MS); // 재개 시점 도래 — 옛 렌더 클로저가 start를 부른다
    expect(setSpy.mock.calls.filter((c) => c[1] === AUTO_SLIDE_MS)).toHaveLength(0);
    expect(dotIdx(tree)).toBe(1); // 멈춘 장은 반영
    tick(AUTO_SLIDE_MS * 3);
    expect(dotIdx(tree)).toBe(1);
    act(() => { appListener!('active'); });
    tick(AUTO_SLIDE_MS);
    expect(dotIdx(tree)).toBe(2);
  });

  it('새 드래그가 재개 대기를 취소한다(놓았다가 곧바로 다시 잡음)', async () => {
    const tree = await renderIt();
    act(() => { list(tree).props.onScrollBeginDrag(ev(0)); });
    act(() => { list(tree).props.onScrollEndDrag(ev(WIDTH)); });
    tick(QUIET_MS - 100);
    act(() => { list(tree).props.onScrollBeginDrag(ev(WIDTH)); }); // 다시 잡음
    tick(QUIET_MS * 4);
    expect(dotIdx(tree)).toBe(0); // 재개 안 됨(아직 누르고 있다)
  });

  it('Codex P2(7R) — 손가락만 올려 둬도(드래그 임계 전) 자동 넘김이 멈춘다', async () => {
    const tree = await renderIt();
    tick(AUTO_SLIDE_MS - 100);
    act(() => { list(tree).props.onTouchStart(); }); // 드래그 인식 없이 닿기만 함
    tick(AUTO_SLIDE_MS * 3);
    expect(dotIdx(tree)).toBe(0); // 손 아래에서 넘어가지 않았다
  });

  it('Codex P2(7R) — 재개 대기 중 다시 닿으면(드래그 없이) 대기가 취소된다', async () => {
    const tree = await renderIt();
    act(() => { list(tree).props.onScrollBeginDrag(ev(0)); });
    act(() => { list(tree).props.onScrollEndDrag(ev(WIDTH)); }); // 재개 대기 시작
    tick(QUIET_MS - 100);
    act(() => { list(tree).props.onTouchStart(); }); // 임계 전 터치 — onScrollBeginDrag는 안 온다
    tick(QUIET_MS * 4 + AUTO_SLIDE_MS * 2);
    expect(dotIdx(tree)).toBe(0); // 재개·넘김 없음(누르고 있다)
  });

  it('드래그 없이 닿았다 떼면 스크롤이 멈춘 지금 장에서 2초 뒤 재개', async () => {
    const tree = await renderIt();
    act(() => { list(tree).props.onTouchStart(); });
    act(() => { list(tree).props.onTouchEnd(touchEv(0)); }); // 남은 손가락 0
    tick(QUIET_MS);
    expect(dotIdx(tree)).toBe(0); // 제자리
    tick(AUTO_SLIDE_MS);
    expect(dotIdx(tree)).toBe(1); // 재개됨
  });

  it('Codex P2(8R) — 두 손가락 중 하나만 떼면 아직 누르고 있는 것(재개 안 함)', async () => {
    const tree = await renderIt();
    act(() => { list(tree).props.onTouchStart(); }); // 첫 손가락
    act(() => { list(tree).props.onTouchStart(); }); // 둘째 손가락
    act(() => { list(tree).props.onTouchEnd(touchEv(1)); }); // 한 손가락 뗌 — 1개 남음
    tick(QUIET_MS + AUTO_SLIDE_MS * 3);
    expect(dotIdx(tree)).toBe(0); // 남은 손가락 아래에서 넘어가지 않음
    act(() => { list(tree).props.onTouchEnd(touchEv(0)); }); // 마지막 손가락 뗌
    tick(QUIET_MS + AUTO_SLIDE_MS);
    expect(dotIdx(tree)).toBe(1); // 이제 재개
  });

  it('터치가 네이티브 스크롤에 뺏겨 취소돼도(onTouchCancel) 재개된다', async () => {
    const tree = await renderIt();
    act(() => { list(tree).props.onTouchStart(); });
    act(() => { list(tree).props.onTouchCancel(); });
    tick(QUIET_MS + AUTO_SLIDE_MS);
    expect(dotIdx(tree)).toBe(1);
  });

  it('Codex P2(5R) — 마지막→처음 순환은 즉시 이동(중간 장을 거꾸로 훑지 않는다)', async () => {
    const RN = require('react-native') as typeof import('react-native');
    const tree = await renderIt();
    const inst = tree.root.findByType(RN.FlatList).instance as { scrollToOffset: (p: unknown) => void };
    const scrollSpy = jest.spyOn(inst, 'scrollToOffset').mockImplementation(() => {});
    // 틱은 실제로 2초 간격으로 따로 온다 — 한 act에 몰면 React가 한 렌더로 묶어 중간 스크롤이 사라진다
    for (let k = 0; k < 4; k++) tick(AUTO_SLIDE_MS);
    expect(scrollSpy.mock.calls.map((c) => c[0])).toEqual([
      { offset: WIDTH * 1, animated: true },
      { offset: WIDTH * 2, animated: true },
      { offset: WIDTH * 3, animated: true },
      { offset: 0, animated: false },
    ]);
  });

  it('구조 잠금 — 사용자/타이머 이벤트 분류 코드가 되살아나지 않는다', () => {
    const g = read('src/features/food/HeroGallery.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(g).not.toContain('onMomentumScrollEnd');
    expect(g).not.toContain('momentumRef');
    expect(g).toContain('onTouchStart={press}'); // 7R: 닿는 순간 정지
    expect(g).toContain('onScrollBeginDrag={press}');
    expect(g).toContain('onScrollEndDrag={onDragEnd}');
  });
});
