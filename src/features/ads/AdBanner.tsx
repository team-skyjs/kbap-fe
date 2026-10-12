/**
 * AdBanner (KB-739 ④-②·③ 폴백) — 배너 자리 하나. 플래그 off·SDK 부재·초기화 전·미수신·실패 = **높이 0**(빈 칸·스켈레톤 금지).
 * 높이는 SDK가 `onAdLoaded`로 알려준 실측(적응형)만 쓴다. 앵커(검색 하단) = LARGE_ANCHORED_ADAPTIVE_BANNER, 인라인(피드) =
 * INLINE_ADAPTIVE_BANNER(maxHeight로 상한). 계측: ad_impression / ad_click(format·placement만 — 광고 내용 0).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import type { AdsSdk } from '@/lib/ads/sdk';
import { useAdsSdk } from '@/lib/ads/adsSession';
import { adUnitId, type AdPlacement } from '@/lib/ads/units';

const INLINE_MAX_HEIGHT = 250;

export function AdBanner({ placement, inline = false, testID }: { placement: Extract<AdPlacement, 'search_banner' | 'feed_banner'>; inline?: boolean; testID?: string }) {
  const sdk = useAdsSdk(); // ready 전 = null → 자리 0
  if (!FLAGS.ads.banner || !sdk) return null;
  return <BannerSlot sdk={sdk} placement={placement} inline={inline} testID={testID} />;
}

function BannerSlot({ sdk, placement, inline, testID }: { sdk: AdsSdk; placement: Extract<AdPlacement, 'search_banner' | 'feed_banner'>; inline: boolean; testID?: string }) {
  const [height, setHeight] = React.useState(0);
  const { BannerAd, BannerAdSize } = sdk;
  return (
    <View style={[styles.slot, { height }]} testID={testID ?? `ad-banner-${placement}`} accessibilityElementsHidden={height === 0}>
      <BannerAd
        unitId={adUnitId(placement)}
        size={inline ? BannerAdSize.INLINE_ADAPTIVE_BANNER : BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        maxHeight={inline ? INLINE_MAX_HEIGHT : undefined}
        onAdLoaded={(d) => setHeight(Math.ceil(d.height))}
        onSizeChange={(d) => setHeight(Math.ceil(d.height))}
        onAdFailedToLoad={() => setHeight(0)} // no-fill·네트워크 = 접힘
        onAdImpression={() => track(EVENTS.ad_impression, { format: 'banner', placement })}
        onAdClicked={() => track(EVENTS.ad_click, { format: 'banner', placement })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { width: '100%', overflow: 'hidden', alignItems: 'center' },
});
