/**
 * pushAdapter (P-192/KB-39) — 푸시 알림 **유일 관문**.
 *
 * ⚠️ OTA 안전 격리: expo-notifications는 config plugin(네이티브 변경)이라 알림
 * 미포함 구 런타임에서 모듈 import 자체가 크래시할 수 있다 — 접근은 전부 이
 * 파일의 **지연 require**(플래그+try 게이트) 경유. 화면/훅에서 직접 import 금지.
 * FLAGS.pushEnabled off = 전 기능 no-op (다음 네이티브 빌드 전 기본).
 *
 * 기획 정본: dropbox/yj/2026-08-13-푸시알림-BE-요청.md — 3종:
 *   ① Helpful 서버푸시(기본 on) ② 리뷰 유도 로컬(주문 완료 1h 후, 기본 on)
 *   ③ 리텐션 넛지 서버푸시(기본 off — 광고성, 옵트인 시각 기록: 정보통신망법).
 * BE 토큰 API = **계약 미정**(요청 문서 회신 대기) — sendTokenToServer만 배선점.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FLAGS } from '@/lib/flags';
import i18n from '@/lib/i18n';

const SETTINGS_KEY = 'kbap.push.settings.v1';
const PROMPTED_KEY = 'kbap.push.prompted.v1';
const REMINDERS_KEY = 'kbap.push.reminders.v1'; // { [foodId]: notificationId }

export const REVIEW_REMINDER_SECONDS = 3600; // 주문 완료 → 1시간 후

export interface PushSettings {
  helpful: boolean;
  reviewReminder: boolean;
  nudge: boolean;
  /** 넛지(광고성) 수신 동의 일시 — 서버 저장은 계약 후, 우선 로컬 기록. */
  nudgeOptInAt: string | null;
}
export const DEFAULT_PUSH_SETTINGS: PushSettings = { helpful: true, reviewReminder: true, nudge: false, nudgeOptInAt: null };

/* ---- 네이티브 모듈 지연 로드 (유일한 require 지점) ---- */

type NotificationsModule = typeof import('expo-notifications');

export function pushAvailable(): boolean {
  return FLAGS.pushEnabled && loadNotifications() != null;
}

function loadNotifications(): NotificationsModule | null {
  if (!FLAGS.pushEnabled) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null; // 구 런타임(네이티브 미포함) — 조용히 무기능
  }
}

/* ---- 설정 (AsyncStorage — 기기 단위) ---- */

export async function getPushSettings(): Promise<PushSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_PUSH_SETTINGS, ...(JSON.parse(raw) as Partial<PushSettings>) };
  } catch {
    /* 저장소 오류 — 기본값 */
  }
  return { ...DEFAULT_PUSH_SETTINGS };
}

/** 저장 + 넛지 off→on 전환 시 동의 일시 스탬프(광고성 수신 동의 기록). */
export async function savePushSettings(next: Omit<PushSettings, 'nudgeOptInAt'>): Promise<PushSettings> {
  const prev = await getPushSettings();
  const merged: PushSettings = {
    ...next,
    nudgeOptInAt: next.nudge && !prev.nudge ? new Date().toISOString() : prev.nudgeOptInAt,
  };
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    /* 저장 실패 — 다음 진입 시 기본값 */
  }
  return merged;
}

/* ---- 권한 프라이머 노출 기록 (거절 시 재노출 0 — 설정 화면 안내만) ---- */

export type PrimerResult = 'accepted' | 'declined';

export async function getPrimerResult(): Promise<PrimerResult | null> {
  try {
    const v = await AsyncStorage.getItem(PROMPTED_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

export async function markPrimerResult(result: PrimerResult): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMPTED_KEY, result);
  } catch {
    /* 기록 실패 — 최악은 1회 재노출 */
  }
}

/* ---- OS 권한 ---- */

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getPermissionStatus(): Promise<PushPermission> {
  const N = loadNotifications();
  if (!N) return 'unavailable';
  try {
    const { status } = await N.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unavailable';
  }
}

