/**
 * useScanPending — KB-992 메뉴판 스캔 'AI 추정' 폴링(서버 S-959 계약 초안 — 확정 시 Swagger 정본).
 *
 * `GET /api/scans/{scanId}/pending` 을 1초 간격으로, 상한 60초 또는 done && imagesDone까지(KB-1006 — 구 15초·done).
 * 도착분은 pendingId로 누적(응답이 누적이든 증분이든 같은 결과). 실패(success=false·네트워크)는
 * 즉시 종료 — 미도착 항목은 호출측이 현행 unable 행으로 되돌린다. 화면이 안 보이면(active=false)
 * 멈추고, 다시 보이면 **남은 예산만큼** 이어서 돈다(60초는 스캔당 총량).
 * 상태는 scanId 키 — 다시 찍기로 scanId가 바뀌면 이전 도착분·종료 표시는 버린다.
 */
import { useEffect, useRef, useState } from 'react';
import { api, apiLang } from '@/lib/api/client';
import { adaptPendingItem, type AiPendingItem } from '@/lib/api/scanAdapter';
import type { ScanPendingPayload } from '@/lib/api/scanTypes';
import { EVENTS, track } from '@/lib/analytics';
import { SCAN_API_VERSION } from './useScan';

export const PENDING_POLL_MS = 1000;
export const PENDING_CAP_MS = 60_000; // KB-1006(S-969): 사진 생성까지 최대 60초(서버 상태 TTL 10분)

interface PendingState {
  scanId: string | null;
  items: AiPendingItem[];
  ended: boolean;
}

export function useScanPending(scanId: string | null, active: boolean): { items: AiPendingItem[]; polling: boolean } {
  const [st, setSt] = useState<PendingState>({ scanId: null, items: [], ended: false });
  const cur = st.scanId === scanId ? st : { scanId, items: [], ended: false };
  const ended = !scanId || cur.ended;
  // 스캔별 예산·도착 키 — effect 안에서만 읽고 쓴다(렌더 중 ref 접근 0)
  const run = useRef<{ scanId: string | null; startedAt: number; seen: Set<string> }>({ scanId: null, startedAt: 0, seen: new Set() });

  useEffect(() => {
    if (!scanId || !active || ended) return;
    if (run.current.scanId !== scanId) run.current = { scanId, startedAt: Date.now(), seen: new Set() };
    const r = run.current;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      alive = false;
      clearTimeout(timer);
      setSt((s) => ({ ...(s.scanId === scanId ? s : { scanId, items: [] }), ended: true }));
    };
    const cap = setTimeout(finish, Math.max(0, r.startedAt + PENDING_CAP_MS - Date.now()));
    const tick = async () => {
      try {
        // QA #428: ScanV2Controller = version "2.0+" — 기본 1.1 헤더면 404 COMMON-002(핸들러 없음). POST /scans와 같은 상수.
        const p = await api.get<ScanPendingPayload>(`/api/scans/${encodeURIComponent(scanId)}/pending?lang=${apiLang()}`, {
          headers: { 'X-API-Version': SCAN_API_VERSION },
        });
        if (!alive) return;
        // KB-1006: 같은 pendingId가 다시 온다(사진 GENERATING → READY | NONE) — 도착 순서 유지, 내용은 최신으로 교체.
        // 계측은 처음 도착 1회만(사진 갱신은 새 도착이 아니다)
        const got = (p.items ?? []).filter((w) => w && typeof w.pendingId === 'string').map(adaptPendingItem);
        if (got.length) {
          for (const i of got) {
            if (r.seen.has(i.pendingId)) continue;
            r.seen.add(i.pendingId);
            track(EVENTS.scan_ai_item_filled, { kind: i.kind });
          }
          setSt((s) => {
            const base = s.scanId === scanId ? s : { scanId, items: [], ended: false };
            const byId = new Map(got.map((i) => [i.pendingId, i]));
            const kept = base.items.map((i) => byId.get(i.pendingId) ?? i);
            const known = new Set(base.items.map((i) => i.pendingId));
            return { ...base, items: [...kept, ...got.filter((i) => !known.has(i.pendingId))] };
          });
        }
        // KB-1006: 추정 끝(done) + 사진 끝(imagesDone) — imagesDone 부재 = 사진 없는 구 서버 → done만
        if (p.done && p.imagesDone !== false) return finish();
        timer = setTimeout(() => void tick(), PENDING_POLL_MS);
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
  }, [scanId, active, ended]);

  return { items: cur.items, polling: !ended };
}
