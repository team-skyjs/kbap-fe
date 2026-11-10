/**
 * KB-1019 1일 차 관문: 후면·전면 카메라 + executorch 기본 탐지 모델(YOLO26 nano 384, COCO) + Skia 박스.
 * 화면에 FPS·프레임당 추론 ms를 띄워 실기 측정값을 읽는다. 장면 구현 아님.
 * 박스: 리사이저가 회전·거울을 적용한 똑바로 선 정사각형(cover) 좌표 → squareCropToUpright → coverMap(P-636). 거울 토글만 보정 노브.
 * P-630: 모델 토글로 자체 모델 v1(bbq) 선택 — 이름표 유지·고기 다수결·불판 조건(bbqTracker), 추론·후처리 ms 따로 표시.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput, type Frame } from 'react-native-vision-camera';
import { type GPUFrame, useResizer } from 'react-native-vision-camera-resizer';
import { models, setTelemetryEnabled, useModel, useObjectDetector } from 'react-native-executorch';
import type { ImageBuffer } from 'react-native-executorch/cv';
import { scheduleOnRN } from 'react-native-worklets';
import { Canvas, Rect } from '@shopify/react-native-skia';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { SkBar } from '@/components/Skeleton';
import { color as C } from '@/lib/theme';
import { HAND_FIRST, LABELS, coverMap, fromXyxy, resizeDims, squareCropToUpright, uprightBgr } from './bbqModel';
import { BBQ_MODELS, createBbqDetector } from './bbqDetector';
import { runFrame, tryCreateHandPose, type BbqTick } from './useBbqDetection';
import { HAND_TUNING, parseHands, pickHand, tipSpread, type Hand } from './handPose';
import { createGrillGate, createTracker, type Shown } from './bbqTracker';

setTelemetryEnabled(false); // 모델 다운로드 익명 이벤트 끔(외부 송신 0)

const SIZE = 384;
const VARIANTS = {
  coreml: models.objectDetection.YOLO26.NANO.SIZE_384.COREML_FP16,
  xnnpack: models.objectDetection.YOLO26.NANO.SIZE_384.XNNPACK_INT8,
} as const;
type VariantKey = keyof typeof VARIANTS;

type Orientation = 'up' | 'right' | 'down' | 'left';
/** executorch 내장 탐지기 출력 — box는 xyxy({ xmin, ymin, xmax, ymax }), SIZE 정사각형 입력 좌표 */
type Det = { label: string; confidence: number; box: { xmin?: number; ymin?: number; xmax?: number; ymax?: number } };
type Tick = { dets: Det[]; ms: number; w: number; h: number; o: Orientation; at: number };

