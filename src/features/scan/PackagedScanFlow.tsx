/**
 * 가공식품 스캔(KB-813 F2, D-32 Capture mode 12338:36477 · Choose your product 36537(+No candidates 37353) · Ingredient label 36679).
 * 흐름: 앞면 촬영(시스템 카메라) → 온디바이스 OCR(메뉴판과 같은 ML Kit 경로) → 서버 이름 스캔(후보 ≤5, 차감 0)
 *   → 후보 탭 = 확정(성공 1회 차감 — 서버 charged) → 가공식품 상세(스캔 결과) / 후보 없음·해당 없음 → 성분표 안내.
 * 규칙:
 * - **차감 표시는 서버 charged만**. 실패·네트워크 오류는 "차감되지 않았어요"(서버가 실패 응답에서 차감하지 않는 계약) — 횟수 추정 0.
 * - 확정 재시도 = 같은 analysisId(서버 멱등 — 같은 결과·charged false).
 * - 성분표 분석(P-508, 서버 #442 scan/label): 안내 → 성분표 촬영(면 추가 최대 4) → 분석 → 결과(상세 판정 섹션 재사용 + 함유 가능 칩).
 *   후보 없음·해당 없음에서 오면 **같은 analysisId**(추가 차감 0 — "같은 분석" 문구는 이 경로만), 촬영 화면·상세에서 바로 오면 새 분석(성공 1회).
 *   결과의 "면 추가" = 같은 ID 재분석(첫 성공 뒤 30분·3회까지 차감 0 — 서버 규칙), 넘으면 409 PFOOD-007 → "새로 분석"(1회).
 *   못 읽음 400 PFOOD-006 = 차감 0, 다시 찍기. 촬영 버튼은 FLAGS.packagedLabelScan(꺼진 채널 = "곧 지원" 안내).
 * - 한도: 스캔 화면 진입 시 기존 게이트(쿼터 잠금)가 먼저 막는다. 확정에서 403이 와도 대비(안내 + 닫기).
 * - OCR 주입(개발·진단 채널 전용): 시뮬엔 카메라 OCR이 없어 텍스트를 직접 넣는 디버그 입력.
 */
import * as React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
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
import { openAppSettings } from '@/lib/openExternal';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { confirmProcessedScan, LABEL_PAGES_MAX, scanFailureOf, scanProcessedLabel, scanProcessedName, type ScanFailure } from '@/lib/data/useProcessedScan';
import type { LabelScanResult, ScanCandidate } from '@/lib/api/processedFoodAdapter';
import { RawText, Verdict } from '@/app/processed-foods/[id]';
import { ProductRow } from '@/features/processedFood/PackagedExplorer';
import { ScanModeTabs, type ScanMode } from './ScanModeTabs';

type Step =
  | { kind: 'capture' }
  /** back = 뒤로 갈 단계(Codex #315: 성분표 읽기·분석 중 뒤로 = 모은 면·분석 ID를 지키며 직전 단계로 — 앞면 촬영으로 초기화 금지) */
  | { kind: 'reading'; label?: boolean; back?: Step }
  | { kind: 'candidates'; analysisId: string; candidates: ScanCandidate[] }
  | { kind: 'none'; analysisId: string }
  /** analysisId = 이름 스캔에서 이어 붙일 분석(후보 없음·해당 없음) · null = 새 분석(촬영 화면·상세에서 바로) */
  | { kind: 'handoff'; analysisId: string | null }
  /** 성분표 면 모으기 — 분석 전(면 1~4) */
  | { kind: 'labelPages'; analysisId: string | null; pages: string[] }
  /** used = 이 분석에서 차감된 적 있음(이번 charged 또는 앞선 성공) — 결과 도착 때 정해 둔다(렌더 중 ref 읽기 금지).
   *  chargeUnknown = 앞선 전송 실패 뒤 재시도로 받은 결과(첫 요청이 차감했을 수 있음) — "추가 사용 없음"을 단정하지 않는다(Codex #315) */
  | { kind: 'labelResult'; result: LabelScanResult; pages: string[]; used: boolean; chargeUnknown: boolean }
  /** labelBack = 성분표 경로의 "다시 찍기" 목적지(Codex #315 R2: 2면째 이후 못 읽음 = 모은 면·분석 ID·결과를 지킨다 — 처음으로 초기화 금지) */
  | { kind: 'error'; failure: ScanFailure; retry: (() => void) | null; chargeUnknown?: boolean; labelBack?: Step };

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

