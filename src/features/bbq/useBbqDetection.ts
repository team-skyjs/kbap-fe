/**
 * KB-1019 장면 1: 후면 카메라 프레임 → 자체 모델 v1 → 트래커·불판 조건. GuideScreen 전용.
 * ProbeScreen(측정용)은 COCO 경로와 한 워크릿에 묶여 있어 그대로 두고, 같은 부품(bbqDetector·bbqTracker)만 공유한다.
 * 시각은 탐지기 워크릿 단조 시계(at) — 렌더 경로 Date.now 0(P-630).
 */
import { useState } from 'react';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { type GPUFrame, type Resizer, useResizer } from 'react-native-vision-camera-resizer';
import { useModel } from 'react-native-executorch';
import { scheduleOnRN } from 'react-native-worklets';
import { resizeDims, type Det } from './bbqModel';
import { BBQ_MODEL, createBbqDetector, type BbqDetector, type BbqRun } from './bbqDetector';
import { createGrillGate, createTracker, type Shown } from './bbqTracker';

/** 장면 1 이름표 대상 = 0 grill ~ 6 scissors. 손 관련 7~9는 이 화면에서 버린다(트래커·불판 조건 모두). */
export const SCENE1_MAX_CLS = 6;
export const scene1Only = (dets: Det[]) => dets.filter((d) => d.cls <= SCENE1_MAX_CLS);

type Tick = BbqRun & { uw: number; uh: number };

/** 프레임 1장 처리 — 훅 밖(모듈 수준 워크릿): try/finally가 훅 안에 있으면 React Compiler가 훅 전체를 건너뛴다. 프레임은 항상 닫는다. */
function runFrame(frame: Frame, resizer: Resizer | undefined, run: BbqDetector['run'] | undefined, rd: { w: number; h: number }): Tick | null {
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
  } catch {
    return null; // 언마운트·프레임 닫힘 중 예외는 버린다
  } finally {
    r?.dispose();
    frame.dispose();
  }
}

export function useBbqDetection() {
  const [attempt, setAttempt] = useState(0);
  const [upright, setUpright] = useState({ w: 1080, h: 1920 });
  const [shown, setShown] = useState<Shown[]>([]);
  const [grillOn, setGrillOn] = useState(false);
  const [track] = useState(createTracker);
  const [grillGate] = useState(createGrillGate);

  const rd = resizeDims(upright.w, upright.h);
  const { resizer } = useResizer({ width: rd.w, height: rd.h, channelOrder: 'rgb', dataType: 'uint8', scaleMode: 'contain', pixelLayout: 'interleaved' });
  const bbq = useModel(createBbqDetector, { module: BBQ_MODEL, attempt });
  const run = bbq.model?.run;

  const onTick = (next: Tick) => {
    if (next.uw !== upright.w || next.uh !== upright.h) setUpright({ w: next.uw, h: next.uh });
    const dets = scene1Only(next.dets);
    setShown(track(dets, next.at));
    setGrillOn(grillGate(dets, next.at));
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame(frame: Frame) {
      'worklet';
      const tick = runFrame(frame, resizer, run, rd);
      if (tick) scheduleOnRN(onTick, tick);
    },
  });

  return {
    frameOutput,
    shown,
    grillOn,
    rd,
    ready: bbq.model != null,
    error: bbq.error,
    retry: () => setAttempt((a) => a + 1),
  };
}
