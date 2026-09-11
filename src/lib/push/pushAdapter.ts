/**
 * pushAdapter (P-192/KB-39) — 푸시 알림 **유일 관문**.
 *
 * ⚠️ OTA 안전 격리: expo-notifications는 config plugin(네이티브 변경)이라 알림
 * 미포함 구 런타임에서 모듈 import 자체가 크래시할 수 있다 — 접근은 전부 이
 * 파일의 **지연 require**(플래그+try 게이트) 경유. 화면/훅에서 직접 import 금지.
 * FLAGS.pushEnabled off = 전 기능 no-op (다음 네이티브 빌드 전 기본).
 *
 * 설정(KB-497) = **서버 정본** 2그룹 — 활동 알림(activity: Helpful + 리뷰 리마인더) ·
 * K-Bap 소식(news: 광고성, 동의 2종 + 하위 mealTime). 로컬 설정 저장소는 없다
 * (useNotificationSettings 캐시가 유일 미러). 토큰 등록은 회원 세션이 있을 때만(KB-543).
 *
 * 푸시 data 계약(KB-498) — 유형 enum 정본 = 서버(BE Swagger), 앱 쪽 정의는 아래 PUSH_TYPES 한 곳.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FLAGS } from '@/lib/flags';
import { track } from '@/lib/net/inflight';
import i18n from '@/lib/i18n';
import { api, apiLang } from '@/lib/api/client';
import { hasBeSession } from '@/lib/auth/beAuth';
import { queryClient } from '@/lib/queryClient';
import { NOTIF_SETTINGS_KEY, type NotificationSettings } from '@/lib/data/useNotificationSettings';

const PROMPTED_KEY = 'kbap.push.prompted.v1';
const REMINDERS_KEY = 'kbap.push.reminders.v1'; // { [foodId]: notificationId }

export const REVIEW_REMINDER_SECONDS = 3600; // 주문 완료 → 1시간 후

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

/* ---- 토큰 등록 ---- */

interface PushTokenRegistration {
  token: string;
  platform: string;
  lang: string;
}

async function sendTokenToServer(reg: PushTokenRegistration): Promise<void> {
  await api.put('/api/notifications/tokens', reg);
}

/** 앱 시작·로그인 성공·언어 변경 시 upsert — **회원 세션 없음·권한 없음이면 조용히 스킵**
 *  (KB-543: 토큰 API 회원 전용, 게스트 요청 0). 실패(401 포함)는 비치명.
 *  Codex #109 10R: track 경유 — 콜드 스타트 +8s OTA 창과 겹치는 연산(관문 5곳째). */
