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
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import { useQueryClient } from '@tanstack/react-query';
import { SubHeader } from '@/components/SubHeader';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Input, Spinner } from '@/components';
import { color as C, font } from '@/lib/theme';
import { FLAGS, isDiagnosticChannel } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { apiLang } from '@/lib/api/client';
import { recognizeMenuLines } from '@/lib/scan/ocr';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { useProcessedSearch, useVerdictKey } from '@/lib/data/useProcessedFoods';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { QueryErrorBlock } from '@/components/StateBlock';
import { CandidateScreen, LabelPhotosScreen, LabelResultScreen, MessagePage, NameSearchBox } from './PackagedScanScreens';
import { confirmProcessedScan, LABEL_PAGES_MAX, scanFailureOf, scanProcessedLabel, scanProcessedName, type ScanFailure } from '@/lib/data/useProcessedScan';
import type { LabelScanResult, ScanCandidate } from '@/lib/api/processedFoodAdapter';
import type { ScanMode } from './ScanModeTabs';
import { ScanLoading } from './ScanLoading';

/** KB-845 공통 카메라(scan.tsx cameraUi) — 가공식품 앞면·성분표 단계가 이걸로 찍는다(시스템 카메라·흰 안내 페이지 경유 0) */
export type ScanPhoto = { uri: string; width: number; height: number };
export type ScanCamKind = 'menu' | 'package' | 'ingredient';
export type ScanCamOpts = {
  kind: ScanCamKind;
  /** 셔터·Photos(라이브러리) 결과 — 크롭본 */
  onShot: (photo: ScanPhoto) => void | Promise<void>;
  /** 안내 힌트 대체(같은 분석 진입 = sameAnalysis · 모은 면 = n/4) */
  hint?: string;
  /** 아래 링크(메뉴 = 라이브러리 · 가공식품 ↔ 성분표 전환) — 없으면 같은 높이 빈 자리 */
  link?: { label: string; onPress: () => void; testID: string } | null;
  /** 닫기 X — 없으면 스캔 화면 닫기, 있으면 직전 단계로(한 면 더 찍기 등) */
  onClose?: () => void;
  /** 진단 채널 OCR 주입 패널(스토어 채널 0) */
  debug?: React.ReactNode;
  /** 더 찍을 수 없음(성분표 4면이 찼다 — Codex #318) — 셔터·Photos 비활성 */
  shootDisabled?: boolean;
};

type Step =
  | { kind: 'capture' }
  /** back = 뒤로 갈 단계(Codex #315: 성분표 읽기·분석 중 뒤로 = 모은 면·분석 ID를 지키며 직전 단계로 — 앞면 촬영으로 초기화 금지) · photoUri = 로딩에 보일 찍은 사진 */
  | { kind: 'reading'; label?: boolean; back?: Step; photoUri?: string | null }
  /** KB-865 ③(시안 16·45): 후보 — 탭 = 선택(테두리), 확정 CTA = 그 후보로 확정 */
  | { kind: 'candidates'; analysisId: string; candidates: ScanCandidate[]; selectedId: string | null; ocrText: string }
  /** 시안 17·39: 후보 없음·"None of these" — 이름으로 찾기 / 성분표 찍기(같은 분석, 추가 차감 0) */
  | { kind: 'another'; analysisId: string; ocrText: string; from: 'none' | 'rejected'; back: Step }
  /** 시안 18: 앞면 글자를 하나도 못 읽음 — 다시 찍기 / 성분표 찍기(새 분석) */
  | { kind: 'frontUnreadable' }
  /** 시안 19: 이름으로 찾기(스캔 맥락) — 읽은 글자로 채운 검색, 고르면 같은 분석으로 확정(후보 밖 선택 허용 — 진입 플로우 ②) */
  | { kind: 'nameSearch'; analysisId: string; ocrText: string; back: Step }
  /** analysisId = 이름 스캔에서 이어 붙일 분석(후보 없음·해당 없음) · null = 새 분석(촬영 화면·목록 빈 상태에서 바로) ·
   *  pages·photos = 이미 모은 면(QA Z5: 이어 붙인다) · from = 결과에서 "한 면 더"(찍으면 그 분석으로 바로 재분석) */
  | { kind: 'handoff'; analysisId: string | null; pages?: string[]; photos?: (string | null)[]; from?: LabelResultStep }
  /** 성분표 면 검토(시안 24·25·50) — 분석 전(면 1~4) · from = 결과에서 다시 검토(50: 기존 결과를 갱신, 추가 차감 0) */
  | { kind: 'labelPages'; analysisId: string | null; pages: string[]; photos: (string | null)[]; from?: LabelResultStep }
  | LabelResultStep
  /** labelBack = 성분표 경로의 "다시 찍기" 목적지(Codex #315 R2) */
  | { kind: 'error'; failure: ScanFailure; retry: (() => void) | null; chargeUnknown?: boolean; labelBack?: Step };

