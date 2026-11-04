/**
 * 가공식품 스캔(KB-813 F2, D-32 Capture mode 12338:36477 · Choose your product 36537(+No candidates 37353) · Ingredient label 36679).
 * 흐름: 사진 한 장(KB-969 비전 — 앞면·성분표·메뉴판을 서버가 판별) → 후보(≤5)
 *   → 후보 탭 = 확정(성공 1회 차감 — 서버 charged) → 가공식품 상세(스캔 결과) / 후보 없음·해당 없음 → 성분표 안내.
 * 규칙:
 * - **차감 표시는 서버 charged만**. 실패·네트워크 오류는 "차감되지 않았어요"(서버가 실패 응답에서 차감하지 않는 계약) — 횟수 추정 0.
 * - 확정 재시도 = 같은 analysisId(서버 멱등 — 같은 결과·charged false).
 * - 성분표 분석(P-508, 서버 #442 scan/label): 안내 → 성분표 촬영(면 추가 최대 4) → 분석 → 결과(상세 판정 섹션 재사용 + 함유 가능 칩).
 *   후보 없음·해당 없음에서 오면 **같은 analysisId**(추가 차감 0 — "같은 분석" 문구는 이 경로만), 촬영 화면·상세에서 바로 오면 새 분석(성공 1회).
 *   결과의 "면 추가" = 같은 ID 재분석(첫 성공 뒤 30분·3회까지 차감 0 — 서버 규칙), 넘으면 409 PFOOD-007 → "새로 분석"(1회).
 *   못 읽음 400 PFOOD-006 = 차감 0, 다시 찍기. 촬영 버튼은 FLAGS.packagedLabelScan(꺼진 채널 = "곧 지원" 안내).
 * - KB-963(예진 11/2 · 서버 S-937): 가공식품 스캔은 **차감 없음**(charged 늘 false · freeUntil 늘 null) — 무료 창·차감 표시는 전부 소멸,
 *   위 차감 서술은 계측(charged)·구 서버 대비로만 남는다. 메뉴 쿼터가 소진돼도 이 흐름은 열린다(소진 안내 = 메뉴 촬영 시점만, scan.tsx).
 *   확정에서 403(SCAN-004)이 와도 대비(안내 + 나중에 = 흐름 복귀).
 * - KB-988: 옛 온디바이스 ML Kit 경로(이름 스캔 OCR·성분표 OCR·모드 탭) 제거 — 촬영은 전부 비전. ML Kit = 메뉴 v1(scan.tsx)만.
 * - 비전 응답 주입(개발·진단 채널 전용): 시뮬엔 카메라가 없어 텍스트로 응답을 만드는 디버그 입력.
 */
import * as React from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import { useQueryClient } from '@tanstack/react-query';
import { SubHeader } from '@/components/SubHeader';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Input, Spinner } from '@/components';
import { color as C, font, radius } from '@/lib/theme';
import { FLAGS } from '@/lib/flags';
import { showOcrDebug, useIsSimulator } from '@/lib/simulator';
import { uploadVisionScanPhoto } from '@/lib/api/scanImage';
import { EVENTS, track } from '@/lib/analytics';
import { apiLang } from '@/lib/api/client';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { useProcessedSearch, useVerdictKey } from '@/lib/data/useProcessedFoods';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { QueryErrorBlock } from '@/components/StateBlock';
import { CandidateScreen, LabelPhotosScreen, LabelResultScreen, MessagePage, NameSearchBox } from './PackagedScanScreens';
import { DarkBackButton, ScanDarkMessage } from './ScanDarkMessage';
import { confirmProcessedScan, LABEL_PAGES_MAX, scanFailureOf, scanProcessedLabel, scanProcessedName, scanProcessedVision, type ScanFailure } from '@/lib/data/useProcessedScan';
import type { LabelScanResult, ScanCandidate, VisionReason, VisionScanResult } from '@/lib/api/processedFoodAdapter';
import { ScanLoading } from './ScanLoading';
import { ScanLeaveConfirm } from './ScanLeaveConfirm';
import { useLeaveConfirm } from '@/components/LeaveConfirmModal';

