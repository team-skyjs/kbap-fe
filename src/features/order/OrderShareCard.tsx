/**
 * OrderShareCard (P-380/KB-518) — 주문 상세 하단 공유 섹션. 시안 `share-section`(2200:21205).
 *
 * 카드는 **폭 210 고정**(시안)이고, 4단계에서 이 뷰를 그대로 캡처해 1080×1920 캔버스에
 * 얹는다. 그래서 카드 내부는 화면 폭에 반응하지 않는다 — 반응형으로 만들면 캡처 결과가
 * 기기마다 달라진다.
 *
 * ⚠️ K-Bap 배지는 **시안(주황 필)과 다르다**(9/14 예진 결정). 마크의 그릇 색이 필 색과
 * 같은 #FF7134라 필 위에서 그릇이 묻히고 K만 떠 보인다 → 필을 빼고 앱 아이콘 마크 +
 * 텍스트로 간다. 참조 렌더 story-card-ref.png에는 옛 배지가 찍혀 있으니 그 부분만 제외.
 */
import * as React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { RemoteImage } from '@/components/RemoteImage';
import { IconDownload, IconInstagram } from '@/components/icons';
import { SHARE_CARD_W, SHARE_GRID_H, shareCells } from './shareCard';

/** 앱 아이콘과 같은 마크(검은 K + 주황 그릇, 투명 배경) — 배지 교체분. */
const BRAND_MARK = require('../../../assets/images/splash-mark-ios.png') as number;

export type OrderShareCardProps = {
  /** 사진 URL(최대 4). 0장이면 그리드를 통째로 생략한다 — 빈 칸·기본 이미지 금지. */
  photos: string[];
  /** place.name → roadAddress 폴백 결과. null이면 줄 자체를 숨긴다(빈 줄 금지). */
  placeName: string | null;
  /** "A · B · C 외 N" 완성 문자열. 빈 문자열이면 줄을 숨긴다. */
  menuLine: string;
  /** 메타줄 좌측(도시 · 날짜). 도시는 place.address가 있을 때만 — 없으면 날짜만. */
  metaLeft: string;
};

/** 캡처 대상 = 이 뷰. 4단계에서 ref를 받아 그대로 찍는다. */
export const OrderShareCard = React.forwardRef<View, OrderShareCardProps>(function OrderShareCard(
  { photos, placeName, menuLine, metaLeft },
  ref,
) {
  const cells = shareCells(photos.length);
  return (
    <View ref={ref} style={styles.card} testID="order-share-card" collapsable={false}>
      {cells.length > 0 && (
        <View style={styles.grid} testID="share-photo-grid">
          {cells.map((c, i) => (
            <RemoteImage
              key={`${photos[i]}-${i}`}
              uri={photos[i]}
              style={{ position: 'absolute', left: c.left, top: c.top, width: c.width, height: c.height }}
              contentFit="cover"
            />
          ))}
        </View>
      )}
      <View style={styles.info}>
        {!!placeName && (
          <Text style={styles.place} numberOfLines={2} testID="share-place-name">
            {placeName}
          </Text>
        )}
        {!!menuLine && (
          <Text style={styles.menu} testID="share-menu-line">
            {menuLine}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1} testID="share-meta-left">
            {metaLeft}
          </Text>
          {/* 브랜드 = 마크 + 텍스트(배경·보더·라운드 없음 — 9/14 예진 결정) */}
          <View style={styles.brand} testID="share-brand">
            <Image source={BRAND_MARK} style={styles.brandMark} resizeMode="contain" />
            <Text style={styles.brandText}>K-Bap</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

/** 카드 + 캡션 + 버튼 2개. 버튼 동작은 4단계에서 붙는다(여기선 핸들러 주입만). */
export function OrderShareSection({
  card,
  caption,
  downloadLabel,
  instagramLabel,
  onDownload,
  onInstagram,
  cardRef,
}: {
  card: OrderShareCardProps;
  caption: string;
  downloadLabel: string;
  instagramLabel: string;
  onDownload?: () => void;
  onInstagram?: () => void;
  cardRef?: React.Ref<View>;
}) {
  return (
    <View style={styles.section} testID="order-share-section">
      <View style={styles.preview}>
        <OrderShareCard ref={cardRef} {...card} />
        <Text style={styles.caption}>{caption}</Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={onDownload} testID="share-download">
            <IconDownload size={24} color="#6A6F7C" />
            <Text style={styles.actionLabel}>{downloadLabel}</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={onInstagram} testID="share-instagram">
            <IconInstagram size={24} />
            <Text style={styles.actionLabel}>{instagramLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16, backgroundColor: '#FFFFFF' },
  preview: { paddingVertical: 20, paddingHorizontal: 24, alignItems: 'center', gap: 12, backgroundColor: '#F7F8FA' },

  // story-card — 폭 210 고정·hug height·r20 + 부유 그림자
  card: {
    width: SHARE_CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden', // 그리드 모서리를 카드 라운드로 자른다
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  // 칸은 절대배치(장수별 변형) — 높이 210 고정
  grid: { width: SHARE_CARD_W, height: SHARE_GRID_H, backgroundColor: '#EAEBEE' },

  info: { padding: 14, gap: 10, backgroundColor: '#FFFFFF' },
  place: { fontSize: 15, fontWeight: '700', letterSpacing: -0.15, color: '#1C1E21' },
  menu: { fontSize: 11, lineHeight: 15.4, color: '#6B7280' }, // 1.4em
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  meta: { flexShrink: 1, fontSize: 10, color: '#9196A1' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandMark: { width: 16, height: 16 },
  brandText: { fontSize: 11, fontWeight: '600', letterSpacing: -0.11, color: '#1C1E21' },

  caption: { fontSize: 11, fontWeight: '500', letterSpacing: -0.11, color: '#9196A1' },

  bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 12, backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  action: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEBEE',
    borderRadius: 14,
  },
  actionLabel: { fontSize: 12, lineHeight: 16.2, fontWeight: '600', letterSpacing: -0.12, color: '#2F3137', textAlign: 'center' },
});

export default OrderShareSection;
