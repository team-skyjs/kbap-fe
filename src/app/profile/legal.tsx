/**
 * 법적 문서 화면(KB-776, QA B2-4) — 가입 뒤에도 약관·개인정보처리방침을 다시 볼 수 있게 프로필에서 진입.
 * 본문은 온보딩 동의 시트와 같은 LegalDocBody(원격 HTML → 구조 블록, 불러오기·실패·재시도 포함).
 * `?doc=terms|privacy|safety` — 그 밖의 값은 약관으로. KB-910: 안전 고지도 여기(구 인앱 브라우저).
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SubHeader } from '@/components';
import { LegalDocBody } from '@/components/LegalDocBody';
import { color as C } from '@/lib/theme';
import { useBottomInset } from '@/lib/useBottomInset';
import type { LegalDoc } from '@/lib/legalText';

export default function LegalDocScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const bottom = useBottomInset();
  const { doc: raw } = useLocalSearchParams<{ doc?: string }>();
  const doc: LegalDoc = raw === 'privacy' ? 'privacy' : raw === 'safety' ? 'safety' : 'terms';
  const title = t(doc === 'privacy' ? 'onboarding.privacyPolicy' : doc === 'safety' ? 'profile.safetyNotice' : 'onboarding.termsOfService');
  return (
    <View style={styles.root}>
      <SubHeader title={title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: bottom + 24 }]} testID="legal-screen">
        <LegalDocBody doc={doc} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 20, paddingTop: 6 },
});
