/**
 * TabBar — presentational 5-tab bottom bar with a center Scan FAB.
 * Tabs: Home · Food · [Scan FAB] · Reviews · Profile.
 * KB-429(디자인 4차, tab-bar 4095:1858): 아이콘 = 시안 SVG 4종(IconTab*),
 * Profile = 아바타 플레이스홀더 원. 활성 = 아이콘 #2F3137 + 라벨 primary /
 * 비활성 = 아이콘 inkDisabled + 라벨 inkMute. FAB 52 + 흰 5px 링, 오버행 22.
 * TabKey(구 커뮤니티 슬롯) → reviews(P-179부터 커뮤니티 탭 = 전역 리뷰 피드 — 라우트
 * 재사용, 키·아이콘·라벨만 교체). Labels come from i18n via the consumer.
 */
import * as React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Txt as Text } from '@/components/Txt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C } from '@/lib/theme';
import { IconTabFood, IconTabHome, IconTabReviews, IconTabScan, type IconProps } from './icons';

/** P-128→P-146: 바 콘텐츠 높이(세이프에어리어 제외) = 플랫폼 **공식** 규격 —
 *  iOS HIG 바 콘텐츠 49pt(하단 세이프에어리어는 배경만 연장) · 안드 Material 3
 *  navigation bar 총 80dp. 아이콘+라벨 스택은 이 존 안에서 상하 센터. */
export const TABBAR_CONTENT_H = Platform.OS === 'ios' ? 49 : 80;
/** P-146: iOS 시각 센터 보정(예진 실기). */
export const TABBAR_V_SHIFT = Platform.OS === 'ios' ? 6 : 0;
/** KB-429: 중앙 스캔 FAB 돌출 — 24 → 22(시안). */
export const FAB_OVERHANG = 22;

/** 시안 gray-900(활성 아이콘·칩 selected 공용) — 정식 토큰 아님(발주 표 외 값). */
const INK_ACTIVE = '#2F3137';

export type TabKey = 'home' | 'food' | 'reviews' | 'profile';

export type TabBarLabels = Record<TabKey | 'scan', string>;

/** 아바타 플레이스홀더(4064:897) — 원 #E8F6FF + 실루엣 #D3E7F4 + 0.5px 검정 10%. */
function AvatarIcon({ size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11.75" fill="#E8F6FF" stroke="rgba(0,0,0,0.1)" strokeWidth={0.5} />
      <Circle cx="12" cy="9.6" r="3.4" fill="#D3E7F4" />
      <Path d="M5.4 19.6 C6.4 15.9 9 14.4 12 14.4 C15 14.4 17.6 15.9 18.6 19.6 A11.75 11.75 0 0 1 5.4 19.6 Z" fill="#D3E7F4" />
    </Svg>
  );
}

const TABS: { key: TabKey; Icon: (p: IconProps) => React.JSX.Element }[] = [
  { key: 'home', Icon: IconTabHome },
  { key: 'food', Icon: IconTabFood },
  { key: 'reviews', Icon: IconTabReviews }, // KB-429: 커뮤니티 슬롯 → 리뷰(전역 피드)
  { key: 'profile', Icon: AvatarIcon },
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
  // P-118: 평평한 5슬롯 균등 분배(각 flex 1) — 탭은 항상 5슬롯.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const pb = Math.max(insets.bottom, 10);
  return (
    <View style={[styles.bar, { height: TABBAR_CONTENT_H + pb, paddingTop: TABBAR_V_SHIFT, paddingBottom: Math.max(pb - TABBAR_V_SHIFT, 0) }]}>
      {left.map((t) => (
        <Tab key={t.key} tab={t} active={active === t.key} label={labels[t.key]} onPress={() => onPress(t.key)} />
      ))}

      {/* 스캔 슬롯 — 타 탭과 동일 골격(아이콘 자리 스페이서+라벨 = 베이스라인 정렬),
          FAB은 슬롯 위 절대 배치로 돌출. 라벨 = 비활성색(시안). */}
      <View style={styles.slot}>
        <View style={styles.iconSpace} />
        <Text style={[styles.tlbl, { color: C.inkMute }]}>{labels.scan}</Text>
        <Pressable style={styles.fab} onPress={onScan} hitSlop={8}>
          <IconTabScan size={24} color="#fff" />
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
  tab: { key: TabKey; Icon: (p: IconProps) => React.JSX.Element };
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { Icon } = tab;
  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={4}>
      <Icon size={24} color={active ? INK_ACTIVE : C.inkDisabled} />
      <Text style={[styles.tlbl, { color: active ? C.primary : C.inkMute }]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 2,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE', // 시안 명시값(4095:1840)
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconSpace: { width: 24, height: 24 },
  // 시안: 11/500 — i18n 가변 길이(독일어/러시아어)는 축소 허용(adjustsFontSizeToFit)
  tlbl: { fontSize: 11, fontWeight: '500', letterSpacing: -0.11 },
  fab: {
    position: 'absolute',
    top: -FAB_OVERHANG,
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5, // 시안: 흰 5px 링
    borderColor: '#FFFFFF',
  },
});

export default TabBar;
