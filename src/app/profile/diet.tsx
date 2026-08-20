/**
 * 식이 전체 페이지 (P-233/KB-305) — 15종(식단·종교·알레르기) 칩 그리드,
 * 현재 활성(역추론) 프리셀렉트, 복수 선택, 저장.
 *
 * 확정 흐름(예진 8/18 인터뷰 → P-243 서버 정본 전환):
 * - **프리셀렉트 = me.dietCategories(서버)** — 역추론(프리셋 ⊆ 회피) 폐기(BE #179).
 * - **저장 = 즉시 반영, 한 요청**: dietCategories 풀 셋 + (신규 선택분이 있으면)
 *   회피 합집합(P-203 unionResolvedCodes — 기존 것 안 지움)을 **PATCH 하나**로.
 *   성공 시 사후 모달(Yes = 회피 편집으로 미세 조정 / No = 복귀 — 반영은 이미 됨).
 * - **해제 = 실동작(P-243)**: dietCategories에서 빠져 칩이 꺼진다. 단 **회피 성분은
 *   불변**(다른 식이·수동 추가와 겹치는 성분 오삭제 방지) — 성분까지 빼려면
 *   회피 편집에서 직접(하단 안내 문구·사후 모달 Yes가 그 경로).
 * - 무변경 저장 = 모달 없이 조용히 복귀.
 *
 * ⚠️ P-227 승인 팝업과의 관계: 회피 편집 화면 내 프리셋 시트(Apply)는 **승인형
 * 팝업 존치** — 그쪽은 회피 편집 문맥이라 적용 전 확인이 맞다. 이 페이지는
 * 식이 선언 문맥이라 **저장 즉시 반영 + 사후 모달** — 두 경로는 의도적으로 다르다.
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

  // P-243: 활성 = 서버 정본(me.dietCategories) — 역추론 폐기
  const initialActive = useMemo(() => new Set(me?.dietCategories ?? []), [me?.dietCategories]);

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
      // P-243: 셋 diff — 무변경 = 조용히 복귀(모달 금지, 재량 확인)
      const added = [...selected].filter((id) => !initialActive.has(id));
      const removed = [...initialActive].filter((id) => !selected.has(id));
      if (added.length === 0 && removed.length === 0) {
        router.back();
        return;
      }
      // 한 요청: dietCategories 풀 셋 교체 + 신규 선택분만 회피 합집합(해제 = 회피 불변)
      const patch: Parameters<typeof update.mutate>[0] = { dietCategories: [...selected] };
      if (added.length > 0) {
        const cur = (me?.restrictions ?? []).map((r) => r.code);
        const merged = Array.from(unionResolvedCodes(dietPresets, added, cur));
        patch.restrictions = merged.map((code) => ({ kind: 'allergy' as const, code }));
      }
      await new Promise<void>((resolve, reject) => {
        update.mutate(patch, { onSuccess: () => resolve(), onError: (e) => reject(e) });
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