/** used·chargeUnknown = 이 분석의 차감 상태(문구는 v4에서 없앴지만 프로필 재조회 판단에 쓴다) */
type LabelResultStep = { kind: 'labelResult'; result: LabelScanResult; pages: string[]; photos: (string | null)[]; used: boolean; chargeUnknown: boolean };

/** 카메라 자리 — renderCamera를 **이 컴포넌트의 렌더**에서 부른다. 흐름 컴포넌트가 렌더 중 직접 부르면 ref를 읽는 콜백을 렌더 중 함수 호출에
 *  넘기는 것으로 잡혀(react-hooks/refs) 컴파일러가 흐름 전체를 건너뛴다 — 콜백은 props로만 건넨다 */
export function CameraSlot({ o, render }: { o: ScanCamOpts; render: (o: ScanCamOpts) => React.ReactElement }) {
  return render(o);
}

/** 디버그 OCR 주입 노출 — 개발 번들·진단 채널(dev·teamtest)만, 스토어 채널 0 */
export const showOcrDebug = (): boolean => __DEV__ || isDiagnosticChannel();

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

/** focused = 스캔 화면이 보이는 중(Codex #318) · onQuota = 확정이 한도에 걸림(KB-865 ③ 시안 21 — scan.tsx가 기존 소진 화면을 이 흐름 위에 띄운다, 흐름 상태 유지) */
export function PackagedScanFlow({ onClose, startLabel = false, renderCamera, focused = true, onQuota }: { mode: ScanMode; onMode: (m: ScanMode) => void; onClose: () => void; startLabel?: boolean; renderCamera: (o: ScanCamOpts) => React.ReactElement; focused?: boolean; onQuota?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const verdictKey = useVerdictKey(); // 확정 응답을 상세 캐시에 심을 때 상세 키와 같은 판정 기준(Codex #338 R3)
  const guest = useIsGuest();
  const { data: me } = useMe();
  // 판정 리본 = 회피 1개 이상 회원만(서버 프로필이 정본) · 회피 0개 = 후보 위 개인화 안내(시안 45)
  const m0 = !guest && !!me && me.restrictions.length === 0;
  // Codex #339 R2(#338 R5와 같은 규칙): 서버 verdict는 회원 기준 계산 — 프로필 대기·실패여도 판정 경로(리본·회피 문장)로 그린다.
  // 회피 0개로 **확인된** 회원만 주요 알레르기 경로. 프로필 미상 + verdict 없음 = 결과 화면의 보수적 "확인 못 함"
  const personalized = !guest && !m0;
  const [step, setStep] = React.useState<Step>(() => (startLabel ? { kind: 'handoff', analysisId: null } : { kind: 'capture' }));
  const guard = useSubmitGuard(); // 촬영·확정 연타 1발(P-173)
  // Codex #339: 확정·거절·분석 대기 중 하드웨어 뒤로 = 삼킨다 — 화면이 닫혀도 요청은 서버에서 확정·차감되고 늦은 응답이 상세로 이동시킨다
  React.useEffect(() => {
    if (!guard.busy) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [guard.busy]);
  // Codex #310 P2: 뒤로가기 뒤에 도착한 응답은 버린다 — 요청마다 회차, 단계를 사용자가 바꾸면 회차가 올라 늦은 응답이 화면을 되돌리거나 이동시키지 않는다
  const reqSeq = React.useRef(0);
  const goStep = (next: Step) => { reqSeq.current += 1; setStep(next); };
  // Codex #310 R2: 확정해 차감된 분석 — 상세에서 뒤로 와 같은 후보를 다시 고르면 서버는 멱등이라 charged false를 준다 → 이미 쓴 1회를 잊지 않는다
  const chargedIds = React.useRef(new Set<string>());
  /** Codex #339: 서버가 NO_CANDIDATE·REJECTED로 둔 분석 — 성분표 API는 이 둘만 이어 받는다("None of these"는 로컬 화면 전환이라 성분표로 갈 때 거절 확정) */
  const settledIds = React.useRef(new Set<string>());

  const runName = async (ocrText: string, photoUri: string | null = null) => {
    goStep({ kind: 'reading', photoUri });
    const my = reqSeq.current;
    try {
      const r = await scanProcessedName(ocrText, apiLang());
      if (my !== reqSeq.current) return; // 그 사이 뒤로 감
      track(EVENTS.food_packaged_scan_name, { candidate_count: r.candidates.length });
      if (r.candidates.length) setStep({ kind: 'candidates', analysisId: r.analysisId, candidates: r.candidates, selectedId: null, ocrText });
      else {
        settledIds.current.add(r.analysisId);
        track(EVENTS.food_packaged_scan_handoff, { from: 'none' });
        setStep({ kind: 'another', analysisId: r.analysisId, ocrText, from: 'none', back: { kind: 'capture' } });
      }
    } catch (e) {
      if (my !== reqSeq.current) return;
      setStep({ kind: 'error', failure: scanFailureOf(e), retry: () => void runName(ocrText, photoUri) });
    }
  };

  /** KB-845: 공통 카메라가 넘긴 사진 → 로딩(그 사진) → 온디바이스 OCR. OCR 중 뒤로 감 = null(늦은 결과 버림), 글자 없음 = ''. */
  const readText = async (photo: ScanPhoto, label: boolean, back: Step): Promise<string | null> => {
    goStep({ kind: 'reading', label, back, photoUri: photo.uri });
    const my = reqSeq.current;
    let text = '';
    try {
      text = (await recognizeMenuLines(photo.uri, photo.width, photo.height)).map((l) => l.text).join('\n');
    } catch {
      text = '';
    }
    if (my !== reqSeq.current) return null; // Codex #310 R2: OCR 중 뒤로 감 — 늦은 OCR 결과로 흐름을 다시 열지 않는다
    return text;
  };

  const onFrontShot = async (photo: ScanPhoto) => {
    const text = await readText(photo, false, { kind: 'capture' });
    if (text == null) return;
    if (!text.trim()) {
      // 시안 18: 글자를 못 읽음 = 서버 호출 없이(차감 0) 다시 찍기 / 성분표 찍기
      track(EVENTS.food_packaged_scan_handoff, { from: 'unreadable' });
      setStep({ kind: 'frontUnreadable' });
      return;
    }
    await runName(text, photo.uri);
  };

  // ── P-508 성분표 ──
  /** 성분표 카메라의 한 면 — 결과에서 왔으면(from) 같은 분석으로 바로 재분석, 아니면 면 검토에 이어 붙임(QA Z5 — 덮어쓰기 0, 상한 4).
   *  글자를 못 읽은 면은 서버에 보내지 않고 "못 읽음"(시안 29b, 차감 0) */
  const addLabelText = async (cam: Extract<Step, { kind: 'handoff' }>, text: string, photoUri: string | null) => {
    const pages = cam.pages ?? [];
    const photos = cam.photos ?? pages.map(() => null);
    if (!text.trim()) {
      setStep({ kind: 'error', failure: 'unreadable', retry: null, labelBack: cam });
      return;
    }
    const next = [...pages, text].slice(0, LABEL_PAGES_MAX);
    const nextPhotos = [...photos, photoUri].slice(0, LABEL_PAGES_MAX);
    if (cam.from) await runLabel(cam.from.result.analysisId, next, nextPhotos, { chargeUnknown: cam.from.chargeUnknown, back: cam.from });
    else setStep({ kind: 'labelPages', analysisId: cam.analysisId, pages: next, photos: nextPhotos });
  };
  const onLabelShot = async (cam: Extract<Step, { kind: 'handoff' }>, photo: ScanPhoto) => {
    const text = await readText(photo, true, cam);
    if (text == null) return;
    await addLabelText(cam, text, photo.uri);
  };

  /** analysisId null = 새 분석(성공 1회) · 있음 = 같은 분석(이어 붙이기·재분석 — 서버 규칙 안에서 차감 0).
   *  requestKey(서버 #444 clientRequestId) = 새 분석의 멱등 키 — **전송 실패 재시도만 같은 키**(면이 바뀌면 새 키). */
  const runLabel = async (analysisId: string | null, pages: string[], photos: (string | null)[], opts: { chargeUnknown?: boolean; back?: Step; requestKey?: string } = {}): Promise<void> => {
    const { chargeUnknown = false, back = { kind: 'labelPages', analysisId, pages, photos } } = opts;
    const requestKey = analysisId == null ? (opts.requestKey ?? Crypto.randomUUID()) : undefined;
    goStep({ kind: 'reading', label: true, back, photoUri: [...photos].reverse().find((u) => !!u) ?? null });
    const my = reqSeq.current;
    try {
      const r = await scanProcessedLabel(analysisId, pages, apiLang(), requestKey);
      if (my !== reqSeq.current) return;
      track(EVENTS.food_packaged_label_scan, { pages: pages.length, charged: r.charged, result: 'ok' });
      // 새 분석의 성공 = 그 분석이 정확히 1회 차감(이번 응답이든, 응답을 잃은 첫 요청이든 — 같은 키 재전송은 charged=false로 온다)
      const fresh = analysisId == null;
      if (r.charged || chargeUnknown || fresh) void qc.invalidateQueries({ queryKey: ['me'] }); // 남은 횟수 = 서버 재조회
      if (r.charged || fresh) chargedIds.current.add(r.analysisId);
      const used = chargedIds.current.has(r.analysisId);
      setStep({ kind: 'labelResult', result: r, pages, photos, used, chargeUnknown: chargeUnknown && !used });
    } catch (e) {
      if (my !== reqSeq.current) return;
      const failure = scanFailureOf(e);
      track(EVENTS.food_packaged_label_scan, { pages: pages.length, charged: false, result: failure });
      if (failure === 'quota') { setStep(back); onQuota?.(); return; }
      // 전송 실패 = 서버가 처리했을 수 있다 → 다시 시도는 **같은 요청**(같은 분석 ID, 새 분석이면 같은 멱등 키) — 이중 차감 0
      const unknown = chargeUnknown || failure === 'network';
      setStep({ kind: 'error', failure, chargeUnknown: unknown, labelBack: back, retry: failure === 'network' ? () => void analyzeLabel(analysisId, pages, photos, { chargeUnknown: unknown, back, requestKey }) : failure === 'newAnalysis' ? () => void analyzeLabel(null, pages, photos) : null });
    }
  };
  const analyzeLabel = (analysisId: string | null, pages: string[], photos: (string | null)[], opts: { chargeUnknown?: boolean; back?: Step; requestKey?: string } = {}) => guard.run(() => runLabel(analysisId, pages, photos, opts));

  /** reportNo = 고른 후보(또는 이름 찾기 항목) · chargeUnknown = 앞선 확정이 전송 실패 — 재확정이 charged false여도 "사용 안 됨"이라 단정하지 않는다.
   *  here = 확정 시도 화면(한도에 걸리면 그 화면 그대로 — 시안 21: 해제·나중에 뒤 같은 후보로 복귀) */
  const confirm = (analysisId: string, reportNo: string, here: Step, chargeUnknown = false) =>
    guard.run(async () => {
      const my = reqSeq.current;
      try {
        const r = await confirmProcessedScan(analysisId, reportNo);
        if (my !== reqSeq.current) return; // 그 사이 뒤로 감 — 이동 0
        track(EVENTS.food_packaged_scan_confirm, { charged: r.charged, rejected: r.rejected });
        if (r.rejected || !r.product) {
          settledIds.current.add(analysisId);
          track(EVENTS.food_packaged_scan_handoff, { from: 'rejected' });
          setStep({ kind: 'another', analysisId, ocrText: here.kind === 'candidates' || here.kind === 'nameSearch' ? here.ocrText : '', from: 'rejected', back: here });
          return;
        }
        // 남은 횟수 = 서버 프로필 재조회(로컬 차감 0) — 차감됐거나 차감 여부를 모를 때
        if (r.charged || chargeUnknown) void qc.invalidateQueries({ queryKey: ['me'] });
        qc.setQueryData(['processedFoods', 'detail', r.product.id, verdictKey], r.product);
        if (r.charged) chargedIds.current.add(analysisId);
        const charge = r.charged || chargedIds.current.has(analysisId) ? '1' : chargeUnknown ? 'u' : '0';
        router.push(`/processed-foods/${r.product.id}?scan=1&charged=${charge}` as Href);
      } catch (e) {
        if (my !== reqSeq.current) return;
        const failure = scanFailureOf(e);
        if (failure === 'quota') { onQuota?.(); return; } // 시안 21 — 화면(후보·선택)은 그대로
        // 전송 실패(응답 없음)는 서버가 확정·차감을 커밋했을 수 있다 → 차감 여부 미상, 같은 analysisId 재확정(멱등)으로 서버 값을 받는다
        const unknown = chargeUnknown || failure === 'network';
        setStep({ kind: 'error', failure, chargeUnknown: unknown, retry: () => void confirm(analysisId, reportNo, here, unknown) });
      }
    });

  /** 성분표로 — 아직 후보 상태(CANDIDATES)인 분석은 먼저 거절 확정(reportNo null, 차감 0)해야 서버가 이어 받는다(Codex #339).
   *  이름 찾기는 거절 전 분석으로 확정하므로 거절은 성분표를 고를 때만 */
  const toLabel = (analysisId: string | null) => {
    if (analysisId == null || settledIds.current.has(analysisId)) { goStep({ kind: 'handoff', analysisId }); return; }
    const here = step;
    void guard.run(async () => {
      const my = reqSeq.current;
      try {
        const r = await confirmProcessedScan(analysisId, null);
        if (my !== reqSeq.current) return;
        // 이미 확정된 분석(상세에서 돌아와 다시 고른 경우 — 멱등 확정이 그 제품을 돌려준다) = 이어 받을 수 없다 → 새 성분표 분석
        if (!r.rejected && r.product) { goStep({ kind: 'handoff', analysisId: null }); return; }
        settledIds.current.add(analysisId);
        goStep({ kind: 'handoff', analysisId });
      } catch (e) {
        if (my !== reqSeq.current) return;
        setStep({ kind: 'error', failure: scanFailureOf(e), retry: () => { goStep(here); toLabel(analysisId); } });
      }
    });
  };
  const labelEnabled = FLAGS.packagedLabelScan;

  // ── 화면 ──
  if (step.kind === 'reading') {
    // 시안 26 대신 공통 로딩(ScanLoading — KB-862, 커맨드 10/22 Q1 (a))
    return (
      <ScanLoading
        title={t(step.label ? 'packagedScan.labelReading' : 'packagedScan.reading')}
        photoUri={step.photoUri ?? null}
        caption={t(step.label ? 'scanCamera.capturedLabel' : 'scanCamera.capturedPackage')}
        onClose={() => goStep(step.back ?? { kind: 'capture' })}
        testID="pscan-reading"
      />
    );
  }

  if (step.kind === 'candidates') {
    const sel = step.candidates.find((c) => c.id === step.selectedId) ?? null;
    return (
      <CandidateScreen
        testID="pscan-candidates"
        title={t('packagedScan.matchTitle')}
        subtitle={t('packagedScan.possibleMatches', { count: step.candidates.length })}
        note={m0 ? t('packagedScan.personalNote') : null}
        items={step.candidates}
        selectedId={step.selectedId}
        onSelect={(id) => setStep({ ...step, selectedId: id })}
        onConfirm={() => { if (sel) void confirm(step.analysisId, sel.reportNo, step); }}
        onNone={() => {
          track(EVENTS.food_packaged_scan_handoff, { from: 'rejected' });
          goStep({ kind: 'another', analysisId: step.analysisId, ocrText: step.ocrText, from: 'rejected', back: step });
        }}
        onBack={() => goStep({ kind: 'capture' })}
        personalized={personalized}
        busy={guard.busy}
      />
    );
  }

  if (step.kind === 'another') {
    return (
      <MessagePage
        testID={step.from === 'none' ? 'pscan-none' : 'pscan-another'}
        busy={guard.busy}
        headerTitle={t('packagedScan.title')}
        title={t('packagedScan.anotherTitle')}
        body={t(labelEnabled ? 'packagedScan.anotherBody' : 'packagedScan.anotherBodyNameOnly')}
        primary={{ label: t('packagedScan.findByName'), testID: 'pscan-find-by-name', onPress: () => { track(EVENTS.food_packaged_scan_find_by_name, { from: step.from }); goStep({ kind: 'nameSearch', analysisId: step.analysisId, ocrText: step.ocrText, back: step }); } }}
        secondary={labelEnabled ? { label: t('packaged.scanIngredientLabel'), testID: 'pscan-to-label', onPress: () => toLabel(step.analysisId) } : null}
        onBack={() => goStep(step.back)}
      />
    );
  }

  if (step.kind === 'frontUnreadable') {
    return (
      <MessagePage
        testID="pscan-front-unreadable"
        headerTitle={t('packagedScan.title')}
        title={t('packagedScan.frontUnreadableTitle')}
        body={t(labelEnabled ? 'packagedScan.frontUnreadableBody' : 'packagedScan.frontUnreadableBodyNoLabel')}
        primary={{ label: t('packagedScan.retakePhoto'), testID: 'pscan-retake', onPress: () => goStep({ kind: 'capture' }) }}
        secondary={labelEnabled ? { label: t('packaged.scanIngredientLabel'), testID: 'pscan-to-label', onPress: () => toLabel(null) } : null}
        onBack={() => goStep({ kind: 'capture' })}
      />
    );
  }

  if (step.kind === 'nameSearch') {
    return (
      <NameSearchStep
        key={step.analysisId}
        initial={step.ocrText.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' ')}
        personalized={personalized}
        m0={m0}
        busy={guard.busy}
        onConfirm={(reportNo) => void confirm(step.analysisId, reportNo, step)}
        onNone={labelEnabled ? () => toLabel(step.analysisId) : null}
        onBack={() => goStep(step.back)}
      />
    );
  }

  if (step.kind === 'handoff') {
    const cam = step;
    if (labelEnabled) {
      const pages = cam.pages ?? [];
      const photos = cam.photos ?? pages.map(() => null);
      return (
        <>
          {focused && <StatusBar style="light" />}
          <CameraSlot
            render={renderCamera}
            o={{
            kind: 'ingredient',
            // 모은 면이 있으면 n/4(QA Z5) · 그 밖 디자인 힌트(차감 문구 없음 — README)
            hint: pages.length ? t('packagedScan.labelPagesCount', { count: pages.length, max: LABEL_PAGES_MAX }) : undefined,
            onShot: (photo: ScanPhoto) => onLabelShot(cam, photo),
            link: { label: t('scanCamera.frontLink'), onPress: () => goStep({ kind: 'capture' }), testID: 'pscan-front-instead' },
            onClose: cam.from ? () => goStep(cam.from as LabelResultStep) : pages.length ? () => goStep({ kind: 'labelPages', analysisId: cam.analysisId, pages, photos }) : undefined,
            debug: pages.length < LABEL_PAGES_MAX ? <LabelDebug onAdd={(text) => void addLabelText(cam, text, null)} /> : null,
            // Codex #318: 4면이 찬 채 뒤로 와도 더 찍지 못한다 — 힌트 4/4 · 닫기 = 면 화면
            shootDisabled: pages.length >= LABEL_PAGES_MAX,
            }}
          />
        </>
      );
    }
    // 성분표 분석 꺼진 채널 = 진입 버튼이 없어 대개 오지 않는다 — 와도 안내 + 비활성(기존)
    return (
      <View style={st.root} testID="pscan-handoff">
        <SubHeader title={t('packagedScan.labelTitle')} onBack={() => goStep({ kind: 'capture' })} />
        <ScrollView contentContainerStyle={st.page}>
          <Text style={st.h1}>{t('packagedScan.labelHeadline')}</Text>
          <Text style={st.body}>{t('packagedScan.labelBody')}</Text>
          <Text style={st.muted} testID="pscan-label-soon">{t('packagedScan.labelSoon')}</Text>
        </ScrollView>
      </View>
    );
  }

  if (step.kind === 'labelPages') {
    const { analysisId, pages, photos, from } = step;
    const full = pages.length >= LABEL_PAGES_MAX;
    const retake = () => goStep({ kind: 'handoff', analysisId, pages: pages.slice(0, -1), photos: photos.slice(0, -1), from }); // 마지막 면을 다시 찍는다
    return (
      <LabelPhotosScreen
        photos={photos}
        count={pages.length}
        max={LABEL_PAGES_MAX}
        reanalyze={!!from}
        onRetake={retake}
        onAdd={full ? null : () => goStep({ kind: 'handoff', analysisId, pages, photos, from })}
        onAnalyze={() => (from ? void analyzeLabel(from.result.analysisId, pages, photos, { chargeUnknown: from.chargeUnknown, back: step }) : void analyzeLabel(analysisId, pages, photos))}
        // Codex #318: 4면이 찼으면 뒤로 = 성분표 단계를 떠나 앞면 카메라 · 결과에서 왔으면 그 결과로
        onBack={() => goStep(from ? from : full ? { kind: 'capture' } : { kind: 'handoff', analysisId, pages, photos })}
        busy={guard.busy}
      />
    );
  }

  if (step.kind === 'labelResult') {
    const { result, pages, photos } = step;
    return (
      <LabelResultScreen
        result={result}
        photoUri={[...photos].reverse().find((u) => !!u) ?? null}
        pages={pages.length}
        max={LABEL_PAGES_MAX}
        member={personalized}
        onAddSide={() => goStep({ kind: 'handoff', analysisId: result.analysisId, pages, photos, from: step })}
        onReview={() => goStep({ kind: 'labelPages', analysisId: result.analysisId, pages, photos, from: step })}
        onSetAvoid={() => router.push('/profile/restrictions' as Href)}
        onDone={onClose}
      />
    );
  }

  if (step.kind === 'error') {
    const f = step.failure;
    if (f === 'unreadable' && step.labelBack) {
      // 시안 29b: 성분표 못 읽음 — 다시 찍기 = 같은 카메라(모은 면 유지) · 면 검토 = 모은 면이 있을 때
      const back = step.labelBack;
      const hasPages = back.kind === 'handoff' && (back.pages?.length ?? 0) > 0;
      return (
        <MessagePage
          testID="pscan-error-unreadable"
          headerTitle={t('packagedScan.labelTitle')}
          title={t('packagedScan.err.unreadableTitle')}
          body={t('packagedScan.err.unreadableBody')}
          primary={{ label: t('packagedScan.retakePhoto'), testID: 'pscan-retake', onPress: () => goStep(back) }}
          secondary={hasPages && back.kind === 'handoff' ? { label: t('packagedScan.reviewPhotos', { count: back.pages?.length ?? 0 }), testID: 'pscan-review-photos', onPress: () => goStep({ kind: 'labelPages', analysisId: back.analysisId, pages: back.pages ?? [], photos: back.photos ?? [], from: back.from }) } : null}
          onBack={() => goStep(back)}
        />
      );
    }
    return (
      <View style={st.root} testID={`pscan-error-${f}`}>
        <SubHeader title={t('packagedScan.title')} onBack={() => goStep({ kind: 'capture' })} />
        <View style={[st.page, { gap: 16 }]}>
          <Text style={st.h1}>{t(`packagedScan.err.${f}Title`)}</Text>
          {/* 확정 전송 실패 = 차감 여부 미상 — 단정하지 않는다(문구는 응답 후 결과가 정한다) */}
          <Text style={st.body}>{t(`packagedScan.err.${f}Body`)}</Text>
          {f === 'network' && step.retry && <Btn busy={guard.busy} onPress={step.retry} testID="pscan-retry">{t('common.tryAgain')}</Btn>}
          {/* P-508: 409 PFOOD-007 = 이 분석엔 더 못 붙임 → 새 분석(성공 1회 — 본문이 알린다) */}
          {f === 'newAnalysis' && step.retry && <Btn busy={guard.busy} onPress={step.retry} testID="pscan-new-analysis">{t('packagedScan.newAnalysisCta')}</Btn>}
          {f === 'quota' ? (
            <Btn variant="ghost" onPress={onClose} testID="pscan-close">{t('common.close')}</Btn>
          ) : (
            <Btn variant="ghost" onPress={() => goStep(step.labelBack ?? { kind: 'capture' })} testID="pscan-retake">{t('packagedScan.retake')}</Btn>
          )}
        </View>
      </View>
    );
  }

  // capture — KB-845 공통 카메라(Packaged food). 성분표 링크 = 새 분석(꺼진 채널이면 숨김)
  return (
    <>
      {focused && <StatusBar style="light" />}
      <CameraSlot
        render={renderCamera}
        o={{
        kind: 'package',
        onShot: onFrontShot,
        link: labelEnabled
          ? { label: t('packagedScan.labelInstead'), onPress: () => { track(EVENTS.food_packaged_scan_handoff, { from: 'capture' }); goStep({ kind: 'handoff', analysisId: null }); }, testID: 'pscan-label-instead' }
          : null,
        debug: <FrontDebug onRun={(text) => void runName(text)} />,
        }}
      />
    </>
  );
}

/** 시안 19: 이름으로 찾기(스캔 맥락) — 읽은 글자(앞 두 줄)로 채운 목록 검색 · 고르면 같은 분석으로 확정 · reportNo 없는 항목은 고를 수 없다 */
function NameSearchStep({ initial, personalized, m0, busy, onConfirm, onNone, onBack }: {
  initial: string; personalized: boolean; m0: boolean; busy: boolean; onConfirm: (reportNo: string) => void; onNone: (() => void) | null; onBack: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState(initial);
  const [query, setQuery] = React.useState(initial);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const q = useProcessedSearch(query);
  const items = (q.data ?? []).filter((it) => !!it.reportNo);
  const tracked = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!q.isSuccess || tracked.current === query) return;
    tracked.current = query;
    track(EVENTS.food_packaged_search, { query_length: Array.from(query.trim()).length, result_count: items.length }); // 검색어 원문 0
  }, [q.isSuccess, query, items.length]);
  const sel = items.find((it) => it.id === selectedId) ?? null;
  return (
    <CandidateScreen
      testID="pscan-name-search"
      title={t('packagedScan.findTitle')}
      subtitle={t('packagedScan.findSubtitle')}
      note={m0 ? t('packagedScan.personalNote') : null}
      search={<NameSearchBox value={draft} onChange={setDraft} onSubmit={() => { if (busy) return; setQuery(draft); setSelectedId(null); }} />}
      items={items}
      selectedId={selectedId}
      onSelect={setSelectedId}
      // Codex #339: 20개씩 페이지 — 끝 근처에서 다음 페이지(목록 화면과 같은 가드)
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) void q.fetchNextPage(); }}
      onConfirm={() => { if (sel?.reportNo) onConfirm(sel.reportNo); }}
      onNone={onNone}
      onBack={onBack}
      personalized={personalized}
      busy={busy}
      empty={q.isPending && query.trim() ? <View style={st.searchState} testID="pscan-name-search-loading"><Spinner /></View> : q.isError ? <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} /> : !items.length && query.trim() ? <Text style={st.muted} testID="pscan-name-search-empty">{t('packaged.emptyTitle')}</Text> : null}
    />
  );
}

/** 앞면 OCR 주입(개발·진단 채널 전용 — 시뮬엔 카메라 OCR이 없다) */
function FrontDebug({ onRun }: { onRun: (text: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = React.useState('');
  if (!showOcrDebug()) return null;
  return (
    <View style={st.debug} testID="pscan-ocr-debug">
      <Text style={st.muted}>{t('packagedScan.debugLabel')}</Text>
      <Input value={text} onChangeText={setText} multiline style={st.debugInput} testID="pscan-ocr-debug-input" placeholder={t('packagedScan.debugPlaceholder')} />
      <Btn variant="ghost" sm onPress={() => text.trim() && onRun(text)} testID="pscan-ocr-debug-run">{t('packagedScan.debugRun')}</Btn>
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
  searchState: { paddingVertical: 24, alignItems: 'center' },
});
