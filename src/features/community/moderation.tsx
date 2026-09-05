/**
 * community/moderation.tsx — ⋯ 액션 → 신고/차단(남의 것)·수정/삭제(내 것)
 * 플로우 일체 (P-087/KB-251 D-06 확정).
 *
 * - 신고 시트: 사유 5종(라디오) + "Something else"만 300자 자유 텍스트, 미선택
 *   제출 비활성 → 확인 상태("Thanks — we'll review this")에서 차단 2차 제안.
 * - 차단: 확인 다이얼로그(**단방향 카피**) → "Blocking…" **텍스트만 ≥2초**
 *   (버튼·스피너 없음 — 목이어도 2초 유지) → onBlocked 콜백(발원지별 후처리는
 *   호출측: 상세발=피드 복귀+토스트 / 댓글발=그 댓글만 즉시 제거).
 * - 전부 공용 ActionSheet('context' 변형) 경유 — 글·댓글·대댓글 동일 배선.
 */
import * as React from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardDismissBar } from '@/components';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { ActionSheet, DESTRUCTIVE } from '@/components/ActionSheet';
import { Btn, Flag, IconCheck, IconEdit, IconProfile, IconReport, IconTrash, IconUserX, Input } from '@/components';
import { useBlockUser, useSubmitReport } from '@/lib/community/hooks';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { FLAGS } from '@/lib/flags';
import type { CommunityAuthor, ReportReason, ReportTarget } from '@/lib/community/types';
import { authorName } from './parts';

export interface ModTarget {
  type: ReportTarget;
  id: string;
  author: CommunityAuthor;
  mine: boolean;
}

const REASONS: ReportReason[] = ['spam', 'harassment', 'inappropriate', 'misinfo', 'other'];
const NOTE_MAX = 300;
const BLOCK_MIN_MS = 2000;

