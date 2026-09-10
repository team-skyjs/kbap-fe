/**
 * useNotificationSettings (KB-497) — 알림 설정 **서버 정본** 훅.
 *
 * GET/PATCH /api/notifications/settings. 로컬 저장소 없음(P-147 서버 정본). PATCH는
 * 낙관 반영 → 실패 롤백 → 응답(전체 설정)으로 캐시 교체. 연타·프라이머 지연 응답이
 * 최신 값을 덮어쓰지 않도록 **모듈 seq**로 최신 요청 응답만 반영한다(훅 안팎 공유).
 *
 * 단위(KB-544): activity·news.mealTime = 이 기기(X-Installation-Id) 저장값,
 * news.enabled = 계산값(이 기기 news AND 회원 동의 2종), 동의 = 회원 단위.
 * 새 X-API-Version 매핑은 consent.ts 상수 1곳(null = 현행 레거시).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, type RequestOpts } from '@/lib/api/client';
import { queryClient as sharedQueryClient } from '@/lib/queryClient';
import { NOTIF_SETTINGS_API_VERSION } from '@/lib/push/consent';

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
    enabled?: boolean;
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

/** 낙관 예측 — 서버 응답이 오면 통째로 교체되므로 표시용 근사면 충분. */
export function predictSettings(cur: NotificationSettings, patch: NotificationSettingsPatch): NotificationSettings {
  const next: NotificationSettings = { ...cur, news: { ...cur.news } };
  if (patch.activity != null) next.activity = patch.activity;
  if (patch.news?.enabled === true) {
    const now = new Date().toISOString();
    next.news.enabled = true;
    next.news.mealTime = true;
    next.news.privacyConsent = { version: patch.news.privacyConsentVersion ?? 0, grantedAt: now };
    next.news.receiveConsent = { version: patch.news.receiveConsentVersion ?? 0, grantedAt: now };
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
  const res = await api.patch<NotificationSettings>(PATH, patch, opts());
  if (isLatest(my)) qc.setQueryData(NOTIF_SETTINGS_KEY, res);
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
    mutationFn: (patch: NotificationSettingsPatch) => api.patch<NotificationSettings>(PATH, patch, opts()),
    onMutate: async (patch) => {
      const my = nextSeq();
      await qc.cancelQueries({ queryKey: NOTIF_SETTINGS_KEY });
      const prev = qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY);
      if (prev) qc.setQueryData(NOTIF_SETTINGS_KEY, predictSettings(prev, patch));
      return { my, prev };
    },
    onSuccess: (res, _patch, ctx) => {
      if (ctx && isLatest(ctx.my)) qc.setQueryData(NOTIF_SETTINGS_KEY, res);
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev && isLatest(ctx.my)) qc.setQueryData(NOTIF_SETTINGS_KEY, ctx.prev);
    },
  });
}
