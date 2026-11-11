/**
 * KB-1019 장면 2 손 인식(P-643, 예진 11/10: 손만, 얼굴 없음). 네이티브(modules/vision-camera-hands)는 Apple Vision 원값만 준다.
 * 방향 선택·좌표 변환·신호 계산은 전부 여기(JS) — 실기에서 틀리면 재빌드 없이 OTA로 고친다.
 * 좌표계 = 탐지 박스와 같은 "똑바로 선 리사이즈 이미지"(rd.w x rd.h, VisionCamera 좌표계 — orientation1019 bufferToUpright).
 */
import { HAND_FIRST, type Box } from './bbqModel';
import type { Shown } from './bbqTracker';
import { signalsFromClasses, type Signals } from './wrapCoach';

/** 실기 보정 상수(OTA 대상) */
export const HAND_TUNING = {
  /** 손 인식은 N프레임에 한 번(모델 30fps 보호). P-644 실측 손 8~11ms·30fps 유지 */
  everyN: 2,
  /** 지난 손 결과를 이 시간까지 재사용(everyN 사이 프레임) */
  staleMs: 250,
  /** 관절 신뢰도 하한 */
  minConf: 0.3,
  /** 손끝 모임 계산용 손끝 신뢰도 하한(주먹이면 손끝 신뢰도가 떨어진다) */
  tipConf: 0.1,
  /** 모델 경로 gone: 손 위 박스를 마지막으로 본 손이 화면 위쪽 이 비율 안(거치대 상반신 구도 전제) */
  topFrac: 0.25,
  /**
   * P-647 손 동작 경로 먹기(S5): 셀카 화면에서 입은 높이 약 40%, 먹는 주먹 손바닥 중심은 55~65%(예진 실측)라 25%는 닿지 않았다.
   * 오므린 손이 가장 낮았던 위치보다 화면 높이의 eatRiseFrac 이상 올라가거나, 위쪽 eatTopFrac 안에 들어오면 먹기.
   * 좌표 = 프레임(기기 방향) 기준 — 가로로 든 폰도 기기 위쪽(실제 입 쪽)이 위.
   */
  eatTopFrac: 0.45,
  eatRiseFrac: 0.12,
  /** 오므린 손이 올라가던 중 이 시간 안에 손이 사라지면(입에 가져가며 가려짐) 먹기로 인정 */
  eatLostMs: 500,
  /** "올라가는 중" = 직전 오므린 손보다 화면 높이의 이 비율 이상 위 */
  eatStepFrac: 0.01,
  /** 손끝 모임: 편 손(또는 올린 잎 8을 든 동안)의 최대 벌어짐 대비 이 비율 이하면 오므린 것 */
  gatherRatio: 0.6,
  /** 편 손바닥 기준(P-644 예진 실측 편 손 0.42~0.52) */
  openSpread: 0.35,
  /**
   * P-644 실기(빌드 5, 전면): 방향 표대로 넘겼는데 관절점이 위아래로 뒤집혀 찍혔다(x는 맞음).
   * 이 키(frame.orientation + 거울이면 '/m')에서는 Vision y를 뒤집지 않고 그대로 쓴다. 측정 화면 HUD의 o 값으로 키를 확인한다.
   * 추정 원인: 거울 + 90° 방향에서 Vision의 "거울 → 회전" 순서가 EXIF 정의와 달라 위아래가 뒤집힘(0°·180° 거울은 순서 무관).
   * 그래서 전면 세로(right/m)와 거꾸로 세로(left/m)만 넣고, 전면이 거울 없이 오는 경우를 대비해 right도 둔다. 후면 세로(left)는 미확인.
   */
  yAsIs: ['right/m', 'right', 'left/m'] as readonly string[],
  /**
   * 발표(11/12)용 손 동작 대체 경로. 7·8·9 박스가 하나도 없을 때만, 손 모양만으로 단계를 넘긴다.
   * 잎·고기·쌈이 실제로 있는지는 모른 채 넘어간다(화면 문구는 그대로). false면 끔.
   */
  handOnly: true,
  /** 손 동작 경로 S1: 편 손바닥이 화면 가운데 영역(가장자리 20%씩 뺀 60%)에서 이만큼 유지된 뒤 신호(상태 머신 0.5초 더 = 1초) */
  openHoldMs: 500,
  /** 손 동작 경로 S2(단순형): 편 손바닥을 S1 신호 뒤 이만큼 더 유지 */
  palmExtraMs: 1500,
  /** 가운데 영역 = 가장자리 비율을 뺀 나머지 */
  centerMargin: 0.2,
};

