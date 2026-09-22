/**
 * NewBadge (P-385/KB-363) — 공개 24시간 이내 표시. 규칙은 lib/newFood, 모양은 여기 한 곳.
 * 상세 헤더(인라인)와 카드 이미지 우상단(absolute)이 같은 필을 쓴다.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
// 고정 높이 18px 필 — 큰글씨 상한(×1.3)·Android 폰트 패딩 제거가 필수라 Txt 경유(P-031·P-371).
import { Txt as Text } from '@/components/Txt';
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
