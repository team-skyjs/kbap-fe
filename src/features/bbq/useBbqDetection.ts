/**
 * KB-1019 장면 1: 후면 카메라 프레임 → 자체 모델 v1 → 트래커·불판 조건. GuideScreen 전용.
 * ProbeScreen(측정용)은 COCO 경로와 한 워크릿에 묶여 있어 그대로 두고, 같은 부품(bbqDetector·bbqTracker)만 공유한다.
 * 시각은 탐지기 워크릿 단조 시계(at) — 렌더 경로 Date.now 0(P-630).
 */
import { useEffect, useRef, useState } from 'react';
import { useFrameOutput, useOrientation, type Frame } from 'react-native-vision-camera';
import { type GPUFrame, type Resizer, useResizer } from 'react-native-vision-camera-resizer';
import { useModel } from 'react-native-executorch';
import { scheduleOnRN } from 'react-native-worklets';
import { createHandPose, type HandPose } from 'react-native-vision-camera-hands';
import { resizeDims, uprightInput, type CamOrientation, type Det, type Reorient } from './bbqModel';
import { BBQ_MODELS, createBbqDetector, type BbqBackend, type BbqDetector, type BbqRun } from './bbqDetector';
import { createGrillGate, createTracker, type Shown } from './bbqTracker';
import { HAND_FIRST } from './bbqModel';
import { HAND_TUNING, frameKey, parseHands, vnOrientation, type Hand } from './handPose';

/** 장면 1 이름표 대상 = 0 grill ~ 6 scissors. 손 관련 7~9는 이 화면에서 버린다(트래커·불판 조건 모두). */
export const SCENE1_MAX_CLS = 6;
export const scene1Only = (dets: Det[]) => dets.filter((d) => d.cls <= SCENE1_MAX_CLS);

/** hands = 이번 프레임에 손 인식을 돌렸을 때만(네이티브 원값). handErr = 손 인식만 실패(모델 결과는 살림) */
/** o·m = 프레임 방향·거울(P-644 가로: 그리기 좌표 변환) */
export type BbqTick = BbqRun & { uw: number; uh: number; o: CamOrientation; m: boolean; hands?: number[]; handMs?: number; handErr?: string; handKey?: string; handVn?: number };
export type HandRun = { pose: HandPose; everyN: number };
/** 워크릿 예외도 결과로 돌려준다(P-637: catch가 삼켜 실기 추론 0의 원인이 화면에 안 보였다) */
export type FrameResult = BbqTick | { error: string } | null;
/** 로드 뒤 이 시간 안에 틱이 한 번도 안 오면 "멈춤"으로 본다 */
export const STALL_MS = 5000;

/** 프레임 1장 처리 — 훅 밖(모듈 수준 워크릿): try/finally가 훅 안에 있으면 React Compiler가 훅 전체를 건너뛴다. 프레임은 항상 닫는다. */
export function runFrame(frame: Frame, resizer: Resizer | undefined, run: BbqDetector['run'] | undefined, rd: { w: number; h: number }, hand?: HandRun): FrameResult {
  'worklet';
  if (!resizer || !run) {
    frame.dispose();
    return null;
  }
  let r: GPUFrame | undefined;
  try {
    const sideways = frame.orientation === 'right' || frame.orientation === 'left';
    r = resizer.resize(frame);
    // P-639: 리사이저 출력 180° 뒤집힘 보정(left·right만 역순 → BGR, P-644 가로의 up·down은 그대로)
    const inp = uprightInput(r.getPixelBuffer(), frame.orientation);
    const res = run({ data: inp.data, width: rd.w, height: rd.h, format: inp.format, layout: 'hwc' });
    const out: BbqTick = { ...res, uw: sideways ? frame.height : frame.width, uh: sideways ? frame.width : frame.height, o: frame.orientation, m: frame.isMirrored };
    if (hand) {
      // P-643: N프레임에 한 번. 카운터는 프레임 런타임 전역(워크릿 클로저는 프레임마다 복사라 못 쓴다)
      const g = globalThis as { __kbHandN?: number };
      const n = (g.__kbHandN ?? 0) + 1;
      g.__kbHandN = n;
      if (n % hand.everyN === 0) {
        const t0 = globalThis.performance?.now?.() ?? Date.now();
        out.handKey = frameKey(frame.orientation, frame.isMirrored);
        out.handVn = vnOrientation(frame.orientation, frame.isMirrored);
        try {
          out.hands = hand.pose.detect(frame, out.handVn);
        } catch (e) {
          out.handErr = String(e);
        }
        out.handMs = (globalThis.performance?.now?.() ?? Date.now()) - t0;
      }
    }
    return out;
  } catch (e) {
    const msg = String(e);
    // P-639: 백엔드·모델 전환 순간 옛 탐지기 텐서가 먼저 해제된 프레임 — 이 프레임만 버린다(전환 뒤 정상)
    if (msg.includes('has been disposed')) return null;
    return { error: msg };
  } finally {
    r?.dispose();
    frame.dispose();
  }
}

/** 화면 기준 방향 갱신: 기기가 세로(up)일 때 본 프레임 방향을 base로 기억, 모르면 카메라 기본값(후면 left·전면 거울 right, P-639 실측) */
export function nextReorient(prev: Reorient | null, f: CamOrientation, m: boolean, device: string | undefined): Reorient {
  const base: CamOrientation = device === 'up' ? f : prev && prev.m === m ? prev.base : m ? 'right' : 'left'; // 카메라 전환(거울 바뀜) = 다시 배움
  if (prev && prev.f === f && prev.m === m && prev.base === base) return prev;
  return { f, base, m };
}