export function ProbeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const [variant, setVariant] = useState<VariantKey>('coreml');
  const [mirrorFix, setMirrorFix] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState<Tick | null>(null);
  const [fps, setFps] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const stamps = useRef<number[]>([]);
  const bbqStamps = useRef<number[]>([]);
  const [model, setModel] = useState<'coco' | 'bbq'>('coco');
  const [upright, setUpright] = useState({ w: 1080, h: 1920 });
  const [bbqTick, setBbqTick] = useState<BbqTick | null>(null);
  const [shown, setShown] = useState<Shown[]>([]);
  const [grillOn, setGrillOn] = useState(false);
  const [track] = useState(createTracker);
  const [grillGate] = useState(createGrillGate);
  // P-643: 자체 모델일 때 손 인식도(HUD 한 줄). 네이티브 모듈 없는 빌드면 undefined
  const [pose] = useState(tryCreateHandPose);
  const [hand, setHand] = useState<{ hands: Hand[]; ms: number; err: string | null } | null>(null);

  const device = useCameraDevice(position);
  const detector = useObjectDetector(VARIANTS[variant]);
  const { detectObjectsWorklet } = detector;
  const { resizer } = useResizer({ width: SIZE, height: SIZE, channelOrder: 'rgb', dataType: 'uint8', scaleMode: 'cover', pixelLayout: 'interleaved' });
  const rd = resizeDims(upright.w, upright.h);
  const { resizer: bbqResizer } = useResizer({ width: rd.w, height: rd.h, channelOrder: 'rgb', dataType: 'uint8', scaleMode: 'contain', pixelLayout: 'interleaved' });
  // P-637: 자체 모델도 Switch backend 토글로 coreml(o2o) ↔ xnnpack(e2e)
  const bbq = useModel(createBbqDetector, model === 'bbq' ? BBQ_MODELS[variant] : undefined);
  const [bbqCalls, setBbqCalls] = useState({ ok: 0, err: 0 });
  const [bbqErr, setBbqErr] = useState<string | null>(null);
  const bbqRun = bbq.model?.run;

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const onTick = (next: Tick) => {
    const now = next.at;
    const s = stamps.current.filter((x) => now - x < 1000);
    s.push(now);
    stamps.current = s;
    setFps(s.length);
    setTick(next);
  };

  const resetBbqDiag = () => {
    setBbqCalls({ ok: 0, err: 0 });
    setBbqErr(null);
    setBbqTick(null);
  };
  const onBbqErr = (msg: string) => {
    setBbqCalls((c) => ({ ...c, err: c.err + 1 }));
    setBbqErr(msg);
  };
  const onBbqTick = (next: BbqTick) => {
    setBbqCalls((c) => ({ ...c, ok: c.ok + 1 }));
    const now = next.at;
    const s = bbqStamps.current.filter((x) => now - x < 1000);
    s.push(now);
    bbqStamps.current = s;
    setFps(s.length);
    if (next.uw !== upright.w || next.uh !== upright.h) setUpright({ w: next.uw, h: next.uh });
    setBbqTick(next);
    if (next.hands || next.handErr) setHand({ hands: next.hands ? parseHands(next.hands, rd.w, rd.h) : [], ms: next.handMs ?? 0, err: next.handErr ?? null });
    setShown(track(next.dets, now));
    setGrillOn(grillGate(next.dets, now));
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame(frame: Frame) {
      'worklet';
      if (model === 'bbq') {
        // P-637: 가이드와 같은 runFrame — 예외를 삼키지 않고 HUD로
        const res = runFrame(frame, bbqResizer, bbqRun, rd, pose ? { pose, everyN: HAND_TUNING.everyN } : undefined);
        if (res && 'error' in res) scheduleOnRN(onBbqErr, res.error);
        else if (res) scheduleOnRN(onBbqTick, res);
        return;
      }
      if (!resizer || !detectObjectsWorklet) {
        frame.dispose();
        return;
      }
      let resized: GPUFrame | undefined;
      try {
        const now = () => globalThis.performance?.now?.() ?? Date.now();
        const t0 = now();
        resized = resizer.resize(frame);
        // P-639: 리사이저 출력 180° 뒤집힘 보정 — 자체 모델과 같은 uprightBgr(COCO도 같은 리사이저)
        const input: ImageBuffer = { data: uprightBgr(resized.getPixelBuffer()), width: SIZE, height: SIZE, format: 'bgr', layout: 'hwc' };
        const dets = detectObjectsWorklet(input) as unknown as Det[];
        const at = now();
        scheduleOnRN(onTick, { dets, ms: at - t0, w: frame.width, h: frame.height, o: frame.orientation, at });
      } catch {
        // 언마운트·프레임 닫힘 중 예외는 버린다(#4219 확인 대상)
      } finally {
        resized?.dispose();
        frame.dispose();
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.hud}>{t('bbqProbe.needCamera')}</Text>
        <Btn testID="bbq-allow-camera" onPress={() => void requestPermission()}>{t('bbqProbe.allowCamera')}</Btn>
      </View>
    );
  }

  // 서버 문구 아님 — 로컬 네이티브(모델 로드·카메라) 오류 원문. development·demo 채널 전용 진단 화면이라 노출(관문 보고용)
  const modelError = model === 'bbq' ? bbq.error : detector.error;
  // bbq: 마지막 워크릿 예외 원문(P-637) — 로드 오류가 없을 때
  const errText = modelError ? String(modelError) : model === 'bbq' && bbqErr ? `worklet: ${bbqErr}` : camError;
  // 버퍼 크기(tick.w×h)는 회전 전 — 리사이저 출력은 똑바로 선 쪽(옆으로 누운 방향이면 가로세로 교환)
  const sideways = tick != null && (tick.o === 'right' || tick.o === 'left');
  const uw = tick ? (sideways ? tick.h : tick.w) : 0;
  const uh = tick ? (sideways ? tick.w : tick.h) : 0;
  const rects =
    tick && view.w > 0
      ? tick.dets.flatMap((d) => {
          const b = fromXyxy(d.box);
          if (!b) return [];
          return [{ d, b, r: coverMap(squareCropToUpright(b, SIZE, uw, uh), uw, uh, view.w, view.h, mirrorFix) }];
        })
      : [];
  // P-636 진단 줄: 첫 박스의 원본(입력) 좌표 → 화면 좌표. 스크린샷 한 장으로 매핑 확인
  const f = (n: number) => Math.round(n);
  const firstBbq = model === 'bbq' ? shown[0] : undefined;
  const diag =
    model === 'coco'
      ? rects[0] && `box0 in ${f(rects[0].b.x1)},${f(rects[0].b.y1)},${f(rects[0].b.x2)},${f(rects[0].b.y2)} /${SIZE} -> view ${f(rects[0].r.x)},${f(rects[0].r.y)} ${f(rects[0].r.w)}x${f(rects[0].r.h)} of ${f(view.w)}x${f(view.h)}`
      : [
          // P-637 자가 진단: 호출 수(성공/예외) · 입력→텐서 모양 · 출력 모양 · 최고 점수(클래스) · 임계값 통과 수 · 첫 박스
          `calls ${bbqCalls.ok}/${bbqCalls.err}err`,
          bbqTick && `in ${bbqTick.diag.inShape} out ${bbqTick.diag.outShape} top ${LABELS[bbqTick.diag.topCls] ?? bbqTick.diag.topCls}:${bbqTick.diag.top.toFixed(3)} pass ${bbqTick.diag.pass}`,
          // P-643 손: 개수 · 손 인식 ms · 주 손(손 위 박스와 겹친 손, 없으면 첫 손)의 손목 · 손끝 모임 값
          (() => {
            if (!pose) return 'hands n/a';
            if (!hand) return 'hands -';
            if (hand.err) return `hands err ${hand.err}`;
            const main = pickHand(hand.hands, shown.filter((s) => s.cls >= HAND_FIRST))?.hand ?? hand.hands[0];
            const w = main?.joints[0];
            const sp = main ? tipSpread(main) : null;
            return `hands ${hand.hands.length} ${f(hand.ms)}ms wrist ${w ? `${f(w.x)},${f(w.y)}` : '-'} spread ${sp == null ? '-' : sp.toFixed(2)}`;
          })(),
          firstBbq &&
            (() => {
              const r = coverMap(firstBbq, rd.w, rd.h, view.w, view.h, mirrorFix);
              return `box0 ${LABELS[firstBbq.cls]} in ${f(firstBbq.x1)},${f(firstBbq.y1)},${f(firstBbq.x2)},${f(firstBbq.y2)} /${rd.w}x${rd.h} -> view ${f(r.x)},${f(r.y)} ${f(r.w)}x${f(r.h)}`;
            })(),
        ]
          .filter(Boolean)
          .join('\n');

  return (
    <View style={styles.root} onLayout={(e) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {device && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          orientationSource="interface"
          outputs={[frameOutput]}
          resizeMode="cover"
          onError={(e) => setCamError(e.message)}
        />
      )}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {model === 'coco' && rects.map(({ r }, i) => (
          <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} color={C.primary} style="stroke" strokeWidth={3} />
        ))}
      </Canvas>
      {model === 'bbq' &&
        view.w > 0 &&
        shown.map((s) => {
          const r = coverMap(s, rd.w, rd.h, view.w, view.h, mirrorFix);
          return (
            <View key={s.id} pointerEvents="none" style={[styles.bbqBox, { left: r.x, top: r.y, width: r.w, height: r.h, opacity: s.held ? 0.6 : 1 }]}>
              <Text style={styles.bbqTag}>{`${t(`bbqProbe.label.${LABELS[s.cls]}`)} ${Math.round(s.score * 100)}%`}</Text>
            </View>
          );
        })}
      {model === 'coco' && rects.map(({ d, r }, i) => (
        <Text key={i} style={[styles.tag, { left: r.x, top: Math.max(0, r.y - 20) }]}>
          {`${d.label} ${Math.round(d.confidence * 100)}%`}
        </Text>
      ))}

      <View style={[styles.hudBox, { top: insets.top + 8 }]}>
        {model === 'bbq' ? (
          bbq.model ? (
            <Text style={styles.hud}>
              {`bbq ${variant} ${position}  ${fps} fps  infer ${bbqTick ? bbqTick.inferMs.toFixed(1) : '-'} ms  post ${bbqTick ? bbqTick.postMs.toFixed(1) : '-'} ms  ${rd.w}x${rd.h}  load ${bbq.model.loadMs} ms  grill ${grillOn ? 'on' : 'off'}`}
            </Text>
          ) : (
            !bbq.error && (
              <View style={styles.loading}>
                <SkBar w={180} />
                <Text style={styles.hud}>{t('bbqProbe.loadingBbq')}</Text>
              </View>
            )
          )
        ) : detector.isReady ? (
          <Text style={styles.hud}>
            {`${variant} ${position}  ${fps} fps  ${tick ? tick.ms.toFixed(1) : '-'} ms  ${tick ? `${tick.w}x${tick.h} ${tick.o}` : ''}`}
          </Text>
        ) : (
          <View style={styles.loading}>
            <SkBar w={180} />
            <Text style={styles.hud}>{t('bbqProbe.loadingModel', { pct: Math.round(detector.downloadProgress * 100) })}</Text>
          </View>
        )}
        {diag ? <Text style={styles.hud} testID="bbq-probe-diag">{diag}</Text> : null}
        {errText && <Text style={styles.err}>{errText}</Text>}
      </View>

      <View style={[styles.bar, { bottom: insets.bottom + 12 }]}>
        <Btn testID="bbq-flip" variant="ghost" onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))}>{t('bbqProbe.flip')}</Btn>
        <Btn testID="bbq-model" variant="ghost" onPress={() => { resetBbqDiag(); setModel((m) => (m === 'coco' ? 'bbq' : 'coco')); }}>{t('bbqProbe.model')}</Btn>
        <Btn testID="bbq-backend" variant="ghost" onPress={() => { resetBbqDiag(); setVariant((v) => (v === 'coreml' ? 'xnnpack' : 'coreml')); }}>{t('bbqProbe.backend')}</Btn>
        <Btn testID="bbq-mirror" variant="ghost" onPress={() => setMirrorFix((m) => !m)}>{t('bbqProbe.mirror')}</Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#000' },
  hudBox: { position: 'absolute', left: 12, right: 12, gap: 4 },
  loading: { gap: 6 },
  hud: { color: '#fff', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' },
  err: { color: C.riskDanger, fontSize: 12, backgroundColor: 'rgba(0,0,0,0.7)', padding: 6 },
  tag: { position: 'absolute', color: '#fff', fontSize: 12, backgroundColor: C.primary, paddingHorizontal: 4 },
  bbqBox: { position: 'absolute', borderWidth: 3, borderColor: C.primary },
  bbqTag: { position: 'absolute', top: -20, left: -3, color: '#fff', fontSize: 12, backgroundColor: C.primary, paddingHorizontal: 4 },
  bar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
});
