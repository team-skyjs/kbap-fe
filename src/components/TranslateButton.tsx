/**
 * TranslateButton (KB-679 → KB-689 2차: X 방식) — 본문 **위 왼쪽** 한 줄 번역 라벨(리뷰 1차 · 게시글·댓글 재사용).
 * 스펙 = spec translate-2026-10-02.md 2차 절 · 레퍼런스 translate-ref-x-before/after.png(X 게시물 화면).
 * - 번역 전 "Show translation" #1B95E0 · 번역 중 "Translating…" #536471 · 번역 후 "Translated from {언어}" #1B95E0(누르면 원문 — KB-777 B2-7, 회색이면 버튼 단서가 없었다)
 * - 글자 12.5(본문 13.5보다 한 단계 작게), 굵기 = 본문과 같음, 1줄 고정(상태가 바뀌어도 높이 불변). 아이콘·번역 평가 없음.
 * - 원문 언어 = 도메인 값 `TranslationSource`(translationAdapter가 와이어를 판정 — 이 컴포넌트는 원시 코드를 모른다):
 *   known → "Translated from {그 언어 이름}", unknown → "Translated".
 */
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { font } from '@/lib/theme';
import type { TranslationSource } from '@/lib/api/translationAdapter';

/** 번역 라벨 **전용** 값 — DS 토큰에 없는 X 동일 색(예진 지시, 레퍼런스 픽셀 실측). 다른 곳에서 쓰지 않는다. */
export const TRANSLATE_LABEL = { idleColor: '#1B95E0', mutedColor: '#536471', fontSize: 12.5 } as const;

/** 라벨 줄 높이(1줄 고정). */
export const TRANSLATE_LABEL_LINE_H = 17;
/** 실제 레이아웃 상자 = padTop 8 + 줄 17 + padBottom 19 = **44**(Codex #223 P2 — hitSlop은 부모 경계 밖에서 잘리므로 쓰지 않는다).
 *  시각 위치는 음수 margin으로 상쇄: 위 8은 ReviewBody 래퍼가 marginTop −8로 카드 gap(8) 안으로 올라가 흡수(위 사진 썸네일과
 *  겹치지 않음 — 상자는 래퍼 안), 아래 19 중 13은 marginBottom −13으로 본문 첫 줄 위에 겹친다(본문은 비대화형 · 라벨이 zIndex 위).
 *  라벨-본문 시각 간격 = padBottom + marginBottom = 6(레퍼런스 비율, 본문 한 줄 19의 약 1/3).
 *  가로: minWidth 44(오른쪽으로만 넓어짐 — 라벨 줄 오른쪽은 빈 공간, 다른 터치 대상 없음) · maxWidth 100%(부모 안). */
export const TRANSLATE_LABEL_BOX = { padTop: 8, padBottom: 19, gapBelow: 6 } as const;

export type TranslateLabelState = 'idle' | 'loading' | 'translated';

export function TranslateButton({ state, source, onPress }: { state: TranslateLabelState; source: TranslationSource | null; onPress: () => void }) {
  const { t } = useTranslation();
  const label =
    state === 'idle'
      ? t('translation.showTranslation')
      : state === 'loading'
        ? t('reviews.translating')
        : source?.kind === 'known'
          ? t('translation.translatedFrom', { language: t(`translation.lang.${source.code}`) })
          : t('translation.translated');
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={state === 'loading'}
      accessibilityRole="button"
      // KB-905(T-067): 라벨을 명시해야 안드가 상태가 바뀔 때마다 content-desc를 다시 쓴다 — 라벨 없이 busy만 있으면 busy=false일 때
      // RN(BaseViewManager.updateViewContentDescription)이 빈 목록이라 갱신을 건너뛰어 "busy"가 번역 뒤에도 남았다
      accessibilityLabel={label}
      accessibilityState={{ busy: state === 'loading' }}
      testID="translate-btn"
    >
      {/* KB-777 B2-7: 번역 후("Translated from …" — 누르면 원문)도 누를 수 있는 라벨이라 같은 X 블루 — 회색은 진행 중(비활성)만. 색만, 프레임 불변 */}
      <Text style={[styles.label, { color: state === 'loading' ? TRANSLATE_LABEL.mutedColor : TRANSLATE_LABEL.idleColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'flex-start',
    minWidth: 44, // Codex #223 P2(3차): 가로도 44 — 짧은 라벨("已翻译" ≈ 38pt)에서도 상자는 44(글자는 왼쪽 그대로)
    maxWidth: '100%', // 긴 라벨(id·vi 등)은 부모 폭에서 말줄임 — 상자가 부모 밖으로 안 나감
    paddingTop: TRANSLATE_LABEL_BOX.padTop,
    paddingBottom: TRANSLATE_LABEL_BOX.padBottom,
    marginBottom: TRANSLATE_LABEL_BOX.gapBelow - TRANSLATE_LABEL_BOX.padBottom,
    zIndex: 1, // 아래로 겹친 상자 부분의 터치가 본문(뒤 형제)이 아니라 라벨로
  },
  label: { fontFamily: font.body, fontSize: TRANSLATE_LABEL.fontSize, lineHeight: TRANSLATE_LABEL_LINE_H },
});

export default TranslateButton;
