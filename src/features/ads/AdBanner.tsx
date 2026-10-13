/**
 * AdBanner (KB-739 ④-②·③ 폴백) — 배너 자리 하나. 플래그 off·SDK 부재·초기화 전·미수신·실패 = **높이 0**(빈 칸·스켈레톤 금지).
 * 높이는 SDK가 `onAdLoaded`로 알려준 **수신 크리에이티브 크기**만 쓴다(`onSizeChange`는 컨테이너 크기라 덮지 않는다 — QA 5R: 468×60 수신에 98dp 슬롯 = 검은 띠).
 * 앵커(검색 하단) = ANCHORED_ADAPTIVE_BANNER(QA 4R: LARGE_*는 컨테이너 112dp 레터박스), 인라인(피드) = INLINE_ADAPTIVE_BANNER(maxHeight로 상한).
 * 슬롯 배경 투명·가로 중앙 정렬. 개발 번들(__DEV__)은 수신 크기를 Metro 로그에 찍는다.
 * 계측: ad_impression / ad_click(format·placement만 — 광고 내용 0).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import type { AdsSdk } from '@/lib/ads/sdk';
import { useAdsSdk } from '@/lib/ads/adsSession';
import { adUnitId, type AdPlacement } from '@/lib/ads/units';

const INLINE_MAX_HEIGHT = 250;

export function AdBanner({ placement, inline = false, testID, visible = true, bottomInset = 0 }: {
  placement: Extract<AdPlacement, 'search_banner' | 'feed_banner'>;
  inline?: boolean;
  testID?: string;
  /** false = 스타일로만 숨김(높이 0) — BannerAd는 마운트 유지(언마운트/재마운트마다 새 요청·노출이 되지 않게, /review 7) */
  visible?: boolean;
  /** 앵커 배너 아래 안전영역 — 광고가 실제로 떠 있을 때만 더한다(높이 0이면 빈 띠 금지, /review 6) */
  bottomInset?: number;
}) {
  const sdk = useAdsSdk(); // ready 전 = null → 자리 0
  if (!FLAGS.ads.banner || !sdk) return null;
  return <BannerSlot sdk={sdk} placement={placement} inline={inline} testID={testID} visible={visible} bottomInset={bottomInset} />;
}

function BannerSlot({ sdk, placement, inline, testID, visible, bottomInset }: { sdk: AdsSdk; placement: Extract<AdPlacement, 'search_banner' | 'feed_banner'>; inline: boolean; testID?: string; visible: boolean; bottomInset: number }) {
  // KB-774: 수신 크리에이티브 크기(폭·높이) — 네이티브 배너 뷰가 크리에이티브보다 크면(큰 글씨 최대 iOS 실측: 320×100 수신) 남는 자리가
  // 검은 바탕으로 칠해져 좌우·아래(인셋 패딩 위로 넘침) 띠가 됐다. 크리에이티브 크기 클립 상자로 네이티브 뷰를 가운데 잘라 띠 0.
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);
  const height = size?.h ?? 0;
  const { BannerAd, BannerAdSize } = sdk;
  const shown = visible && height > 0;
  const slotTestID = testID ?? `ad-banner-${placement}`;
  return (
    <View style={[styles.slot, { height: shown ? height : 0, paddingBottom: shown ? bottomInset : 0 }]} testID={slotTestID} accessibilityElementsHidden={!shown}>
      <View style={[styles.clip, size && { width: size.w, height: size.h }]} testID={`${slotTestID}-clip`}>
        <BannerAd
          unitId={adUnitId(placement)}
          size={inline ? BannerAdSize.INLINE_ADAPTIVE_BANNER : BannerAdSize.ANCHORED_ADAPTIVE_BANNER} /* ANCHORED_*: 타입은 deprecated 표기지만 지원 사이즈 — LARGE_*는 112dp 컨테이너에 50dp 크리에이티브가 레터박스(QA 4R) */
          maxHeight={inline ? INLINE_MAX_HEIGHT : undefined}
          onAdLoaded={(d) => { if (__DEV__) console.log('[ads] banner loaded', placement, JSON.stringify(d)); setSize({ w: Math.ceil(d.width), h: Math.ceil(d.height) }); }}
          onSizeChange={(d) => { if (__DEV__) console.log('[ads] banner sizeChange(ignored)', placement, JSON.stringify(d)); }}
          onAdFailedToLoad={() => setSize(null)} // no-fill·네트워크 = 접힘
          onAdImpression={() => track(EVENTS.ad_impression, { format: 'banner', placement })}
          onAdClicked={() => track(EVENTS.ad_click, { format: 'banner', placement })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { width: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', boxSizing: 'content-box' },
  clip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, // 로드 전 = 크기 미지정(슬롯 높이 0이 숨김)
});