/** startLabel = 상세 "성분표 직접 확인"(/scan?mode=packaged&label=1) — 새 분석으로 성분표 안내부터 */
/** 성분표 한 면 OCR 주입(개발·진단 채널 전용 — 시뮬엔 카메라 OCR이 없다). 면 하나 = 입력 한 번 */
function LabelDebug({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = React.useState('');
  if (!showOcrDebug()) return null;
  return (
    <View style={st.debug} testID="pscan-label-debug">
      <Text style={st.muted}>{t('packagedScan.debugLabel')}</Text>
      <Input value={text} onChangeText={setText} multiline style={st.debugInput} testID="pscan-label-debug-input" placeholder={t('packagedScan.debugLabelPlaceholder')} />
      <Btn variant="ghost" sm onPress={() => { if (text.trim()) { onAdd(text); setText(''); } }} testID="pscan-label-debug-add">{t('packagedScan.debugAddPage')}</Btn>
    </View>
  );
}

export function PackagedScanFlow({ mode, onMode, onClose, startLabel = false }: { mode: ScanMode; onMode: (m: ScanMode) => void; onClose: () => void; startLabel?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [step, setStep] = React.useState<Step>(() => (startLabel ? { kind: 'handoff', analysisId: null } : { kind: 'capture' }));
  const [debugText, setDebugText] = React.useState('');
  const guard = useSubmitGuard(); // 촬영·확정 연타 1발(P-173)
  // Codex #310 P2: 뒤로가기 뒤에 도착한 응답은 버린다 — 요청마다 회차, 단계를 사용자가 바꾸면 회차가 올라 늦은 응답이 화면을 되돌리거나 이동시키지 않는다
  const reqSeq = React.useRef(0);
  const goStep = (next: Step) => { reqSeq.current += 1; setStep(next); };
  // Codex #310 R2: 확정해 차감된 분석 — 상세에서 뒤로 와 같은 후보를 다시 고르면 서버는 멱등이라 charged false를 준다 → 이미 쓴 1회를 잊지 않는다
  const chargedIds = React.useRef(new Set<string>());

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

  /** 촬영 + 온디바이스 OCR 한 장 — 취소·권한 거부·OCR 중 뒤로 감 = null(아무것도 안 함), 글자 없음 = ''.
   *  reading 단계로 넘긴 뒤 OCR을 기다린다(앞면·성분표 공용). */
  const shootText = async (label: boolean, back: Step = { kind: 'capture' }): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      // Codex #310 R2: 거부 = 메뉴판 흐름과 같은 설정 유도(조용히 무시하면 이 모드를 쓸 길이 없다)
      Alert.alert(t('scan.permissionTitle'), t('scan.permissionSettingsBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('photo.openSettings'), onPress: () => void openAppSettings() },
      ]);
      return null;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.length) return null;
    const a = res.assets[0];
    goStep({ kind: 'reading', label, back });
    const my = reqSeq.current;
    let text = '';
    try {
      text = (await recognizeMenuLines(a.uri, a.width ?? 0, a.height ?? 0)).map((l) => l.text).join('\n');
    } catch {
      text = '';
    }
    if (my !== reqSeq.current) return null; // Codex #310 R2: OCR 중 뒤로 감 — 늦은 OCR 결과로 흐름을 다시 열지 않는다
    return text;
  };

  const capture = () =>
    guard.run(async () => {
      const text = await shootText(false);
      if (text == null) return;
      if (!text.trim()) {
        // 글자를 못 읽음 = 서버 호출 없이 후보 없음과 같은 길(차감 0) — 분석 ID가 없으니 새 분석 문맥
        setStep({ kind: 'handoff', analysisId: null });
        return;
      }
      await runName(text);
    });

  // ── P-508 성분표 ──
  /** 한 면 더(분석 전) — 글자를 못 읽은 면은 서버에 보내지 않고 "못 읽음"(차감 0) */
  const shootLabelPage = (analysisId: string | null, pages: string[]) =>
    guard.run(async () => {
      const text = await shootText(true, pages.length ? { kind: 'labelPages', analysisId, pages } : { kind: 'handoff', analysisId });
      if (text == null) return; // 취소(단계 그대로 — 모은 면 유지) · OCR 중 뒤로 감(늦은 결과 버림)
      if (!text.trim()) {
        setStep({ kind: 'error', failure: 'unreadable', retry: null, labelBack: pages.length ? { kind: 'labelPages', analysisId, pages } : { kind: 'handoff', analysisId } });
        return;
      }
      setStep({ kind: 'labelPages', analysisId, pages: [...pages, text].slice(0, LABEL_PAGES_MAX) });
    });

  /** analysisId null = 새 분석(성공 1회) · 있음 = 같은 분석(이어 붙이기·재분석 — 서버 규칙 안에서 차감 0).
   *  가드 없는 본체 — 촬영 뒤 이어 부르는 경로(면 추가 재분석)가 같은 가드 안에서 쓴다 */
  const runLabel = async (analysisId: string | null, pages: string[], chargeUnknown = false, back: Step = { kind: 'labelPages', analysisId, pages }): Promise<void> => {
      goStep({ kind: 'reading', label: true, back });
      const my = reqSeq.current;
      try {
        const r = await scanProcessedLabel(analysisId, pages, apiLang());
        if (my !== reqSeq.current) return;
        track(EVENTS.food_packaged_label_scan, { pages: pages.length, charged: r.charged, result: 'ok' });
        if (r.charged || chargeUnknown) void qc.invalidateQueries({ queryKey: ['me'] }); // 남은 횟수 = 서버 재조회
        if (r.charged) chargedIds.current.add(r.analysisId);
        const used = chargedIds.current.has(r.analysisId);
        setStep({ kind: 'labelResult', result: r, pages, used, chargeUnknown: chargeUnknown && !used });
      } catch (e) {
        if (my !== reqSeq.current) return;
        const failure = scanFailureOf(e);
        track(EVENTS.food_packaged_label_scan, { pages: pages.length, charged: false, result: failure });
        // ponytail: 새 분석의 전송 실패는 서버가 새 분석을 만들고 차감했을 수 있다(응답이 없으니 그 ID를 모른다) — 다시 시도는 또 새 분석.
        // 차감 여부를 단정하지 않는 문구("확인 중")로 남긴다. 서버가 요청 멱등 키를 받으면 그걸로 바꿀 것.
        const unknown = chargeUnknown || failure === 'network';
        setStep({ kind: 'error', failure, chargeUnknown: unknown, labelBack: back, retry: failure === 'network' ? () => void analyzeLabel(analysisId, pages, unknown) : failure === 'newAnalysis' ? () => void analyzeLabel(null, pages) : null });
      }
  };
  const analyzeLabel = (analysisId: string | null, pages: string[], chargeUnknown = false) => guard.run(() => runLabel(analysisId, pages, chargeUnknown));
  /** 결과에서 "한 면 더" = 찍고 같은 분석으로 다시(면은 누적 — 서버는 보낸 면 전체로 결과를 갱신). 뒤로 = 그 결과 화면 */
  const shootMoreAndReanalyze = (from: Extract<Step, { kind: 'labelResult' }>) =>
    guard.run(async () => {
      const { analysisId } = from.result;
      const { pages } = from;
      const text = await shootText(true, from);
      if (text == null) return;
      if (!text.trim()) {
        setStep({ kind: 'error', failure: 'unreadable', retry: null, labelBack: from }); // 결과 그대로 돌아간다
        return;
      }
      await runLabel(analysisId, [...pages, text].slice(0, LABEL_PAGES_MAX), from.chargeUnknown, from);
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
          setStep({ kind: 'handoff', analysisId });
          return;
        }
        // 남은 횟수 = 서버 프로필 재조회(로컬 차감 0) — 차감됐거나 차감 여부를 모를 때
        if (r.charged || chargeUnknown) void qc.invalidateQueries({ queryKey: ['me'] });
        qc.setQueryData(['processedFoods', 'detail', r.product.id, 'member'], r.product);
        if (r.charged) chargedIds.current.add(analysisId);
        const charge = r.charged || chargedIds.current.has(analysisId) ? '1' : chargeUnknown ? 'u' : '0';
        router.push(`/processed-foods/${r.product.id}?scan=1&charged=${charge}` as Href);
      } catch (e) {
        if (my !== reqSeq.current) return;
        const failure = scanFailureOf(e);
        // 전송 실패(응답 없음)는 서버가 확정·차감을 커밋했을 수 있다 → 차감 여부 미상, 같은 analysisId 재확정(멱등)으로 서버 값을 받는다
        const unknown = chargeUnknown || failure === 'network';
        setStep({ kind: 'error', failure, chargeUnknown: unknown, retry: () => void confirm(analysisId, reportNo, unknown) });
      }
    });

  const toHandoffFromNone = (analysisId: string) => {
    track(EVENTS.food_packaged_scan_handoff, { from: 'none' });
    setStep({ kind: 'handoff', analysisId });
  };

  // ── 화면 ──
  if (step.kind === 'reading') {
    return (
      <View style={st.root} testID="pscan-reading">
        <SubHeader title={t(step.label ? 'packagedScan.labelTitle' : 'packagedScan.chooseTitle')} onBack={() => goStep(step.back ?? { kind: 'capture' })} />
        <View style={st.darkBand} />
        <View style={[st.sheet, { gap: 20 }]}>
          <Text style={st.h1}>{t(step.label ? 'packagedScan.labelReading' : 'packagedScan.reading')}</Text>
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
            <Btn onPress={() => toHandoffFromNone(step.analysisId)} testID="pscan-to-label">{t('packagedScan.scanLabel')}</Btn>
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
          {step.analysisId != null && <ScanCount text={t('packagedScan.sameAnalysis')} testID="pscan-same-analysis" />}
          <Text style={st.muted}>{t('packagedScan.successOnly')}</Text>
          {!FLAGS.packagedLabelScan && <Text style={st.muted} testID="pscan-label-soon">{t('packagedScan.labelSoon')}</Text>}
          {FLAGS.packagedLabelScan && <LabelDebug onAdd={(text) => setStep({ kind: 'labelPages', analysisId: step.analysisId, pages: [text] })} />}
        </ScrollView>
        <View style={[st.bottom, { paddingBottom: insets.bottom + 12 }]}>
          {FLAGS.packagedLabelScan ? (
            <Btn busy={guard.busy} onPress={() => void shootLabelPage(step.analysisId, [])} testID="pscan-label-capture">{t('packagedScan.labelCta')}</Btn>
          ) : (
            <Btn variant="off" testID="pscan-label-capture">{t('packagedScan.labelCta')}</Btn>
          )}
        </View>
      </View>
    );
  }

  if (step.kind === 'labelPages') {
    const { analysisId, pages } = step;
    const full = pages.length >= LABEL_PAGES_MAX;
    return (
      <View style={st.root} testID="pscan-label-pages">
        <SubHeader title={t('packagedScan.labelTitle')} onBack={() => goStep({ kind: 'handoff', analysisId })} />
        <ScrollView contentContainerStyle={st.page}>
          <Text style={st.h1}>{t('packagedScan.labelPagesTitle')}</Text>
          <Text style={st.body} testID="pscan-label-count">{t('packagedScan.labelPagesCount', { count: pages.length, max: LABEL_PAGES_MAX })}</Text>
          {analysisId != null && <ScanCount text={t('packagedScan.sameAnalysis')} testID="pscan-same-analysis" />}
          <Text style={st.muted}>{t('packagedScan.successOnly')}</Text>
          {!full && <Btn variant="ghost" busy={guard.busy} onPress={() => void shootLabelPage(analysisId, pages)} style={st.outline} testID="pscan-label-add">{t('packagedScan.labelAddPage')}</Btn>}
          {!full && <LabelDebug onAdd={(text) => setStep({ kind: 'labelPages', analysisId, pages: [...pages, text] })} />}
        </ScrollView>
        <View style={[st.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Btn busy={guard.busy} onPress={() => void analyzeLabel(analysisId, pages)} testID="pscan-label-analyze">{t('packagedScan.labelAnalyze')}</Btn>
        </View>
      </View>
    );
  }

  if (step.kind === 'labelResult') {
    const { result, pages, used, chargeUnknown } = step;
    return (
      <View style={st.root} testID="pscan-label-result">
        <SubHeader title={t('packagedScan.resultTitle')} onBack={onClose} />
        <ScrollView contentContainerStyle={[st.page, { paddingBottom: 24 }]}>
          <ScanCount text={t(used ? 'packagedScan.scanUsed' : chargeUnknown ? 'packagedScan.chargeSeeHome' : 'packagedScan.labelNoExtra')} testID="pscan-label-charge" />
          {/* 상세 판정 섹션 그대로(검출 빨강·미매핑 노랑·미확인 회색·labelSource 문구·회피 대조) + 함유 가능 칩. 제품이 정해지지 않아 상세 링크 없음 */}
          <Verdict d={result} onLogin={() => {}} />
          {!!result.rawText && (
            <View style={{ gap: 12 }}>
              <Text style={st.h2}>{t('packagedScan.labelRawTitle')}</Text>
              <RawText text={result.rawText} />
            </View>
          )}
          {pages.length < LABEL_PAGES_MAX && (
            <>
              <Btn variant="ghost" busy={guard.busy} onPress={() => void shootMoreAndReanalyze(step)} style={st.outline} testID="pscan-label-more">{t('packagedScan.labelAddPage')}</Btn>
              <Text style={st.muted}>{t('packagedScan.labelFreeRetry')}</Text>
              <LabelDebug onAdd={(text) => void guard.run(() => runLabel(result.analysisId, [...pages, text], chargeUnknown, step))} />
            </>
          )}
        </ScrollView>
        <View style={[st.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Btn onPress={onClose} testID="pscan-label-done">{t('common.close')}</Btn>
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
          {/* P-508: 409 PFOOD-007 = 이 분석엔 더 못 붙임 → 새 분석(성공 1회 — 버튼 위 본문이 알린다) */}
          {f === 'newAnalysis' && step.retry && <Btn busy={guard.busy} onPress={step.retry} testID="pscan-new-analysis">{t('packagedScan.newAnalysisCta')}</Btn>}
          {f === 'quota' ? (
            <Btn variant="ghost" onPress={onClose} testID="pscan-close">{t('common.close')}</Btn>
          ) : (
            // 성분표 경로 = 직전 단계(모은 면·분석 ID·결과 유지 — 서버 400은 이전 결과를 지우지 않는다) · 그 밖 = 앞면 촬영
            <Btn variant="ghost" onPress={() => goStep(step.labelBack ?? { kind: 'capture' })} testID="pscan-retake">{t('packagedScan.retake')}</Btn>
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
          <Btn variant="ghost" onPress={() => { track(EVENTS.food_packaged_scan_handoff, { from: 'capture' }); setStep({ kind: 'handoff', analysisId: null }); }} style={st.outline} testID="pscan-label-instead">
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
  h2: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 24, color: C.ink },
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