export const JOINT_COUNT = 21;
/** 손바닥 묶음 = 손목 + 엄지 CMC + 네 손가락 MCP */
export const PALM = [0, 1, 5, 9, 13, 17] as const;
/** 손끝 = 엄지·검지·중지·약지·새끼 tip */
export const TIPS = [4, 8, 12, 16, 20] as const;
const WRIST = 0;
const MIDDLE_MCP = 9;

export type Joint = { x: number; y: number; c: number };
export type Hand = { joints: Joint[] };

/**
 * VisionCamera frame.orientation(+isMirrored) → CGImagePropertyOrientation 원값.
 * Vision이 VisionCamera 정답 좌표계(= uprightBgr 뒤 탐지 입력)와 같은 똑바로 선 이미지를 보게 고른다(handPose1019가 정의대로 대조).
 * 실기 결과 y 보정은 HAND_TUNING.yAsIs(P-644).
 */
export function vnOrientation(o: string, mirrored: boolean): number {
  'worklet';
  if (o === 'left') return mirrored ? 7 : 6; // rightMirrored : right
  if (o === 'right') return mirrored ? 5 : 8; // leftMirrored : left
  if (o === 'down') return mirrored ? 4 : 3; // downMirrored : down
  return mirrored ? 2 : 1; // upMirrored : up
}

/** 측정 화면·y 보정 키: 'right/m' 등 */
export function frameKey(o: string, mirrored: boolean): string {
  'worklet';
  return mirrored ? `${o}/m` : o;
}

/**
 * 네이티브 평탄 배열(손마다 21 x (x, y, c), Vision 정규) → 똑바로 선 w x h 픽셀(원점 왼쪽 위).
 * 기본은 Vision 정의(원점 왼쪽 아래)대로 y를 뒤집는다. key가 yAsIs에 있으면 그대로(P-644 전면 실측).
 */
export function parseHands(flat: readonly number[], w: number, h: number, key = ''): Hand[] {
  const flipY = !HAND_TUNING.yAsIs.includes(key);
  const per = JOINT_COUNT * 3;
  const hands: Hand[] = [];
  for (let i = 0; i + per <= flat.length; i += per) {
    const joints: Joint[] = [];
    for (let j = 0; j < JOINT_COUNT; j++) {
      const k = i + j * 3;
      joints.push({ x: flat[k]! * w, y: (flipY ? 1 - flat[k + 1]! : flat[k + 1]!) * h, c: flat[k + 2]! });
    }
    hands.push({ joints });
  }
  return hands;
}

const ok = (j: Joint | undefined, minConf: number): j is Joint => j != null && j.c >= minConf;

