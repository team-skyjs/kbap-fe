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

/** 라벨 줄 높이(1줄 고정) + 터치 확장. 유효 터치 높이 = 17 + 8 + 19 = 44(Codex #223 P2 — 최소 터치 타깃).
 *  위는 8까지만(카드 gap 8 — 위 사진 썸네일 터치 영역과 겹치지 않게), 나머지는 아래로(라벨-본문 간격 6 + 본문 첫 줄 — 본문은 비대화형). */
export const TRANSLATE_LABEL_LINE_H = 17;
export const TRANSLATE_LABEL_HIT_SLOP = { top: 8, bottom: 19, left: 8, right: 16 } as const;

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
      hitSlop={TRANSLATE_LABEL_HIT_SLOP} // 라벨 줄은 낮게(레퍼런스 간격) — 터치 영역은 hitSlop으로 44
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
  // 본문과의 간격 = 본문 한 줄(19)의 약 1/3(레퍼런스 비율)
  row: { alignSelf: 'flex-start', marginBottom: 6 },
  label: { fontFamily: font.body, fontSize: TRANSLATE_LABEL.fontSize, lineHeight: TRANSLATE_LABEL_LINE_H },
});

export default TranslateButton;
