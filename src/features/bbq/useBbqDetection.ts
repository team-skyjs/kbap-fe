/**
 * KB-1019 장면 1: 후면 카메라 프레임 → 자체 모델 v1 → 트래커·불판 조건. GuideScreen 전용.
 * ProbeScreen(측정용)은 COCO 경로와 한 워크릿에 묶여 있어 그대로 두고, 같은 부품(bbqDetector·bbqTracker)만 공유한다.
 * 시각은 탐지기 워크릿 단조 시계(at) — 렌더 경로 Date.now 0(P-630).
 */
import { useEffect, useState } from 'react';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { type GPUFrame, type Resizer, useResizer } from 'react-native-vision-camera-resizer';
import { useModel } from 'react-native-executorch';
import { scheduleOnRN } from 'react-native-worklets';
import { resizeDims, type Det } from './bbqModel';
import { BBQ_MODELS, createBbqDetector, type BbqBackend, type BbqDetector, type BbqRun } from './bbqDetector';
import { createGrillGate, createTracker, type Shown } from './bbqTracker';

/** 장면 1 이름표 대상 = 0 grill ~ 6 scissors. 손 관련 7~9는 이 화면에서 버린다(트래커·불판 조건 모두). */
export const SCENE1_MAX_CLS = 6;
export const scene1Only = (dets: Det[]) => dets.filter((d) => d.cls <= SCENE1_MAX_CLS);

export type BbqTick = BbqRun & { uw: number; uh: number };
/** 워크릿 예외도 결과로 돌려준다(P-637: catch가 삼켜 실기 추론 0의 원인이 화면에 안 보였다) */
export type FrameResult = BbqTick | { error: string } | null;
/** 로드 뒤 이 시간 안에 틱이 한 번도 안 오면 "멈춤"으로 본다 */
export const STALL_MS = 5000;

/** 프레임 1장 처리 — 훅 밖(모듈 수준 워크릿): try/finally가 훅 안에 있으면 React Compiler가 훅 전체를 건너뛴다. 프레임은 항상 닫는다. */
export function runFrame(frame: Frame, resizer: Resizer | undefined, run: BbqDetector['run'] | undefined, rd: { w: number; h: number }): FrameResult {
  'worklet';
  if (!resizer || !run) {
    frame.dispose();
    return null;
  }
  let r: GPUFrame | undefined;
  try {
    const sideways = frame.orientation === 'right' || frame.orientation === 'left';
    r = resizer.resize(frame);
    const res = run({ data: new Uint8Array(r.getPixelBuffer()), width: rd.w, height: rd.h, format: 'rgb', layout: 'hwc' });
    return { ...res, uw: sideways ? frame.height : frame.width, uh: sideways ? frame.width : frame.height };
  } catch (e) {
    return { error: String(e) };
  } finally {
    r?.dispose();
    frame.dispose();
  }
}

/**
 * @param scene table = 장면 1(0~6만), hand = 장면 2(전 클래스 — 디버그 박스·신호는 화면이 고른다)
 * @param onShown 틱마다 트래커 결과와 워크릿 시각을 넘긴다(상태 머신 입력). 렌더 중이 아니라 틱 콜백에서 불린다.
 */
export function useBbqDetection(scene: 'table' | 'hand' = 'table', onShown?: (shown: Shown[], at: number) => void, backend: BbqBackend = 'coreml') {
  const [attempt, setAttempt] = useState(0);
  const [upright, setUpright] = useState({ w: 1080, h: 1920 });
  const [shown, setShown] = useState<Shown[]>([]);
  const [grillOn, setGrillOn] = useState(false);
  const [track] = useState(createTracker);
  const [grillGate] = useState(createGrillGate);

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
    if (next.uw !== upright.w || next.uh !== upright.h) setUpright({ w: next.uw, h: next.uh });
    const dets = scene === 'table' ? scene1Only(next.dets) : next.dets;
    const tracked = track(dets, next.at);
    setShown(tracked);
    setGrillOn(grillGate(dets, next.at));
    onShown?.(tracked, next.at);
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame(frame: Frame) {
      'worklet';
      const res = runFrame(frame, resizer, run, rd);
      if (res && 'error' in res) scheduleOnRN(onError, res.error);
      else if (res) scheduleOnRN(onTick, res);
    },
  });

  return {
    frameOutput,
    shown,
    grillOn,
    rd,
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
