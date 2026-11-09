/**
 * KB-1019 장면 1(테이블 이름표) + 장면 3(굽는 방식 묻기). 후면 카메라, 손에 들고.
 * - 이름표: 자체 모델 v1 7종(grill~scissors), 누르면 한 줄 설명. 회피 연결은 bbqAvoid(주의·판정 불가만, safe 0).
 * - 불판 띠 → 종업원 한국어 카드(사장님 카드 레이아웃 재사용) → 영어 결과. 서버 호출·저장 없음.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { setTelemetryEnabled } from 'react-native-executorch';
import { Canvas, Rect } from '@shopify/react-native-skia';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { SkBar } from '@/components/Skeleton';
import { IconClose } from '@/components/icons';
import { PressScale, RISK, RiskMark, RiskPill } from '@/components';
import { color as C, font, radius } from '@/lib/theme';
import { useSession } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { openAppSettings } from '@/lib/openExternal';
import { isLongQuestion, ownerCardStyles as O } from '@/app/food/[id]/owner';
import { LABELS, coverMap } from './bbqModel';
import { avoidFrom, tagRisk } from './bbqAvoid';
import { GRILL_ANSWERS, GRILL_ASK_KO, type GrillAnswer } from './grillAsk';
import { useBbqDetection } from './useBbqDetection';

setTelemetryEnabled(false);

export function GuideScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const det = useBbqDetection();
  const session = useSession();
  const me = useMe();
  const avoid = avoidFrom(session, me.data, me.error);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [picked, setPicked] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<GrillAnswer | null>(null);
  const [camError, setCamError] = useState(false);
  const [camKey, setCamKey] = useState(0);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) void requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  const close = (
    <PressScale style={[styles.close, { top: insets.top + 10 }]} onPress={() => router.back()} hitSlop={8} testID="bbq-guide-close" accessibilityLabel={t('bbqGuide.close')}>
      <IconClose size={22} color={C.ink2} />
    </PressScale>
  );

  if (!hasPermission) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        {close}
        <Text style={styles.msg}>{t('bbqGuide.needCamera')}</Text>
        {canRequestPermission ? (
          <Btn testID="bbq-guide-allow-camera" onPress={() => void requestPermission()}>{t('bbqGuide.allowCamera')}</Btn>
        ) : (
          <Btn testID="bbq-guide-open-settings" onPress={() => void openAppSettings()}>{t('bbqGuide.openSettings')}</Btn>
        )}
      </View>
    );
  }

  const pickedRisk = picked == null ? null : tagRisk(picked, avoid);

  return (
    <View style={styles.root} onLayout={(e) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {device && !camError && (
        <Camera
          key={camKey}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!asking}
          orientationSource="interface"
          outputs={[det.frameOutput]}
          resizeMode="cover"
          onError={() => setCamError(true)}
        />
      )}

      {view.w > 0 && (
        <>
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {det.shown.map((s) => {
              const r = coverMap(s, det.rd.w, det.rd.h, view.w, view.h, false);
              const risk = tagRisk(s.cls, avoid);
              return <Rect key={s.id} x={r.x} y={r.y} width={r.w} height={r.h} color={risk ? RISK[risk.state].color : C.primary} style="stroke" strokeWidth={3} />;
            })}
          </Canvas>
          {det.shown.map((s) => {
            const r = coverMap(s, det.rd.w, det.rd.h, view.w, view.h, false);
            const risk = tagRisk(s.cls, avoid);
            const label = LABELS[s.cls]!;
            return (
              <Pressable
                key={s.id}
                testID={`bbq-tag-${label}`}
                onPress={() => setPicked((p) => (p === s.cls ? null : s.cls))}
                hitSlop={8}
                style={[styles.tag, { left: Math.max(4, Math.min(r.x, view.w - 140)), top: Math.max(insets.top + 56, r.y - 30) }]}
              >
                {risk && <RiskMark state={risk.state} size={14} />}
                <Text style={styles.tagText}>{t(`bbqProbe.label.${label}`)}</Text>
              </Pressable>
            );
          })}
        </>
      )}

      {close}

      <View style={[styles.top, { top: insets.top + 64 }]} pointerEvents="box-none">
        {camError ? (
          <View style={styles.status}>
            <Text style={styles.statusText}>{t('bbqGuide.camFail')}</Text>
            <Btn testID="bbq-guide-cam-retry" sm onPress={() => { setCamError(false); setCamKey((k) => k + 1); }}>{t('bbqGuide.retry')}</Btn>
          </View>
        ) : det.error ? (
          <View style={styles.status}>
            <Text style={styles.statusText}>{t('bbqGuide.loadFail')}</Text>
            <Btn testID="bbq-guide-model-retry" sm onPress={det.retry}>{t('bbqGuide.retry')}</Btn>
          </View>
        ) : !det.ready ? (
          <View style={styles.status}>
            <SkBar w={180} />
            <Text style={styles.statusText}>{t('bbqGuide.loading')}</Text>
          </View>
        ) : (
          det.shown.length === 0 && <Text style={styles.hint}>{t('bbqGuide.pointHint')}</Text>
        )}
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
        {picked != null && (
          <Pressable style={styles.card} onPress={() => setPicked(null)} testID="bbq-guide-desc">
            <Text style={styles.cardText}>{t(`bbqGuide.desc.${LABELS[picked]}`)}</Text>
            {pickedRisk && <RiskPill state={pickedRisk.state} label={t(pickedRisk.reasonKey)} />}
          </Pressable>
        )}
        {answer ? (
          <View style={styles.card} testID="bbq-guide-result">
            <Text style={styles.cardText}>{t(`bbqGuide.result.${answer}`)}</Text>
            <Btn testID="bbq-guide-result-done" sm variant="ghost" onPress={() => setAnswer(null)}>{t('bbqGuide.resultDone')}</Btn>
          </View>
        ) : (
          det.grillOn && (
            <Pressable style={styles.band} onPress={() => setAsking(true)} testID="bbq-grill-band" accessibilityRole="button">
              <Text style={styles.bandText}>{t('bbqGuide.grillBand')}</Text>
            </Pressable>
          )
        )}
      </View>

      {asking && (
        <View style={[StyleSheet.absoluteFill, O.root, { paddingTop: insets.top }]}>
          <PressScale style={[O.close, { top: insets.top + 10 }]} onPress={() => setAsking(false)} hitSlop={8} testID="bbq-ask-close">
            <IconClose size={22} color={C.ink2} />
          </PressScale>
          <View style={O.center}>
            <Text style={[O.question, isLongQuestion(GRILL_ASK_KO) && O.questionLong]} lineBreakStrategyIOS="hangul-word">
              {GRILL_ASK_KO}
            </Text>
            <Text style={O.caption}>{t('owner.caption')}</Text>
          </View>
          <View style={[O.foot, styles.answers, { paddingBottom: insets.bottom + 18 }]}>
            {GRILL_ANSWERS.map((a) => (
              <PressScale
                key={a.key}
                style={O.done}
                testID={`bbq-ask-${a.key}`}
                onPress={() => {
                  setAnswer(a.key);
                  setAsking(false);
                }}
              >
                <Text style={[O.doneText, styles.koAnswer]}>{a.ko}</Text>
              </PressScale>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 30, backgroundColor: '#fff' },
  msg: { fontFamily: font.bodyBold, fontSize: 17, color: C.ink, textAlign: 'center' },
  close: { position: 'absolute', left: 18, zIndex: 5, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  status: { alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.lg, padding: 14 },
  statusText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 15, textAlign: 'center' },
  hint: { color: '#fff', fontSize: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden' },
  tag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  bottom: { position: 'absolute', left: 16, right: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 16, gap: 10 },
  cardText: { fontSize: 15, lineHeight: 21, color: C.ink },
  band: { backgroundColor: C.ink, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 18 },
  bandText: { fontFamily: font.bodyBold, fontSize: 15, color: '#fff', textAlign: 'center' },
  answers: { gap: 10 },
  koAnswer: { fontFamily: font.koBold },
});
