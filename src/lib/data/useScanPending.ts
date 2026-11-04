/**
 * useScanPending — KB-992 메뉴판 스캔 'AI 추정' 폴링(서버 S-959 계약 초안 — 확정 시 Swagger 정본).
 *
 * `GET /api/scans/{scanId}/pending` 을 1초 간격으로, 상한 15초 또는 done=true까지.
 * 도착분은 pendingId로 누적(응답이 누적이든 증분이든 같은 결과). 실패(success=false·네트워크)는
 * 즉시 종료 — 미도착 항목은 호출측이 현행 unable 행으로 되돌린다. 화면이 안 보이면(active=false)
 * 멈추고, 다시 보이면 **남은 예산만큼** 이어서 돈다(15초는 스캔당 총량).
 * 상태는 scanId 키 — 다시 찍기로 scanId가 바뀌면 이전 도착분·종료 표시는 버린다.
 */
import { useEffect, useRef, useState } from 'react';
import { api, apiLang } from '@/lib/api/client';
import { adaptPendingItem, type AiPendingItem } from '@/lib/api/scanAdapter';
import type { ScanPendingPayload } from '@/lib/api/scanTypes';
import { EVENTS, track } from '@/lib/analytics';

export const PENDING_POLL_MS = 1000;
export const PENDING_CAP_MS = 15_000;

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
        const p = await api.get<ScanPendingPayload>(`/api/scans/${encodeURIComponent(scanId)}/pending?lang=${apiLang()}`);
        if (!alive) return;
        const fresh = (p.items ?? [])
          .filter((w) => w && typeof w.pendingId === 'string' && !r.seen.has(w.pendingId))
          .map(adaptPendingItem);
        if (fresh.length) {
          for (const i of fresh) {
            r.seen.add(i.pendingId);
            track(EVENTS.scan_ai_item_filled, { kind: i.kind });
          }
          setSt((s) => {
            const base = s.scanId === scanId ? s : { scanId, items: [], ended: false };
            return { ...base, items: [...base.items, ...fresh] };
          });
        }
        if (p.done) return finish();
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
