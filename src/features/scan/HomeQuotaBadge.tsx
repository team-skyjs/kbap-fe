/**
 * HomeQuotaBadge (KB-680, P-432) — 홈 우하단 플로팅 "무료 스캔 N회 남음" 불꽃 + 안내 시트.
 * 스펙 = spec specs/001-personalized-menu-mvp/countdown-badge-2026-10-02.md (예진 10/2 결정).
 *
 * - 정본 = `me.scanQuota`(서버) — 클라는 횟수를 세지 않는다. 노출 = 남은 횟수가 숫자인 회원(0 포함 — 꺼진 불꽃).
 *   숨김 = 무제한 · 게스트 · scanQuota null(구서버 — 판별 불가는 막지도 보여주지도 않는다) · 플래그 off.
 * - 탭 = 안내 시트(남은 횟수 · "리뷰를 쓰면 무제한" · 리뷰 쓰기) → 스캔 잠금 화면과 같은 TagPickerSheet(context=review).
 * - 숫자 → 해금(리뷰 작성 후) = 마지막 숫자로 폭죽 1회 후 사라짐 — 시작은 홈이 보일 때(CountdownBadge). 축하 조건은
 *   `unlocked === true` + **같은 회원**(remaining 누락·음수 → 'unlimited' 판별 불가 응답, 계정 전환은 축하 아님).
 */
import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { SheetShell } from '@/components/SheetShell';
import { CountdownBadge } from '@/components/CountdownBadge';
import { TagPickerSheet } from '@/app/community/compose';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { FLAGS } from '@/lib/flags';
import { color as C, font, type as type_ } from '@/lib/theme';
import type { ScanQuota } from '@/lib/api/types';

export interface QuotaBadgeModel {
  value: number;
  state: 'active' | 'empty';
}

/** 쿼터 → 뱃지 값. null = 숨김. */
export function quotaBadgeModel(quota: ScanQuota | null | undefined, isGuest: boolean): QuotaBadgeModel | null {
  if (isGuest || !quota || quota.unlocked || quota.remaining === 'unlimited') return null;
  return { value: quota.remaining, state: quota.remaining > 0 ? 'active' : 'empty' };
}

/** 홈 리스트 하단 여백(110) 안쪽 — 뱃지가 마지막 콘텐츠(면책)를 영구히 가리지 않게. 리뷰 피드 FAB와 같은 오프셋. */
export const BADGE_RIGHT = 14;
export const BADGE_BOTTOM = 18;

export function HomeQuotaBadge() {
  const { t } = useTranslation();
  const router = useRouter();
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const model = FLAGS.countdownBadge ? quotaBadgeModel(me?.scanQuota, isGuest) : null;

  // 숫자 → 해금 전이 감지 = 렌더 중 이전값 비교(KB-603 — 값 키가 아니라 전이)
  const memberId = me?.id ?? null;
  const unlockedNow = FLAGS.countdownBadge && !isGuest && me?.scanQuota?.unlocked === true;
  const [prev, setPrev] = React.useState<{ m: QuotaBadgeModel | null; id: string | null }>({ m: model, id: memberId });
  const [celebrating, setCelebrating] = React.useState<QuotaBadgeModel | null>(null);
  if (prev.m?.value !== model?.value || prev.m?.state !== model?.state || prev.id !== memberId) {
    setPrev({ m: model, id: memberId });
    if (prev.id !== memberId) setCelebrating(null); // 계정 전환 = 진행 중 축하도 취소
    else if (prev.m && !model && unlockedNow) setCelebrating(prev.m);
    else if (model) setCelebrating(null); // 대기 중 다시 숫자 = 되돌려진 해금 → 축하 취소(공부 #221 재확인 ①)
  }

  const [sheet, setSheet] = React.useState(false);
  const [picker, setPicker] = React.useState(false);
  const pickerAfterDismiss = React.useRef(false);
  const openPicker = () => {
    setSheet(false);
    // iOS: 시트 dismiss 완료 뒤 픽커 present(같은 커밋 연쇄 = 두 번째 모달 누락 race, P-267 선례) · 안드: onDismiss 미지원 → 즉시
    if (Platform.OS === 'ios') pickerAfterDismiss.current = true;
    else setPicker(true);
  };
  const onSheetDismiss = () => {
    if (!pickerAfterDismiss.current) return;
    pickerAfterDismiss.current = false;
    setPicker(true);
  };

  const shown = celebrating ?? model;
  const left = shown && shown.value > 0 ? t('scan.freeLeft', { count: shown.value }) : t('scan.quotaTitle');
  return (
    <>
      {shown && (
        <View style={styles.float} pointerEvents="box-none" testID="home-quota-badge">
          <CountdownBadge
            value={shown.value}
            unitLabel={t('scan.badgeUnit', { count: shown.value })}
            state={shown.state}
            onPress={() => setSheet(true)}
            celebrate={celebrating != null}
            onCelebrateEnd={() => setCelebrating(null)}
            accessibilityLabel={left}
          />
        </View>
      )}
      <SheetShell visible={sheet} onClose={() => setSheet(false)} onDismiss={onSheetDismiss}>
        <View style={styles.copy}>
          <Text style={styles.title} testID="quota-sheet-title">{left}</Text>
          <Text style={styles.body}>{t('scan.quotaBody')}</Text>
        </View>
        <View style={styles.actions}>
          <Btn onPress={openPicker} testID="quota-sheet-review">{t('scan.quotaCta')}</Btn>
          <Btn variant="ghost" onPress={() => setSheet(false)} testID="quota-sheet-later">{t('scan.later')}</Btn>
        </View>
      </SheetShell>
      {/* 열릴 때만 마운트(스캔 잠금 화면과 같은 방식) — 홈에서 픽커 검색 훅이 상시 돌지 않게 */}
      {picker && (
      <TagPickerSheet
        context="review"
        kind="food"
        foodTags={[]}
        placeTag={null}
        onToggleFood={(f) => {
          setPicker(false);
          router.push(`/food/${f.foodId}/review` as Href);
        }}
        onTogglePlace={() => {}}
        onClose={() => setPicker(false)}
        t={t}
      />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  float: { position: 'absolute', right: BADGE_RIGHT, bottom: BADGE_BOTTOM },
  copy: { gap: 8 },
  title: { ...type_.sectionTitle, fontFamily: font.bodyBold, color: C.ink },
  body: { ...type_.body, fontFamily: font.body, color: C.ink2 },
  actions: { gap: 8 },
});
