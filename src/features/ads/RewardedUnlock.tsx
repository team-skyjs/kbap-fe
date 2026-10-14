/**
 * RewardedUnlock (KB-739 ④-⑤⑥ · 서버 KB-740) — 스캔 제한 해제 2택의 "광고 보고 풀기(n/3)" 쪽. 제한 도달 시트(HomeQuotaBadge)와
 * 스캔 제한 화면(scan.tsx) 둘 다 `<UnlockActions onWriteReview … />`로 같은 버튼 묶음을 쓴다: [리뷰 쓰기] + [광고 보고 풀기 n/3].
 * 광고 버튼은 회원 + 서버가 adRewards를 주고(구서버 null = 숨김) + 광고 준비됨일 때만 — 리뷰 경로는 무변.
 *
 * 흐름: 로드 완료마다 rewardKey(UUID) 새로 발급 → 사용자가 탭 → 보상형 표시 → EARNED_REWARD → `POST ad-rewards` {rewardKey, adUnitId}
 * → 응답 `remainingForUnlock`으로 n/3 표시(**서버 응답만**, 로컬 카운트 0) · `scanUnlocked`면 onUnlocked(시트 닫고 스캔 허용).
 * 429 = "오늘은 여기까지" 안내 · 400 = 재시도 없이 닫기 · 네트워크 = **같은 rewardKey 보관 → 버튼 재탭에 같은 키로 재신고**(멱등 — 본 광고의 보상 소실 0,
 * /review 1), 성공한 뒤에만 새 광고·새 키. 성공 뒤 프로필 캐시 invalidate(훅).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import { color as C, font } from '@/lib/theme';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { classifyAdRewardError, useClaimAdReward, type AdRewardFailure } from '@/lib/data/useAdReward';
import type { AdsSdk } from '@/lib/ads/sdk';
import { useAdsSdk } from '@/lib/ads/adsSession';
import { adUnitId } from '@/lib/ads/units';

const PLACEMENT = 'scan_unlock_rewarded';

/** 광고 보고 풀기 버튼이 실제로 보이는 조건 — 본문 문구(quotaBodyUnlock vs quotaBody)도 같은 판정을 쓴다(KB-759 /review 4: 버튼 없는데 "광고 보기" 약속 금지).
 *  게스트·구서버(adRewards null)·SDK 미준비·남은 0 = false. 429 상한은 버튼이 남아 "오늘은 여기까지" 안내를 띄우므로 여기서 가리지 않는다. */
export function useCanWatchAd(): boolean {
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const sdk = useAdsSdk();
  const rewards = me?.adRewards ?? null;
  return FLAGS.ads.rewarded && !!sdk && !isGuest && rewards != null && rewards.remaining > 0;
}

export function UnlockActions({ onWriteReview, onUnlocked, onClose, reviewTestID = 'quota-sheet-review' }: {
  onWriteReview: () => void;
  /** 서버가 scanUnlocked=true를 돌려줬다 — 호출측이 시트를 닫고 스캔을 허용 */
  onUnlocked: () => void;
  /** 400(남의 키·허용 밖 단위) — 재시도 없이 닫기 */
  onClose: () => void;
  reviewTestID?: string;
}) {
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const sdk = useAdsSdk();
  const rewards = me?.adRewards ?? null;
  const canWatch = FLAGS.ads.rewarded && !!sdk && !isGuest && rewards != null && rewards.remaining > 0;
  return (
    <View style={styles.actions}>
      <Btn onPress={onWriteReview} testID={reviewTestID}>{t('scan.quotaCta')}</Btn>
      {canWatch && sdk && rewards && <RewardedButton sdk={sdk} initial={rewards} onUnlocked={onUnlocked} onClose={onClose} />}
    </View>
  );
}

export type RewardedSurface = 'dialog';
type RewardsInit = { count: number; forUnlock: number; remaining: number };

/** 보상형 광고 해제의 상태 기계(KB-739 → KB-765 추출) — 표면(스캔 화면 버튼 · 홈 한도 다이얼로그 타일)이 같은 로직을 그린다.
 *  로드마다 새 rewardKey · EARNED_REWARD 1회 자동 신고 · 네트워크 실패 = 같은 키 보관·재신고 · 429 상한 · 400 닫기 · 서버 응답만으로 n/3. */
