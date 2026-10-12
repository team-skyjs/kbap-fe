/**
 * AdBanner (KB-739 ④-②·③ 폴백) — 배너 자리 하나. 플래그 off·SDK 부재·초기화 전·미수신·실패 = **높이 0**(빈 칸·스켈레톤 금지).
 * 높이는 SDK가 `onAdLoaded`/`onSizeChange`로 알려준 실측만 쓴다. 앵커(검색 하단) = ANCHORED_ADAPTIVE_BANNER(폭 기준 최적 높이 —
 * QA 4R: LARGE_*는 컨테이너가 112dp로 잡혀 320×50 데모 광고가 레터박스), 인라인(피드) = INLINE_ADAPTIVE_BANNER(maxHeight로 상한).
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
  const [height, setHeight] = React.useState(0);
  const { BannerAd, BannerAdSize } = sdk;
  const shown = visible && height > 0;
  return (
    <View style={[styles.slot, { height: shown ? height : 0, paddingBottom: shown ? bottomInset : 0 }]} testID={testID ?? `ad-banner-${placement}`} accessibilityElementsHidden={!shown}>
      <BannerAd
        unitId={adUnitId(placement)}
        size={inline ? BannerAdSize.INLINE_ADAPTIVE_BANNER : BannerAdSize.ANCHORED_ADAPTIVE_BANNER} /* ANCHORED_*: 타입은 deprecated 표기지만 지원 사이즈 — LARGE_*는 112dp 컨테이너에 50dp 크리에이티브가 레터박스(QA 4R) */
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
  slot: { width: '100%', overflow: 'hidden', alignItems: 'center', boxSizing: 'content-box' },
});
