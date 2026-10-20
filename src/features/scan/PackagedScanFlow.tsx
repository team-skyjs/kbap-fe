/**
 * 가공식품 스캔(KB-813 F2, D-32 Capture mode 12338:36477 · Choose your product 36537(+No candidates 37353) · Ingredient label 36679).
 * 흐름: 앞면 촬영(시스템 카메라) → 온디바이스 OCR(메뉴판과 같은 ML Kit 경로) → 서버 이름 스캔(후보 ≤5, 차감 0)
 *   → 후보 탭 = 확정(성공 1회 차감 — 서버 charged) → 가공식품 상세(스캔 결과) / 후보 없음·해당 없음 → 성분표 안내.
 * 규칙:
 * - **차감 표시는 서버 charged만**. 실패·네트워크 오류는 "차감되지 않았어요"(서버가 실패 응답에서 차감하지 않는 계약) — 횟수 추정 0.
 * - 확정 재시도 = 같은 analysisId(서버 멱등 — 같은 결과·charged false).
 * - 성분표 분석(KB-560)은 서버 미구현 → 안내 화면까지만, 촬영 버튼은 FLAGS.packagedLabelScan(off) — "곧 지원" 안내.
 *   "같은 분석으로 이어가요(추가 차감 없음)" 문구는 후보 없음·해당 없음에서 온 경우만(README 진입별 표) — 촬영 화면에서 바로 오면 쓰지 않는다.
 * - 한도: 스캔 화면 진입 시 기존 게이트(쿼터 잠금)가 먼저 막는다. 확정에서 403이 와도 대비(안내 + 닫기).
 * - OCR 주입(개발·진단 채널 전용): 시뮬엔 카메라 OCR이 없어 텍스트를 직접 넣는 디버그 입력.
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { SubHeader } from '@/components/SubHeader';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Input } from '@/components';
import { Shimmer } from '@/components/Skeleton';
import { FlameShape } from '@/components/FlameShape';
import { IconCamera } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { FLAGS, isDiagnosticChannel } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { apiLang } from '@/lib/api/client';
import { recognizeMenuLines } from '@/lib/scan/ocr';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { confirmProcessedScan, scanFailureOf, scanProcessedName, type ScanFailure } from '@/lib/data/useProcessedScan';
import type { ScanCandidate } from '@/lib/api/processedFoodAdapter';
import { ProductRow } from '@/features/processedFood/PackagedExplorer';
import { ScanModeTabs, type ScanMode } from './ScanModeTabs';

type Step =
  | { kind: 'capture' }
  | { kind: 'reading' }
  | { kind: 'candidates'; analysisId: string; candidates: ScanCandidate[] }
  | { kind: 'none'; analysisId: string }
  | { kind: 'handoff'; sameAnalysis: boolean }
  | { kind: 'error'; failure: ScanFailure; retry: (() => void) | null; chargeUnknown?: boolean };

/** 디버그 OCR 주입 노출 — 개발 번들·진단 채널(dev·teamtest)만, 스토어 채널 0 */
export const showOcrDebug = (): boolean => __DEV__ || isDiagnosticChannel();

function ScanCount({ text, testID }: { text: string; testID: string }) {
  return (
    <View style={st.countRow} testID={testID}>
      <View style={st.flameBox} pointerEvents="none">
        <FlameShape scale={0.2} state="active" />
      </View>
      <Text style={st.countText}>{text}</Text>
    </View>
  );
}

