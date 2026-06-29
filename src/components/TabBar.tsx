/**
 * TabBar — presentational 5-tab bottom bar with a center Scan FAB.
 * Tabs: Home · Food · [Scan FAB] · Community (locked, phase 2) · Profile.
 * Wired into expo-router Tabs as a custom `tabBar` in the (tabs) layout.
 * Labels come from i18n via the consumer (passed in `labels`).
 */
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

export type TabKey = 'home' | 'food' | 'community' | 'profile';

export type TabBarLabels = Record<TabKey | 'scan', string>;

const TABS: { key: TabKey; Icon: (p: IconProps) => React.JSX.Element; locked?: boolean }[] = [
  { key: 'home', Icon: IconHome },
  { key: 'food', Icon: IconFood },
  { key: 'community', Icon: IconCommunity, locked: true },
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
  // render order: home, food, [FAB], community, profile
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {left.map((t) => (
        <Tab key={t.key} tab={t} active={active === t.key} label={labels[t.key]} onPress={() => onPress(t.key)} />
      ))}

      {/* center Scan FAB */}
      <View style={styles.fabWrap}>
        <Pressable style={styles.fab} onPress={onScan} hitSlop={8}>
          <IconCamera size={27} color="#fff" />
        </Pressable>
        <Text style={[styles.tlbl, { color: C.primary }]}>{labels.scan}</Text>
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
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hair,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  locked: { opacity: 0.42 },
  lockBadge: { position: 'absolute', top: -5, right: -10 },
  tlbl: { fontFamily: font.bodyBold, fontSize: 10, letterSpacing: -0.1 },
  fabWrap: { flex: 1, alignItems: 'center', gap: 4 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -16 }],
    marginBottom: -12,
    borderWidth: 3,
    borderColor: C.surface,
    ...shadow.sh2,
  },
});

export default TabBar;