function useRewardedUnlock(sdk: AdsSdk, initial: RewardsInit, onUnlocked: () => void, onClose: () => void, surface?: RewardedSurface) {
  const unitId = adUnitId(PLACEMENT);
  const ad = sdk.useRewardedAd({ adUnitId: unitId, autoLoad: true });
  const { status, earnedReward, show, load, impression, clicked } = ad;
  const claim = useClaimAdReward();
  // 서버 응답만 — 초기값은 프로필(서버), 그 뒤는 claim 응답
  const [remaining, setRemaining] = React.useState(initial.remaining);
  const [failure, setFailure] = React.useState<AdRewardFailure | null>(null);
  const keyRef = React.useRef<string | null>(null);
  const claimedRef = React.useRef<string | null>(null);
  // 네트워크 실패로 신고 못 한 보상 — 같은 키로 재신고할 때까지 보관(새 로드가 와도 덮지 않는다)
  const pendingRef = React.useRef<{ rewardKey: string; adUnitId: string } | null>(null);
  // KB-765: 표면 구분(홈 다이얼로그 = 'dialog') — 기존 이벤트 이름 그대로, 속성만 추가. 스캔 화면 버튼은 미지정(종전과 동일)
  const surfaceProp = surface ? { surface } : {};

  React.useEffect(() => { if (status === 'loaded' && !pendingRef.current) keyRef.current = Crypto.randomUUID(); }, [status]); // 로드마다 새 키(멱등 단위) — 미신고 보상이 있으면 유지
  React.useEffect(() => { if (impression) { track(EVENTS.ad_impression, { format: 'rewarded', placement: PLACEMENT, ...surfaceProp }); airbridge.adImpression('rewarded', PLACEMENT); } }, [impression]); // eslint-disable-line react-hooks/exhaustive-deps -- 노출 1회(표면은 마운트 동안 불변)
  React.useEffect(() => { if (clicked) { track(EVENTS.ad_click, { format: 'rewarded', placement: PLACEMENT, ...surfaceProp }); airbridge.adClick('rewarded', PLACEMENT); } }, [clicked]); // eslint-disable-line react-hooks/exhaustive-deps -- 위와 같음

  const { mutateAsync } = claim;
  const submitClaim = React.useCallback((input: { rewardKey: string; adUnitId: string }) => {
    pendingRef.current = input;
    return mutateAsync(input)
      .then((r) => {
        pendingRef.current = null;
        setFailure(null);
        setRemaining(r.remainingForUnlock);
        track(EVENTS.ad_reward_earned, { placement: PLACEMENT, remaining: r.remainingForUnlock, ...(surface ? { surface } : {}) });
        if (__DEV__) console.log('[ads] reward claim ok', JSON.stringify(r)); // KB-759 원인 특정(개발 번들만)
        if (r.scanUnlocked) onUnlocked(); // KB-783 ⑮ 'ad' 표식은 useClaimAdReward.onSuccess(재조회 전)에서
      })
      .catch((e: unknown) => {
        const kind = classifyAdRewardError(e);
        if (__DEV__) console.log('[ads] reward claim fail', kind, String((e as { code?: string })?.code ?? e));
        setFailure(kind);
        if (kind !== 'network') pendingRef.current = null; // 400·429 = 재신고 대상 아님
        if (kind === 'rejected') onClose();
      });
  }, [mutateAsync, onUnlocked, onClose, surface]);
  React.useEffect(() => {
    const key = keyRef.current;
    if (!earnedReward || !key || claimedRef.current === key) return;
    claimedRef.current = key; // 같은 보상 1회만 자동 신고(상태 재렌더에 따른 재발화 차단) — 재시도는 버튼 탭
    void submitClaim({ rewardKey: key, adUnitId: unitId });
  }, [earnedReward, submitClaim, unitId]);

  // 닫힌 뒤 다음 광고 미리 로드(아직 해제 전·상한 아님·미신고 보상 없음일 때)
  React.useEffect(() => { if (status === 'closed' && remaining > 0 && failure !== 'limit' && !pendingRef.current) load(); }, [status, remaining, failure, load]);

  const busy = status === 'showing' || claim.isPending;
  const loaded = status === 'loaded';
  const retryPending = failure === 'network'; // 보상은 받았는데 신고만 못 함 — 버튼 = 같은 키 재신고(광고 다시 안 봄)
  const pressable = retryPending || (loaded && failure !== 'limit');
  const press = () => {
    if (retryPending && pendingRef.current) { void submitClaim(pendingRef.current); return; }
    if (loaded && failure !== 'limit') show();
  };
  return { watched: Math.max(0, initial.forUnlock - remaining), total: initial.forUnlock, busy, loaded, retryPending, pressable, failure, press };
}

function RewardedButton({ sdk, initial, onUnlocked, onClose }: { sdk: AdsSdk; initial: RewardsInit; onUnlocked: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const r = useRewardedUnlock(sdk, initial, onUnlocked, onClose);
  return (
    <View style={styles.rewarded}>
      <Btn variant={r.pressable ? 'secondary' : 'off'} busy={r.busy} onPress={r.press} testID="quota-watch-ad">
        {r.retryPending ? t('common.tryAgain') : t('ads.watchToUnlock', { n: r.watched, total: r.total })}
      </Btn>
      {r.failure === 'limit' && <Text style={styles.note} testID="quota-ad-limit">{t('ads.rewardLimit')}</Text>}
      {r.failure === 'network' && <Text style={styles.note} testID="quota-ad-error">{t('ads.rewardError')}</Text>}
    </View>
  );
}

/** 홈 한도 다이얼로그(KB-765)의 광고 타일 원천 — 보일 때만 sdk·rewards를 준다(조건 = useCanWatchAd와 동일). */
export function useAdUnlockSource(): { sdk: AdsSdk; rewards: RewardsInit } | null {
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const sdk = useAdsSdk();
  const rewards = me?.adRewards ?? null;
  return FLAGS.ads.rewarded && sdk && !isGuest && rewards != null && rewards.remaining > 0 ? { sdk, rewards } : null;
}

/** KB-765 광고 타일 — 상태 기계는 버튼과 같고 그리는 것만 다르다. children = 타일 표면(호출측 스타일), note = 상한·실패 안내 슬롯 */
export function RewardedTile({ sdk, initial, onUnlocked, onClose, render }: {
  sdk: AdsSdk;
  initial: RewardsInit;
  onUnlocked: () => void;
  onClose: () => void;
  render: (r: ReturnType<typeof useRewardedUnlock>) => React.ReactNode;
}) {
  const r = useRewardedUnlock(sdk, initial, onUnlocked, onClose, 'dialog');
  return <>{render(r)}</>;
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  rewarded: { gap: 6 },
  note: { fontFamily: font.body, fontSize: 13, color: C.ink3, lineHeight: 18, textAlign: 'center' },
});
