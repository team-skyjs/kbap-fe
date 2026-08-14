/**
 * Edit restrictions (mockup Screen I6, KB-6 override) — the flat 81-ingredient
 * filter. Category groups + per-ingredient pre-risk-color removed; a searchable
 * catalog + active chips (tap × to remove). Top safety notice + bottom owner-
 * confirm disclaimer kept. Saves the flat ingredient-code list via PATCH /me
 * (MOCK_MODE merges the cache). The picker UI is the shared IngredientFilter
 * (also used by onboarding KB-8).
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setUserProps } from '@/lib/analytics';
import { color as C, font } from '@/lib/theme';
import { SubHeader, Btn, RiskMark, IconCheck } from '@/components';
import { IngredientFilter } from '@/components/IngredientFilter';
import { useMe, useUpdateMe } from '@/lib/data/useMe';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { FLAGS } from '@/lib/flags';
import { Modal } from 'react-native';
import { DIET_PRESETS, unionPresetCodes, type PresetGroup } from '@/lib/onboarding/dietPresets';

export default function EditRestrictions() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const update = useUpdateMe();

  const [sel, setSel] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  // P-203: 카테고리 재적용 — 적용 = 기존 선택과 합집합(기존 삭제 금지·안전)
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetSel, setPresetSel] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (me && !seeded) {
      setSel(me.restrictions.map((r) => r.code));
      setSeeded(true);
    }
  }, [me, seeded]);

  const toggle = (code: string) => setSel((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));
  const isGuest = useIsGuest();

  // 라우트 자체 가드 (⑧-b) — 진입로는 프로필/홈 Edit(게이트·게스트 미노출)뿐이지만
  // 딥링크 이중 방어. 게스트는 콘텐츠(mock 포함) 미마운트, 시트 닫으면 뒤로.
  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('restrictionsEdit.title')} onBack={() => router.back()} />
        <AuthGateSheet context="profile" open onClose={() => router.back()} />
      </View>
    );
  }

  const { busy: saving, run: runSave } = useSubmitGuard(); // P-173: 저장 연타 봉쇄
  function save() {
    void runSave(
      () =>
        new Promise<void>((resolve) => {
          update.mutate(
            { restrictions: sel.map((code) => ({ kind: 'allergy' as const, code })) },
            {
              onSuccess: () => {
                setUserProps({ avoid_count: sel.length }); // P-144: CSV 트리거(프로필 수정 시 갱신)
                router.back();
              },
              onSettled: () => resolve(),
            },
          );
        }),
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader
        title={t('restrictionsEdit.title')}
        onBack={() => router.back()}
        trailing={
          <Pressable onPress={save} disabled={saving} hitSlop={8} style={[styles.saveWrap, saving && { opacity: 0.35 }]}>
            <Text style={styles.saveLink}>{t('common.save')}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <RiskMark state="danger" size={22} />
          <Text style={styles.noticeText}>{t('restrictionsEdit.notice')}</Text>
        </View>

        {/* P-203: 카테고리로 채우기(러프 배치 재량 — 상단 행) → 시트에서 합집합 적용 */}
        {FLAGS.dietPresetsEnabled && (
          <Pressable style={styles.presetRow} onPress={() => setPresetOpen(true)} hitSlop={4} testID="preset-open">
            <Text style={styles.presetRowText}>{t('onboarding.presets.applyRow')}</Text>
          </Pressable>
        )}

        <IngredientFilter selected={sel} onToggle={toggle} onClear={() => setSel([])} />

        <View style={styles.disc}>
          <RiskMark state="caution" size={15} variant="outline" />
          <Text style={styles.discText}>{t('restrictionsEdit.disclaimer')}</Text>
        </View>
      </ScrollView>

      {/* P-203: 카테고리 시트 — 러프(온보딩 칩 문법 축약) */}
      <Modal visible={presetOpen} transparent animationType="slide" onRequestClose={() => setPresetOpen(false)}>
        <View style={styles.presetBackdrop}>
          <View style={styles.presetSheet}>
            <Text style={styles.presetTitle}>{t('onboarding.presets.title')}</Text>
            {(['diet', 'religion', 'allergy'] as PresetGroup[]).map((g) => (
              <View key={g} style={styles.presetGrid}>
                {DIET_PRESETS.filter((pr) => pr.group === g).map((pr) => {
                  const on = presetSel.has(pr.id);
                  return (
                    <Pressable
                      key={pr.id}
                      style={[styles.presetChip, on && styles.presetChipOn]}
                      onPress={() =>
                        setPresetSel((cur) => {
                          const next = new Set(cur);
                          next.has(pr.id) ? next.delete(pr.id) : next.add(pr.id);
                          return next;
                        })
                      }
                      testID={`preset-${pr.id}`}
                    >
                      <Text style={[styles.presetChipText, on && styles.presetChipTextOn]}>{t(pr.labelKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <View style={{ gap: 9, marginTop: 6 }}>
              <Btn
                onPress={() => {
                  setSel((cur) => Array.from(unionPresetCodes(Array.from(presetSel), cur))); // 합집합 — 기존 보존
                  setPresetOpen(false);
                }}
                testID="preset-apply"
              >
                {t('onboarding.presets.apply')}
              </Btn>
              <Btn variant="ghost" onPress={() => setPresetOpen(false)}>{t('common.cancel')}</Btn>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.savebar}>
        <Btn icon={<IconCheck size={17} color="#fff" />} onPress={save}>
          {t('restrictionsEdit.save')}
        </Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, gap: 16 },
  // P-203: 카테고리 프리셋(러프)
  presetRow: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: C.line, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  presetRowText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  presetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  presetSheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, gap: 12 },
  presetTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: { borderWidth: 1.5, borderColor: C.line, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  presetChipOn: { borderColor: C.primary, backgroundColor: 'rgba(226,88,12,0.08)' },
  presetChipText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  presetChipTextOn: { color: C.primaryText },
  saveWrap: { paddingHorizontal: 6, height: 38, justifyContent: 'center' },
  saveLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  noticeText: { flex: 1, fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2, lineHeight: 19 },

  disc: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 2 },
  discText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 },

  savebar: { padding: 18, paddingBottom: 30, backgroundColor: 'rgba(252,245,239,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
});
