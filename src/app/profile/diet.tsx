/**
 * 식이 전체 페이지 (P-233/KB-305) — 15종(식단·종교·알레르기) 칩 그리드,
 * 현재 활성(역추론) 프리셀렉트, 복수 선택, 저장.
 *
 * 확정 흐름(예진 8/18 인터뷰):
 * - **저장 = 즉시 반영**: 신규 선택분 성분을 회피 목록에 합집합 추가(P-203
 *   unionResolvedCodes — 기존 것 안 지움) → PATCH → 성공 시 사후 모달
 *   (Yes = 회피 편집으로 미세 조정 / No = 프로필 복귀 — 반영은 이미 됨).
 * - **해제 = 회피 불변**: 체크를 빼고 저장해도 성분은 안 건드린다(다른 식이·
 *   수동 추가와 겹치는 성분 오삭제 방지). 하단 안내 문구가 이 동작을 설명.
 *   → 역추론 칩은 회피에서 직접 빼야 꺼진다(의도된 동작 — 버그 아님).
 * - 무변경 저장 = 모달 없이 조용히 복귀.
 *
 * ⚠️ P-227 승인 팝업과의 관계: 회피 편집 화면 내 프리셋 시트(Apply)는 **승인형
 * 팝업 존치** — 그쪽은 회피 편집 문맥이라 적용 전 확인이 맞다. 이 페이지는
 * 식이 선언 문맥이라 **저장 즉시 반영 + 사후 모달** — 두 경로는 의도적으로 다르다.
 *
 * 식이 선택 자체의 서버 저장은 BE 프리셋 이력 안건 대기(역추론 유지 — 비범위).
 */
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, shadow } from '@/lib/theme';
import { Btn, IconCheck, SubHeader } from '@/components';
import { useMe, useUpdateMe } from '@/lib/data/useMe';
import { useDietPresets } from '@/lib/data/useDietPresets';
import { unionResolvedCodes, type PresetGroup } from '@/lib/onboarding/dietPresets';
import { useSubmitGuard } from '@/lib/useSubmitGuard';

const GROUP_LABEL: Record<PresetGroup, string> = {
  diet: 'onboarding.presets.groupDiet',
  religion: 'onboarding.presets.groupReligion',
  allergy: 'onboarding.presets.groupAllergy',
};

export default function DietPresetsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const update = useUpdateMe();
  const dietPresets = useDietPresets();

  // 역추론 활성 = 프리셋 코드 전부 ⊆ 현재 회피 (P-227과 동일 규칙)
  const initialActive = useMemo(() => {
    const have = new Set((me?.restrictions ?? []).map((r) => r.code));
    return new Set(dietPresets.filter((p) => p.codes.length > 0 && p.codes.every((c) => have.has(c))).map((p) => p.id));
  }, [dietPresets, me?.restrictions]);

  const [sel, setSel] = useState<Set<string> | null>(null); // null = 아직 시딩 전(me 도착 대기)
  const selected = sel ?? initialActive;
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSel(next);
  };

  const [savedModal, setSavedModal] = useState(false);
  const { busy: saving, run: runSave } = useSubmitGuard();

  const save = () =>
    runSave(async () => {
      // 신규 선택분만 합집합 대상(해제분은 회피 불변 — 안전 원칙)
      const added = [...selected].filter((id) => !initialActive.has(id));
      if (added.length === 0) {
        router.back(); // 무변경(해제만 포함) = 조용히 복귀 — 무변경에 모달 금지(재량 확인)
        return;
      }
      const cur = (me?.restrictions ?? []).map((r) => r.code);
      const merged = Array.from(unionResolvedCodes(dietPresets, added, cur));
      await new Promise<void>((resolve, reject) => {
        update.mutate(
          { restrictions: merged.map((code) => ({ kind: 'allergy' as const, code })) },
          { onSuccess: () => resolve(), onError: (e) => reject(e) },
        );
      });
      setSavedModal(true); // 반영 완료 — 사후 모달(Yes = 미세 조정 / No = 복귀)
    });

  return (
    <View style={styles.root}>
      <SubHeader title={t('profile.dietTitle')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {(['diet', 'religion', 'allergy'] as PresetGroup[]).map((g) => (
          <View key={g} style={styles.group}>
            <Text style={styles.groupTitle}>{t(GROUP_LABEL[g])}</Text>
            <View style={styles.grid}>
              {dietPresets.filter((p) => p.group === g).map((p) => {
                const on = selected.has(p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => toggle(p.id)}
                    testID={`dietpage-${p.id}`}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(p.labelKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {/* 해제 동작 안내 — 체크를 빼도 회피 성분은 그대로(직접 빼야 함) */}
        <Text style={styles.hint}>{t('profile.dietUncheckHint')}</Text>
      </ScrollView>

      <View style={styles.savebar}>
        <Btn icon={<IconCheck size={17} color="#fff" />} busy={saving} onPress={save} testID="diet-save">
          {t('common.save')}
        </Btn>
      </View>

      {/* 저장 성공 사후 모달 — 반영은 이미 됨(No여도 유지) */}
      <Modal visible={savedModal} transparent animationType="fade" onRequestClose={() => { setSavedModal(false); router.back(); }}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard} testID="diet-saved-modal">
            <Text style={styles.confirmTitle}>{t('profile.dietSavedTitle')}</Text>
            <Text style={styles.confirmBody}>{t('profile.dietSavedBody')}</Text>
            <View style={{ gap: 9, marginTop: 8 }}>
              <Btn
                onPress={() => { setSavedModal(false); router.push('/profile/restrictions' as Href); }}
                testID="diet-saved-yes"
              >
                {t('profile.dietSavedYes')}
              </Btn>
              <Btn variant="ghost" onPress={() => { setSavedModal(false); router.back(); }} testID="diet-saved-no">
                {t('profile.dietSavedNo')}
              </Btn>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 18, gap: 18, paddingBottom: 120 },
  group: { gap: 10 },
  groupTitle: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2, textTransform: 'uppercase', letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // 온보딩 프리셋 칩 문법 — 선택 전후 프레임 불변(같은 폭 보더, 색만 전환 — P-103)
  chip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { backgroundColor: primaryTint, borderColor: C.primary },
  chipText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  chipTextOn: { color: C.primaryText },
  hint: { fontFamily: font.body, fontSize: 12, color: C.ink3, lineHeight: 17 },
  savebar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, paddingBottom: 30, backgroundColor: C.surface },
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
});
