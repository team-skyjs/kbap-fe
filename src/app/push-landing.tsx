/**
 * push-landing (KB-498, 2026-09-12 종한) — **임시 디버깅 화면**. 탭 착지가 아직 기획되지 않은
 * 푸시 유형(HELPFUL·SCAN_SUGGESTION)이 여기로 온다. 기획 확정 시 routeForNotificationData의
 * 해당 case를 실제 화면으로 바꾸고 이 파일을 지운다. ?type= 로 어떤 알림인지 표시.
 */
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SubHeader } from '@/components';
import { EmptyBlock } from '@/components/StateBlock';
import { color as C } from '@/lib/theme';

export default function PushLanding() {
  const router = useRouter();
  const { t } = useTranslation();
  const { type } = useLocalSearchParams<{ type?: string }>();
  return (
    <View style={styles.root}>
      <SubHeader title={t('push.landingTbdTitle')} onBack={() => router.back()} />
      <View style={styles.center} testID="push-landing">
        <EmptyBlock label={t('push.landingTbdBody', { type: type ?? '?' })} testID="push-landing-body" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