export function PackagedScanFlow({ mode, onMode, onClose }: { mode: ScanMode; onMode: (m: ScanMode) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [step, setStep] = React.useState<Step>({ kind: 'capture' });
  const [debugText, setDebugText] = React.useState('');
  const guard = useSubmitGuard(); // 촬영·확정 연타 1발(P-173)
  // Codex #310 P2: 뒤로가기 뒤에 도착한 응답은 버린다 — 요청마다 회차, 단계를 사용자가 바꾸면 회차가 올라 늦은 응답이 화면을 되돌리거나 이동시키지 않는다
  const reqSeq = React.useRef(0);
  const goStep = (next: Step) => { reqSeq.current += 1; setStep(next); };

  const runName = async (ocrText: string) => {
    goStep({ kind: 'reading' });
    const my = reqSeq.current;
    try {
      const r = await scanProcessedName(ocrText, apiLang());
      if (my !== reqSeq.current) return; // 그 사이 뒤로 감
      track(EVENTS.food_packaged_scan_name, { candidate_count: r.candidates.length });
      setStep(r.candidates.length ? { kind: 'candidates', analysisId: r.analysisId, candidates: r.candidates } : { kind: 'none', analysisId: r.analysisId });
    } catch (e) {
      if (my !== reqSeq.current) return;
      setStep({ kind: 'error', failure: scanFailureOf(e), retry: () => void runName(ocrText) });
    }
  };

  const capture = () =>
    guard.run(async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setStep({ kind: 'reading' });
      let text = '';
      try {
        text = (await recognizeMenuLines(a.uri, a.width ?? 0, a.height ?? 0)).map((l) => l.text).join('\n');
      } catch {
        text = '';
      }
      if (!text.trim()) {
        // 글자를 못 읽음 = 서버 호출 없이 후보 없음과 같은 길(차감 0) — 분석 ID가 없으니 새 분석 문맥
        setStep({ kind: 'handoff', sameAnalysis: false });
        return;
      }
      await runName(text);
    });

  /** chargeUnknown = 앞선 확정이 전송 실패(서버는 커밋했을 수 있음) — 재확정이 charged false여도 "사용 안 됨"이라 단정하지 않는다 */
  const confirm = (analysisId: string, reportNo: string | null, chargeUnknown = false) =>
    guard.run(async () => {
      const my = reqSeq.current;
      try {
        const r = await confirmProcessedScan(analysisId, reportNo);
        if (my !== reqSeq.current) return; // 그 사이 뒤로 감 — 이동 0
        track(EVENTS.food_packaged_scan_confirm, { charged: r.charged, rejected: r.rejected });
        if (r.rejected || !r.product) {
          track(EVENTS.food_packaged_scan_handoff, { from: 'rejected' });
          setStep({ kind: 'handoff', sameAnalysis: true });
          return;
        }
        // 남은 횟수 = 서버 프로필 재조회(로컬 차감 0) — 차감됐거나 차감 여부를 모를 때
        if (r.charged || chargeUnknown) void qc.invalidateQueries({ queryKey: ['me'] });
        qc.setQueryData(['processedFoods', 'detail', r.product.id, 'member'], r.product);
        const charge = r.charged ? '1' : chargeUnknown ? 'u' : '0';
        router.push(`/processed-foods/${r.product.id}?scan=1&charged=${charge}` as Href);
      } catch (e) {
        if (my !== reqSeq.current) return;
        const failure = scanFailureOf(e);
        // 전송 실패(응답 없음)는 서버가 확정·차감을 커밋했을 수 있다 → 차감 여부 미상, 같은 analysisId 재확정(멱등)으로 서버 값을 받는다
        const unknown = chargeUnknown || failure === 'network';
        setStep({ kind: 'error', failure, chargeUnknown: unknown, retry: () => void confirm(analysisId, reportNo, unknown) });
      }
    });

  const toHandoffFromNone = () => {
    track(EVENTS.food_packaged_scan_handoff, { from: 'none' });
    setStep({ kind: 'handoff', sameAnalysis: true });
  };

  // ── 화면 ──
  if (step.kind === 'reading') {
    return (
      <View style={st.root} testID="pscan-reading">
        <SubHeader title={t('packagedScan.chooseTitle')} onBack={() => goStep({ kind: 'capture' })} />
        <View style={st.darkBand} />
        <View style={[st.sheet, { gap: 20 }]}>
          <Text style={st.h1}>{t('packagedScan.reading')}</Text>
          {[0, 1, 2].map((i) => <Shimmer key={i} style={st.skelRow} />)}
        </View>
      </View>
    );
  }

  if (step.kind === 'candidates' || step.kind === 'none') {
    const none = step.kind === 'none';
    return (
      <View style={st.root} testID={none ? 'pscan-none' : 'pscan-candidates'}>
        <SubHeader title={t('packagedScan.chooseTitle')} onBack={() => goStep({ kind: 'capture' })} />
        <View style={st.darkBand} />
        <View style={[st.sheet, { flex: 1 }]}>
          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
            <Text style={st.h1} accessibilityRole="header">{t(none ? 'packagedScan.noneTitle' : 'packagedScan.whichTitle')}</Text>
            <ScanCount text={t(none ? 'packagedScan.noScanUsed' : 'packagedScan.usedOnSuccess')} testID="pscan-count" />
            <Text style={st.body}>{t(none ? 'packagedScan.noneBody' : 'packagedScan.checkMaker')}</Text>
            {!none && (
              <View style={{ marginHorizontal: -20 }}>
                {step.candidates.map((c) => (
                  <ProductRow key={c.reportNo} item={c} onOpen={() => void confirm(step.analysisId, c.reportNo)} />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
        <View style={[st.bottom, { paddingBottom: insets.bottom + 12 }]}>
          {none ? (
            <Btn onPress={toHandoffFromNone} testID="pscan-to-label">{t('packagedScan.scanLabel')}</Btn>
          ) : (
            <Btn busy={guard.busy} onPress={() => void confirm(step.analysisId, null)} testID="pscan-none-of-these">{t('packagedScan.noneOfThese')}</Btn>
          )}
        </View>
      </View>
    );
  }

  if (step.kind === 'handoff') {
    return (
      <View style={st.root} testID="pscan-handoff">
        <SubHeader title={t('packagedScan.labelTitle')} onBack={() => goStep({ kind: 'capture' })} />
        <ScrollView contentContainerStyle={st.page}>
          <Text style={st.h1}>{t('packagedScan.labelHeadline')}</Text>
          <Text style={st.body}>{t('packagedScan.labelBody')}</Text>
          <View style={st.box}>
            <IconCamera size={24} color="#FFFFFF" />
            <Text style={st.boxText}>{t('packagedScan.labelBox')}</Text>
          </View>
          {/* "같은 분석으로 이어가요"는 후보 없음·해당 없음에서 온 경우만(README 진입별 표) */}
          {step.sameAnalysis && <ScanCount text={t('packagedScan.sameAnalysis')} testID="pscan-same-analysis" />}
          <Text style={st.muted}>{t('packagedScan.successOnly')}</Text>
          {!FLAGS.packagedLabelScan && <Text style={st.muted} testID="pscan-label-soon">{t('packagedScan.labelSoon')}</Text>}
        </ScrollView>
        <View style={[st.bottom, { paddingBottom: insets.bottom + 12 }]}>
          {/* 성분표 분석(KB-560) 서버 미구현 — 비활성(촬영 연결은 KB-560에서 FLAGS.packagedLabelScan과 함께) */}
          <Btn variant="off" testID="pscan-label-capture">
            {t('packagedScan.labelCta')}
          </Btn>
        </View>
      </View>
    );
  }

  if (step.kind === 'error') {
    const f = step.failure;
    return (
      <View style={st.root} testID={`pscan-error-${f}`}>
        <SubHeader title={t('packagedScan.title')} onBack={() => goStep({ kind: 'capture' })} />
        <View style={[st.page, { gap: 16 }]}>
          <Text style={st.h1}>{t(`packagedScan.err.${f}Title`)}</Text>
          {/* 이름 스캔·서버가 거절한 확정 = 차감 없음(계약). 확정 전송 실패 = 차감 여부 미상 — 단정하지 않고 "확인 중" */}
          <ScanCount text={t(step.chargeUnknown ? 'packagedScan.chargeChecking' : 'packagedScan.noScanUsed')} testID="pscan-error-count" />
          <Text style={st.body}>{t(`packagedScan.err.${f}Body`)}</Text>
          {f === 'network' && step.retry && <Btn busy={guard.busy} onPress={step.retry} testID="pscan-retry">{t('common.tryAgain')}</Btn>}
          {f === 'quota' ? (
            <Btn variant="ghost" onPress={onClose} testID="pscan-close">{t('common.close')}</Btn>
          ) : (
            <Btn variant="ghost" onPress={() => goStep({ kind: 'capture' })} testID="pscan-retake">{t('packagedScan.retake')}</Btn>
          )}
        </View>
      </View>
    );
  }

  // capture
  return (
    <View style={st.root} testID="pscan-capture">
      <SubHeader title={t('packagedScan.title')} onBack={onClose} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <ScanModeTabs value={mode} onChange={onMode} />
        <View style={st.page}>
          <Text style={st.eyebrow}>{t('scanMode.packaged')}</Text>
          <Text style={st.h1}>{t('packagedScan.captureHeadline')}</Text>
          <Text style={st.body}>{t('packagedScan.captureBody')}</Text>
          <View style={st.box} testID="pscan-box">
            <IconCamera size={24} color="#FFFFFF" />
            <Text style={st.boxText}>{t('packagedScan.captureBox')}</Text>
          </View>
          <Btn variant="ghost" onPress={() => { track(EVENTS.food_packaged_scan_handoff, { from: 'capture' }); setStep({ kind: 'handoff', sameAnalysis: false }); }} style={st.outline} testID="pscan-label-instead">
            {t('packagedScan.labelInstead')}
          </Btn>
          {showOcrDebug() && (
            <View style={st.debug} testID="pscan-ocr-debug">
              <Text style={st.muted}>{t('packagedScan.debugLabel')}</Text>
              <Input value={debugText} onChangeText={setDebugText} multiline style={st.debugInput} testID="pscan-ocr-debug-input" placeholder={t('packagedScan.debugPlaceholder')} />
              <Btn variant="ghost" sm onPress={() => debugText.trim() && void runName(debugText)} testID="pscan-ocr-debug-run">{t('packagedScan.debugRun')}</Btn>
            </View>
          )}
        </View>
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Btn busy={guard.busy} onPress={() => void capture()} testID="pscan-take-photo">{t('packagedScan.takePhoto')}</Btn>
      </View>
    </View>
  );
}

// 시안 실측(2x): 본문 좌우 20 · 안내 eyebrow 15 primary · 제목 28 bold · 본문 15/22 · 촬영 상자 335×264 r24 #2F3137(아이콘 + 18 semibold 흰 글자)
// · 아웃라인 40 · 하단 고정 버튼 · 후보 시트 = 어두운 띠 200 위 흰 시트 r24
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  page: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  eyebrow: { fontFamily: font.body, fontSize: 15, lineHeight: 20, color: C.primary },
  h1: { fontFamily: font.bodyBold, fontSize: 28, lineHeight: 36, color: C.ink },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: C.ink },
  muted: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: C.ink2 },
  box: { height: 264, borderRadius: 24, backgroundColor: '#2F3137', alignItems: 'center', justifyContent: 'center', gap: 12 },
  boxText: { fontFamily: font.bodySemi, fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  outline: { minHeight: 40, paddingVertical: 8 },
  bottom: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: C.card },
  darkBand: { height: 100, backgroundColor: '#2F3137' },
  sheet: { marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: C.card, paddingHorizontal: 20, paddingTop: 20 },
  skelRow: { height: 72, borderRadius: 8 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flameBox: { width: 24, height: 30, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  countText: { flex: 1, fontFamily: font.body, fontSize: 14, lineHeight: 20, color: C.ink2 },
  debug: { gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' },
  debugInput: { minHeight: 72, textAlignVertical: 'top' },
});
