/**
 * KB-1019 장면 2 쌈 코칭(P-632 뼈대). 거치대 + 전면 카메라(거울).
 * 신호원: 모델(leaf_on_hand·topped_leaf·wrapped_ssam) + 손 인식(P-643, handPose.createHandSignals) + 수동 Next(바닥 동작).
 * 손이 안 잡히면 모델만으로 P-641 매핑. 쌈장 신호원은 없음.
 * 수동으로 넘긴 단계는 체크만, "Nice wrap"은 S5 자동 인식 뒤에만(wrapCoach.finishedByAuto).
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Canvas, Circle, Rect } from '@shopify/react-native-skia';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { SkBar } from '@/components/Skeleton';
import { IconCheck, IconClose } from '@/components/icons';
import { PressScale, RiskMark, RiskPill } from '@/components';
import { color as C, font, radius, riskText } from '@/lib/theme';
import { useSession } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { openAppSettings } from '@/lib/openExternal';
import { coverMap } from './bbqModel';
import { avoidFrom, tagRisk } from './bbqAvoid';
import type { Shown } from './bbqTracker';
import { NO_SIGNALS, STEPS, createCoach, currentStep, finishedByAuto, isDone, step, type CoachState, type Mark } from './wrapCoach';
import { HAND_TUNING, createHandSignals, type Hand } from './handPose';
import { useBbqDetection } from './useBbqDetection';

const SSAMJANG = 4;

export function WrapScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ssamjang } = useLocalSearchParams<{ ssamjang?: string }>();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const session = useSession();
  const me = useMe();
  const avoid = avoidFrom(session, me.data, me.error);
  const avoidRisk = tagRisk(SSAMJANG, avoid);
  const [started, setStarted] = useState(false);
  const [boxes, setBoxes] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [camError, setCamError] = useState(false);
  const [camKey, setCamKey] = useState(0);
  const lastAt = useRef(0);
  /** 시작·다시 하기 때 만든다(회피 정보가 늦게 와도 시작 시점 값으로) */
  const fresh = () => createCoach({ sawSsamjang: ssamjang === '1', avoidSsamjang: avoidRisk != null }, lastAt.current);
  const [coach, setCoach] = useState<CoachState>(() => createCoach({ sawSsamjang: ssamjang === '1', avoidSsamjang: avoidRisk != null }, 0));

  const [handSignals] = useState(createHandSignals);
  const onShown = (shown: Shown[], at: number, hands: Hand[], frameH: number) => {
    lastAt.current = at;
    const sig = handSignals(shown, hands, frameH);
    setCoach((c) => step(c, sig, at));
  };
  const det = useBbqDetection('hand', onShown);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) void requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  const close = (
    <PressScale style={[styles.close, { top: insets.top + 10 }]} onPress={() => router.back()} hitSlop={8} testID="bbq-wrap-close" accessibilityLabel={t('bbqGuide.close')}>
      <IconClose size={22} color={C.ink2} />
    </PressScale>
  );

  if (!started || !hasPermission) {
    return (
      <View style={[styles.intro, { paddingTop: insets.top }]}>
        {close}
        <Text style={styles.introTitle}>{t('bbqWrap.prop')}</Text>
        <Text style={styles.introSub}>{t('bbqWrap.propSub')}</Text>
        {hasPermission ? (
          <Btn testID="bbq-wrap-start" onPress={() => { setCoach(fresh()); setStarted(true); }}>{t('bbqWrap.start')}</Btn>
        ) : canRequestPermission ? (
          <Btn testID="bbq-wrap-allow-camera" onPress={() => void requestPermission()}>{t('bbqGuide.allowCamera')}</Btn>
        ) : (
          <Btn testID="bbq-wrap-open-settings" onPress={() => void openAppSettings()}>{t('bbqGuide.openSettings')}</Btn>
        )}
      </View>
    );
  }

  const cur = currentStep(coach);
  const done = isDone(coach);
  const showAvoid = avoidRisk != null && coach.marks.ssamjang === 'avoid' && (cur === 'meat' || cur === 'wrap');

  return (
    <View style={styles.root} onLayout={(e) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {device && !camError && (
        <Camera key={camKey} style={StyleSheet.absoluteFill} device={device} isActive={!done} orientationSource="interface" outputs={[det.frameOutput]} resizeMode="cover" onError={() => setCamError(true)} />
      )}
      {boxes && view.w > 0 && (
        <>
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {det.shown.map((s) => {
              const r = coverMap(s, det.rd.w, det.rd.h, view.w, view.h, false);
              return <Rect key={s.id} x={r.x} y={r.y} width={r.w} height={r.h} color={C.primary} style="stroke" strokeWidth={3} />;
            })}
            {det.hands.hands.flatMap((h, hi) =>
              h.joints.flatMap((j, ji) => {
                if (j.c < HAND_TUNING.minConf) return [];
                const p = coverMap({ x1: j.x, y1: j.y, x2: j.x, y2: j.y }, det.rd.w, det.rd.h, view.w, view.h, false);
                return [<Circle key={`${hi}-${ji}`} cx={p.x} cy={p.y} r={4} color={C.accent} />];
              }),
            )}
          </Canvas>
          {det.shown.map((s) => {
            const r = coverMap(s, det.rd.w, det.rd.h, view.w, view.h, false);
            return (
              <Text key={s.id} style={[styles.dbgTag, { left: Math.max(0, r.x), top: Math.max(0, r.y - 18) }]}>
                {`${s.cls} ${Math.round(s.score * 100)}`}
              </Text>
            );
          })}
        </>
      )}
      {close}

      <View style={[styles.progress, { top: insets.top + 12 }]} testID="bbq-wrap-progress">
        {STEPS.map((id, i) => (
          <View key={id} style={styles.slot}>
            <View style={[styles.dot, i === coach.idx && styles.dotCur]}>
              <SlotMark mark={coach.marks[id]} risk={avoidRisk?.state} />
            </View>
            <Text style={[styles.slotText, (coach.marks[id] === 'skipped' || coach.marks[id] === 'missed') && styles.slotDim]}>{t(`bbqWrap.short.${id}`)}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + 16 }]}>
        {camError ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>{t('bbqGuide.camFail')}</Text>
            <Btn testID="bbq-wrap-cam-retry" sm onPress={() => { setCamError(false); setCamKey((k) => k + 1); }}>{t('bbqGuide.retry')}</Btn>
          </View>
        ) : det.error || det.stuck ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>{t(det.stuck ? 'bbqGuide.stuck' : 'bbqGuide.loadFail')}</Text>
            <Btn testID="bbq-wrap-model-retry" sm onPress={det.retry}>{t('bbqGuide.retry')}</Btn>
          </View>
        ) : !det.ready ? (
          <View style={styles.card}>
            <SkBar w={180} />
            <Text style={styles.cardText}>{t('bbqGuide.loading')}</Text>
          </View>
        ) : null}
        <View style={styles.card} testID="bbq-wrap-step">
          {done ? (
            <Text style={styles.stepText}>{t(finishedByAuto(coach) ? 'bbqWrap.niceWrap' : 'bbqWrap.allDone')}</Text>
          ) : (
            <Text style={styles.stepText}>{t(`bbqWrap.step.${cur}`)}</Text>
          )}
          {coach.tip && <Text style={styles.tipText}>{t(`bbqWrap.tip.${coach.tip}`)}</Text>}
          {showAvoid && avoidRisk && <RiskPill state={avoidRisk.state} label={t(avoidRisk.reasonKey)} />}
          <View style={styles.row}>
            {done ? (
              <Btn testID="bbq-wrap-again" sm onPress={() => setCoach(fresh())}>{t('bbqWrap.again')}</Btn>
            ) : (
              <Btn testID="bbq-wrap-next" sm onPress={() => setCoach((c) => step(c, { ...NO_SIGNALS, manualNext: true }, lastAt.current))}>{t('bbqWrap.next')}</Btn>
            )}
            <Btn testID="bbq-wrap-boxes" sm variant="ghost" onPress={() => setBoxes((b) => !b)}>{t('bbqWrap.boxes')}</Btn>
          </View>
        </View>
      </View>
    </View>
  );
}

