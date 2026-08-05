/**
 * TabBar — presentational 5-tab bottom bar with a center Scan FAB.
 * Tabs: Home · Food · [Scan FAB] · Community (locked, phase 2) · Profile.
 * Wired into expo-router Tabs as a custom `tabBar` in the (tabs) layout.
 * Labels come from i18n via the consumer (passed in `labels`).
 */
import * as React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, shadow } from '@/lib/theme';
import {
  IconCamera,
  IconCommunity,
  IconFood,
  IconHome,
  IconLock,
  IconProfile,
  type IconProps,
} from './icons';

/** P-128: 바 콘텐츠 높이(세이프에어리어 제외) = 플랫폼 권장치 — iOS HIG 49pt · 안드 Material 56dp. */
export const TABBAR_CONTENT_H = Platform.OS === 'ios' ? 49 : 56;

export type TabKey = 'home' | 'food' | 'community' | 'profile';

export type TabBarLabels = Record<TabKey | 'scan', string>;

const TABS: { key: TabKey; Icon: (p: IconProps) => React.JSX.Element; locked?: boolean }[] = [
  { key: 'home', Icon: IconHome },
  { key: 'food', Icon: IconFood },
  { key: 'community', Icon: IconCommunity }, // P-087(KB-251): 커뮤니티 개방 — 잠금 해제
  { key: 'profile', Icon: IconProfile },
];

export function TabBar({
  active,
  labels,
  onPress,
  onScan,
}: {
  active: TabKey;
  labels: TabBarLabels;
  onPress: (key: TabKey) => void;
  onScan: () => void;
}) {
  const insets = useSafeAreaInsets();
  // P-118(테플 반려): P-110의 양측 flex 래퍼 잔존이 좌우 묶음 분배(1/3·1/3·1/3)로
  // 탭 간격을 불균등하게 만듦 — 원래의 **평평한 5슬롯 균등 분배**(각 flex 1) 원복.
  // prod 숨김은 커뮤니티 화면의 coming-soon이 담당(P-113) — 탭은 항상 5슬롯.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const pb = Math.max(insets.bottom, 10);
  return (
    // P-128: 바 높이 = 콘텐츠 고정(iOS 49/안드 56) + 세이프에어리어 — FAB은 레이아웃
    // 흐름에서 분리(절대 배치 오버행)라 바 높이에 미기여. 예진 "너무 높음" 해소.
    <View style={[styles.bar, { height: TABBAR_CONTENT_H + pb, paddingBottom: pb }]}>
      {left.map((t) => (
        <Tab key={t.key} tab={t} active={active === t.key} label={labels[t.key]} onPress={() => onPress(t.key)} />
      ))}

      {/* 스캔 슬롯 — 타 탭과 동일 골격(아이콘 자리 스페이서+라벨 = 베이스라인 정렬),
          FAB은 슬롯 위 절대 배치로 돌출(시각 무변: 56pt·그림자·보더) */}
      <View style={styles.slot}>
        <View style={styles.iconSpace} />
        <Text style={[styles.tlbl, { color: C.primary }]}>{labels.scan}</Text>
        <Pressable style={styles.fab} onPress={onScan} hitSlop={8}>
          <IconCamera size={27} color="#fff" />
        </Pressable>
      </View>

      {right.map((t) => (
        <Tab key={t.key} tab={t} active={active === t.key} label={labels[t.key]} onPress={() => onPress(t.key)} />
      ))}
    </View>
  );
}

function Tab({
  tab,
  active,
  label,
  onPress,
}: {
  tab: { key: TabKey; Icon: (p: IconProps) => React.JSX.Element; locked?: boolean };
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { Icon, locked } = tab;
  const tint = active ? C.primary : C.ink3;
  return (
    <Pressable style={[styles.tab, locked && styles.locked]} onPress={onPress} hitSlop={4}>
      <View>
        <Icon size={23} color={tint} />
        {locked && (
          <View style={styles.lockBadge}>
            <IconLock size={11} color={C.ink3} />
          </View>
        )}
      </View>
      <Text style={[styles.tlbl, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hair,
  },
  // P-128: 슬롯 = 콘텐츠 높이 전체(터치 49/56 ≥ 44pt), 아이콘+라벨 수직 중앙
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconSpace: { width: 23, height: 23 }, // 타 탭 아이콘 자리 — 라벨 베이스라인 정렬
  locked: { opacity: 0.42 },
  lockBadge: { position: 'absolute', top: -5, right: -10 },
  tlbl: { fontFamily: font.bodyBold, fontSize: 10, letterSpacing: -0.1 },
  fab: {
    // P-128: 레이아웃 미기여 — 절대 배치로 바 위 돌출(시각 현행 유지)
    position: 'absolute',
    top: -30, // 바 축소분만큼 위로 — 라벨(중앙 정렬)과 비겹침, 돌출 시각 유지
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.surface,
    ...shadow.sh2,
  },
});

export default TabBar;
