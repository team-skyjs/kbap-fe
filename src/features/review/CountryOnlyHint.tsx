/** KB-907(T-106): "{국가} only" 토글이 무엇을 거르는지 한 줄 — 같은 국적(보는 사람 국적) 리뷰어의 리뷰만. 토글이 있는 세 곳(상세·전체 리뷰·리뷰 탭) 공용 */
import * as React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { color as C } from '@/lib/theme';
import { countryDisplayName } from '@/lib/onboarding/countries';
import { useAppLanguage } from '@/lib/i18n/useAppLanguage';

export function CountryOnlyHint({ code, style }: { code: string; style?: TextStyle }) {
  const { t } = useTranslation();
  const appLang = useAppLanguage(); // 구독형(KB-695) — 프로필 국적 표기와 같은 경로
  // 토글 라벨은 코드("KR only") 그대로 — 설명은 나라 이름(앱 언어 또는 영어, 프로필과 같은 표기)
  return <Text style={[st.hint, style]} testID="country-only-hint">{t('reviews.countryOnlyHint', { country: countryDisplayName(code, appLang) })}</Text>;
}

const st = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 18, color: C.ink3 }, // KB-909: 12→13
});
