/**
 * KB-992 'AI 추정' — 어댑터(false-safe 잠금) + 폴링 훅(1초·15초 상한·done·실패·떠나면 멈춤·scanId 리셋).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { adaptPendingItem, mapPriceOptions, photoOnlyResults, spiceRank } from '@/lib/api/scanAdapter';
import type { ScanResultWire } from '@/lib/api/scanTypes';
import { PENDING_CAP_MS, PENDING_STATE_TTL_MS, useScanPending } from '../useScanPending';

const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'en' }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));


const wire = (p: Partial<ScanResultWire>): ScanResultWire => ({ matched: false, riskLevel: 'UNKNOWN', name: 'x', ...p });
const item = (pendingId: string, extra: Record<string, unknown> = {}) => ({ pendingId, kind: 'DISH', name: pendingId, riskLevel: 'CAUTION', aiEstimated: true, ...extra });

describe('어댑터', () => {
  it('P-616(S-970): notMenu = 엄격 true만(부재·이상값 = 일반 판정 줄 — 숨김보다 남는 쪽)', () => {
    const out = photoOnlyResults([wire({ notMenu: true }), wire({ notMenu: false }), wire({}), wire({ notMenu: 'yes' as never })]);
    expect(out.map((o) => o.notMenu)).toEqual([true, false, false, false]);
  });
  it('KB-1006: 맵기 ceil(s/2) → 고추 1~5 · 0·-1·결측 = 0 / 수량 옵션 2개 이상만(이상값 칸 버림) / 사진 상태', () => {
    expect([10, 9, 3, 1, 0, -1, null, undefined, 99].map(spiceRank)).toEqual([5, 5, 2, 1, 0, 0, 0, 0, 5]);
    expect(mapPriceOptions([{ label: '10개', priceKrw: 11000 }, { label: '20개', priceKrw: 22000 }])).toEqual([{ label: '10개', priceKrw: 11000 }, { label: '20개', priceKrw: 22000 }]);
    expect(mapPriceOptions([{ label: '10개', priceKrw: 11000 }, { label: '', priceKrw: 22000 }])).toBeNull();
    expect(mapPriceOptions(null)).toBeNull();
    const a = adaptPendingItem(item('p1', { avoidances: ['EGG'], estimatedCodes: ['FLOUR', 'EGG'], spiciness: 6, priceKrw: 9000, imageStatus: 'READY', imageUrl: 'https://cdn/a.webp', aiGeneratedImage: true }) as never);
    expect([a.spice, a.priceKrw, a.image, a.imageUrl, a.aiImage]).toEqual([3, 9000, 'ready', 'https://cdn/a.webp', true]);
    expect(a.estimatedCodes).toEqual(['EGG', 'FLOUR']); // 겹친 코드는 전체 목록에서 빠지지 않는다
    expect(adaptPendingItem(item('p2', { imageStatus: 'READY', imageUrl: null }) as never).image).toBe('none'); // URL 없는 READY = 기본 이미지
    expect(adaptPendingItem(item('p3') as never).image).toBe('none'); // 구 서버
  });
  it('pendingId = 미매칭·비대체만 통과 (매칭·대체·빈 문자열 = null)', () => {
    const out = photoOnlyResults([
      wire({ pendingId: 'p1' }),
      wire({ matched: true, riskLevel: 'SAFE', pendingId: 'p2' }),
      wire({ substituted: true, pendingId: 'p3' }),
      wire({ pendingId: '  ' }),
      wire({}),
    ]);
    expect(out.map((o) => o.pendingId)).toEqual(['p1', null, null, null, null]);
  });

  it('위험도: CAUTION·DANGER = caution · UNKNOWN(S-959 확정)·SAFE·UNABLE·미지·결측 = unable (SAFE 렌더 0, 헌법 III)', () => {
    expect(adaptPendingItem({ ...item('a'), riskLevel: 'UNKNOWN' } as never).risk).toBe('unable');
    const r = (riskLevel: unknown) => adaptPendingItem({ ...item('a'), riskLevel } as never).risk;
    expect(r('CAUTION')).toBe('caution');
    expect(r('DANGER')).toBe('caution');
    expect(r('SAFE')).toBe('unable');
    expect(r('UNABLE')).toBe('unable');
    expect(r('WHATEVER')).toBe('unable');
    expect(r(undefined)).toBe('unable');
  });

  it('kind: NOT_FOOD = notFood · DRINK = drink · 그 밖 = dish(숨김보다 표시) · 회피 재료 = 코드 배열(S-959) — 빈 값·중복 버림, 초안 객체 모양은 overlapped만', () => {
    expect(adaptPendingItem(item('a', { kind: 'NOT_FOOD' }) as never).kind).toBe('notFood');
    expect(adaptPendingItem(item('a', { kind: 'DRINK' }) as never).kind).toBe('drink');
    expect(adaptPendingItem(item('a', { kind: '??' }) as never).kind).toBe('dish');
    expect(adaptPendingItem(item('a', { avoidances: ['EGG', 'MILK', ' ', 'EGG'] }) as never).avoidCodes).toEqual(['EGG', 'MILK']);
    const a = adaptPendingItem(item('a', { avoidances: [{ code: 'EGG', name: 'Egg', overlapped: true, riskLevel: 'SAFE' }, { code: 'MILK', overlapped: false }] }) as never);
    expect(a.avoidCodes).toEqual(['EGG']);
  });

  it('서버 #565 filled: true = estimated false · false = true(내용 무관 — 설명 없는 UNKNOWN 추정도 추정으로)', () => {
    const base = { pendingId: 'p9', kind: 'DISH', name: '김치전', koreanName: '김치전', description: null, riskLevel: 'UNKNOWN', avoidances: [], aiEstimated: true };
    expect(adaptPendingItem({ ...base, filled: true, description: 'x' } as never).estimated).toBe(false);
    expect(adaptPendingItem({ ...base, filled: false } as never).estimated).toBe(true);
  });

  it('filled 부재(배포 전 서버) 폴백: DISH·UNKNOWN·설명 null·재료 0 = estimated false · 설명·재료·CAUTION 중 하나라도 있으면 true', () => {
    const filler = { pendingId: 'p9', kind: 'DISH', name: '김치전', koreanName: '김치전', description: null, riskLevel: 'UNKNOWN', avoidances: [], aiEstimated: true };
    expect(adaptPendingItem(filler as never).estimated).toBe(false);
    expect(adaptPendingItem({ ...filler, description: 'Pancake' } as never).estimated).toBe(true);
    expect(adaptPendingItem({ ...filler, avoidances: ['EGG'] } as never).estimated).toBe(true);
    expect(adaptPendingItem({ ...filler, riskLevel: 'CAUTION' } as never).estimated).toBe(true);
  });
});

describe('useScanPending', () => {
  let out: { items: { pendingId: string; kind: string; risk: string }[]; polling: boolean };
  function Probe({ id, active }: { id: string | null; active: boolean }) {
    out = useScanPending(id, active);
    return null;
  }
  let tree: ReactTestRenderer;
  const mount = (id: string | null, active = true) => act(() => { tree = renderer.create(<Probe id={id} active={active} />); });
  const update = (id: string | null, active: boolean) => act(() => tree.update(<Probe id={id} active={active} />));
  const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); await Promise.resolve(); }); };
  const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

  beforeEach(() => {
    jest.useFakeTimers();
    mockGet.mockReset();
    mockTrack.mockReset();
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.useRealTimers();
  });

  it('1초 간격 · 도착분 누적(같은 pendingId 중복 0) · done = 종료 · 도착마다 scan_ai_item_filled{kind}', async () => {
    mockGet
      .mockResolvedValueOnce({ items: [], done: false })
      .mockResolvedValueOnce({ items: [item('p1')], done: false })
      .mockResolvedValueOnce({ items: [item('p1'), item('p2', { kind: 'NOT_FOOD' })], done: true });
    mount('s1');
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/api/scans/s1/pending?lang=en');
    // QA #428: 스캔 v2 컨트롤러는 2.0+ — 기본 1.1이면 dev 404. POST /scans와 같은 버전 헤더가 실려야 한다
    expect(mockGet.mock.calls[0][1]).toEqual({ headers: { 'X-API-Version': '3.0' } });
    await advance(999);
    expect(mockGet).toHaveBeenCalledTimes(1);
    await advance(1);
    await flush();
    expect(out.items.map((i) => i.pendingId)).toEqual(['p1']);
    await advance(1000);
    await flush();
    expect(out.items.map((i) => i.pendingId)).toEqual(['p1', 'p2']);
    expect(out.polling).toBe(false);
    expect(mockTrack.mock.calls).toEqual([['scan_ai_item_filled', { kind: 'dish' }], ['scan_ai_item_filled', { kind: 'notFood' }]]);
    await advance(5000);
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('done이 안 와도 상한(KB-1006 60초)에 종료', async () => {
    expect(PENDING_CAP_MS).toBe(60_000);
    mockGet.mockResolvedValue({ items: [], done: false });
    mount('s1');
    await flush();
    for (let i = 0; i < 59; i++) { await advance(1000); await flush(); }
    expect(out.polling).toBe(true);
    await advance(1000);
    await flush();
    expect(out.polling).toBe(false);
    const n = mockGet.mock.calls.length;
    expect(n).toBeLessThanOrEqual(61);
    await advance(5000);
    expect(mockGet).toHaveBeenCalledTimes(n);
  });

  it('KB-1006: 같은 pendingId 재도착 = 내용 교체(사진 GENERATING → READY) · 순서 유지 · 계측은 첫 도착 1회 · done이어도 imagesDone=false면 계속', async () => {
    mockGet
      .mockResolvedValueOnce({ items: [item('p1', { imageStatus: 'GENERATING' }), item('p2', { imageStatus: 'GENERATING' })], done: true, imagesDone: false })
      .mockResolvedValueOnce({ items: [item('p1', { imageStatus: 'READY', imageUrl: 'https://cdn/p1.webp', aiGeneratedImage: true })], done: true, imagesDone: false })
      .mockResolvedValueOnce({ items: [item('p2', { imageStatus: 'NONE' })], done: true, imagesDone: true });
    mount('s1');
    await flush();
    expect(out.items.map((i) => [i.pendingId, i.image])).toEqual([['p1', 'generating'], ['p2', 'generating']]);
    expect(out.polling).toBe(true); // 추정은 끝났지만 사진이 남았다
    await advance(1000);
    await flush();
    expect(out.items.map((i) => [i.pendingId, i.image, i.imageUrl, i.aiImage])).toEqual([['p1', 'ready', 'https://cdn/p1.webp', true], ['p2', 'generating', null, false]]);
    await advance(1000);
    await flush();
    expect(out.items.map((i) => [i.pendingId, i.image])).toEqual([['p1', 'ready'], ['p2', 'none']]);
    expect(out.polling).toBe(false);
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'scan_ai_item_filled')).toHaveLength(2);
  });

  it('KB-1006: imagesDone 부재(사진 없는 구 서버) = done만으로 종료', async () => {
    mockGet.mockResolvedValueOnce({ items: [item('p1')], done: true });
    mount('s1');
    await flush();
    expect(out.polling).toBe(false);
  });

  it('P-617: 끝난 뒤 화면 재진입(active false → true) = 상태 TTL 안이면 한 번 재조회 → 60초 뒤 READY 된 사진 반영 · 폴링은 재개 안 함', async () => {
    mockGet.mockResolvedValueOnce({ items: [item('p1', { imageStatus: 'NONE' })], done: true, imagesDone: true });
    mount('s1');
    await flush();
    expect(out.polling).toBe(false);
    update('s1', false); // 상세로 이동
    mockGet.mockResolvedValueOnce({ items: [item('p1', { imageStatus: 'READY', imageUrl: 'https://cdn/late.webp' })], done: true, imagesDone: true });
    await advance(120_000);
    update('s1', true); // 돌아옴
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect((out.items[0] as unknown as { image: string; imageUrl: string }).imageUrl).toBe('https://cdn/late.webp');
    await advance(10_000);
    expect(mockGet).toHaveBeenCalledTimes(2); // 한 번만 — 폴링 재개 0
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'scan_ai_item_filled')).toHaveLength(1); // 사진 갱신은 새 도착이 아니다
  });

  it('S-975: 재진입 재조회에 늦은 추정 + 사진 GENERATING이 오면 새 60초 예산으로 폴링 재개 → READY 받고 끝', async () => {
    mockGet.mockResolvedValueOnce({ items: [item('p1', { filled: true, riskLevel: 'UNKNOWN', name: null })], done: true, imagesDone: true });
    mount('s1');
    await flush();
    expect(out.polling).toBe(false);
    update('s1', false);
    await advance(90_000); // 첫 예산(60초) 지난 뒤
    mockGet
      .mockResolvedValueOnce({ items: [item('p1', { filled: false, imageStatus: 'GENERATING' })], done: true, imagesDone: false })
      .mockResolvedValueOnce({ items: [item('p1', { filled: false, imageStatus: 'GENERATING' })], done: true, imagesDone: false })
      .mockResolvedValueOnce({ items: [item('p1', { filled: false, imageStatus: 'READY', imageUrl: 'https://cdn/r.webp' })], done: true, imagesDone: true });
    update('s1', true);
    await flush();
    await flush();
    expect(out.polling).toBe(true); // 재개
    expect((out.items[0] as unknown as { estimated: boolean }).estimated).toBe(true); // 채움 → 추정
    await advance(1000);
    await flush();
    await advance(1000);
    await flush();
    expect((out.items[0] as unknown as { imageUrl: string }).imageUrl).toBe('https://cdn/r.webp');
    expect(out.polling).toBe(false);
    const n = mockGet.mock.calls.length;
    await advance(5000);
    expect(mockGet).toHaveBeenCalledTimes(n);
  });

  it('P-617: 상태 TTL(10분)이 지났으면 재진입해도 재조회 0', async () => {
    mockGet.mockResolvedValueOnce({ items: [item('p1')], done: true, imagesDone: true });
    mount('s1');
    await flush();
    update('s1', false);
    await advance(PENDING_STATE_TTL_MS + 1);
    update('s1', true);
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('P-617: 앱 백그라운드 = 폴링 멈춤(남은 예산 유지) · 전경 복귀 = 이어서 · 끝난 뒤 복귀 = 한 번 재조회', async () => {
    let onChange: (s: string) => void = () => {};
    // spyOn+mockRestore는 RN jest 목(jest.fn)의 구현까지 지워 다음 테스트 구독이 undefined가 된다 — 속성을 직접 바꾸고 되돌린다
    const orig = AppState.addEventListener;
    (AppState as unknown as { addEventListener: unknown }).addEventListener = (_: string, cb: (s: string) => void) => { onChange = cb; return { remove: () => {} }; };
    try {
      mockGet.mockResolvedValue({ items: [], done: false });
      mount('s1');
      await flush();
      expect(mockGet).toHaveBeenCalledTimes(1);
      act(() => onChange('background'));
      await advance(5000);
      expect(mockGet).toHaveBeenCalledTimes(1); // 백그라운드 = 요청 0
      act(() => onChange('active'));
      await flush();
      expect(mockGet).toHaveBeenCalledTimes(2); // 이어서 폴링
      mockGet.mockResolvedValue({ items: [item('p1')], done: true, imagesDone: true });
      await advance(1000);
      await flush();
      expect(out.polling).toBe(false);
      const n = mockGet.mock.calls.length;
      act(() => onChange('background'));
      act(() => onChange('active'));
      await flush();
      expect(mockGet).toHaveBeenCalledTimes(n + 1); // 끝난 뒤 복귀 = 한 번 재조회
    } finally {
      act(() => tree.unmount()); // 바꾼 구독으로 마운트한 트리는 여기서 정리
      (AppState as unknown as { addEventListener: unknown }).addEventListener = orig;
    }
  });

  it('Codex #445 P2: 폴링 중 백그라운드 → 60초 마감이 지난 뒤(TTL 안) 복귀 = pending 1회 받아 반영하고 끝(사진이 영영 빠지지 않는다)', async () => {
    let onChange: (s: string) => void = () => {};
    const orig = AppState.addEventListener;
    (AppState as unknown as { addEventListener: unknown }).addEventListener = (_: string, cb: (s: string) => void) => { onChange = cb; return { remove: () => {} }; };
    try {
      mockGet.mockResolvedValueOnce({ items: [item('p1', { imageStatus: 'GENERATING' })], done: true, imagesDone: false });
      mount('s1');
      await flush();
      expect(out.polling).toBe(true);
      act(() => onChange('background'));
      await advance(70_000); // 마감(60초) 경과
      expect(mockGet).toHaveBeenCalledTimes(1);
      // 실기 순서 재현: 응답(네트워크)보다 0ms 타이머가 먼저 돈다 — 응답을 붙잡아 둔 채 타이머부터 돌린다
      let respond: (v: unknown) => void = () => {};
      mockGet.mockImplementationOnce(() => new Promise((res) => { respond = res; }));
      act(() => onChange('active'));
      await advance(1);
      await act(async () => { respond({ items: [item('p1', { imageStatus: 'READY', imageUrl: 'https://cdn/late.webp' })], done: true, imagesDone: true }); });
      await flush();
      expect(mockGet).toHaveBeenCalledTimes(2); // 복귀 = 1회
      expect((out.items[0] as unknown as { imageUrl: string }).imageUrl).toBe('https://cdn/late.webp');
      expect(out.polling).toBe(false);
      await advance(10_000);
      expect(mockGet).toHaveBeenCalledTimes(2); // 폴링 재개 0
    } finally {
      act(() => tree.unmount());
      (AppState as unknown as { addEventListener: unknown }).addEventListener = orig;
    }
  });

  it('실패(success=false·네트워크) = 즉시 종료(재시도 0)', async () => {
    mockGet.mockRejectedValueOnce(new Error('SCAN-999'));
    mount('s1');
    await flush();
    expect(out.polling).toBe(false);
    await advance(3000);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('화면을 떠나면(active=false) 요청 0 · 돌아오면 남은 예산만큼 이어서', async () => {
    mockGet.mockResolvedValue({ items: [], done: false });
    mount('s1');
    await flush();
    await advance(5000);
    await flush();
    update('s1', false);
    const n = mockGet.mock.calls.length;
    await advance(4000);
    expect(mockGet).toHaveBeenCalledTimes(n);
    expect(out.polling).toBe(true); // 아직 종료 아님 — 미도착 행은 스켈레톤 유지
    update('s1', true);
    await flush();
    await advance(PENDING_CAP_MS - 9000 - 1);
    await flush();
    expect(out.polling).toBe(true);
    await advance(1);
    await flush();
    expect(out.polling).toBe(false); // 총 상한(떠나 있던 4초 포함) — 새 상한 아님
  });

  it('scanId 없음 = 폴링 0 · scanId가 바뀌면 이전 도착분·종료를 버리고 새로', async () => {
    mount(null);
    await flush();
    expect(mockGet).not.toHaveBeenCalled();
    expect(out.polling).toBe(false);
    mockGet.mockResolvedValueOnce({ items: [item('p1')], done: true });
    update('s1', true);
    await flush();
    expect(out.items).toHaveLength(1);
    expect(out.polling).toBe(false);
    mockGet.mockResolvedValueOnce({ items: [], done: false });
    update('s2', true);
    expect(out.items).toHaveLength(0);
    expect(out.polling).toBe(true);
    await flush();
    expect(mockGet.mock.calls[1][0]).toBe('/api/scans/s2/pending?lang=en');
  });
});