/** 손 인식 객체. 네이티브 모듈이 없는 빌드(빌드 4 이하)면 undefined — 손 없이 P-641 바닥 동작 */
export function tryCreateHandPose(): HandPose | undefined {
  try {
    return createHandPose();
  } catch {
    return undefined;
  }
}

/**
 * @param scene table = 장면 1(0~6만), hand = 장면 2(7·8·9만 + 손 인식, P-644)
 * @param onShown 틱마다 트래커 결과·손(staleMs 안의 최근 값)·워크릿 시각을 넘긴다(상태 머신 입력). 렌더 중이 아니라 틱 콜백에서 불린다.
 */
export function useBbqDetection(scene: 'table' | 'hand' = 'table', onShown?: (shown: Shown[], at: number, hands: Hand[], frame: { w: number; h: number }) => void, backend: BbqBackend = 'coreml') {
  const [attempt, setAttempt] = useState(0);
  const [upright, setUpright] = useState({ w: 1080, h: 1920 });
  const [shown, setShown] = useState<Shown[]>([]);
  const [grillOn, setGrillOn] = useState(false);
  const [track] = useState(createTracker);
  const [grillGate] = useState(createGrillGate);
  const [pose] = useState(() => (scene === 'hand' ? tryCreateHandPose() : undefined));
  // P-644 가로: 카메라 출력은 기기 방향(orientationSource="device"), UI는 세로 잠금. 기기가 세로일 때의 프레임 방향 = 화면 기준(base)
  const device = useOrientation('device');
  const [xf, setXf] = useState<Reorient | null>(null);
  type HandState = { hands: Hand[]; at: number; ms: number; err: string | null; key: string };
  const [hands, setHands] = useState<HandState>({ hands: [], at: -Infinity, ms: 0, err: null, key: '' });
  /** 틱 콜백 전용(렌더 중 읽지 않음) — 손은 everyN 프레임에 한 번이라 사이 프레임은 직전 값을 쓴다 */
  const lastHands = useRef<HandState>({ hands: [], at: -Infinity, ms: 0, err: null, key: '' });

  const rd = resizeDims(upright.w, upright.h);
  const { resizer } = useResizer({ width: rd.w, height: rd.h, channelOrder: 'rgb', dataType: 'uint8', scaleMode: 'contain', pixelLayout: 'interleaved' });
  const bbq = useModel(createBbqDetector, { ...BBQ_MODELS[backend], attempt });
  const [ticks, setTicks] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const loaded = bbq.model != null;
  // 로드됐는데 STALL_MS 안에 틱 0 = 멈춤(타이머 콜백에서만 상태 변경 — 렌더·effect 본문 동기 setState 0)
  useEffect(() => {
    if (!loaded || ticks > 0) return;
    const id = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(id);
  }, [loaded, ticks, attempt]);
  const run = bbq.model?.run;

  const onError = (msg: string) => setLastError(msg);
  const onTick = (next: BbqTick) => {
    setTicks((n) => n + 1);
    setXf((prev) => nextReorient(prev, next.o, next.m, device));
    if (next.uw !== upright.w || next.uh !== upright.h) setUpright({ w: next.uw, h: next.uh });
    // P-644: 쌈 코칭(hand)은 손 위 3종만 — 담요·머리카락 위 가위·날고기 오탐을 버린다
    const dets = scene === 'table' ? scene1Only(next.dets) : next.dets.filter((d) => d.cls >= HAND_FIRST);
    const tracked = track(dets, next.at);
    setShown(tracked);
    setGrillOn(grillGate(dets, next.at));
    if (next.hands || next.handErr) {
      lastHands.current = { hands: next.hands ? parseHands(next.hands, rd.w, rd.h, next.handKey) : [], at: next.at, ms: next.handMs ?? 0, err: next.handErr ?? null, key: next.handKey ?? '' };
      setHands(lastHands.current);
    }
    const h = lastHands.current;
    onShown?.(tracked, next.at, next.at - h.at <= HAND_TUNING.staleMs ? h.hands : [], rd);
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame(frame: Frame) {
      'worklet';
      const res = runFrame(frame, resizer, run, rd, pose ? { pose, everyN: HAND_TUNING.everyN } : undefined);
      if (res && 'error' in res) scheduleOnRN(onError, res.error);
      else if (res) scheduleOnRN(onTick, res);
    },
  });

  return {
    frameOutput,
    shown,
    grillOn,
    rd,
    /** 그리기 좌표 변환(프레임 방향 → 세로 UI). toView에 넘긴다 */
    xf,
    /** 손 인식(장면 2만): 최근 결과·프레임당 ms·오류, available = 네이티브 모듈 있음 */
    hands: { ...hands, available: pose != null },
    ready: bbq.model != null,
    error: bbq.error,
    retry: () => {
      setStalled(false);
      setLastError(null);
      setTicks(0);
      setAttempt((a) => a + 1);
    },
    ticks,
    lastError,
    /** 로드됐는데 추론이 안 나온다(예외든 무응답이든) */
    stuck: loaded && ticks === 0 && (stalled || lastError != null),
  };
}
