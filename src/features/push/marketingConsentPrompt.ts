/**
 * marketingConsentPrompt (KB-979 → KB-987) — 미동의 회원에게 광고성 동의 시트를 권하는 표면(홈·알림함)의 판정.
 *
 * 홈 = 포커스마다(백그라운드 복귀 포함) 마지막 노출 후 3시간이 지났으면 판정. 노출 시각(epoch ms)은 시트를 **실제로 띄운 순간**
 * 기록한다(게스트·GET 실패·동의 회원·블러 abort는 기록 0). 키는 기기 단위. 시계 되돌림(저장값이 미래) = 기준점을 지금으로 재설정하고
 * 이번엔 안 띄운다(리뷰 유도 fixClockRewind 선례). 동의 여부는 서버 GET이 정본 — 로컬엔 "띄운 시각"(UX 상태)만 둔다.
 * 이미 동의로 캐시된 세션은 GET 생략(인증 경계의 queryClient.clear()가 캐시를 비우므로 재가입은 다시 서버 판정).
 * 알림함은 포커스마다(InboxMarketingConsent). 둘 다 시트가 떠 있는 동안 `isMarketingConsentActive()` — ScanExitPrompts가 비켜 준다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FLAGS } from '@/lib/flags';
import { getSessionState } from '@/lib/auth/useSession';
import { queryClient } from '@/lib/queryClient';
import { fetchNotificationSettings, NOTIF_SETTINGS_KEY, type NotificationSettings } from '@/lib/data/useNotificationSettings';
import { waitStep, waitUntil } from '@/lib/oneShotQueue';
import { isAdsSettled, subscribeAds } from '@/lib/ads/adsSession';
import { isOccluded, subscribeOcclusion } from '@/lib/engagement/occlusion';

export const HOME_LAST_SHOWN_KEY = 'kbap.marketingConsent.homeLastShownAt';
export const HOME_INTERVAL_MS = 3 * 60 * 60 * 1000;
const FETCH_CAP_MS = 8000;

/** 마지막 노출 후 3시간 경과 — 없음 = 통과. 미래값(시계 되돌림)은 호출 전에 보정한다 */
export const homeConsentDue = (last: number | null, now: number): boolean => last == null || now - last >= HOME_INTERVAL_MS;
/** 미동의 = 두 동의 중 하나라도 없음(홈·알림함 공용) */
export const isUnconsented = (s: NotificationSettings): boolean => !s.news.privacyConsent || !s.news.receiveConsent;

let sheetActive = false;
export const isMarketingConsentActive = (): boolean => sheetActive;
export function setMarketingConsentActive(v: boolean): void {
  sheetActive = v;
}

/** 홈 큐 스텝 — 띄우면 true(닫힌 뒤 done). 게스트·세션 미확정·3시간 미만·동의 캐시·GET 실패·블러 = 기록 없이 false(다음 포커스 재판정) */
export async function presentHomeMarketingConsent(show: (done: () => void) => void, done: () => void, signal: AbortSignal): Promise<boolean> {
  if (!FLAGS.pushEnabled || !FLAGS.marketingConsentPrompt) return false; // P-599: 운영 OFF = 판정 전 즉시 false(GET·기록·대기 0 — 큐는 다음 스텝으로)
  if (getSessionState() !== true) return false; // 홈 응답 전에 스텝이 돈다 — home.authenticated 대신 세션
  let last: number | null;
  try {
    const n = Number(await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY) ?? NaN);
    last = Number.isFinite(n) ? n : null; // 없음·깨진 값 = 통과
  } catch {
    return false; // 스토리지 오류 — 흐름 방해 금지(코치마크 선례)
  }
  const now = Date.now();
  if (last != null && last > now) {
    // 시계 되돌림 — 저장하지 않으면 시계가 그 미래 시각을 지날 때까지 영영 막힌다
    void AsyncStorage.setItem(HOME_LAST_SHOWN_KEY, String(now)).catch(() => {});
    return false;
  }
  if (!homeConsentDue(last, now)) return false;
  const cached = queryClient.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY);
  if (cached && !isUnconsented(cached)) return false; // 이미 동의(이 세션 서버 응답) — 포커스마다 GET 방지
  const r = await waitStep(queryClient.fetchQuery({ queryKey: NOTIF_SETTINGS_KEY, queryFn: fetchNotificationSettings }), signal, FETCH_CAP_MS);
  if (!r.ok) return false;
  if (!isUnconsented(r.value)) return false; // 동의 회원 — 기록 없음(서버가 정본)
  // 첫 실행 UMP·ATT 위에 Modal을 올리면 iOS가 present를 버린다 — 광고 기동 끝 + 덮개 없음까지(presentHomeCoach와 같은 대기)
  if (!(await waitUntil(isAdsSettled, subscribeAds, signal))) return false;
  if (!(await waitUntil(() => !isOccluded(), subscribeOcclusion, signal))) return false;
  void AsyncStorage.setItem(HOME_LAST_SHOWN_KEY, String(Date.now())).catch(() => {});
  show(done);
  return true;
}

/** 테스트 전용 */
export function _resetMarketingConsentForTest(): void {
  sheetActive = false;
}
