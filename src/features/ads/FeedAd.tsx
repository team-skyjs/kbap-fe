/**
 * FeedAd (KB-739 ④-③④) — 리뷰 탭 피드 "5개마다 1개"(KB-816)·음식 상세 리뷰 미리보기 "3개마다 1개" 네이티브 광고. 리뷰 카드(FeedCard)와 같은 폭·여백(pad 22/20·하단 구분선).
 * 네이티브 no-fill·실패면 인라인 배너(feed_banner)로 폴백, 그것도 없으면 높이 0. "Sponsored" 배지 + AdChoices(우상단 — SDK 오버레이,
 * 그 자리를 비워 둔다) 필수. 등록한 asset만 클릭된다(NativeAsset 바로 안에 뷰, 래퍼 금지 — 라이브러리 규칙).
 * 계측: ad_impression/ad_click(format native·placement feed_native).
 *
 * **NativeAdView 자체엔 padding·border 금지**(QA 6R, iOS 검증기 "assets outside native ad view"): Fabric RCTViewComponentView는 contentView
 * (= GADNativeAdView, 자식이 여기 꽂힌다)를 *content frame*(bounds − padding − border)으로 잡는데 자식의 Yoga 프레임은 바깥 원점 기준이라
 * padding만큼 두 번 밀려 마지막 자산(CTA)이 광고 뷰 밖으로 넘친다. 여백·구분선은 바깥 View가, NativeAdView는 레이아웃(gap)만.
 */
import * as React from 'react';
import { Image, PixelRatio, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import { color as C, font } from '@/lib/theme';
import type { AdsSdk } from '@/lib/ads/sdk';
import { useAdsSdk } from '@/lib/ads/adsSession';
import { adUnitId } from '@/lib/ads/units';
import { compactMediaSize } from '@/lib/ads/compactMedia';
import { AdBanner } from './AdBanner';

export function FeedAd({ testID }: { testID?: string }) {
  const sdk = useAdsSdk();
  if (!sdk) return null;
  if (!FLAGS.ads.native) return FLAGS.ads.banner ? <AdBanner placement="feed_banner" inline testID={testID} /> : null;
  return <NativeSlot sdk={sdk} testID={testID} />;
}

function NativeSlot({ sdk, testID }: { sdk: AdsSdk; testID?: string }) {
  const { t } = useTranslation();
  const { useNativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView, NativeAdEventType, NativeAdChoicesPlacement } = sdk;
  const ad = useNativeAd({ adUnitId: adUnitId('feed_native'), autoLoad: true, requestOptions: { adChoicesPlacement: NativeAdChoicesPlacement.TOP_RIGHT } });
  const [availableWidth, setAvailableWidth] = React.useState<number | null>(null);
  const nativeAd = ad.status === 'loaded' ? ad.nativeAd : null;
  React.useEffect(() => {
    if (!nativeAd) return;
    const subs = [
      nativeAd.addAdEventListener(NativeAdEventType.IMPRESSION, () => { track(EVENTS.ad_impression, { format: 'native', placement: 'feed_native' }); airbridge.adImpression('native', 'feed_native'); }),
      nativeAd.addAdEventListener(NativeAdEventType.CLICKED, () => { track(EVENTS.ad_click, { format: 'native', placement: 'feed_native' }); airbridge.adClick('native', 'feed_native'); }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [nativeAd, NativeAdEventType]);

  if (ad.status === 'no-fill' || ad.status === 'error') return <AdBanner placement="feed_banner" inline testID={testID} />; // 폴백
  if (!nativeAd) return null; // idle·loading = 0 높이
  const mediaSize = availableWidth === null ? null : compactMediaSize(
    availableWidth, nativeAd.mediaContent?.aspectRatio, nativeAd.mediaContent?.hasVideoContent === true, PixelRatio.get(),
  );
  const unsupported = availableWidth !== null && mediaSize === null;
  // Keep the measuring host mounted through fallback, so rotation can be evaluated without re-requesting native ads.
  return (
    <View
      onLayout={(e) => setAvailableWidth(Math.max(0, e.nativeEvent.layout.width - 40))}
      style={availableWidth === null || unsupported ? undefined : styles.card}
      testID={`${testID ?? 'ad-native-feed_native'}-frame`}
    >
      {unsupported ? <AdBanner placement="feed_banner" inline testID={testID} /> : mediaSize && (
        <NativeAdView nativeAd={nativeAd} style={styles.inner} testID={testID ?? 'ad-native-feed_native'}>
          <View style={styles.badgeWrap}>
            <Text style={styles.badge} testID="ad-sponsored">{t('ads.sponsored')}</Text>
            <View style={styles.adChoicesSpace} />
          </View>
          <View style={styles.top}>
            {nativeAd.icon && (
              <NativeAsset assetType={NativeAssetType.ICON}>
                <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
              </NativeAsset>
            )}
            <View style={styles.who}>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.headline}>{nativeAd.headline}</Text>
              </NativeAsset>
              {nativeAd.advertiser ? (
                <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                  <Text style={styles.advertiser}>{nativeAd.advertiser}</Text>
                </NativeAsset>
              ) : null}
            </View>
          </View>
          <NativeMediaView style={[styles.media, mediaSize]} resizeMode="contain" />
          {nativeAd.body ? (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.body}>{nativeAd.body}</Text>
            </NativeAsset>
          ) : null}
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.cta}>{nativeAd.callToAction}</Text>
          </NativeAsset>
        </NativeAdView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 22, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.line }, // FeedCard와 동일 프레임 — 바깥 View
  inner: { gap: 8 }, // NativeAdView: padding·border·margin 0(위 주석)
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface2 },
  who: { flex: 1, minWidth: 0, gap: 2 },
  headline: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink, lineHeight: 21 },
  advertiser: { fontFamily: font.body, fontSize: 12, color: C.ink3, lineHeight: 16 },
  badgeWrap: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  badge: { flexShrink: 1, fontFamily: font.bodyBold, fontSize: 11, color: C.ink2, lineHeight: 16, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: C.line2 },
  adChoicesSpace: { width: 22, height: 22, flexShrink: 0 },
  body: { fontFamily: font.body, fontSize: 14, color: C.ink2, lineHeight: 20 },
  media: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: C.surface2 }, // 원비율·측정 가용폭으로 width/height 지정
  cta: { alignSelf: 'flex-start', maxWidth: '100%', fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText, lineHeight: 20, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.primary },
});