export function ModerationFlow({
  target,
  onClose,
  onEdit,
  onDelete,
  onBlocked,
}: {
  target: ModTarget | null;
  onClose: () => void;
  /** 내 콘텐츠 — 수정 진입 (호출측 라우팅/상태) */
  onEdit: (target: ModTarget) => void;
  /** 내 콘텐츠 — 삭제 확정 (호출측 뮤테이션) */
  onDelete: (target: ModTarget) => void;
  /** 차단 완료 — 발원지별 후처리 (피드 복귀+토스트 / 댓글 제거) */
  onBlocked: (target: ModTarget) => void;
}) {
  const { t } = useTranslation();
  const isGuest = useIsGuest(); // P-281: 게스트 = 차단 숨김·신고 게이트(호출처 5곳 무변)
  const [gateOpen, setGateOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<'menu' | 'report' | 'blockConfirm' | 'blocking'>('menu');
  const [reason, setReason] = React.useState<ReportReason | null>(null);
  const [note, setNote] = React.useState('');
  const [reported, setReported] = React.useState(false);
  const submitReport = useSubmitReport();
  const blockUser = useBlockUser();

  // P-194: "Something else" 자유입력이 키보드에 가림 — P-158 실측 문법(keyboardDidShow
  // 높이) 재사용, 시트를 키보드 위로 리프트. iOS만 — Android는 resize 모드가 창을
  // 줄여 자동 회피(중복 리프트 방지).
  const [kbH, setKbH] = React.useState(0);
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbH(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // 대상이 바뀔 때 플로우 리셋
  React.useEffect(() => {
    setPhase('menu');
    setReason(null);
    setNote('');
    setReported(false);
    setGateOpen(false);
  }, [target?.type, target?.id]);

  if (!target) return null;
  const name = authorName(target.author, t);

  const close = () => {
    if (phase === 'blocking') return; // 차단 중엔 닫기 금지 (2초 오버레이)
    onClose();
  };

  const doReport = () => {
    // P-173: reported 전환 전 같은-틱 더블탭 = 이중 신고 — 동기 가드
    if (!reason || reported || submitReport.isPending) return;
    submitReport.mutate({ target: target.type, id: target.id, reason, note: reason === 'other' && note.trim() ? note.trim() : null });
    setReported(true); // 적재만 — 확인 상태로 전환 (즉시 숨김 없음)
  };

  const doBlock = async () => {
    if (phase === 'blocking' || blockUser.isPending) return; // P-173: 재진입 봉쇄
    setPhase('blocking');
    // 목이어도 ≥2초 유지 — 실 API가 2초를 넘으면 응답까지 대기 (Promise.all)
    try {
      await Promise.all([
        blockUser.mutateAsync(target.author),
        new Promise((r) => setTimeout(r, BLOCK_MIN_MS)),
      ]);
    } catch {
      // P-281 근본 원인: 실패(게스트 401·네트워크) 시 'blocking'에 영원히 갇히던 것 —
      // 메뉴 복귀(닫기 가능), 재시도는 사용자가. 5xx 관측은 captureApi5xx가 담당.
      setPhase('menu');
      return;
    }
    onClose();
    onBlocked(target);
  };

  /* ---- ① ⋯ 메뉴 (공용 ActionSheet) ---- */
  if (phase === 'menu') {
    // P-281: 게스트 Report 게이트 — ⋯ 시트는 닫고 게이트만(시트 위 시트 금지)
    if (gateOpen) {
      return (
        <AuthGateSheet
          context="report"
          open
          onClose={() => {
            setGateOpen(false);
            onClose();
          }}
        />
      );
    }
    const KIND_MINE = { post: 'community.yourPost', comment: 'community.yourComment', review: 'community.yourReview' } as const;
    const KIND_BY = { post: 'community.postBy', comment: 'community.commentBy', review: 'community.reviewBy' } as const;
    const title = target.mine ? t(KIND_MINE[target.type]) : t(KIND_BY[target.type], { name });
    const avatar = target.author.nationality ? (
      <Flag code={target.author.nationality} size={26} />
    ) : (
      <View style={styles.anonAvatar}>
        <IconProfile size={15} color={C.ink3} />
      </View>
    );
    return (
      <ActionSheet
        open
        title={title}
        avatar={avatar}
        onClose={close}
        items={
          target.mine
            ? [
                { key: 'edit', label: t('community.edit'), icon: <IconEdit size={17} color={C.ink} />, onPress: () => onEdit(target) },
                { key: 'delete', label: t('community.delete'), icon: <IconTrash size={17} color={DESTRUCTIVE} />, destructive: true, onPress: () => onDelete(target) },
              ]
            : [
                // P-142: 커뮤니티 신고 = 플래그 off(/reports targetType이 REVIEW뿐) — 리뷰 타깃만 노출
                // P-190: keepOpen — 조기 onClose(setMod null = 플로우 언마운트)가 페이즈
                // 전환을 죽이던 반려 버그(Q-40①②) 수정. 전환 렌더가 시트를 대체한다.
                // P-281: 게스트 Report = 사유 시트 대신 로그인 게이트(서버 /reports 회원 전용 —
                // 가짜 Thanks 방지). keepOpen — 게이트 렌더가 시트를 대체한다.
                ...(target.type === 'review' || FLAGS.communityReportEnabled
                  ? [{ key: 'report', label: t('community.report'), icon: <IconReport size={17} color={C.ink} />, keepOpen: true, onPress: () => (isGuest ? setGateOpen(true) : setPhase('report')) }]
                  : []),
                // P-281: 게스트 = 차단 항목 자체 미노출(예진 지시 — /members/me/blocks 회원 전용)
                ...(!isGuest
                  ? [{ key: 'block', label: t('community.blockUser', { name }), icon: <IconUserX size={17} color={DESTRUCTIVE} />, destructive: true, keepOpen: true, onPress: () => setPhase('blockConfirm') }]
                  : []),
              ]
        }
      />
    );
  }

  /* ---- 이후 단계는 별도 모달 — P-190: 메뉴의 신고/차단은 keepOpen이라
          onClose 없이 페이즈 전환, 이 렌더가 시트를 대체한다 ---- */
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={phase === 'blocking' ? undefined : close}>
        <Pressable style={[styles.sheet, kbH > 0 && { marginBottom: kbH }]} onPress={() => {}} testID="mod-sheet">
          {phase === 'report' &&
            (reported ? (
              /* 확인 상태 + 차단 2차 제안 */
              <View style={{ gap: 14, alignItems: 'center' }}>
                <View style={styles.okIc}>
                  <IconCheck size={26} color="#fff" />
                </View>
                <Text style={styles.title}>{t('community.reportThanks')}</Text>
                {!target.mine && !isGuest && (
                  <Pressable style={styles.blockSuggest} onPress={() => setPhase('blockConfirm')}>
                    <IconUserX size={16} color={DESTRUCTIVE} />
                    <Text style={styles.blockSuggestText}>{t('community.blockUser', { name })}</Text>
                  </Pressable>
                )}
                <Btn variant="ghost" onPress={close}>
                  {t('common.gotIt')}
                </Btn>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={styles.title}>{t('community.reportTitle')}</Text>
                {REASONS.map((r) => (
                  <Pressable key={r} style={styles.reasonRow} onPress={() => setReason(r)}>
                    <View style={[styles.radio, reason === r && styles.radioOn]}>{reason === r && <View style={styles.radioDot} />}</View>
                    <Text style={styles.reasonText}>{t(`community.reason.${r}`)}</Text>
                  </Pressable>
                ))}
                {reason === 'other' && (
                  <Input
                    value={note}
                    onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))}
                    placeholder={t('community.reasonOtherPlaceholder')}
                    placeholderTextColor={C.ink3}
                    multiline
                    style={styles.noteInput}
                    textAlignVertical="top"
                  />
                )}
                <Btn variant={reason ? 'primary' : 'off'} onPress={reason ? doReport : undefined}>
                  {t('community.reportSubmit')}
                </Btn>
              </View>
            ))}

          {phase === 'blockConfirm' && (
            <View style={{ gap: 12 }}>
              <Text style={styles.title}>{t('community.blockConfirmTitle', { name })}</Text>
              {/* 단방향 카피 확정 — "You won't see their posts or comments" 계열 */}
              <Text style={styles.sub}>{t('community.blockConfirmBody')}</Text>
              <Btn onPress={() => void doBlock()}>{t('community.blockConfirmCta')}</Btn>
              <Btn variant="ghost" onPress={close}>
                {t('common.cancel')}
              </Btn>
            </View>
          )}

          {phase === 'blocking' && (
            /* 텍스트만 ≥2초 — 버튼·스피너 없음 (확정 정책, 시안 스피너 불채택) */
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <Text style={styles.blocking}>{t('community.blocking')}</Text>
            </View>
          )}
        </Pressable>
      </Pressable>
      <KeyboardDismissBar modal />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 34, ...shadow.sh2 },
  title: { fontFamily: font.display, fontSize: 17, color: C.ink },
  sub: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19 },
  anonAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },

  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 6 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.primary },
  reasonText: { flex: 1, fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  noteInput: { minHeight: 80, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 12, fontFamily: font.body, fontSize: 13.5, color: C.ink },

  okIc: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.riskSafe, alignItems: 'center', justifyContent: 'center' },
  blockSuggest: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  blockSuggestText: { fontFamily: font.bodyBold, fontSize: 13.5, color: DESTRUCTIVE },
  blocking: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
});
