/**
 * useScanPending — KB-992 메뉴판 스캔 'AI 추정' 폴링(서버 S-959 계약 초안 — 확정 시 Swagger 정본).
 *
 * `GET /api/scans/{scanId}/pending` 을 1초 간격으로, 상한 60초 또는 done && imagesDone까지(KB-1006 — 구 15초·done).
 * P-617: 끝난 뒤에도 화면 재진입·포그라운드 복귀 때 상태 TTL(10분) 안이면 한 번 재조회(60초 넘게 걸린 사진 구제).
 * 도착분은 pendingId로 누적(응답이 누적이든 증분이든 같은 결과). 실패(success=false·네트워크)는
 * 즉시 종료 — 미도착 항목은 호출측이 현행 unable 행으로 되돌린다. 화면이 안 보이면(active=false)
 * 멈추고, 다시 보이면 **남은 예산만큼** 이어서 돈다(60초는 스캔당 총량). P-617: 앱이 백그라운드여도 멈춘다.
 * 상태는 scanId 키 — 다시 찍기로 scanId가 바뀌면 이전 도착분·종료 표시는 버린다.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, apiLang } from '@/lib/api/client';
import { adaptPendingItem, type AiPendingItem } from '@/lib/api/scanAdapter';
import type { ScanPendingPayload } from '@/lib/api/scanTypes';
import { EVENTS, track } from '@/lib/analytics';
import { SCAN_API_VERSION } from './useScan';

export const PENDING_POLL_MS = 1000;
export const PENDING_CAP_MS = 60_000; // KB-1006(S-969): 사진 생성까지 최대 60초 — P-617: 서버 병렬 생성(가장 느린 1장 ≈ 40초)이라 연장 안 함
/** P-617: 서버 pending 상태 보존 10분 — 그 안이면 화면 재진입·포그라운드 복귀 때 한 번 다시 받아 늦게 READY 된 사진을 반영 */
export const PENDING_STATE_TTL_MS = 10 * 60_000;

interface PendingState {
  scanId: string | null;
  items: AiPendingItem[];
  ended: boolean;
}

type Run = { scanId: string | null; startedAt: number; seen: Set<string> };

const pendingPath = (scanId: string) => `/api/scans/${encodeURIComponent(scanId)}/pending?lang=${apiLang()}`;
// QA #428: ScanV2Controller = version "2.0+" — 기본 1.1 헤더면 404 COMMON-002(핸들러 없음). POST /scans와 같은 상수.
const fetchPending = (scanId: string) => api.get<ScanPendingPayload>(pendingPath(scanId), { headers: { 'X-API-Version': SCAN_API_VERSION } });

/** KB-1006: 같은 pendingId가 다시 온다(사진 GENERATING → READY | NONE) — 도착 순서 유지, 내용은 최신으로 교체. 계측은 처음 도착 1회만 */
function adaptAndCount(p: ScanPendingPayload, r: Run): AiPendingItem[] {
  const got = (p.items ?? []).filter((w) => w && typeof w.pendingId === 'string').map(adaptPendingItem);
  for (const i of got) {
    if (r.seen.has(i.pendingId)) continue;
    r.seen.add(i.pendingId);
    track(EVENTS.scan_ai_item_filled, { kind: i.kind });
  }
  return got;
}
/** 상태 갱신 함수(모듈 레벨 — effect deps에 안정 setter만 남게) */
const withItems = (id: string, got: AiPendingItem[]) => (s: PendingState): PendingState => {
  const base = s.scanId === id ? s : { scanId: id, items: [], ended: false };
  const byId = new Map(got.map((i) => [i.pendingId, i]));
  const known = new Set(base.items.map((i) => i.pendingId));
  return { ...base, items: [...base.items.map((i) => byId.get(i.pendingId) ?? i), ...got.filter((i) => !known.has(i.pendingId))] };
};

/** P-617: 앱이 전경일 때만 true — 백그라운드면 폴링을 멈추고(남은 예산 유지), 돌아오면 재개·재조회 */
function useAppActive(): boolean {
  const [on, setOn] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setOn(st === 'active'));
    return () => sub.remove();
  }, []);
  return on;
}

