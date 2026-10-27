/**
 * QuotaDialog (KB-765 · D-23 E2 — 예진 확정 10/13, Figma FeNjJTiLQKiG3QUl7kDKqh 12236:19199) — 홈 불꽃 뱃지의 스캔 한도 안내.
 * KB-759의 바텀시트를 **표면만** 교체: 진입 조건(뱃지 탭)·광고 3회 상태 기계(useRewardedUnlock — 스캔 화면 버튼과 같은 로직)·리뷰 경로(픽커)·
 * 해제 뒤 닫힘은 그대로. 리뷰·광고 = **같은 스타일 타일**(흰 바탕 · primary 1.5 테두리 · primary 12% 원 아이콘 · 카드 전체 탭, 최소 72h).
 * 광고 타일은 광고가 실제로 있을 때만(useAdUnlockSource — 게스트·구서버·SDK 미준비·남은 0이면 리뷰 타일만, 본문도 리뷰 전용 문구).
 * 딤·뒤로가기 = "나중에"와 동일. 텍스트는 전부 자동 줄바꿈(독일어 1.8배 = 제목·옵션 제목 2줄), 큰 글씨 최대에선 카드 안 스크롤.
 */
import * as React from 'react';
import { blockUnlockPresentation } from './unlockCelebrationStore';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { CountdownBadge } from '@/components/CountdownBadge';
import { IconEdit } from '@/components/icons';
import { RewardedTile, useAdUnlockSource } from '@/features/ads/RewardedUnlock';
import { color as C, font } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';

const DIM = 'rgba(28, 30, 33, 0.5)'; // gray-1000(ink) 50%
const PRIMARY_12 = 'rgba(255, 113, 52, 0.12)'; // primary(#FF7134) 12% — 타일 아이콘 원
const RADIUS_XL = 24; // DS radius xl(시안) — theme.radius엔 lg 10까지만