/** OS 권한 팝업 — 프라이머 수락 후에만 호출(iOS 1회성 보호는 프라이머 몫). */
export async function requestPermission(): Promise<boolean> {
  const N = loadNotifications();
  if (!N) return false;
  try {
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/* ---- 토큰 등록 (BE 계약 미정 — 이 함수만 배선점) ---- */

interface PushTokenRegistration {
  token: string;
  platform: string;
  lang: string;
  settings: PushSettings;
}

async function sendTokenToServer(reg: PushTokenRegistration): Promise<void> {
  // BE 토큰 저장 API 계약 대기(2026-08-13 요청 문서) — 회신 오면 여기만 배선.
  console.log('[push] token upsert (BE 계약 대기, no-op)', reg.token.slice(0, 24), reg.platform, reg.lang);
}

/** 앱 시작·언어 변경 시 upsert — 권한 없으면 조용히 스킵(게스트 포함). */
export async function registerPushToken(): Promise<void> {
  const N = loadNotifications();
  if (!N) return;
  try {
    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = getProjectId();
    const { data: token } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await sendTokenToServer({ token, platform: Platform.OS, lang: i18n.language, settings: await getPushSettings() });
  } catch (e) {
    console.log('[push] token register 실패(비치명)', (e as Error)?.message ?? e);
  }
}

/** 로그아웃·탈퇴 시 서버 토큰 삭제 골격 — 계약 후 배선(현재 no-op+로그). */
export async function unregisterPushToken(): Promise<void> {
  if (!FLAGS.pushEnabled) return;
  console.log('[push] token delete (BE 계약 대기, no-op)');
}

function getProjectId(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as { easConfig?: { projectId?: string }; expoConfig?: { extra?: { eas?: { projectId?: string } } } };
    return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  } catch {
    return undefined;
  }
}

/* ---- 로컬 리뷰 유도 알림 (BE 무관 — 표 ②) ---- */

async function getReminderMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* 손상 — 빈 맵 */
  }
  return {};
}

async function setReminderMap(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(map));
  } catch {
    /* 기록 실패 — 취소 불가 최악 1회 중복 */
  }
}

/**
 * 주문 완료 모달 닫힘 시점 호출 — 1시간 후 "아까 그 메뉴 어땠어요?" 예약.
 * 수신 설정 off·권한 없음·플래그 off = 예약 안 함. 같은 음식 기존 예약은 교체.
 */
export async function scheduleReviewReminder(food: { foodId: string; name: string }): Promise<void> {
  const N = loadNotifications();
  if (!N) return;
  try {
    const settings = await getPushSettings();
    if (!settings.reviewReminder) return;
    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') return;
    await cancelReviewReminder(food.foodId); // 재주문 = 타이머 리셋
    const id = await N.scheduleNotificationAsync({
      content: {
        title: i18n.t('push.reviewReminderTitle'),
        body: i18n.t('push.reviewReminderBody', { name: food.name }),
        data: { type: 'REVIEW_REMINDER', foodId: food.foodId },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: REVIEW_REMINDER_SECONDS },
    });
    await setReminderMap({ ...(await getReminderMap()), [food.foodId]: id });
  } catch (e) {
    console.log('[push] reminder 예약 실패(비치명)', (e as Error)?.message ?? e);
  }
}

/** 그 음식 리뷰 작성 완료 시 호출 — 예약 취소(이미 발화됐으면 no-op). */
export async function cancelReviewReminder(foodId: string): Promise<void> {
  const N = loadNotifications();
  if (!N) return;
  try {
    const map = await getReminderMap();
    const id = map[foodId];
    if (!id) return;
    await N.cancelScheduledNotificationAsync(id);
    delete map[foodId];
    await setReminderMap(map);
  } catch {
    /* 취소 실패 — 알림 1회 더 오는 것뿐 */
  }
}

/* ---- 알림 탭 구독 (루트 레이아웃 1곳 배선) ---- */

/**
 * 알림 탭 → 라우팅 콜백. 포그라운드 표시 핸들러(배너)도 여기서 1회 설정.
 * 콜드 스타트(종료 상태 알림 탭)는 마지막 응답 1회 처리. 반환 = 해제 함수.
 */
export function addNotificationTapListener(onRoute: (href: string) => void): () => void {
  const N = loadNotifications();
  if (!N) return () => {};
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const emit = (resp: { notification: { request: { content: { data?: unknown } } } } | null) => {
      const href = resp ? routeForNotificationData(resp.notification.request.content.data) : null;
      if (href) onRoute(href);
    };
    const sub = N.addNotificationResponseReceivedListener(emit);
    void N.getLastNotificationResponseAsync().then(emit).catch(() => {});
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/* ---- 딥링크 라우팅 (순수 함수 — 서버 data 스키마는 BE 확정 대기, 여기만 배선) ---- */

export function routeForNotificationData(data: unknown): string | null {
  const d = data as { type?: string; foodId?: string | number } | null | undefined;
  switch (d?.type) {
    case 'HELPFUL':
      return '/profile/reviews'; // 발주 6: HELPFUL → 내 리뷰
    case 'NUDGE':
      return '/scan'; // 넛지 → 스캔
    case 'REVIEW_REMINDER':
      return d.foodId != null ? `/food/${d.foodId}/review` : null;
    default:
      return null; // 미지 타입 — 무동작(스키마 확장 안전)
  }
}