export function useScanPending(scanId: string | null, active: boolean): { items: AiPendingItem[]; polling: boolean } {
  const [st, setSt] = useState<PendingState>({ scanId: null, items: [], ended: false });
  const cur = st.scanId === scanId ? st : { scanId, items: [], ended: false };
  const ended = !scanId || cur.ended;
  const appActive = useAppActive();
  const live = active && appActive;
  // 스캔별 예산·도착 키 — effect 안에서만 읽고 쓴다(렌더 중 ref 접근 0)
  const run = useRef<Run>({ scanId: null, startedAt: 0, seen: new Set() });

  useEffect(() => {
    if (!scanId || !live || ended) return;
    if (run.current.scanId !== scanId) run.current = { scanId, startedAt: Date.now(), seen: new Set() };
    const r = run.current;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      alive = false;
      clearTimeout(timer);
      setSt((s) => ({ ...(s.scanId === scanId ? s : { scanId, items: [] }), ended: true }));
    };
    // Codex #445 P2: 폴링 중 백그라운드·화면 이탈로 멈췄다가 60초 마감이 지난 뒤 돌아오면 — cap이 0ms로 바로 끝내며
    // 진행 중 응답을 버리고(alive=false), live는 이미 true라 복귀 재조회도 안 탄다 → 늦게 READY 된 사진이 영영 안 들어왔다.
    // 마감이 지났으면 한 번 받아 반영하고 끝낸다(실패도 끝 — 현행 unable 폴백). 남았으면 남은 예산으로 폴링 재개(아래)
    const remaining = r.startedAt + PENDING_CAP_MS - Date.now();
    if (remaining <= 0) {
      fetchPending(scanId)
        .then((p) => { if (alive) { const got = adaptAndCount(p, r); if (got.length) setSt(withItems(scanId, got)); } })
        .catch(() => {})
        .finally(() => { if (alive) finish(); });
      return () => { alive = false; };
    }
    const cap = setTimeout(finish, remaining);
    const tick = async () => {
      try {
        const p = await fetchPending(scanId);
        if (!alive) return;
        const got = adaptAndCount(p, r);
        if (got.length) setSt(withItems(scanId, got));
        // KB-1006: 추정 끝(done) + 사진 끝(imagesDone) — imagesDone 부재 = 사진 없는 구 서버 → done만
        if (p.done && p.imagesDone !== false) return finish();
        timer = setTimeout(() => void tick(), PENDING_POLL_MS); // 사진이 완성되는 대로 줄마다 바로 교체(1초)
      } catch {
        if (alive) finish(); // 실패 = 현행 unable 폴백(서버 message는 노출하지 않는다)
      }
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(cap);
    };
  }, [scanId, live, ended]);

  // P-617: 폴링이 끝난 뒤 화면 재진입·포그라운드 복귀(live false → true) = 상태 TTL(10분) 안이면 한 번 재조회.
  // 60초 상한 뒤에 READY 된 사진이 여기서 반영된다. 실패 = 조용히 무시(현재 화면 유지)
  const wasLive = useRef(live);
  useEffect(() => {
    const was = wasLive.current;
    wasLive.current = live;
    if (!live || was || !scanId || !ended) return;
    const r = run.current;
    if (r.scanId !== scanId || Date.now() - r.startedAt > PENDING_STATE_TTL_MS) return;
    let alive = true;
    fetchPending(scanId)
      .then((p) => {
        if (!alive) return;
        const got = adaptAndCount(p, r);
        if (!got.length) return;
        // S-975: 15초 마감 채움이 늦게 끝난 추정으로 바뀌며 사진 GENERATING이 붙어 올 수 있다 — 그대로 두면 점 애니메이션에 멈춘다.
        // 그럴 때만 새 60초 예산으로 폴링을 다시 돌려 READY·NONE을 받는다(TTL 안 · 실패하면 종전처럼 끝)
        const regen = got.some((i) => i.image === 'generating');
        if (regen) r.startedAt = Date.now();
        setSt((s) => ({ ...withItems(scanId, got)(s), ...(regen ? { ended: false } : {}) }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [live, ended, scanId]);

  return { items: cur.items, polling: !ended };
}