/** 손바닥 관절 묶음의 상자. 믿을 만한 관절 3개 미만이면 null */
export function palmBox(hand: Hand, minConf = HAND_TUNING.minConf): Box | null {
  const pts = PALM.map((i) => hand.joints[i]).filter((j) => ok(j, minConf));
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

/** 손끝 벌어짐 = 손끝 5개의 중심 거리 평균 / 손 크기(손목~중지 MCP). 크기 정규화라 거리와 무관. 못 재면 null */
export function tipSpread(hand: Hand, minConf = HAND_TUNING.minConf, tipConf = minConf): number | null {
  const tips = TIPS.map((i) => hand.joints[i]).filter((j) => ok(j, tipConf));
  const w = hand.joints[WRIST];
  const m = hand.joints[MIDDLE_MCP];
  if (tips.length < 4 || !ok(w, minConf) || !ok(m, minConf)) return null;
  const size = Math.hypot(w.x - m.x, w.y - m.y);
  if (!(size > 0)) return null;
  const cx = tips.reduce((a, p) => a + p.x, 0) / tips.length;
  const cy = tips.reduce((a, p) => a + p.y, 0) / tips.length;
  return tips.reduce((a, p) => a + Math.hypot(p.x - cx, p.y - cy), 0) / tips.length / size;
}

const overlapArea = (a: Box, b: Box) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
const area = (b: Box) => (b.x2 - b.x1) * (b.y2 - b.y1);
const centerY = (b: Box) => (b.y1 + b.y2) / 2;

export type HandPick = { hand: Hand; palm: Box; box: Shown };

/** 손이 둘이면 손 위 3종 박스와 가장 많이 겹친 손이 주 손. 겹친 손이 없으면 null */
export function pickHand(hands: Hand[], handBoxes: Shown[]): HandPick | null {
  let best: HandPick | null = null;
  let bestArea = 0;
  for (const hand of hands) {
    const palm = palmBox(hand);
    if (!palm) continue;
    for (const box of handBoxes) {
      const a = overlapArea(palm, box);
      if (a > bestArea) {
        bestArea = a;
        best = { hand, palm, box };
      }
    }
  }
  return best;
}

/**
 * 트래커 결과 + 손 → 쌈 코칭 신호(프레임마다, 시간 순서대로 부른다).
 * 모델 경로(P-643, 7·8·9 박스가 있으면 우선):
 * - 손이 하나도 안 잡히면 P-641 매핑 그대로(바닥 동작).
 * - leafOnHand = 손 위 3종 박스가 손바닥과 겹침. wrapped = 9가 손과 겹침, 또는 8이 손과 겹친 뒤 손끝이 모임.
 * - gone = 손 위 박스를 마지막으로 본 순간 그 손이 화면 위쪽(topFrac)이었고, 지금 손 위 박스가 없음(유지 0.5초는 상태 머신이).
 * - toppedLeaf(8)는 손 조건 없이 P-641 그대로.
 * 손 동작 경로(P-644, 발표용 대체 — 7·8·9가 없을 때, handOnly): 잎이 실제로 있는지 모른다.
 * - S1 leafOnHand = 편 손바닥(spread ≥ openSpread)이 가운데 영역에서 openHoldMs 유지
 * - S2 toppedLeaf = 다른 손이 주 손 손바닥에 들어왔다 나감, 또는 편 손바닥을 openHoldMs + palmExtraMs 유지(단순형)
 * - S4 wrapped = 손끝 모임이 편 손 최대값의 gatherRatio 이하(유지 0.5초는 상태 머신이)
 * - S5 gone = 오므린 손이 가장 낮던 위치보다 eatRiseFrac 이상 올라감, 또는 위쪽 eatTopFrac 안, 또는 올라가던 중 사라짐(P-647)
 */
export function createHandSignals(t = HAND_TUNING) {
  let lastBoxTop = false;
  let gatherBase: number | null = null;
  // 손 동작 경로 상태
  let openSince: number | null = null;
  let openMax: number | null = null;
  let visited = false;
  let passedAt: number | null = null;
  // 먹기(P-647): 오므린 손바닥 중심의 가장 낮은 y · 직전 y · 마지막으로 올라가던 시각 · 손이 사라진 뒤 인정 상태
  let fistLowY: number | null = null;
  let fistPrevY: number | null = null;
  let risingAt: number | null = null;
  let goneLatched = false;

  function handOnly(hands: Hand[], frameW: number, frameH: number, now: number): Partial<Signals> {
    const withPalm = hands.flatMap((hand) => {
      const palm = palmBox(hand, t.minConf);
      return palm ? [{ hand, palm }] : [];
    });
    if (withPalm.length === 0) {
      openSince = null;
      visited = false;
      // 오므린 손이 올라가던 중 사라짐 = 입에 가져감(다시 손이 보일 때까지 유지 — 0.5초 유지는 상태 머신)
      if (risingAt != null && now - risingAt <= t.eatLostMs) goneLatched = true;
      fistLowY = null;
      fistPrevY = null;
      risingAt = null;
      return goneLatched ? { gone: true } : {};
    }
    goneLatched = false;
    // 주 손 = 손바닥이 가장 큰(가까운) 손
    withPalm.sort((a, b) => area(b.palm) - area(a.palm));
    const main = withPalm[0]!;
    const other = withPalm[1];
    const spread = tipSpread(main.hand, t.minConf, t.tipConf);
    const cx = (main.palm.x1 + main.palm.x2) / 2;
    const cy = centerY(main.palm);
    const m = t.centerMargin;
    const centered = cx >= frameW * m && cx <= frameW * (1 - m) && cy >= frameH * m && cy <= frameH * (1 - m);
    const open = spread != null && spread >= t.openSpread;
    if (open) openMax = Math.max(openMax ?? spread, spread);
    if (open && centered) openSince ??= now;
    else openSince = null;
    // 두 손: 다른 손이 주 손 손바닥에 들어왔다 나가면 S2
    if (other && overlapArea(other.palm, main.palm) > 0) {
      visited = true;
      passedAt = null;
    } else if (visited) {
      visited = false;
      passedAt = now;
    }
    const openHeld = openSince != null && now - openSince >= t.openHoldMs;
    const extraHeld = openSince != null && now - openSince >= t.openHoldMs + t.palmExtraMs;
    const closed = spread != null && spread <= (openMax ?? t.openSpread) * t.gatherRatio;
    let eat = false;
    if (closed) {
      fistLowY = Math.max(fistLowY ?? cy, cy); // y가 클수록 아래
      if (fistPrevY != null && fistPrevY - cy >= frameH * t.eatStepFrac) risingAt = now;
      fistPrevY = cy;
      eat = fistLowY - cy >= frameH * t.eatRiseFrac || cy < frameH * t.eatTopFrac;
    } else {
      // 손이 펴지면 기준 초기화
      fistLowY = null;
      fistPrevY = null;
      risingAt = null;
    }
    return {
      leafOnHand: openHeld,
      toppedLeaf: extraHeld || (passedAt != null && open),
      wrapped: closed,
      gone: eat,
    };
  }

  return function signals(shown: Shown[], hands: Hand[], frameH: number, frameW = 0, now = 0): Signals {
    const base = signalsFromClasses(new Set(shown.map((s) => s.cls)));
    const handBoxes = shown.filter((s) => s.cls >= HAND_FIRST);
    if (handBoxes.length === 0 && t.handOnly) {
      gatherBase = null;
      const h = handOnly(hands, frameW, frameH, now);
      return { ...base, ...h, gone: lastBoxTop || (h.gone ?? false) };
    }
    // 사라짐은 이번 프레임에 실제로 본 박스로만(트래커 유지 400ms를 기다리지 않음)
    if (!handBoxes.some((s) => !s.held)) {
      gatherBase = null;
      return { ...base, gone: lastBoxTop };
    }
    if (!hands.some((h) => palmBox(h, t.minConf))) {
      lastBoxTop = false;
      gatherBase = null;
      return base;
    }
    const pick = pickHand(hands, handBoxes);
    if (!pick) {
      lastBoxTop = false;
      return { ...base, leafOnHand: false, wrapped: false };
    }
    lastBoxTop = centerY(pick.palm) < frameH * t.topFrac;
    const spread = tipSpread(pick.hand, t.minConf);
    if (pick.box.cls === 8 && spread != null) gatherBase = Math.max(gatherBase ?? spread, spread);
    const gathered = gatherBase != null && spread != null && spread <= gatherBase * t.gatherRatio;
    return { ...base, leafOnHand: true, wrapped: pick.box.cls === 9 || gathered };
  };
}
