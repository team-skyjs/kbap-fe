/**
 * TranslateButton (KB-679 → KB-689 2차: X 방식) — 본문 **위 왼쪽** 한 줄 번역 라벨(리뷰 1차 · 게시글·댓글 재사용).
 * 스펙 = spec translate-2026-10-02.md 2차 절 · 레퍼런스 translate-ref-x-before/after.png(X 게시물 화면).
 * - 번역 전 "Show translation" #1B95E0 · 번역 중 "Translating…" #536471 · 번역 후 "Translated from {언어}" #536471(누르면 원문)
 * - 글자 12.5(본문 13.5보다 한 단계 작게), 굵기 = 본문과 같음, 1줄 고정(상태가 바뀌어도 높이 불변). 아이콘·번역 평가 없음.
 * - 원문 언어 = 서버 sourceLanguage(KB-688): 앱 10개 코드와 **정확 일치**면 그 이름, 그 밖·null·없음 = "Translated".
 */
import * as React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { font } from '@/lib/theme';

/** 번역 라벨 **전용** 값 — DS 토큰에 없는 X 동일 색(예진 지시, 레퍼런스 픽셀 실측). 다른 곳에서 쓰지 않는다. */
export const TRANSLATE_LABEL = { idleColor: '#1B95E0', mutedColor: '#536471', fontSize: 12.5 } as const;

/** 언어 이름을 아는 코드 = 앱 10개 언어(서버가 이 글자 그대로 정규화해 보낸다 — KB-688). */
export const TRANSLATION_LANG_CODES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'] as const;

/** 라벨 줄 높이(1줄 고정). */
export const TRANSLATE_LABEL_LINE_H = 17;
/** 실제 레이아웃 상자 = padTop 8 + 줄 17 + padBottom 19 = **44**(Codex #223 P2 — hitSlop은 부모 경계 밖에서 잘리므로 쓰지 않는다).
 *  시각 위치는 음수 margin으로 상쇄: 위 8은 ReviewBody 래퍼가 marginTop −8로 카드 gap(8) 안으로 올라가 흡수(위 사진 썸네일과
 *  겹치지 않음 — 상자는 래퍼 안), 아래 19 중 13은 marginBottom −13으로 본문 첫 줄 위에 겹친다(본문은 비대화형 · 라벨이 zIndex 위).
 *  라벨-본문 시각 간격 = padBottom + marginBottom = 6(레퍼런스 비율, 본문 한 줄 19의 약 1/3). */
export const TRANSLATE_LABEL_BOX = { padTop: 8, padBottom: 19, gapBelow: 6 } as const;

export type TranslateLabelState = 'idle' | 'loading' | 'translated';

export function TranslateButton({ state, sourceLanguage, onPress }: { state: TranslateLabelState; sourceLanguage: string | null; onPress: () => void }) {
  const { t } = useTranslation();
  const known = sourceLanguage != null && (TRANSLATION_LANG_CODES as readonly string[]).includes(sourceLanguage);
  const label =
    state === 'idle'
      ? t('translation.showTranslation')
      : state === 'loading'
        ? t('reviews.translating')
        : known
          ? t('translation.translatedFrom', { language: t(`translation.lang.${sourceLanguage}`) })
          : t('translation.translated');
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={state === 'loading'}
      accessibilityRole="button"
      accessibilityState={{ busy: state === 'loading' }}
      testID="translate-btn"
    >
      <Text style={[styles.label, { color: state === 'idle' ? TRANSLATE_LABEL.idleColor : TRANSLATE_LABEL.mutedColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'flex-start',
    paddingTop: TRANSLATE_LABEL_BOX.padTop,
    paddingBottom: TRANSLATE_LABEL_BOX.padBottom,
    marginBottom: TRANSLATE_LABEL_BOX.gapBelow - TRANSLATE_LABEL_BOX.padBottom,
    zIndex: 1, // 아래로 겹친 상자 부분의 터치가 본문(뒤 형제)이 아니라 라벨로
  },
  label: { fontFamily: font.body, fontSize: TRANSLATE_LABEL.fontSize, lineHeight: TRANSLATE_LABEL_LINE_H },
});

export default TranslateButton;
