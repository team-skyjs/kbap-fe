/**
 * NewBadge (P-385/KB-363) — 공개 24시간 이내 표시. 규칙은 lib/newFood, 모양은 여기 한 곳.
 * 상세 헤더(인라인)와 카드 이미지 우상단(absolute)이 같은 필을 쓴다.
 */
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';

export function NewBadge({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.badge} testID={testID}>
      <Text style={styles.text}>{t('inbox.newBadge')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { height: 18, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 10, fontWeight: '600', color: '#fff' },
});
