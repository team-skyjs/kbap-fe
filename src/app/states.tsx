/**
 * States catalog (mockup Screen J) — the shared empty / loading / error /
 * offline / unable states in one place. These components (StateBlock,
 * SkeletonList, RiskMark) are used inline by the real data screens; this route
 * is a reviewable reference for the state system.
 *
 * No emoji (SVG), reader text i18n'd, risk colors fixed.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { SubHeader, SkeletonList } from '@/components';
import { EmptyBlock } from '@/components/StateBlock';

export default function States() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SubHeader title={t('states.catalogTitle')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Item label={t('states.labelLoading')}>
          <SkeletonList />
        </Item>

        <Item label={t('states.labelEmpty')}>
          {/* P-359(KB-522): 구 StateBlock 폐기 — 디자이너 공용 EmptyBlock(4003:6689)이 유일 빈 상태 */}
          <EmptyBlock label={t('states.emptyReviewsTitle')} />
        </Item>
      </ScrollView>
    </View>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 18, gap: 22, paddingBottom: 40 },
  item: { gap: 8 },
  label: { fontFamily: font.bodyBold, fontSize: 10.5, letterSpacing: 1, color: C.ink3 },
  frame: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 18, paddingVertical: 18, justifyContent: 'center' },
});
