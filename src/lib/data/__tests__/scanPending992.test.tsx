/**
 * KB-992 'AI 추정' — 어댑터(false-safe 잠금) + 폴링 훅(1초·15초 상한·done·실패·떠나면 멈춤·scanId 리셋).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { adaptPendingItem, photoOnlyResults } from '@/lib/api/scanAdapter';
import type { ScanResultWire } from '@/lib/api/scanTypes';
import { PENDING_CAP_MS, useScanPending } from '../useScanPending';

const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'en' }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));


const wire = (p: Partial<ScanResultWire>): ScanResultWire => ({ matched: false, riskLevel: 'UNKNOWN', name: 'x', ...p });
const item = (pendingId: string, extra: Record<string, unknown> = {}) => ({ pendingId, kind: 'DISH', name: pendingId, riskLevel: 'CAUTION', aiEstimated: true, ...extra });

describe('어댑터', () => {
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

  it('done이 안 와도 15초에 종료', async () => {
    mockGet.mockResolvedValue({ items: [], done: false });
    mount('s1');
    await flush();
    for (let i = 0; i < 14; i++) { await advance(1000); await flush(); }
    expect(out.polling).toBe(true);
    await advance(1000);
    await flush();
    expect(out.polling).toBe(false);
    const n = mockGet.mock.calls.length;
    expect(n).toBeLessThanOrEqual(16);
    await advance(5000);
    expect(mockGet).toHaveBeenCalledTimes(n);
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
    expect(out.polling).toBe(false); // 총 15초(떠나 있던 4초 포함) — 새 15초 아님
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
