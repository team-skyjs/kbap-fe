/**
 * TranslateButton (KB-679) — 본문 번역 토글 버튼 1개(리뷰 1차 · 게시글·댓글 재사용). "Translate" ↔ "See original",
 * 요청 중 = 같은 자리 인라인 스피너 + "Translating…"(본문 깜빡임 없음). 스타일 = ExpandToggle과 같은 DS 토큰(type.body + bodyBold +
 * primaryText · 터치 타깃 EXPAND_TOGGLE_MIN_H) — 새 스타일 값 0, 이모지·글로브 아이콘 없이 텍스트만.
 */
import * as React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Spinner } from '@/components/Spinner';
import { EXPAND_TOGGLE_MIN_H } from '@/components/ExpandToggle';
import { color as C, font, type as type_ } from '@/lib/theme';

export function TranslateButton({ showingTranslated, loading, onPress }: { showingTranslated: boolean; loading: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      testID="translate-btn"
    >
      {loading && <Spinner size={14} color={C.primaryText} />}
      {/* 대기 중 라벨 = "Translating…"(기존 reviews.translating) — 엔진 첫 호출이 8초까지 걸려 작은 스피너만으론 무반응으로 읽힘(커맨드 센터 실측) */}
      <Text style={styles.label} numberOfLines={1}>{t(loading ? 'reviews.translating' : showingTranslated ? 'translation.seeOriginal' : 'translation.translate')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'flex-start', minHeight: EXPAND_TOGGLE_MIN_H, flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { ...type_.body, fontFamily: font.bodyBold, color: C.primaryText },
});

export default TranslateButton;