export function registerPushToken(): Promise<void> {
  return track(registerPushTokenInner());
}
async function registerPushTokenInner(): Promise<void> {
  const N = loadNotifications();
  if (!N) return;
  try {
    if (!(await hasBeSession())) return; // KB-543: 게스트 토큰 등록 폐기
    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = getProjectId();
    const { data: token } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await sendTokenToServer({ token, platform: Platform.OS, lang: apiLang() });
  } catch (e) {
    console.log('[push] token register 실패(비치명)', (e as Error)?.message ?? e);
  }
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
 * 서버 설정 `activity`(리뷰 리마인더 통합) 캐시가 true일 때만 — 캐시 없음 = 예약 안 함(보수적).
 * 권한 없음·플래그 off = 예약 안 함. 같은 음식 기존 예약은 교체. (KB-500에서 서버 배치로 이관 예정)
 */
export async function scheduleReviewReminder(food: { foodId: string; name: string }): Promise<void> {
  const N = loadNotifications();
  if (!N) return;
  try {
    if (queryClient.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY)?.activity !== true) return;
    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') return;
    await cancelReviewReminder(food.foodId); // 재주문 = 타이머 리셋
    const id = await N.scheduleNotificationAsync({
      content: {
        title: i18n.t('push.reviewReminderTitle'),
        body: i18n.t('push.reviewReminderBody', { name: food.name }),
        data: { type: 'REVIEW_REMINDER', foodId: food.foodId },
      },
      // KB-498: Android는 activity 채널(MAX)로 — 없으면 expo 폴백 채널(기본 중요도). iOS는 channelId 무시.
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: REVIEW_REMINDER_SECONDS, channelId: 'activity' },
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
 * KB-498: 탭마다 항상 호출 — href는 이동 없는 유형(NEWS·MEAL_TIME·foodId 없는 리마인더)이면 null.
 * 2번째 인자 = 서버 알림 id(기기 단위, data.notificationId 그대로 — 형 변환 없음). 경로가 없어도 id는 전달(읽음 처리용).
 * 읽음 처리 호출은 후속 작업(서버 알림함 전환) 몫. Android는 여기서 activity(MAX)·news(HIGH) 채널을 1회 설정.
 */
export function addNotificationTapListener(onRoute: (href: string | null, notificationId?: number | string) => void): () => void {
  const N = loadNotifications();
  if (!N) return () => {};
  // P-289: 발화 기록 — 알림함(실알림 전용)에 적재. id = request.identifier(중복 방지 키)
  const record = (req: { identifier?: string; content: { data?: unknown } } | null | undefined) => {
    try {
      const d = req?.content?.data as { type?: unknown; foodId?: string | number } | undefined;
      if (!req?.identifier || !isPushType(d?.type)) return; // KB-498: 미지 유형 = 기록 안 함
      const { recordInboxNotification } = require('@/lib/notifications/inbox') as typeof import('@/lib/notifications/inbox');
      recordInboxNotification({
        id: req.identifier,
        type: d.type,
        ...(d.foodId != null ? { foodId: String(d.foodId) } : {}),
      });
    } catch {
      /* 기록 실패 = 비치명(알림함만 비는 것) */
    }
  };
  try {
    // KB-498: Android 채널 2종 — activity(MAX: HELPFUL·REVIEW_REMINDER) · news(HIGH: 광고성 3종, 기기 설정에서 따로 끌 수 있게 분리).
    // 채널 중요도는 생성 후 변경 불가라 'default'는 만들지 않는다(서버가 default로 보내면 expo 폴백 채널 = 지금과 동일).
    // 이름은 설정 화면 그룹명 i18n 재사용. 멱등(재호출 = 이름만 갱신) · iOS 무동작 · 결과 대기 없음(부팅 지연 0).
    if (Platform.OS === 'android') {
      void N.setNotificationChannelAsync('activity', { name: i18n.t('notif.activityGroup'), importance: N.AndroidImportance.MAX, sound: 'default' }).catch(() => {});
      void N.setNotificationChannelAsync('news', { name: i18n.t('notif.newsGroup'), importance: N.AndroidImportance.HIGH, sound: 'default' }).catch(() => {});
    }
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const routed = new Set<string>(); // KB-498: 콜드 스타트 — 마지막 응답 조회와 리스너가 같은 탭을 이중 전달하는 것 차단
    const emit = (resp: { notification: { request: { identifier?: string; content: { data?: unknown } } } } | null) => {
      record(resp?.notification.request); // 백그라운드 발화 → 탭 진입도 회수
      const id = resp?.notification.request.identifier;
      if (id) {
        if (routed.has(id)) return;
        routed.add(id);
      }
      const data = resp?.notification.request.content.data as { notificationId?: number | string } | undefined;
      if (!resp) return;
      onRoute(routeForNotificationData(data), data?.notificationId); // 경로 null이어도 호출 — id 보존(Codex #149)
    };
    const sub = N.addNotificationResponseReceivedListener(emit);
    // P-289 ①: 포그라운드 발화 즉시 기록
    const recv = N.addNotificationReceivedListener?.((n: { request: { identifier?: string; content: { data?: unknown } } }) => record(n.request));
    // P-289 ②: 백그라운드 발화분 재실행 회수(알림 센터에 떠 있는 것)
    // #109 11R 잔여(P-348 동승): 부팅 알림 조회 2건도 track — OTA 정적 창 포함
    void track(N.getPresentedNotificationsAsync?.()
      .then((list: { request: { identifier?: string; content: { data?: unknown } } }[]) => list.forEach((n) => record(n.request)))
      .catch(() => {}) ?? Promise.resolve());
    void track(N.getLastNotificationResponseAsync().then(emit).catch(() => {}));
    return () => {
      sub.remove();
      recv?.remove?.();
    };
  } catch {
    return () => {};
  }
}

/* ---- 푸시 유형 (KB-498 — 서버 enum과 동일, 정확 일치만) ---- */

export const PUSH_TYPES = ['HELPFUL', 'SCAN_SUGGESTION', 'REVIEW_REMINDER', 'NEWS', 'MEAL_TIME'] as const;
export type PushType = (typeof PUSH_TYPES)[number];

export function isPushType(v: unknown): v is PushType {
  return typeof v === 'string' && (PUSH_TYPES as readonly string[]).includes(v); // trim·대소문자 정규화 없음
}

/* ---- 딥링크 라우팅 (순수 함수 — 서버 data 계약 KB-498, 여기만 배선) ---- */

export function routeForNotificationData(data: unknown): string | null {
  const d = data as { type?: string; foodId?: string | number } | null | undefined;
  switch (d?.type) {
    // 2026-09-12 종한: HELPFUL·SCAN_SUGGESTION 착지 미정 → 임시 디버깅 화면(push-landing). 기획 확정 시 교체.
    case 'HELPFUL':
      return '/push-landing?type=HELPFUL';
    case 'SCAN_SUGGESTION': // 구 NUDGE(2026-09-07 개명) — 구 이름은 default로 무동작
      return '/push-landing?type=SCAN_SUGGESTION';
    case 'REVIEW_REMINDER':
      return d.foodId != null ? `/food/${d.foodId}` : null; // 음식 상세(리뷰 작성 화면 아님 — 9/12 결정)
    case 'NEWS':
    case 'MEAL_TIME':
      return null; // 앱만 켜짐 — 이동 없음(알림함 열람·읽음 처리만)
    default:
      return null; // 미지·구 이름·변형 — 무동작(정확 일치만)
  }
}
