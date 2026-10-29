/**
 * Edit restrictions (mockup Screen I6, KB-6 override) — the flat 81-ingredient
 * filter. Category groups + per-ingredient pre-risk-color removed; a searchable
 * catalog + active chips (tap × to remove). Top safety notice + bottom owner-
 * confirm disclaimer kept. Saves the flat ingredient-code list via PATCH /me
 * (MOCK_MODE merges the cache). The picker UI is the shared IngredientFilter
 * (also used by onboarding KB-8).
 */
// 🔴 KB-602 래칫 기록(2026-09-21): 아래 `if (isGuest)` early return이 **훅 호출보다 위**에 있다.
// 앞의 FLAGS 계열과 달리 `useIsGuest()`는 **런타임 값**이라, 로그인/로그아웃으로 값이 뒤집히면
// 훅 순서가 실제로 바뀐다(`useSubmitGuard`가 조건부 호출됨) — 잠재 버그다.
// 소진 발주(KB-603~) 1순위 후보. 코드 변경은 이번 PR 범위 밖이라 표시만 남긴다.
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { KAV_BEHAVIOR, KAV_OFFSET } from '@/lib/keyboardAvoid';
import { useBottomInset } from '@/lib/useBottomInset';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EVENTS, setUserProps, track } from '@/lib/analytics';
import { color as C, font, shadow } from '@/lib/theme';
import { SubHeader, Btn, RiskMark, IconCheck, IconInfo } from '@/components';
import { LeaveConfirmModal, useLeaveConfirm } from '@/components/LeaveConfirmModal';
import { IngredientFilter } from '@/components/IngredientFilter';
import { useMe, useUpdateMe } from '@/lib/data/useMe';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { FLAGS } from '@/lib/flags';
import { BE_CODES } from '@/lib/mocks/ingredients';