/** 재생 아이콘 — DS 세트에 없음(디자이너 요청 등록됨) → 벡터 삼각형 임시(시안 README) */
function PlayGlyph({ size = 20, color = C.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M6 3.8 L16.2 10 L6 16.2 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

function Tile({ icon, title, sub, onPress, disabled, busy, children, testID, a11y }: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  children?: React.ReactNode;
  testID: string;
  a11y: string;
}) {
  return (
    <Pressable
      onPress={disabled || busy ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={({ pressed }) => [styles.tile, pressed && !disabled && !busy && styles.tilePressed]}
      testID={testID}
    >
      <View style={styles.tileIcon}>{busy ? <ActivityIndicator color={C.primary} /> : icon}</View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
      {children}
    </Pressable>
  );
}

export function QuotaDialog({ visible, value, state, title, onWriteReview, onUnlocked, onClose, onDismiss }: {
  visible: boolean;
  value: number;
  state: 'active' | 'empty';
  /** 제목 — 0회 = "무료 스캔을 모두 사용했어요", 남아 있으면 "무료 스캔 n회 남음"(KB-759로 남아 있어도 열린다) */
  title: string;
  onWriteReview: () => void;
  onUnlocked: () => void;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const ad = useAdUnlockSource();
  const release = React.useRef<(() => void) | null>(null);
  const dismissed = () => { release.current?.(); release.current = null; onDismiss?.(); };
  React.useLayoutEffect(() => {
    if (visible && !release.current) release.current = blockUnlockPresentation();
    if (!visible && Platform.OS !== 'ios') { release.current?.(); release.current = null; }
  }, [visible]);
  React.useEffect(() => () => { release.current?.(); }, []);
  // KB-765 계측: 선택 = review | ad | later(뒤로가기·딤 탭도 later — 같은 닫기)
  const select = (option: 'review' | 'ad' | 'later') => track(EVENTS.scan_quota_dialog_select, { option });
  const later = () => { select('later'); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={later} onDismiss={dismissed}>
      <View style={styles.backdrop}>
        {/* 딤 탭 = 나중에 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={later} accessible={false} testID="quota-dialog-dim" />
        <View style={styles.card} accessibilityViewIsModal testID="quota-dialog">
          <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <CountdownBadge value={value} state={state} testID="quota-dialog-flame" />
            </View>
            <Text style={styles.title} accessibilityRole="header" testID="quota-sheet-title">{title}</Text>
            <Text style={styles.body}>{t(ad ? 'scan.quotaDialogBody' : 'scan.quotaBody')}</Text>
            <View style={styles.tiles}>
              <Tile
                icon={<IconEdit size={22} color={C.primary} />}
                title={t('scan.quotaTileReviewTitle')}
                sub={t('scan.quotaTileReviewSub')}
                onPress={() => { select('review'); onWriteReview(); }}
                a11y={`${t('scan.quotaTileReviewTitle')}. ${t('scan.quotaTileReviewSub')}`}
                testID="quota-sheet-review"
              />
              {ad && (
                <RewardedTile
                  sdk={ad.sdk}
                  initial={ad.rewards}
                  onUnlocked={onUnlocked}
                  onClose={onClose}
                  render={(r) => {
                    const sub = r.retryPending ? t('common.tryAgain') : t('scan.quotaTileAdProgress', { n: r.watched, total: r.total });
                    return (
                      <Tile
                        icon={<PlayGlyph />}
                        title={t('scan.quotaTileAdTitle', { count: r.total })}
                        sub={sub}
                        onPress={() => { select('ad'); r.press(); }}
                        disabled={!r.pressable}
                        busy={r.busy || (!r.loaded && !r.retryPending && r.failure !== 'limit')}
                        a11y={`${t('scan.quotaTileAdTitle', { count: r.total })}. ${sub}`}
                        testID="quota-watch-ad"
                      >
                        <View style={styles.progress} testID="quota-ad-progress">
                          {Array.from({ length: r.total }, (_, i) => (
                            <View key={i} style={[styles.seg, i < r.watched ? styles.segDone : styles.segTodo]} testID={i < r.watched ? 'quota-ad-seg-done' : 'quota-ad-seg-todo'} />
                          ))}
                        </View>
                        {r.failure === 'limit' && <Text style={styles.note} testID="quota-ad-limit">{t('ads.rewardLimit')}</Text>}
                        {r.failure === 'network' && <Text style={styles.note} testID="quota-ad-error">{t('ads.rewardError')}</Text>}
                      </Tile>
                    );
                  }}
                />
              )}
            </View>
            <Pressable onPress={later} accessibilityRole="button" style={styles.later} hitSlop={4} testID="quota-sheet-later">
              <Text style={styles.laterText}>{t('scan.later')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: DIM, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  // 335폭(작은 화면은 좌우 20 거터 안) · radius xl 24 · 그림자 y8 blur32 16%
  card: {
    width: '100%',
    maxWidth: 335,
    maxHeight: '90%',
    backgroundColor: C.surface,
    borderRadius: RADIUS_XL,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  content: { paddingTop: 28, paddingHorizontal: 20, paddingBottom: 12, alignItems: 'stretch' },
  hero: { alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: font.bodyBold, fontSize: 18, lineHeight: 25, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: C.ink3, textAlign: 'center', marginTop: 6 },
  tiles: { flexDirection: 'row', gap: 11, marginTop: 20, alignItems: 'stretch' },
  // 두 옵션 같은 스타일 — 흰 바탕 · primary 1.5 테두리 · 카드 전체 탭(최소 72h)
  tile: {
    flex: 1,
    minHeight: 72,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
  },
  tilePressed: { backgroundColor: PRIMARY_12 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY_12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileTitle: { fontFamily: font.bodyBold, fontSize: 16, lineHeight: 22, color: C.ink, textAlign: 'center' },
  tileSub: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink3, textAlign: 'center' },
  progress: { flexDirection: 'row', gap: 4, marginTop: 6 },
  seg: { width: 16, height: 4, borderRadius: 2 },
  segDone: { backgroundColor: C.primary },
  segTodo: { backgroundColor: C.line }, // gray-200
  note: { fontFamily: font.body, fontSize: 12, lineHeight: 16, color: C.ink3, textAlign: 'center', marginTop: 4 },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  laterText: { fontFamily: font.body, fontSize: 15, color: C.ink3 }, // gray-600 텍스트 버튼(박스 없음)
});
