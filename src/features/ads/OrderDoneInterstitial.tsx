/**
 * OrderDoneInterstitial (KB-739 ④-①) — 주문 완료 뒤 홈으로 돌아오는 전환 시점의 전면 광고. 큐 스텝(oneShotQueue)으로 리뷰 유도
 * 시트 **뒤**에 선다(겹침 0). 세션당 1회(adsSession.canShowInterstitial) · 미리 로드(autoLoad) · 준비 안 됐으면 건너뜀(false) ·
 * 결과·판정 화면 진입엔 쓰지 않는다. 15초 내 닫힘은 SDK 전면 광고 기본(닫기 버튼).
 *
 * 호스트 컴포넌트가 SDK 훅을 들고, 부모(FlippedOrderCard)는 ref로 받은 `step()`을 큐에 넣는다 — SDK 부재·플래그 off·초기화 전이면
 * 호스트가 안 그려져 ref가 비고, 부모는 스텝을 건너뛴다.
 * show() 실패를 SDK가 삼켜 status가 안 움직이면 큐가 영구 블록 — `INTERSTITIAL_SHOW_TIMEOUT.ms` 안에 'showing'이 안 오면 done(/review 3).
 * 세션 상한은 **실제로 떠야**(showing) 소모(/review 4).
 */
import * as React from 'react';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import type { QueueStep } from '@/lib/oneShotQueue';
import type { AdsSdk } from '@/lib/ads/sdk';
import { canShowInterstitial, markInterstitialShown, useAdsSdk } from '@/lib/ads/adsSession';
import { adUnitId } from '@/lib/ads/units';

export interface InterstitialController { step: () => QueueStep }
/** show() 뒤 'showing'까지 기다리는 상한 — 넘으면 안 뜬 것으로 보고 복귀. 테스트는 ms를 줄인다 */
export const INTERSTITIAL_SHOW_TIMEOUT = { ms: 1500 };

export function OrderDoneInterstitial({ controllerRef }: { controllerRef: React.MutableRefObject<InterstitialController | null> }) {
  const sdk = useAdsSdk();
  if (!FLAGS.ads.interstitial || !sdk) return null;
  return <Host sdk={sdk} controllerRef={controllerRef} />;
}

function Host({ sdk, controllerRef }: { sdk: AdsSdk; controllerRef: React.MutableRefObject<InterstitialController | null> }) {
  const ad = sdk.useInterstitialAd({ adUnitId: adUnitId('order_done_interstitial'), autoLoad: canShowInterstitial() });
  const { status, show, impression, clicked } = ad;
  // 닫힘(또는 show 실패·타임아웃) → 큐 done 1회. 콜백은 ref — 네이티브 이벤트에서 최신 값
  const doneRef = React.useRef<(() => void) | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const finish = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    const done = doneRef.current;
    doneRef.current = null;
    done?.();
  };
  const finishRef = React.useRef(finish);
  React.useEffect(() => { finishRef.current = finish; });
  React.useEffect(() => {
    if (status === 'showing') { // 실제로 떴다 — 이제 세션 상한 소모, 타임아웃 해제
      markInterstitialShown();
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      return;
    }
    if (status === 'closed' || status === 'error') finishRef.current();
  }, [status]);
  React.useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  React.useEffect(() => { if (impression) track(EVENTS.ad_impression, { format: 'interstitial', placement: 'order_done_interstitial' }); }, [impression]);
  React.useEffect(() => { if (clicked) track(EVENTS.ad_click, { format: 'interstitial', placement: 'order_done_interstitial' }); }, [clicked]);

  const loadedRef = React.useRef(false);
  React.useEffect(() => { loadedRef.current = status === 'loaded'; }, [status]);

  React.useEffect(() => {
    controllerRef.current = {
      step: () => ({
        key: 'ad:order_done_interstitial',
        present: (done) => {
          if (!loadedRef.current || !canShowInterstitial()) return false; // 준비 안 됨·세션 상한 = 건너뜀
          doneRef.current = done;
          timeoutRef.current = setTimeout(() => finishRef.current(), INTERSTITIAL_SHOW_TIMEOUT.ms); // show가 조용히 실패하면 복귀
          show();
          return true;
        },
      }),
    };
    return () => { controllerRef.current = null; };
  }, [controllerRef, show]);

  return null;
}
