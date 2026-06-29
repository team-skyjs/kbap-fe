/**
 * TEMP design-system gallery — verifies Unit 2 components render.
 * Replaced by the (tabs) app shell in the app-shell unit.
 */
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, riskTone, type RiskState } from '@/lib/theme';
import {
  RiskMark,
  Btn,
  Stars,
  StateBlock,
  SkeletonList,
  IconPlus,
  IconBubbleEmpty,
} from '@/components';

const RISKS: RiskState[] = ['safe', 'caution', 'danger', 'unable'];

function H({ children }: { children: string }) {
  return <Text style={styles.h}>{children}</Text>;
}

export default function Gallery() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: C.surface }} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 18, gap: 22 }}>
      <Text style={styles.title}>K-Bap · Design System</Text>

      <View style={styles.sec}>
        <H>RiskMark (solid / outline)</H>
        <View style={styles.row}>
          {RISKS.map((r) => (
            <View key={r} style={styles.riskItem}>
              <RiskMark state={r} size={34} />
              <Text style={[styles.cap, { color: riskTone[r].fg }]}>{r}</Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          {RISKS.map((r) => (
            <RiskMark key={r} state={r} size={28} variant="outline" />
          ))}
        </View>
      </View>

      <View style={styles.sec}>
        <H>Stars</H>
        <Stars value={4.4} size={22} />
      </View>

      <View style={styles.sec}>
        <H>Buttons</H>
        <Btn icon={<IconPlus size={17} color="#fff" />}>Primary</Btn>
        <Btn variant="ghost">Ghost</Btn>
        <Btn variant="danger">Delete account</Btn>
        <Btn variant="off">Disabled</Btn>
        <Btn sm>Small</Btn>
      </View>

      <View style={styles.sec}>
        <H>StateBlock</H>
        <StateBlock
          icon={<IconBubbleEmpty size={38} color={C.primary} />}
          title="No reviews yet"
          body="Be the first to review this dish."
          primary={{ label: 'Write a review', icon: <IconPlus size={17} color="#fff" /> }}
        />
      </View>

      <View style={styles.sec}>
        <H>Skeleton (loading)</H>
        <SkeletonList />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.display, fontSize: 24, color: C.primary },
  sec: { gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.hair },
  h: { fontFamily: font.display, fontSize: 15, color: C.ink },
  row: { flexDirection: 'row', gap: 18, alignItems: 'center', flexWrap: 'wrap' },
  riskItem: { alignItems: 'center', gap: 4 },
  cap: { fontFamily: font.bodyBold, fontSize: 11 },
});
