/**
 * KB-1019 1일 차 관문: 후면·전면 카메라 + executorch 기본 탐지 모델(YOLO26 nano 384, COCO) + Skia 박스.
 * 화면에 FPS·프레임당 추론 ms를 띄워 실기 측정값을 읽는다. 장면 구현 아님.
 * 회전·거울은 실기 보정 토글(boxMap 참고).
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
import { addTurns, mapBox, type Orientation } from './boxMap';
import { LABELS, coverMap, resizeDims, type Det as BbqDet } from './bbqModel';
import { BBQ_MODEL, createBbqDetector } from './bbqDetector';
import { createGrillGate, createTracker, type Shown } from './bbqTracker';

setTelemetryEnabled(false); // 모델 다운로드 익명 이벤트 끔(외부 송신 0)

const SIZE = 384;
const VARIANTS = {
  coreml: models.objectDetection.YOLO26.NANO.SIZE_384.COREML_FP16,
  xnnpack: models.objectDetection.YOLO26.NANO.SIZE_384.XNNPACK_INT8,
} as const;
type VariantKey = keyof typeof VARIANTS;

type Det = { label: string; confidence: number; box: { x1: number; y1: number; x2: number; y2: number } };
type Tick = { dets: Det[]; ms: number; w: number; h: number; o: Orientation };
type BbqTick = { dets: BbqDet[]; inferMs: number; postMs: number; uw: number; uh: number };

export function ProbeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const [variant, setVariant] = useState<VariantKey>('coreml');
  const [turns, setTurns] = useState(0);
  const [mirrorFix, setMirrorFix] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState<Tick | null>(null);
  const [fps, setFps] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const stamps = useRef<number[]>([]);
  const [model, setModel] = useState<'coco' | 'bbq'>('coco');
  const [upright, setUpright] = useState({ w: 1080, h: 1920 });
  const [bbqTick, setBbqTick] = useState<BbqTick | null>(null);
  const [shown, setShown] = useState<Shown[]>([]);
  const [grillOn, setGrillOn] = useState(false);
  const [track] = useState(createTracker);
  const [grillGate] = useState(createGrillGate);

  const device = useCameraDevice(position);
  const detector = useObjectDetector(VARIANTS[variant]);
  const { detectObjectsWorklet } = detector;
  const { resizer } = useResizer({ width: SIZE, height: SIZE, channelOrder: 'rgb', dataType: 'uint8', scaleMode: 'cover', pixelLayout: 'interleaved' });
  const rd = resizeDims(upright.w, upright.h);
  const { resizer: bbqResizer } = useResizer({ width: rd.w, height: rd.h, channelOrder: 'rgb', dataType: 'uint8', scaleMode: 'contain', pixelLayout: 'interleaved' });
  const bbq = useModel(createBbqDetector, model === 'bbq' ? { module: BBQ_MODEL } : undefined);
  const bbqRun = bbq.model?.run;

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const onTick = (next: Tick) => {
    const now = Date.now();
    const s = stamps.current.filter((x) => now - x < 1000);
    s.push(now);
    stamps.current = s;
    setFps(s.length);
    setTick(next);
  };

  const onBbqTick = (next: BbqTick) => {
    const now = Date.now();
    onTick({ dets: [], ms: next.inferMs + next.postMs, w: next.uw, h: next.uh, o: 'up' });
    if (next.uw !== upright.w || next.uh !== upright.h) setUpright({ w: next.uw, h: next.uh });
    setBbqTick(next);
    setShown(track(next.dets, now));
    setGrillOn(grillGate(next.dets, now));
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame(frame: Frame) {
      'worklet';
      if (model === 'bbq') {
        if (!bbqResizer || !bbqRun) {
          frame.dispose();
          return;
        }
        let r: GPUFrame | undefined;
        try {
          const sideways = frame.orientation === 'right' || frame.orientation === 'left';
          r = bbqResizer.resize(frame);
          const res = bbqRun({ data: new Uint8Array(r.getPixelBuffer()), width: rd.w, height: rd.h, format: 'rgb', layout: 'hwc' });
          scheduleOnRN(onBbqTick, { ...res, uw: sideways ? frame.height : frame.width, uh: sideways ? frame.width : frame.height });
        } catch {
          // 언마운트·프레임 닫힘 중 예외는 버린다
        } finally {
          r?.dispose();
          frame.dispose();
        }
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
        const input: ImageBuffer = { data: new Uint8Array(resized.getPixelBuffer()), width: SIZE, height: SIZE, format: 'rgb', layout: 'hwc' };
        const dets = detectObjectsWorklet(input) as unknown as Det[];
        const ms = now() - t0;
        scheduleOnRN(onTick, { dets, ms, w: frame.width, h: frame.height, o: frame.orientation });
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
  const errText = modelError ? String(modelError) : camError;
  const orientation = tick ? addTurns(tick.o, turns) : 'up';
  const mirror = (position === 'front') !== mirrorFix;
  const rects =
    tick && view.w > 0
      ? tick.dets.map((d) => ({ d, r: mapBox({ box: d.box, inputSize: SIZE, frameW: tick.w, frameH: tick.h, orientation, viewW: view.w, viewH: view.h, mirror }) }))
      : [];

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
              {`bbq ${position}  ${fps} fps  infer ${bbqTick ? bbqTick.inferMs.toFixed(1) : '-'} ms  post ${bbqTick ? bbqTick.postMs.toFixed(1) : '-'} ms  ${rd.w}x${rd.h}  load ${bbq.model.loadMs} ms  grill ${grillOn ? 'on' : 'off'}`}
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
        {errText && <Text style={styles.err}>{errText}</Text>}
      </View>

      <View style={[styles.bar, { bottom: insets.bottom + 12 }]}>
        <Btn testID="bbq-flip" variant="ghost" onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))}>{t('bbqProbe.flip')}</Btn>
        <Btn testID="bbq-model" variant="ghost" onPress={() => setModel((m) => (m === 'coco' ? 'bbq' : 'coco'))}>{t('bbqProbe.model')}</Btn>
        <Btn testID="bbq-backend" variant="ghost" onPress={() => setVariant((v) => (v === 'coreml' ? 'xnnpack' : 'coreml'))}>{t('bbqProbe.backend')}</Btn>
        <Btn testID="bbq-rotate" variant="ghost" onPress={() => setTurns((n) => (n + 1) % 4)}>{t('bbqProbe.rotate')}</Btn>
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