export default function EditRestrictions() {
  const bottom = useBottomInset(); // KB-900(T-005): 3버튼 내비 바가 Save 바를 반쯤 가렸다(고정 30, 인셋 미반영)
  const router = useRouter();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const update = useUpdateMe();

  const [sel, setSel] = useState<string[]>([]);
  // KB-603: 시딩 시점 개수(P-214 delta 기준선)를 시딩 상태에 함께 담는다(null = 미시딩) — 렌더 중 ref 쓰기 대신 상태
  const [seed, setSeed] = useState<{ initialCount: number } | null>(null);
  // P-203: 카테고리 재적용 — 적용 = 기존 선택과 합집합(기존 삭제 금지·안전)
  // P-227 ②: 프로필 식이 Edit 진입 = 프리셋 시트 자동 오픈(기존 시트 재사용)
  // P-227 ③: 프리셋 적용 전 확인 팝업 — "회피 성분을 이에 맞게 채울까요?"
  // P-243: 시트 초기 표시 = 서버 정본(me.dietCategories) — me 도착 후 seeding(아래 effect)
  // P-214: 변경 폭(delta)·경로(via) 계측 재료 — 시딩 시점 개수가 기준선
  // 서버값 1회 시딩 — effect(빈 선택이 한 프레임 먼저 그려짐)가 아니라 렌더 중(React 공식 "이전 값 비교" 패턴)
  // KB-843(서버 백필 #448 짝): 서버 프로필의 **앱이 모르는 코드**(새 서버 코드·백필)는 화면에 그리지 않고(타일·개수 0) 저장 때 그대로 되돌려 보낸다 —
  // 서버는 목록을 통째로 교체하므로 빼면 지워진다. 전부 해제(Clear)로도 지우지 않는다(보이지 않는 값 — 과회피 쪽이 안전)
  const known = (codes: string[]) => codes.filter((c) => BE_CODES.has(c));
  const hidden = (me?.restrictions ?? []).map((r) => r.code).filter((c) => !BE_CODES.has(c));
  if (me && !seed) {
    const seedCodes = known(me.restrictions.map((r) => r.code));
    setSeed({ initialCount: seedCodes.length });
    setSel(seedCodes);
  }

  const toggle = (code: string) => setSel((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));
  const isGuest = useIsGuest();
  const { busy: saving, run: runSave } = useSubmitGuard(); // P-173: 저장 연타 봉쇄 — KB-604: 게스트 return보다 위(순수 로컬 훅, 부수효과 0)
  // KB-776(QA B3-3): 미저장 이탈 확인 — 게스트 return보다 위(훅 순서). 기준 = 서버 정본(me.restrictions), 순서 무관 비교
  const base = known(me?.restrictions.map((r) => r.code) ?? []); // 보이는 코드끼리 비교(숨은 코드는 늘 그대로 보낸다)
  const dirty = !isGuest && seed != null && (sel.length !== base.length || sel.some((c) => !base.includes(c)));
  const leave = useLeaveConfirm(dirty, saving);

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

  function save() {
    void runSave(
      () =>
        new Promise<void>((resolve) => {
          update.mutate(
            { restrictions: [...sel, ...hidden.filter((c) => !sel.includes(c))].map((code) => ({ kind: 'allergy' as const, code })) },
            {
              onSuccess: () => {
                setUserProps({ user_info_avoid_count: sel.length }); // P-144: CSV 트리거(프로필 수정 시 갱신)
                // P-214: 변경 시점·폭 계측(user property는 현재값만 남음). 항목명 금지 — 개수만.
                track(EVENTS.profile_avoid_update, {
                  count: sel.length,
                  delta: sel.length - (seed?.initialCount ?? 0),
                  via: 'manual', // P-339 ⑧: 프리셋 채우기 소멸 — 이 화면은 항상 수동
                });
                leave.release(() => router.back()); // 막기를 먼저 풀고 다음 렌더에서 뒤로(저장 성공에 확인 창 0)
              },
              onSettled: () => resolve(),
            },
          );
        }),
    );
  }

  return (
    // KB-700(#228 공부 지적 — 전수 스캔이 못 본 화면): IngredientFilter 검색 입력 중 하단 Save 바가 키보드 뒤 → 같은 iOS KAV(padding)
    <KeyboardAvoidingView style={styles.root} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={KAV_OFFSET} testID="restrictions-kav">
      <SubHeader
        title={t('restrictionsEdit.title')}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* KB-776(QA B3-4): 빨간 위험 마크(원 안 ✕)가 닫기 버튼처럼 보였다 — 안내는 DS 정보 아이콘. 문구 = "저장하면 반영"(Save 버튼과 일치) */}
        <View style={styles.notice} testID="restrictions-notice">
          <IconInfo size={20} color={C.ink2} />
          <Text style={styles.noticeText}>{t('restrictionsEdit.notice')}</Text>
        </View>

        {/* P-339 ⑧(KB-494): "Fill from a diet or religion" 행·시트 제거 — 온보딩 프리셋 단계는 무변 */}
        <IngredientFilter selected={sel} onToggle={toggle} onClear={() => setSel([])} />

        <View style={styles.disc}>
          <RiskMark state="caution" size={15} variant="outline" />
          <Text style={styles.discText}>{t('restrictionsEdit.disclaimer')}</Text>
        </View>
      </ScrollView>

      <View style={[styles.savebar, { paddingBottom: bottom + 10 }]} testID="restrictions-savebar">
        {/* KB-904(T-079): 저장 버튼은 이것 하나(헤더 Save 제거 — 색도 프로필 편집과 달랐다) · 바뀐 게 없으면 비활성 */}
        <Btn icon={<IconCheck size={17} color="#fff" />} variant={dirty ? 'primary' : 'off'} busy={saving} onPress={dirty ? save : undefined} testID="restrictions-save">
          {t('restrictionsEdit.save')}
        </Btn>
      </View>
      <LeaveConfirmModal {...leave.modal} kind="edit" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // P-227 ③: 확인 팝업(P-162 confirm 카드 문법)
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, gap: 16 },
  // P-203: 카테고리 프리셋(러프)

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  noticeText: { flex: 1, fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2, lineHeight: 19 },

  disc: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 2 },
  discText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 },

  savebar: { padding: 18, backgroundColor: 'rgba(252,245,239,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
});
