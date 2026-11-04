/**
 * marketingConsentPrompt (KB-979) — 미동의 회원에게 광고성 동의 시트를 권하는 표면(홈·알림함)의 판정.
 *
 * 홈 = 콜드 스타트(JS 런타임) 1회 AND 오늘(기기 로컬 날짜) 아직 안 띄움. 날짜는 시트를 **실제로 띄운 순간** 기록한다
 * (게스트·GET 실패·동의 회원·블러 abort는 기록 0). 날짜 키는 기기 단위(같은 날 계정 전환 = 그날 홈 미노출, 계획 A-2).
 * 동의 여부는 서버 GET이 정본 — 로컬엔 "띄운 날"(UX 상태)만 둔다(탈퇴→재가입 = 서버 null이면 다시 대상).
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

export const HOME_SHOWN_DATE_KEY = 'kbap.marketingConsent.homeShownDate';
const FETCH_CAP_MS = 8000;

/** 기기 로컬 YYYY-MM-DD(UTC 금지 — 자정 경계는 사용자 시계 기준) */
export function localDateKey(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
/** 오늘 아직 안 띄움 — 어제·미래(시계 되돌림)·없음 = 통과 */
export const shouldCheckHome = (stored: string | null, today: string): boolean => stored !== today;
/** 미동의 = 두 동의 중 하나라도 없음(홈·알림함 공용) */
export const isUnconsented = (s: NotificationSettings): boolean => !s.news.privacyConsent || !s.news.receiveConsent;

let homeChecked = false; // 이 런타임에서 홈 판정을 마쳤나(콜드 스타트당 1회)
let sheetActive = false;
export const isMarketingConsentActive = (): boolean => sheetActive;
export function setMarketingConsentActive(v: boolean): void {
  sheetActive = v;
}

/** 홈 큐 스텝 — 띄우면 true(닫힌 뒤 done). 게스트·세션 미확정·GET 실패·블러 = 소모 없이 false(다음 포커스 재판정) */
export async function presentHomeMarketingConsent(show: (done: () => void) => void, done: () => void, signal: AbortSignal): Promise<boolean> {
  if (!FLAGS.pushEnabled || homeChecked) return false;
  if (getSessionState() !== true) return false; // 홈 응답 전에 스텝이 돈다 — home.authenticated 대신 세션
  let stored: string | null;
  try {
    stored = await AsyncStorage.getItem(HOME_SHOWN_DATE_KEY);
  } catch {
    return false; // 스토리지 오류 — 흐름 방해 금지(코치마크 선례)
  }
  if (!shouldCheckHome(stored, localDateKey(new Date()))) { homeChecked = true; return false; }
  const r = await waitStep(queryClient.fetchQuery({ queryKey: NOTIF_SETTINGS_KEY, queryFn: fetchNotificationSettings }), signal, FETCH_CAP_MS);
  if (!r.ok) return false;
  if (!isUnconsented(r.value)) { homeChecked = true; return false; } // 동의 회원 — 날짜 기록 없음(서버가 정본)
  // 첫 실행 UMP·ATT 위에 Modal을 올리면 iOS가 present를 버린다 — 광고 기동 끝 + 덮개 없음까지(presentHomeCoach와 같은 대기)
  if (!(await waitUntil(isAdsSettled, subscribeAds, signal))) return false;
  if (!(await waitUntil(() => !isOccluded(), subscribeOcclusion, signal))) return false;
  homeChecked = true;
  void AsyncStorage.setItem(HOME_SHOWN_DATE_KEY, localDateKey(new Date())).catch(() => {});
  show(done);
  return true;
}

/** 테스트 전용 */
export function _resetMarketingConsentForTest(): void {
  homeChecked = false;
  sheetActive = false;
}