/** KB-845 공통 카메라(scan.tsx cameraUi) — 가공식품 앞면·성분표 단계가 이걸로 찍는다(시스템 카메라·흰 안내 페이지 경유 0) */
export type ScanPhoto = { uri: string; width: number; height: number };
/** KB-969: 카메라 하나(사진 종류는 서버가 판별) */
export type ScanCamOpts = {
  /** 셔터·Photos(라이브러리) 결과 — 크롭본 */
  onShot: (photo: ScanPhoto) => void | Promise<void>;
  /** 안내 힌트 대체(모은 면 = n/4) */
  hint?: string;
  /** KB-877: 힌트 위 한 줄(가공식품 무료 남은 분) — 아무것도 안 그리면 자리 0 */
  notice?: React.ReactNode;
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
  /** 시안 19: 이름으로 찾기(스캔 맥락) — 읽은 글자로 채운 검색, 고르면 같은 분석으로 확정(후보 밖 선택 허용 — 진입 플로우 ②) */
  | { kind: 'nameSearch'; analysisId: string; ocrText: string; back: Step }
  /** analysisId = 이름 스캔에서 이어 붙일 분석(후보 없음·해당 없음) · null = 새 분석(촬영 화면·목록 빈 상태에서 바로) ·
   *  pages·photos = 이미 모은 면(QA Z5: 이어 붙인다) · from = 결과에서 "한 면 더"(찍으면 그 분석으로 바로 재분석) */
  | { kind: 'handoff'; analysisId: string | null; pages?: string[]; photos?: (string | null)[]; from?: LabelResultStep }
  /** 성분표 면 검토(시안 24·25·50) — 분석 전(면 1~4) · from = 결과에서 다시 검토(50: 기존 결과를 갱신, 추가 차감 0) */
  | { kind: 'labelPages'; analysisId: string | null; pages: string[]; photos: (string | null)[]; from?: LabelResultStep }
  | LabelResultStep
  /** KB-969: 사진 스캔이 앞면·성분표·메뉴판이 아니라고 판별(OTHER — reason별 안내) → 다시 찍기 = back */
  | { kind: 'visionOther'; reason: VisionReason | null; back: Step; addSide?: boolean }
  /** labelBack = 성분표 경로의 "다시 찍기" 목적지(Codex #315 R2) */
  | { kind: 'error'; failure: ScanFailure; retry: (() => void) | null; chargeUnknown?: boolean; labelBack?: Step };

/** used·chargeUnknown = 이 분석의 차감 상태(문구는 v4에서 없앴지만 프로필 재조회 판단에 쓴다) */
/** verdictKey = 결과를 받을 때의 판정 기준(언어·회피 코드) — 회피를 바꾸고 돌아오면 옛 verdict를 개인 판정으로 보이지 않는다(Codex #339) */
type LabelResultStep = { kind: 'labelResult'; result: LabelScanResult; pages: string[]; photos: (string | null)[]; used: boolean; chargeUnknown: boolean; verdictKey: string; };

/** 카메라 자리 — renderCamera를 **이 컴포넌트의 렌더**에서 부른다. 흐름 컴포넌트가 렌더 중 직접 부르면 ref를 읽는 콜백을 렌더 중 함수 호출에
 *  넘기는 것으로 잡혀(react-hooks/refs) 컴파일러가 흐름 전체를 건너뛴다 — 콜백은 props로만 건넨다 */
export function CameraSlot({ o, render }: { o: ScanCamOpts; render: (o: ScanCamOpts) => React.ReactElement }) {
  return render(o);
}


/** focused = 스캔 화면이 보이는 중(Codex #318) · onQuota = 확정이 한도에 걸림(KB-865 ③ 시안 21 — scan.tsx가 기존 소진 화면을 이 흐름 위에 띄운다, 흐름 상태 유지) */
/** onMenuPhoto(KB-969) = 사진 스캔이 메뉴판으로 판별 — 같은 사진·이미 올린 경로로 메뉴 v2(scan.tsx — 티켓·소진 화면 그대로) */
export function PackagedScanFlow({ onClose, startLabel = false, renderCamera, focused = true, onQuota, onMenuPhoto }: { onClose: () => void; startLabel?: boolean; renderCamera: (o: ScanCamOpts) => React.ReactElement; focused?: boolean; onQuota?: () => void; onMenuPhoto?: (photo: ScanPhoto, imagePath: string) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  // 흐름 진입·포그라운드 복귀 때 프로필 재조회 — 판정 기준(회피)·쿼터가 서버 정본. KB-963: 가공식품 무료 창(freeUntil)·차감 표시는 소멸(서버 S-937 — 차감 없음)
  React.useEffect(() => {
    void qc.invalidateQueries({ queryKey: ['me'] });
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void qc.invalidateQueries({ queryKey: ['me'] }); });
    return () => sub.remove();
  }, [qc]);
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
  // KB-908(T-050): 후보 화면에서 하드웨어 뒤로·닫기·스와이프 = 메뉴 결과와 같은 "Leave scan results?" 확인(전엔 확인 없이 스캔 전체 종료).
  // 확정 요청 중(busy)은 위 BackHandler가 이미 삼킨다 — 확인 창을 겹치지 않는다
  const leave = useLeaveConfirm(focused && step.kind === 'candidates' && !guard.busy);
  const reqSeq = React.useRef(0);
  const goStep = (next: Step) => { reqSeq.current += 1; setStep(next); };
  // Codex #310 R2: 확정해 차감된 분석 — 상세에서 뒤로 와 같은 후보를 다시 고르면 서버는 멱등이라 charged false를 준다 → 이미 쓴 1회를 잊지 않는다
  const chargedIds = React.useRef(new Set<string>());
  /** Codex #339: 서버가 NO_CANDIDATE·REJECTED로 둔 분석 — 성분표 API는 이 둘만 이어 받는다("None of these"는 로컬 화면 전환이라 성분표로 갈 때 거절 확정) */
  const settledIds = React.useRef(new Set<string>());
  /** 확정 성공(CONFIRMED)한 분석 — 성분표는 이어 받지 않는다 → 성분표로 가면 새 분석(Codex #339: NO_CANDIDATE로 정리됐다가 이름 찾기로 확정된 경우 포함) */
  const confirmedIds = React.useRef(new Set<string>());

  // ── KB-969 사진 스캔(서버 비전) — 앞면·성분표 촬영 전부 이 경로(KB-988: 온디바이스 OCR 경로 제거) ──
  /** 비전 응답 → 기존 단계로. addTo = 성분표 결과에서 "한 면 더"(읽은 원문을 그 분석에 합친다 — 같은 analysisId로 /scan/label) */
  const applyVision = async (r: VisionScanResult, photo: ScanPhoto | null, imagePath: string | null, back: Step, addTo?: LabelResultStep) => {
    track(EVENTS.food_packaged_scan_vision, { kind: r.kind, state: r.route, confidence: confidenceBand(r.confidence), reason: r.reason ?? 'none', side: addTo ? 'add' : 'first' });
    const photoUri = photo?.uri ?? null;
    if (addTo) {
      // 한 면 더 = 성분표만 합친다. 다른 사진(앞면·메뉴판 등)이면 다시 찍기 — 기존 결과는 back(카메라)에서 닫기로 돌아간다
      if (r.route !== 'label' || !r.label) { setStep({ kind: 'visionOther', reason: r.reason, back, addSide: true }); return; }
      const pages = [...addTo.pages, r.label.rawText].filter((x) => x.trim()).slice(0, LABEL_PAGES_MAX);
      await runLabel(addTo.result.analysisId, pages, [...addTo.photos, photoUri].slice(0, LABEL_PAGES_MAX), { chargeUnknown: addTo.chargeUnknown, back: addTo });
      return;
    }
    const frontText = [r.front?.productName, r.front?.maker].filter(Boolean).join('\n'); // 이름 찾기 검색창 초기값(시안 19 — 앞 두 줄)
    switch (r.route) {
      case 'candidates':
        setStep({ kind: 'candidates', analysisId: r.analysisId, candidates: r.front?.candidates ?? [], selectedId: null, ocrText: frontText });
        return;
      case 'none':
        settledIds.current.add(r.analysisId); // 서버 NO_CANDIDATE = 성분표 이어 받음
        track(EVENTS.food_packaged_scan_handoff, { from: 'none' });
        setStep({ kind: 'another', analysisId: r.analysisId, ocrText: frontText, from: 'none', back: { kind: 'capture' } });
        return;
      case 'label':
        if (!r.label) return;
        track(EVENTS.food_packaged_label_scan, { pages: 1, charged: false, result: 'ok' }); // 기존 성분표 결과 이벤트 유지(분모)
        setStep({ kind: 'labelResult', result: r.label, pages: [r.label.rawText].filter((x) => x.trim()), photos: [photoUri], used: false, chargeUnknown: false, verdictKey });
        return;
      case 'menu':
        if (onMenuPhoto && photo && imagePath) { goStep({ kind: 'capture' }); onMenuPhoto(photo, imagePath); return; }
        setStep({ kind: 'visionOther', reason: null, back }); // 메뉴 경로가 없는 호출(테스트·시뮬 주입) = 다시 찍기
        return;
      case 'confirmed': {
        // 같은 키 재전송인데 그 사이 확정됨 — 멱등 확정이 그 제품을 돌려준다(toLabel과 같은 규칙). 제품이 없으면 후보 없음으로
        const c = await confirmProcessedScan(r.analysisId, null);
        if (c.product) {
          qc.setQueryData(['processedFoods', 'detail', c.product.id, verdictKey], c.product);
          confirmedIds.current.add(r.analysisId);
          goStep({ kind: 'capture' });
          router.push(`/processed-foods/${c.product.id}?scan=1&charged=0` as Href);
        } else {
          settledIds.current.add(r.analysisId);
          setStep({ kind: 'another', analysisId: r.analysisId, ocrText: frontText, from: 'none', back: { kind: 'capture' } });
        }
        return;
      }
      default:
        setStep({ kind: 'visionOther', reason: r.reason, back });
    }
  };
  /** 사진 한 장 = 비전 1회. key = 촬영 1회당 멱등 키 · uploaded = 이미 올린 경로 — 재시도는 같은 키·같은 경로(비전 재호출·상한 차감 0, 재업로드 0) */
  const runVision = async (photo: ScanPhoto, back: Step, addTo?: LabelResultStep, key: string = Crypto.randomUUID(), uploaded: string | null = null): Promise<void> => {
    goStep({ kind: 'reading', label: !!addTo, back, photoUri: photo.uri }); // Q-412 ①: 판정 전 = 중립 문구(메뉴판일 수도)
    const my = reqSeq.current;
    let path = uploaded;
    try {
      path = path ?? (await uploadVisionScanPhoto(photo));
      if (my !== reqSeq.current) return; // Codex #412: 업로드 중 닫음 = 비전 호출 0(하루 상한 소모 금지)
      const r = await scanProcessedVision(path, key, apiLang());
      if (my !== reqSeq.current) return; // 그 사이 뒤로 감 — 늦은 응답 버림
      await applyVision(r, photo, path, back, addTo);
    } catch (e) {
      if (my !== reqSeq.current) return;
      const failure = scanFailureOf(e);
      track(EVENTS.food_packaged_scan_fail, { stage: 'vision', result: failure });
      if (failure === 'unreadable') { setStep({ kind: 'visionOther', reason: null, back, addSide: !!addTo }); return; } // 성분표로 봤지만 글자를 못 읽음(PFOOD-006) = 다시 찍기
      // 전송 실패·혼잡 = 같은 키·같은 경로로 다시(서버 멱등) · 상한·용량·그 밖 = 다시 찍기만
      const retry = failure === 'network' || failure === 'busy' ? () => void runVision(photo, back, addTo, key, path) : null;
      setStep({ kind: 'error', failure, retry, labelBack: addTo ? back : undefined });
    }
  };

  // ── P-508 성분표 ──
  /** 성분표 카메라의 한 면 = 비전 1회 — 결과에서 왔으면(from) 그 분석에 합쳐 재분석, 아니면 첫 면(서버가 종류 판별) */
  const onLabelShot = (cam: Extract<Step, { kind: 'handoff' }>, photo: ScanPhoto) =>
    // Codex #412: 결과 → 사진 보기 → 다시 찍기 = 잘라낸 면 목록(cam.pages)에 합친다 — 원본(from.pages)이면 교체가 아니라 추가가 된다
    runVision(photo, cam, cam.from && { ...cam.from, pages: cam.pages ?? cam.from.pages, photos: cam.photos ?? cam.from.photos });

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
      // 첫 차감 성공 = 이번 호출이 차감했고 창이 열림 — 창 안의 무료 분석엔 안 보인다
      setStep({ kind: 'labelResult', result: r, pages, photos, used, chargeUnknown: chargeUnknown && !used, verdictKey });
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
        confirmedIds.current.add(analysisId);
        if (r.charged) chargedIds.current.add(analysisId);
        const charge = r.charged || chargedIds.current.has(analysisId) ? '1' : chargeUnknown ? 'u' : '0';
        // KB-877: 이번 확정이 차감했고 창이 열림 = 상세에 "다음 1시간 무료" 한 줄(창 안 무료 확정엔 0)
        router.push(`/processed-foods/${r.product.id}?scan=1&charged=${charge}` as Href);
      } catch (e) {
        if (my !== reqSeq.current) return;
        const failure = scanFailureOf(e);
        track(EVENTS.food_packaged_scan_fail, { stage: 'confirm', result: failure }); // KB-973: 확정 성공(food_packaged_scan_confirm)과 분모를 섞지 않는다
        if (failure === 'quota') { onQuota?.(); return; } // 시안 21 — 화면(후보·선택)은 그대로
        // 전송 실패(응답 없음)는 서버가 확정·차감을 커밋했을 수 있다 → 차감 여부 미상, 같은 analysisId 재확정(멱등)으로 서버 값을 받는다
        const unknown = chargeUnknown || failure === 'network';
        setStep({ kind: 'error', failure, chargeUnknown: unknown, retry: () => void confirm(analysisId, reportNo, here, unknown) });
      }
    });

  /** 성분표로 — 아직 후보 상태(CANDIDATES)인 분석은 먼저 거절 확정(reportNo null, 차감 0)해야 서버가 이어 받는다(Codex #339).
   *  이름 찾기는 거절 전 분석으로 확정하므로 거절은 성분표를 고를 때만 */
  const toLabel = (analysisId: string | null) => {
    if (analysisId != null && confirmedIds.current.has(analysisId)) { goStep({ kind: 'handoff', analysisId: null }); return; }
    if (analysisId == null || settledIds.current.has(analysisId)) { goStep({ kind: 'handoff', analysisId }); return; }
    const here = step;
    void guard.run(async () => {
      const my = reqSeq.current;
      try {
        const r = await confirmProcessedScan(analysisId, null);
        if (my !== reqSeq.current) return;
        // 이미 확정된 분석(상세에서 돌아와 다시 고른 경우 — 멱등 확정이 그 제품을 돌려준다) = 이어 받을 수 없다 → 새 성분표 분석
        if (!r.rejected && r.product) { confirmedIds.current.add(analysisId); goStep({ kind: 'handoff', analysisId: null }); return; }
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
        title={t(step.label ? 'packagedScan.labelReading' : 'packagedScan.vision.reading')}
        photoUri={step.photoUri ?? null}
        caption={t(step.label ? 'scanCamera.capturedLabel' : 'scanCamera.capturedPhoto')}
        onClose={() => goStep(step.back ?? { kind: 'capture' })}
        testID="pscan-reading"
      />
    );
  }

  if (step.kind === 'candidates') {
    return (
      <>
      <CandidateScreen
        testID="pscan-candidates"
        // KB-945(예진 10/31): 후보 단계 = 제목 + 후보 목록 + None of these만 — 무료 배지·설명 줄·"N possible matches"·회피 설정 안내 제거(무료 창 차감 자체는 서버 그대로)
        title={t('packagedScan.matchTitle')}
        subtitle={null}
        note={null}
        items={step.candidates}
        pickingId={step.selectedId}
        // KB-914(R-138): 줄 탭 = 바로 확정(구 선택 → 하단 확정 버튼). 확정 화면(here)은 고른 줄을 기억한 후보 단계 — 한도에 걸리면 그대로 돌아온다
        onPick={(c) => {
          const cand = step.candidates.find((x) => x.id === c.id);
          if (!cand) return;
          const here = { ...step, selectedId: cand.id };
          setStep(here);
          void confirm(step.analysisId, cand.reportNo, here);
        }}
        onNone={() => {
          track(EVENTS.food_packaged_scan_handoff, { from: 'rejected' });
          goStep({ kind: 'another', analysisId: step.analysisId, ocrText: step.ocrText, from: 'rejected', back: step });
        }}
        onBack={() => goStep({ kind: 'capture' })}
        personalized={personalized}
        busy={guard.busy}
      />
      <ScanLeaveConfirm visible={leave.modal.visible} onKeep={leave.modal.onKeep} onLeave={leave.modal.onDiscard} />
      </>
    );
  }

  if (step.kind === 'another') {
    return (
      <MessagePage
        focused={focused}
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
            // 모은 면이 있으면 n/4(QA Z5) · 그 밖 디자인 힌트(차감 문구 없음 — README)
            hint: pages.length ? t('packagedScan.labelPagesCount', { count: pages.length, max: LABEL_PAGES_MAX }) : undefined,
            onShot: (photo: ScanPhoto) => onLabelShot(cam, photo),
            link: { label: t('scanCamera.frontLink'), onPress: () => goStep({ kind: 'capture' }), testID: 'pscan-front-instead' },
            onClose: cam.from ? () => goStep(cam.from as LabelResultStep) : pages.length ? () => goStep({ kind: 'labelPages', analysisId: cam.analysisId, pages, photos }) : undefined,
            debug: <VisionDebug onResult={(r) => applyVision(r, null, null, cam, cam.from)} onFail={(e) => setStep({ kind: 'error', failure: scanFailureOf(e), retry: null, labelBack: cam })} />,
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
        avoidCount={me?.restrictions.length ?? 0} // KB-959: Safe 부제 근거
        stale={step.verdictKey !== verdictKey}
        onAddSide={() => goStep({ kind: 'handoff', analysisId: result.analysisId, pages, photos, from: step })}
        onReview={() => goStep({ kind: 'labelPages', analysisId: result.analysisId, pages, photos, from: step })}
        onDone={onClose}
      />
    );
  }

  if (step.kind === 'visionOther') {
    // KB-969: 사진 종류 판별 = 그 밖(OTHER)·성분표 못 읽음 — reason별 한 줄 + 다시 찍기(어두운 전체 화면 = 스캔 오류와 같은 문법)
    const back = step.back;
    return (
      <ScanDarkMessage
        testID="pscan-vision-other"
        lightStatusBar={focused}
        label={t('scanCamera.title')}
        title={t('packagedScan.vision.retakeTitle')}
        body={t(`packagedScan.vision.${visionBodyKey(step.reason, !!step.addSide)}`)}
        overlay={<DarkBackButton onPress={() => goStep(back)} label={t('common.goBack')} testID="pscan-vision-other-back" />}
      >
        <Btn onPress={() => goStep(back)} testID="pscan-retake">{t('packagedScan.retakePhoto')}</Btn>
      </ScanDarkMessage>
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
          focused={focused}
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
    // KB-914(R-139): 일반 오류(네트워크·만료·충돌·한도 등)도 메뉴판과 같은 어두운 전체 화면 — 문장·버튼 분기는 그대로
    return (
      <ScanDarkMessage
        testID={`pscan-error-${f}`}
        lightStatusBar={focused}
        label={t('packagedScan.title')}
        title={t(`packagedScan.err.${f}Title`)}
        // 확정 전송 실패 = 차감 여부 미상 — 단정하지 않는다(문구는 응답 후 결과가 정한다)
        body={t(`packagedScan.err.${f}Body`)}
        overlay={<DarkBackButton onPress={() => goStep({ kind: 'capture' })} label={t('common.goBack')} testID={`pscan-error-${f}-back`} />}
      >
        {(f === 'network' || f === 'busy') && step.retry && <Btn busy={guard.busy} onPress={step.retry} testID="pscan-retry">{t('common.tryAgain')}</Btn>}
        {/* P-508: 409 PFOOD-007 = 이 분석엔 더 못 붙임 → 새 분석(성공 1회 — 본문이 알린다) */}
        {f === 'newAnalysis' && step.retry && <Btn busy={guard.busy} onPress={step.retry} testID="pscan-new-analysis">{t('packagedScan.newAnalysisCta')}</Btn>}
        {f === 'quota' || f === 'visionLimit' ? ( /* KB-969: 하루 상한 = 다시 찍어도 같다 — 닫기만 */
          <Btn variant="ghost" onPress={onClose} testID="pscan-close">{t('common.close')}</Btn>
        ) : (
          <Btn variant="ghost" onPress={() => goStep(step.labelBack ?? { kind: 'capture' })} testID="pscan-retake">{t('packagedScan.retake')}</Btn>
        )}
      </ScanDarkMessage>
    );
  }

  // capture — KB-845 공통 카메라. KB-969: 카메라 하나 — 성분표도 같은 셔터(서버가 종류 판별)라 "성분표로" 링크 없음
  return (
    <>
      {focused && <StatusBar style="light" />}
      <CameraSlot
        render={renderCamera}
        o={{
        onShot: (photo: ScanPhoto) => runVision(photo, { kind: 'capture' }),
        debug: <VisionDebug onResult={(r) => applyVision(r, null, null, { kind: 'capture' })} onFail={(e) => setStep({ kind: 'error', failure: scanFailureOf(e), retry: null })} />,
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
  return (
    <CandidateScreen
      testID="pscan-name-search"
      title={t('packagedScan.findTitle')}
      subtitle={t('packagedScan.findSubtitle')}
      note={m0 ? t('packagedScan.personalNote') : null}
      search={<NameSearchBox value={draft} onChange={setDraft} onSubmit={() => { if (busy) return; setQuery(draft); setSelectedId(null); }} />}
      items={items}
      pickingId={selectedId}
      // KB-914(R-138): 줄 탭 = 바로 확정(reportNo 없는 항목은 위에서 걸렀다)
      onPick={(it) => { setSelectedId(it.id); if (it.reportNo) onConfirm(it.reportNo); }}
      // Codex #339: 20개씩 페이지 — 끝 근처에서 다음 페이지(목록 화면과 같은 가드)
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) void q.fetchNextPage(); }}
      onNone={onNone}
      onBack={onBack}
      personalized={personalized}
      busy={busy}
      empty={q.isPending && query.trim() ? <View style={st.searchState} testID="pscan-name-search-loading"><Spinner /></View> : q.isError ? <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} /> : !items.length && query.trim() ? <Text style={st.muted} testID="pscan-name-search-empty">{t('packaged.emptyTitle')}</Text> : null}
    />
  );
}

/** KB-969 계측: 확신도는 구간으로(원값 0.873… 대신 대시보드 분해용) */
export function confidenceBand(c: number): 'low' | 'mid' | 'high' {
  return c >= 0.8 ? 'high' : c >= 0.5 ? 'mid' : 'low';
}
/** OTHER reason → 안내 키(모르는 값·없음 = unknown) */
export function visionReasonKey(r: VisionReason | null): string {
  switch (r) {
    case 'BLURRY': return 'blurry';
    case 'TOO_DARK': return 'tooDark';
    case 'GLARE': return 'glare';
    case 'CROPPED': return 'cropped';
    case 'NOT_FOOD': return 'notFood';
    default: return 'unknown';
  }
}
/** Q-412 ②: 한 면 더(성분표 합치기)에서 성분표가 아닌 사진 = 성분표 면 안내. 품질 reason(흐림 등)이 있으면 그 안내 우선. */
export function visionBodyKey(r: VisionReason | null, addSide: boolean): string {
  const k = visionReasonKey(r);
  if (!addSide) return k;
  return k === 'unknown' || k === 'notFood' ? 'notLabel' : k;
}

/** KB-969 비전 응답 주입(개발·진단 채널 전용 — 시뮬엔 카메라가 없다). 구 OCR 입력칸 자리. 글자 = 앞면 이름 → 실제 이름 스캔 후보로,
 *  또는 성분표 원문 → 실제 성분표 분석으로 응답을 만들어 같은 분기(applyVision)를 탄다. 다시 찍기 = OTHER(흐림) 목 */
function VisionDebug({ onResult, onFail }: { onResult: (r: VisionScanResult) => Promise<void>; onFail: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [text, setText] = React.useState('');
  const sim = useIsSimulator();
  if (!showOcrDebug(sim)) return null;
  const run = (make: () => Promise<VisionScanResult>) => void make().then(onResult).catch(onFail);
  const base = { confidence: 0.9, reason: null, front: null, label: null, warnings: [] };
  return (
    <View style={st.debug} testID="pscan-vision-debug">
      <Text style={st.muted}>{t('packagedScan.debugLabel')}</Text>
      <Input value={text} onChangeText={setText} multiline style={st.debugInput} testID="pscan-vision-debug-input" placeholder={t('packagedScan.debugPlaceholder')} />
      <View style={st.debugRow}>
        <Btn variant="ghost" sm onPress={() => text.trim() && run(async () => {
          const n = await scanProcessedName(text, apiLang());
          return { ...base, analysisId: n.analysisId, kind: 'PACKAGE_FRONT', route: n.candidates.length ? 'candidates' : 'none', front: { productName: text.split('\n')[0] ?? null, maker: null, reportNo: null, candidates: n.candidates } };
        })} testID="pscan-vision-debug-front">{t('packagedScan.debugRun')}</Btn>
        <Btn variant="ghost" sm onPress={() => text.trim() && run(async () => {
          const l = await scanProcessedLabel(null, [text], apiLang(), Crypto.randomUUID());
          return { ...base, analysisId: l.analysisId, kind: 'INGREDIENT_LABEL', route: 'label', label: l };
        })} testID="pscan-vision-debug-label">{t('packagedScan.debugAddPage')}</Btn>
        <Btn variant="ghost" sm onPress={() => run(async () => ({ ...base, analysisId: Crypto.randomUUID(), kind: 'OTHER', route: 'other', reason: 'BLURRY' }))} testID="pscan-vision-debug-other">{t('packagedScan.retakePhoto')}</Btn>
      </View>
    </View>
  );
}

// 시안 실측(2x): 본문 좌우 20 · 안내 eyebrow 15 primary · 제목 28 bold · 본문 15/22 · 촬영 상자 335×264 r24 #2F3137(아이콘 + 18 semibold 흰 글자)
// · 아웃라인 40 · 하단 고정 버튼 · 후보 시트 = 어두운 띠 200 위 흰 시트 r24
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  page: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  eyebrow: { fontFamily: font.body, fontSize: 16, lineHeight: 21, color: C.primary },
  h1: { fontFamily: font.bodyBold, fontSize: 28, lineHeight: 36, color: C.ink },
  h2: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 24, color: C.ink },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink },
  muted: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink2 },
  box: { height: 264, borderRadius: radius.xl, backgroundColor: '#2F3137', alignItems: 'center', justifyContent: 'center', gap: 12 },
  boxText: { fontFamily: font.bodySemi, fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  outline: { minHeight: 40, paddingVertical: 8 },
  bottom: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: C.card },
  darkBand: { height: 100, backgroundColor: '#2F3137' },
  sheet: { marginTop: -24, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: C.card, paddingHorizontal: 20, paddingTop: 20 },
  skelRow: { height: 72, borderRadius: radius.md },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flameBox: { width: 24, height: 30, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  countText: { flex: 1, fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink2 },
  debug: { gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' },
  debugInput: { minHeight: 72, textAlignVertical: 'top' },
  debugRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  searchState: { paddingVertical: 24, alignItems: 'center' },
});