/** 진행 표시 슬롯: 체크(자동·수동 같음 — 칭찬 없음), 회피 = 기존 위험 표시, 나머지 = 빈 원. 슬롯 크기 고정(프레임 불변). */
function SlotMark({ mark, risk }: { mark: Mark; risk?: 'caution' | 'unable' }) {
  if (mark === 'auto' || mark === 'manual') return <IconCheck size={16} color="#fff" />;
  if (mark === 'avoid' && risk) return <RiskMark state={risk} size={16} />;
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 30, backgroundColor: '#fff' },
  introTitle: { fontFamily: font.display, fontSize: 24, lineHeight: 31, color: C.ink, textAlign: 'center' },
  introSub: { fontSize: 15, lineHeight: 21, color: C.ink2, textAlign: 'center', marginBottom: 8 },
  close: { position: 'absolute', left: 18, zIndex: 5, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  progress: { position: 'absolute', left: 70, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  slot: { alignItems: 'center', gap: 4, width: 56 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  dotCur: { borderColor: '#fff' },
  slotText: { color: '#fff', fontSize: 11, fontFamily: font.bodyBold },
  slotDim: { opacity: 0.5 },
  bottom: { position: 'absolute', left: 16, right: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 16, gap: 10 },
  cardText: { fontSize: 15, lineHeight: 21, color: C.ink },
  stepText: { fontFamily: font.display, fontSize: 20, lineHeight: 27, color: C.ink },
  tipText: { fontFamily: font.bodyBold, fontSize: 15, color: riskText.caution },
  row: { flexDirection: 'row', gap: 8 },
  dbgTag: { position: 'absolute', color: '#fff', fontSize: 11, backgroundColor: C.primary, paddingHorizontal: 3 },
});
