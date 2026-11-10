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
  /** 손 인식은 N프레임에 한 번(모델 30fps 보호). 실기 손 ms를 보고 1로 내릴 수 있다 */
  everyN: 2,
  /** 지난 손 결과를 이 시간까지 재사용(everyN 사이 프레임) */
  staleMs: 250,
  /** 관절 신뢰도 하한 */
  minConf: 0.3,
  /** "입 쪽" 근사 = 화면 위쪽 비율(거치대 상반신 구도 전제) */
  topFrac: 0.25,
  /** 손끝 모임: 올린 잎(8)을 든 동안의 최대 벌어짐 대비 이 비율 이하로 줄면 싼 것으로 본다 */
  gatherRatio: 0.6,
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
 */
export function vnOrientation(o: string, mirrored: boolean): number {
  'worklet';
  if (o === 'left') return mirrored ? 7 : 6; // rightMirrored : right
  if (o === 'right') return mirrored ? 5 : 8; // leftMirrored : left
  if (o === 'down') return mirrored ? 4 : 3; // downMirrored : down
  return mirrored ? 2 : 1; // upMirrored : up
}

/** 네이티브 평탄 배열(손마다 21 x (x, y, c), Vision 정규·원점 왼쪽 아래) → 똑바로 선 w x h 픽셀(원점 왼쪽 위) */
export function parseHands(flat: readonly number[], w: number, h: number): Hand[] {
  const per = JOINT_COUNT * 3;
  const hands: Hand[] = [];
  for (let i = 0; i + per <= flat.length; i += per) {
    const joints: Joint[] = [];
    for (let j = 0; j < JOINT_COUNT; j++) {
      const k = i + j * 3;
      joints.push({ x: flat[k]! * w, y: (1 - flat[k + 1]!) * h, c: flat[k + 2]! });
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
export function tipSpread(hand: Hand, minConf = HAND_TUNING.minConf): number | null {
  const tips = TIPS.map((i) => hand.joints[i]).filter((j) => ok(j, minConf));
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
 * 트래커 결과 + 손 → 쌈 코칭 신호(프레임마다, 시간 순서대로 부른다). P-643:
 * - 손이 하나도 안 잡히면 P-641 매핑 그대로(바닥 동작).
 * - leafOnHand = 손 위 3종 박스가 손바닥과 겹침. wrapped = 9가 손과 겹침, 또는 8이 손과 겹친 뒤 손끝이 모임.
 * - gone = 손 위 박스를 마지막으로 본 순간 그 손이 화면 위쪽(topFrac)이었고, 지금 손 위 박스가 없음(유지 0.5초는 상태 머신이).
 * - toppedLeaf(8)는 손 조건 없이 P-641 그대로.
 */
export function createHandSignals(t = HAND_TUNING) {
  let lastBoxTop = false;
  let gatherBase: number | null = null;

  return function signals(shown: Shown[], hands: Hand[], frameH: number): Signals {
    const base = signalsFromClasses(new Set(shown.map((s) => s.cls)));
    const handBoxes = shown.filter((s) => s.cls >= HAND_FIRST);
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
    lastBoxTop = (pick.palm.y1 + pick.palm.y2) / 2 < frameH * t.topFrac;
    const spread = tipSpread(pick.hand, t.minConf);
    if (pick.box.cls === 8 && spread != null) gatherBase = Math.max(gatherBase ?? spread, spread);
    const gathered = gatherBase != null && spread != null && spread <= gatherBase * t.gatherRatio;
    return { ...base, leafOnHand: true, wrapped: pick.box.cls === 9 || gathered };
  };
}
