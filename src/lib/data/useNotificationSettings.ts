/**
 * useNotificationSettings (KB-497) — 알림 설정 **서버 정본** 훅.
 *
 * GET/PATCH /api/notifications/settings. 로컬 저장소 없음(P-147 서버 정본). PATCH는
 * 낙관 반영 → 실패 롤백 → 응답(전체 설정)으로 캐시 교체. 연타·프라이머 지연 응답이
 * 최신 값을 덮어쓰지 않도록 **모듈 seq**로 최신 요청 응답만 반영한다(훅 안팎 공유).
 *
 * 단위(KB-544, dev Swagger 9/14): activity·news.enabled·news.mealTime = 이 기기(X-Installation-Id) 토글 저장값
 * (enabled는 동의와 결합하지 않는다 — 발송 시점에 서버가 AND 검사), 동의 = 회원 단위(privacy/receiveConsent로 읽음).
 * 새 X-API-Version 매핑은 consent.ts 상수 1곳(null = 현행 레거시).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, type RequestOpts } from '@/lib/api/client';
import { queryClient as sharedQueryClient } from '@/lib/queryClient';
import { NOTIF_SETTINGS_API_VERSION } from '@/lib/push/consent';
import { currentGen } from '@/lib/auth/beTokens';

export interface ConsentState {
  version: number;
  grantedAt: string;
}
export interface NotificationSettings {
  activity: boolean;
  news: {
    enabled: boolean;
    mealTime: boolean;
    privacyConsent: ConsentState | null;
    receiveConsent: ConsentState | null;
  };
}
export interface NotificationSettingsPatch {
  activity?: boolean;
  news?: {
    /** 이 기기의 소식 수신 on/off — 동의 원장은 건드리지 않는다(KB-544 Swagger) */
    enabled?: boolean;
    /** 회원 마케팅 동의: true = 두 버전으로 동의 기록(버전 2종 필수), false = 철회. 기기 토글은 무변 */
    consent?: boolean;
    /** 식사 시간 알림 — 이 요청 반영 후 이 기기 소식이 켜져 있어야 한다(아니면 NOTIFICATION-001) */
    mealTime?: boolean;
    privacyConsentVersion?: number;
    receiveConsentVersion?: number;
  };
}

export const NOTIF_SETTINGS_KEY = ['notifSettings'] as const;
const PATH = '/api/notifications/settings';

function opts(): RequestOpts | undefined {
  return NOTIF_SETTINGS_API_VERSION ? { headers: { 'X-API-Version': NOTIF_SETTINGS_API_VERSION } } : undefined;
}

export function fetchNotificationSettings(): Promise<NotificationSettings> {
  return api.get<NotificationSettings>(PATH, opts());
}

/* ---- 최신 요청 판정 (훅 안팎 공유) ---- */
let seq = 0;
const nextSeq = () => ++seq;
const isLatest = (n: number) => n === seq;

/* ---- PATCH 직렬화 (KB-553, 9/14 실기): 동의 확정 PATCH가 아직 서버에 반영되기 전에 다음 토글 PATCH가
 * 도착하면 서버는 반영 전 행(전부 false)을 기준으로 응답한다 — 그 응답이 "최신"이라 캐시를 덮어 소식 토글이
 * 꺼진 것처럼 보였다. 요청은 앞 요청이 끝난 뒤 보낸다(낙관 표시는 즉시 · 응답 반영은 seq 그대로). ---- */
let chain: Promise<unknown> = Promise.resolve();
/** 큐에 든 채 계정 경계(로그아웃·계정 전환 = 세션 세대 증가)를 넘은 요청 — 다른 계정 자격으로 나가면 안 된다. */
export class StaleSessionError extends Error {
  constructor() { super('notifSettings: session changed while queued'); this.name = 'StaleSessionError'; }
}
function sendPatch(patch: NotificationSettingsPatch, gen: number): Promise<NotificationSettings> {
  const p = chain.then(() => {
    if (gen !== currentGen()) throw new StaleSessionError(); // Codex 리뷰(#150): 큐 대기 중 계정 전환 → 폐기
    return api.patch<NotificationSettings>(PATH, patch, opts());
  });
  chain = p.catch(() => undefined); // 실패해도 다음 요청은 이어간다
  return p;
}
/** 응답·롤백 반영 조건: 최신 요청 AND 같은 세션 세대(전환 뒤 이전 계정 값을 캐시에 되살리지 않는다). */
const stillMine = (my: number, gen: number) => isLatest(my) && gen === currentGen();

/** 낙관 예측 — 서버 응답이 오면 통째로 교체되므로 표시용 근사면 충분. */
export function predictSettings(cur: NotificationSettings, patch: NotificationSettingsPatch): NotificationSettings {
  const next: NotificationSettings = { ...cur, news: { ...cur.news } };
  if (patch.activity != null) next.activity = patch.activity;
  if (patch.news?.consent === true) {
    const now = new Date().toISOString();
    next.news.privacyConsent = { version: patch.news.privacyConsentVersion ?? 0, grantedAt: now };
    next.news.receiveConsent = { version: patch.news.receiveConsentVersion ?? 0, grantedAt: now };
  }
  if (patch.news?.enabled === true) {
    next.news.enabled = true; // mealTime은 아래 명시값만 따른다 — 예측이 요청보다 앞서가면 응답에서 되돌아가 깜빡인다(9/14 실기)
  } else if (patch.news?.enabled === false) {
    next.news.enabled = false;
    next.news.mealTime = false; // 동의(회원 단위)는 유지 — 서버 응답이 정본
  }
  if (patch.news?.mealTime != null) next.news.mealTime = patch.news.mealTime;
  return next;
}

/**
 * 훅 밖 PATCH(프라이머 수락 등). 응답이 최신 요청일 때만 캐시 교체 — 응답 지연 중
 * 사용자가 설정 화면에서 바꾼 값을 되돌리지 않는다.
 */
export async function patchNotificationSettings(
  patch: NotificationSettingsPatch,
  qc: QueryClient = sharedQueryClient,
): Promise<NotificationSettings> {
  const my = nextSeq();
  const gen = currentGen();
  const res = await sendPatch(patch, gen);
  if (stillMine(my, gen)) qc.setQueryData(NOTIF_SETTINGS_KEY, res);
  return res;
}

export function useNotificationSettings(enabled = true) {
  return useQuery({
    queryKey: NOTIF_SETTINGS_KEY,
    queryFn: fetchNotificationSettings,
    staleTime: 0, // 화면 진입마다 서버 재확인(정본)
    enabled,
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: NotificationSettingsPatch) => sendPatch(patch, currentGen()),
    onMutate: async (patch) => {
      const my = nextSeq();
      const gen = currentGen();
      await qc.cancelQueries({ queryKey: NOTIF_SETTINGS_KEY });
      const prev = qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY);
      if (prev) qc.setQueryData(NOTIF_SETTINGS_KEY, predictSettings(prev, patch));
      return { my, gen, prev };
    },
    onSuccess: (res, _patch, ctx) => {
      if (ctx && stillMine(ctx.my, ctx.gen)) qc.setQueryData(NOTIF_SETTINGS_KEY, res);
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev && stillMine(ctx.my, ctx.gen)) qc.setQueryData(NOTIF_SETTINGS_KEY, ctx.prev);
    },
  });
}
