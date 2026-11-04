/**
 * marketingConsentPrompt (KB-979 → KB-987) — 미동의 회원에게 광고성 동의 시트를 권하는 표면(홈·알림함)의 판정.
 *
 * 홈 = **최초 1회**(P-600, 예진 11/04 결정 — 구 KB-987 3시간 주기 폐기): 포커스·백그라운드 복귀 때 판정하되, 홈에서 한 번이라도
 * 띄운 기기(노출 시각 기록 있음)면 닫았든 나중에든 다시 안 띄운다. 노출 시각(epoch ms)은 시트를 **실제로 띄운 순간** 기록한다
 * (게스트·GET 실패·동의 회원·블러 abort는 기록 0 → 다음 기회에 다시 판정). 키는 기기 단위. 동의 여부는 서버 GET이 정본 — 로컬엔 "띄운 시각"(UX 상태)만 둔다.
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
const FETCH_CAP_MS = 8000;

/** P-600: 노출 기록이 없을 때만 — 한 번 띄운 기기는 영구 미노출(홈·알림함 공통 기록) */
export const homeConsentDue = (last: number | null): boolean => last == null;

/** P-600(#424 Codex P1 → 예진 11/4): 홈·알림함 **공통** 노출 기록 — 어느 쪽이든 한 번 떴으면 양쪽 다 0.
 *  키 문자열은 기존 홈 키 그대로(이미 홈에서 본 기기 승계). true = 이미 노출 · false = 미노출 · null = 스토리지 오류(띄우지 않음). 깨진 값 = 미노출 */
export async function consentShownBefore(): Promise<boolean | null> {
  try {
    const n = Number((await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY)) ?? NaN);
    return !homeConsentDue(Number.isFinite(n) ? n : null);
  } catch {
    return null;
  }
}
/** 실제로 띄운 순간에만(홈·알림함 공통) */
export function recordConsentShown(): void {
  void AsyncStorage.setItem(HOME_LAST_SHOWN_KEY, String(Date.now())).catch(() => {});
}
/** 미동의 = 두 동의 중 하나라도 없음(홈·알림함 공용) */
export const isUnconsented = (s: NotificationSettings): boolean => !s.news.privacyConsent || !s.news.receiveConsent;

let sheetActive = false;
export const isMarketingConsentActive = (): boolean => sheetActive;
export function setMarketingConsentActive(v: boolean): void {
  sheetActive = v;
}

/** 홈 큐 스텝 — 띄우면 true(닫힌 뒤 done). 게스트·세션 미확정·이미 노출·동의 캐시·GET 실패·블러 = 기록 없이 false(다음 포커스 재판정) */
export async function presentHomeMarketingConsent(show: (done: () => void) => void, done: () => void, signal: AbortSignal): Promise<boolean> {
  if (!FLAGS.pushEnabled || !FLAGS.marketingConsentPrompt) return false; // P-599: 운영 OFF = 판정 전 즉시 false(GET·기록·대기 0 — 큐는 다음 스텝으로)
  if (getSessionState() !== true) return false; // 홈 응답 전에 스텝이 돈다 — home.authenticated 대신 세션
  // P-600: 최초 1회(홈·알림함 공통 기록) — 이미 노출·스토리지 오류(null) = 안 띄움(흐름 방해 금지, 코치마크 선례)
  if ((await consentShownBefore()) !== false) return false;
  const cached = queryClient.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY);
  if (cached && !isUnconsented(cached)) return false; // 이미 동의(이 세션 서버 응답) — 포커스마다 GET 방지
  const r = await waitStep(queryClient.fetchQuery({ queryKey: NOTIF_SETTINGS_KEY, queryFn: fetchNotificationSettings }), signal, FETCH_CAP_MS);
  if (!r.ok) return false;
  if (!isUnconsented(r.value)) return false; // 동의 회원 — 기록 없음(서버가 정본)
  // 첫 실행 UMP·ATT 위에 Modal을 올리면 iOS가 present를 버린다 — 광고 기동 끝 + 덮개 없음까지(presentHomeCoach와 같은 대기)
  if (!(await waitUntil(isAdsSettled, subscribeAds, signal))) return false;
  if (!(await waitUntil(() => !isOccluded(), subscribeOcclusion, signal))) return false;
  recordConsentShown();
  show(done);
  return true;
}

/** 테스트 전용 */
export function _resetMarketingConsentForTest(): void {
  sheetActive = false;
}
