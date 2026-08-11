/**
 * Ask the owner (mockup Screen F) — one full-screen card the diner holds up to
 * staff: a large Korean question (place language = ko, Constitution I) with the
 * menu name highlighted, a Korean allergy note, a reader-language caption, and a
 * single dismiss button. No card chrome, no on-screen answer step.
 *
 * Korean text is DATA (OwnerConfirmation), not i18n. menuNameKo matches the
 * scanned menu name (FR-019). Reader caption/button are i18n.
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { IconClose } from '@/components';
import { PressScale } from '@/components';
import { useOwnerConfirmation } from '@/lib/data/useOwnerConfirmation';

export default function OwnerConfirm() {
  const { id, ingredient } = useLocalSearchParams<{ id: string; ingredient?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정
  const { t } = useTranslation();
  const { data } = useOwnerConfirmation(id ?? '', ingredient);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PressScale style={[styles.close, { top: insets.top + 10 }]} onPress={() => router.back()} hitSlop={8}>
        <IconClose size={22} color={C.ink2} />
      </PressScale>

      {/* P-172: 본문 = 스크롤(회피 나열로 긴 질문도 끝까지) — 짧은 질문은 flexGrow 센터
          유지(P-149 주문 카드 문법). X·Done은 스크롤 밖 고정, 상단 패딩이 X 겹침 봉쇄. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.center}
        showsVerticalScrollIndicator={false}
        testID="owner-scroll"
      >
        {data && (
          <>
            <Text style={[styles.question, isLongQuestion(data.questionKo) && styles.questionLong]}>
              {renderQuestion(data.questionKo, data.menuNameKo)}
            </Text>
            <Text style={styles.note}>{data.explanationKo}</Text>
            <Text style={styles.caption}>{t('owner.caption')}</Text>
          </>
        )}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: bottom + 18 }]}>
        <PressScale style={styles.done} onPress={() => router.back()}>
          <Text style={styles.doneText}>{t('owner.done')}</Text>
        </PressScale>
      </View>
    </View>
  );
}

/** P-172 재량: 나열 질문 가독 보정 — 40자 초과 시 1단계 축소(34→27).
 *  사장님이 읽는 화면이라 27/40이 하한(추가 축소 없음 — 초과분은 스크롤 몫). */
export function isLongQuestion(q: string): boolean {
  return q.length > 40;
}

/** Highlight the menu name (primary) within the Korean question. */
function renderQuestion(question: string, menuNameKo: string) {
  const idx = menuNameKo ? question.indexOf(menuNameKo) : -1;
  if (idx < 0) return question;
  return (
    <>
      {question.slice(0, idx)}
      <Text style={styles.menu}>{menuNameKo}</Text>
      {question.slice(idx + menuNameKo.length)}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  close: {
    position: 'absolute',
    left: 18,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // P-172: flex→flexGrow(스크롤 콘텐츠) — 짧으면 센터, 길면 스크롤. 상단 패딩 = X(40)+여유 클리어
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingTop: 64, paddingBottom: 20, gap: 26 },
  question: { fontFamily: font.koBold, fontSize: 34, lineHeight: 46, color: C.ink, textAlign: 'center' },
  questionLong: { fontSize: 27, lineHeight: 40 },
  menu: { color: C.primary },
  note: { fontFamily: font.koBold, fontSize: 19, lineHeight: 29, color: C.ink2, textAlign: 'center' },
  caption: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink3, textAlign: 'center', marginTop: 4 },
  foot: { paddingHorizontal: 22 },
  done: { backgroundColor: C.ink, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  doneText: { fontFamily: font.display, fontSize: 17, color: '#fff' },
});
