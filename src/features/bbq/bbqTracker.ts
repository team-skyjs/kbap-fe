/**
 * KB-1019 장면 1: 프레임 사이 상태(JS 스레드). 이름표 유지·고기 다수결·불판 띠 조건.
 * 시간은 인자로 받는다(jest에서 결정적).
 */
import { COOKED_MEAT, GRILL, RAW_MEAT, TUNING, iou, type Box, type Det, type GrillGateConfig } from './bbqModel';

export type Shown = Box & { id: number; cls: number; score: number; held: boolean };

type Track = { id: number; group: number; box: Box; score: number; cls: number; lastSeen: number; votes: { t: number; cls: number }[] };

const isMeat = (c: number) => c === RAW_MEAT || c === COOKED_MEAT;
/** 날고기·익은 고기는 한 물체로 이어 붙이고 이름은 다수결로 정한다. */
const groupOf = (c: number) => (isMeat(c) ? RAW_MEAT : c);

function majority(votes: { t: number; cls: number }[]): number {
  let raw = 0;
  let cooked = 0;
  for (const v of votes) {
    if (v.cls === RAW_MEAT) raw++;
    else cooked++;
  }
  if (raw === cooked) return votes[votes.length - 1]!.cls; // 동률 = 가장 최근
  return raw > cooked ? RAW_MEAT : COOKED_MEAT;
}

export function createTracker(t = TUNING) {
  let tracks: Track[] = [];
  let nextId = 1;

  return function update(dets: Det[], now: number): Shown[] {
    // 만료 먼저: 유지 시간을 넘긴 트랙이 이번 프레임 박스를 가로채지 않게
    tracks = tracks.filter((tr) => now - tr.lastSeen <= t.holdMs);
    const used = new Set<number>();
    for (const d of [...dets].sort((a, b) => b.score - a.score)) {
      const g = groupOf(d.cls);
      let hit: Track | undefined;
      let bestIou = t.linkIou;
      for (const tr of tracks) {
        if (tr.group !== g || used.has(tr.id)) continue;
        const v = iou(tr.box, d);
        if (v >= bestIou) {
          bestIou = v;
          hit = tr;
        }
      }
      if (!hit) {
        hit = { id: nextId++, group: g, box: d, score: d.score, cls: d.cls, lastSeen: now, votes: [] };
        tracks.push(hit);
      }
      used.add(hit.id);
      hit.box = { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 };
      hit.score = d.score;
      hit.lastSeen = now;
      if (isMeat(d.cls)) hit.votes.push({ t: now, cls: d.cls });
    }
    return tracks.map((tr) => {
      tr.votes = tr.votes.filter((v) => now - v.t <= t.meatVoteMs);
      const cls = isMeat(tr.group) && tr.votes.length > 0 ? majority(tr.votes) : tr.cls;
      return { ...tr.box, id: tr.id, cls, score: tr.score, held: tr.lastSeen !== now };
    });
  };
}

/** 불판 띠 조건. 프레임마다 그 프레임에 불판(임계값 통과)이 있었는지 넣는다. */
export function createGrillGate(cfg: GrillGateConfig = TUNING.grill) {
  const hist: boolean[] = [];
  let since: number | null = null;
  return function seen(dets: Det[], now: number): boolean {
    const hit = dets.some((d) => d.cls === GRILL);
    if (cfg.mode === 'window') {
      hist.push(hit);
      if (hist.length > cfg.window) hist.shift();
      return hist.filter(Boolean).length >= cfg.need;
    }
    if (!hit) {
      since = null;
      return false;
    }
    since ??= now;
    return now - since >= cfg.ms;
  };
}
