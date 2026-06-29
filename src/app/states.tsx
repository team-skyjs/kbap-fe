/**
 * States catalog (mockup Screen J) — the shared empty / loading / error /
 * offline / unable states in one place. These components (StateBlock,
 * SkeletonList, RiskMark) are used inline by the real data screens; this route
 * is a reviewable reference for the state system.
 *
 * No emoji (SVG), reader text i18n'd, risk colors fixed.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import {
  SubHeader,
  StateBlock,
  stateIconColor,
  SkeletonList,
  RiskMark,
  IconBubbleEmpty,
  IconAlertTri,
  IconWifiOff,
  IconPlus,
  IconRetry,
  IconSpeech,
} from '@/components';

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
          <StateBlock
            icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
            title={t('states.emptyReviewsTitle')}
            body={t('states.emptyReviewsBody')}
            primary={{ label: t('states.writeReview'), icon: <IconPlus size={17} color="#fff" /> }}
          />
        </Item>

        <Item label={t('states.labelError')}>
          <StateBlock
            tone="err"
            icon={<IconAlertTri size={38} color={stateIconColor.err} />}
            title={t('states.errorTitle')}
            body={t('states.errorBody')}
            primary={{ label: t('common.tryAgain'), icon: <IconRetry size={17} color="#fff" /> }}
            secondary={{ label: t('common.goBack') }}
          />
        </Item>

        <Item label={t('states.labelOffline')}>
          <StateBlock
            icon={<IconWifiOff size={38} color={stateIconColor.default} />}
            title={t('states.offlineTitle')}
            body={t('states.offlineBody')}
            primary={{ label: t('common.retry'), icon: <IconRetry size={17} color="#fff" /> }}
            secondary={{ label: t('states.viewSavedScans') }}
          />
        </Item>

        <Item label={t('states.labelUnable')}>
          <StateBlock
            tone="unable"
            icon={<RiskMark state="unable" size={46} />}
            title={t('states.unableTitle')}
            body={t('states.unableBody')}
            primary={{ label: t('states.askOwner'), icon: <IconSpeech size={17} color="#fff" /> }}
            secondary={{ label: t('states.seeIngredients') }}
          />
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
