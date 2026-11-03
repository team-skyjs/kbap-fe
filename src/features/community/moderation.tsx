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
import { StyleSheet, View } from 'react-native';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import { KeyboardDismissBar } from '@/components';
import { useKeyboardLift } from '@/lib/keyboardAvoid';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { ActionSheet, DESTRUCTIVE } from '@/components/ActionSheet';
import { Btn, Flag, IconCheck, IconEdit, IconProfile, IconReport, IconTrash, IconUserX, Input } from '@/components';
import { IconGallery } from '@/components/icons';
import { showTopToast } from '@/components/topToastStore';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { TopToastHost } from '@/components/TopToast';
import { useBlockUser, useSubmitReport } from '@/lib/community/hooks';
import { useIsGuest } from '@/lib/auth/useSession';
import { FLAGS } from '@/lib/flags';
import type { CommunityAuthor, ReportReason, ReportTarget } from '@/lib/community/types';
import { authorName } from './parts';

export interface ModTarget {
  type: ReportTarget;
  id: string;
  author: CommunityAuthor;
  mine: boolean;
  /** P-339 ②: 탈퇴(익명) 리뷰 — 작성자 부재라 차단 미노출(신고만) */
  anonymized?: boolean;
  /** P-339 ②: 홈 피드 등 신고 전용 표면 — 차단 항목 미노출 */
  reportOnly?: boolean;
}

const REASONS: ReportReason[] = ['spam', 'harassment', 'inappropriate', 'misinfo', 'other'];
const NOTE_MAX = 300;
const BLOCK_MIN_MS = 2000;

/** 삭제 확정 뒤 시트가 닫히는 동안 가드를 유지하는 시간 — 페이드 아웃(약 300ms)보다 길게. */
const DELETE_GUARD_HOLD_MS = 500;

export function ModerationFlow({
  target,
  onClose,
  onEdit,
  onDelete,
  onBlocked,
  onPhotoRemoval,
}: {
  target: ModTarget | null;
  onClose: () => void;
  /** 내 콘텐츠 — 수정 진입 (호출측 라우팅/상태) */
  onEdit: (target: ModTarget) => void;
  /** 내 콘텐츠 — 삭제 확정 (호출측 뮤테이션) */
  onDelete: (target: ModTarget) => void;
  /** 차단 완료 — 발원지별 후처리 (피드 복귀+토스트 / 댓글 제거) */
  onBlocked: (target: ModTarget) => void;
  /** KB-814 F3: 가공식품 리뷰(남의 것)만 — 있으면 '사진 삭제 요청' 행(문의로 이동). 호출측이 대상별로 넘긴다 */
  onPhotoRemoval?: (target: ModTarget) => void;
}) {
  const { t } = useTranslation();
  const isGuest = useIsGuest(); // P-281: 게스트 = 차단 숨김·신고 게이트(호출처 5곳 무변)
  const [phase, setPhase] = React.useState<'menu' | 'report' | 'blockConfirm' | 'blocking' | 'deleteConfirm'>('menu');
  const [reported, setReported] = React.useState(false);
  const targetRef = React.useRef(target); // 늦은 뮤테이션 콜백이 현재 대상과 같은지 대조용
  // KB-657: 최신값 ref는 렌더 중이 아니라 커밋(layout effect)에서 동기화 — 리더는 전부 이벤트·리스너·passive effect(layout 뒤)
  React.useLayoutEffect(() => {
    targetRef.current = target;
  });
  const submitReport = useSubmitReport();
  const blockUser = useBlockUser();
  const deleteGuard = useSubmitGuard(); // 훅은 early return 위

  // P-194: "Something else" 자유입력이 키보드에 가림 — 시트를 키보드 위로 리프트.
  // KB-768: 두 플랫폼 — 안드도 edge-to-edge(Expo 57)라 Modal 창이 resize되지 않는다(lib/keyboardAvoid).
  const kbH = useKeyboardLift({ dismissBar: true }); // 안드: 시트 아래 내리기 바(KB-768 QA — Submit이 바에 잘림)

  // 대상이 바뀔 때 플로우 리셋 — KB-603: 렌더 중 이전값 비교(React 공식 패턴), 옛 대상의 phase가 한 프레임도 보이지 않는다
  const targetKey = target ? `${target.type}\u0000${target.id}` : null;
  const [prevTargetKey, setPrevTargetKey] = React.useState(targetKey);
  if (targetKey !== prevTargetKey) {
    setPrevTargetKey(targetKey);
    setPhase('menu');
    setReported(false);
  }

  if (!target) return null;
  const name = authorName(target.author, t);

  const close = () => {
    if (phase === 'blocking') return; // 차단 중엔 닫기 금지 (2초 오버레이)
    onClose();
  };
  // 삭제 확정 = 공용 제출 가드(P-173). onDelete는 뮤테이션 발사(동기)라 시트가 닫혀 언마운트될 때까지 가드를 잡아 둔다 — 같은 틱 연타 2발 0
  const confirmDelete = async () => {
    onDelete(target);
    close();
    await new Promise((r) => setTimeout(r, DELETE_GUARD_HOLD_MS));
  };

  // 제출 자체는 부모가 알고, **가드·사유 입력은 대상별 시트가 갖는다**(아래 ReportSheet).
  const doReport = async (reason: ReportReason, note: string) => {
    // Codex #161 P2: 응답이 늦는 사이 다른 대상으로 넘어가면 콜백이 **그 대상**의 시트를
    // 완료로 바꿔 버린다(신고한 적 없는데 Thanks) — 제출 시점 대상을 묶어 두고 대조한다.
    const submittedFor = `${target.type}:${target.id}`;
    const isSameTarget = () => submittedFor === `${targetRef.current?.type}:${targetRef.current?.id}`;
    try {
      await submitReport.mutateAsync({ target: target.type, id: target.id, reason, note: note || null });
      // P-387(KB-460): **응답 성공 후에만** 완료 화면 — 실패했는데 "접수됐다"고 말하지 않는다.
      if (isSameTarget()) setReported(true);
    } catch {
      // 실패 = 사유·메모를 그대로 두고 재시도(reported 유지 false) + 모달 안 토스트
      if (isSameTarget()) showTopToast(t('community.reportFailed'), { error: true });
    }
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
    const KIND_MINE = { post: 'community.yourPost', comment: 'community.yourComment', review: 'community.yourReview' } as const;
    const KIND_BY = { post: 'community.postBy', comment: 'community.commentBy', review: 'community.reviewBy' } as const;
    const title = target.mine ? t(KIND_MINE[target.type]) : t(KIND_BY[target.type], { name });
    const avatar = target.author.nationality ? (
      // KB-905(T-070): 국기 이모지는 헌법 v2.3.0 허용(유지) — 제목 줄에서 크게 튀던 26을 리뷰 행 배지와 같은 14로
      <Flag code={target.author.nationality} size={14} />
    ) : (
      <View style={styles.anonAvatar}>
        <IconProfile size={15} color={C.ink3} />
      </View>
    );
    return (
      <ActionSheet testID="mod-actions"
        open
        title={title}
        avatar={avatar}
        onClose={close}
        items={
          target.mine
            ? [
                { key: 'edit', label: t('community.edit'), icon: <IconEdit size={17} color={C.ink} />, onPress: () => onEdit(target) },
                { key: 'delete', label: t('community.delete'), icon: <IconTrash size={17} color={DESTRUCTIVE} />, destructive: true, keepOpen: true, onPress: () => setPhase('deleteConfirm') }, // 되돌릴 수 없음 = 2차 확인(KB-777 커맨드 지시)
              ]
            : [
                // P-142: 커뮤니티 신고 = 플래그 off(/reports targetType이 REVIEW뿐) — 리뷰 타깃만 노출
                // P-190: keepOpen — 조기 onClose(setMod null = 플로우 언마운트)가 페이즈
                // 전환을 죽이던 반려 버그(Q-40①②) 수정. 전환 렌더가 시트를 대체한다.
                // P-387(KB-460): 게스트도 회원과 같은 신고 시트 — 서버 /reports가 인증 선택으로
                // 바뀌었다(BE #249·#250, X-Installation-Id 헤더로 식별). P-281 로그인 게이트는 폐기.
                ...(target.type === 'review' || FLAGS.communityReportEnabled
                  ? [{ key: 'report', label: t('community.report'), icon: <IconReport size={17} color={C.ink} />, keepOpen: true, onPress: () => setPhase('report') }]
                  : []),
                // KB-814 F3: 사진 삭제 요청 = 통지→중단 창구(문의 화면). 게스트 게이트는 호출측
                ...(onPhotoRemoval && target.type === 'review'
                  ? [{ key: 'photoRemoval', label: t('ugc.photoRemovalRequest'), icon: <IconGallery size={17} color={C.ink} />, onPress: () => onPhotoRemoval(target) }]
                  : []),
                // P-281: 게스트 = 차단 항목 자체 미노출(예진 지시 — /members/me/blocks 회원 전용)
                // P-339 ②: 탈퇴 리뷰(작성자 부재)·신고 전용 표면(홈)도 차단 미노출
                ...(!isGuest && !target.anonymized && !target.reportOnly
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
      <Pressable testID="mod-backdrop" style={styles.backdrop} onPress={phase === 'blocking' ? undefined : close}>
        <Pressable style={[styles.sheet, kbH > 0 && { marginBottom: kbH }]} noTrack onPress={() => {}} testID="mod-sheet">
          {phase === 'report' &&
            (reported ? (
              /* 확인 상태 + 차단 2차 제안 */
              <View style={{ gap: 14, alignItems: 'center' }}>
                <View style={styles.okIc}>
                  <IconCheck size={26} color="#fff" />
                </View>
                <Text style={styles.title}>{t('community.reportThanks')}</Text>
                {/* Codex #100 2R: 초기 메뉴와 같은 가드 — 익명·신고 전용 표면은 차단 제안 없음 */}
                {!target.mine && !isGuest && !target.anonymized && !target.reportOnly && (
                  <Pressable testID="mod-block-suggest" style={styles.blockSuggest} onPress={() => setPhase('blockConfirm')}>
                    <IconUserX size={16} color={DESTRUCTIVE} />
                    <Text style={styles.blockSuggestText}>{t('community.blockUser', { name })}</Text>
                  </Pressable>
                )}
                <Btn testID="mod-done" variant="ghost" onPress={close}>
                  {t('common.gotIt')}
                </Btn>
              </View>
            ) : (
              /* Codex #161 3R: 제출 가드를 **대상별**로. 전역 가드였을 때는 호출처가 같은
                 ModerationFlow를 유지한 채 target만 바꾸므로, A의 응답이 끝날 때까지 B의
                 신고가 스피너에 묶였다. 가드가 이 자식에 살면 대상 전환(phase 리셋)에서
                 함께 사라진다 — key는 시트가 마운트된 채 대상만 바뀌는 변형까지 막는 보험. */
              <ReportSheet key={`${target.type}:${target.id}`} onSubmit={doReport} onCancel={close} />
            ))}

          {phase === 'blockConfirm' && (
            <View style={{ gap: 12 }}>
              <Text style={styles.title}>{t('community.blockConfirmTitle', { name })}</Text>
              {/* 단방향 카피 확정 — "You won't see their posts or comments" 계열 */}
              <Text style={styles.sub}>{t('community.blockConfirmBody')}</Text>
              <Btn testID="mod-block-confirm" onPress={() => void doBlock()}>{t('community.blockConfirmCta')}</Btn>
              <Btn testID="mod-block-cancel" variant="ghost" onPress={close}>
                {t('common.cancel')}
              </Btn>
            </View>
          )}

          {/* 삭제 2차 확인 — 리뷰·글·댓글은 되돌릴 수 없다. 차단 확인과 같은 시트 안 단계(모달 겹침 0) */}
          {phase === 'deleteConfirm' && (
            <View style={{ gap: 12 }}>
              <Text style={styles.title}>{t(target.type === 'review' ? 'editReview.deleteConfirmTitle' : 'community.deleteConfirmTitle')}</Text>
              <Text style={styles.sub}>{t(target.type === 'review' ? 'editReview.deleteConfirmBody' : 'community.deleteConfirmBody')}</Text>
              <Btn testID="mod-delete-confirm" variant="danger" busy={deleteGuard.busy} onPress={() => void deleteGuard.run(confirmDelete)}>{t('community.delete')}</Btn>
              <Btn testID="mod-delete-cancel" variant="ghost" onPress={close}>
                {t('common.cancel')}
              </Btn>
            </View>
          )}

          {/* P-370(KB-533) 문법: 네이티브 Modal은 루트 토스트 호스트 위에 뜬다 —
              실패 안내가 가려지지 않도록 이 모달 안에도 호스트를 둔다(Codex #161 P2) */}
          <TopToastHost />

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

/**
 * ReportSheet — 사유 선택 + 제출. 공용 제출 가드(P-173)를 **이 자식이** 들고 있어서
 * 대상이 바뀌면 가드도 함께 사라진다. 부모(ModerationFlow)는 호출처에서 계속 마운트된
 * 채 target만 바뀌므로, 가드를 부모에 두면 A의 응답이 B의 제출을 막는다(Codex #161 3R).
 */
function ReportSheet({ onSubmit, onCancel }: { onSubmit: (reason: ReportReason, note: string) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = React.useState<ReportReason | null>(null);
  const [note, setNote] = React.useState('');
  const guard = useSubmitGuard(); // 동기 ref + busy — 같은 대상 더블탭 1건만
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.title}>{t('community.reportTitle')}</Text>
      {REASONS.map((r) => (
        <Pressable key={r} style={styles.reasonRow} onPress={() => setReason(r)} testID={`report-reason-${r}`}>
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
      <Btn
        variant={reason ? 'primary' : 'off'}
        onPress={reason ? () => void guard.run(() => onSubmit(reason, reason === 'other' ? note.trim() : '')) : undefined}
        busy={guard.busy}
        testID="report-submit"
      >
        {t('community.reportSubmit')}
      </Btn>
      {/* KB-905(T-068): 닫을 길이 배경 탭·뒤로뿐이었다 — 삭제·차단 확인과 같은 ghost Cancel */}
      <Btn testID="report-cancel" variant="ghost" onPress={onCancel}>
        {t('common.cancel')}
      </Btn>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 22, paddingBottom: 34, ...shadow.sh2 },
  title: { fontFamily: font.display, fontSize: 17, color: C.ink },
  sub: { fontFamily: font.body, fontSize: 14, color: C.ink2, lineHeight: 20 },
  anonAvatar: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },

  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 6 },
  radio: { width: 21, height: 21, borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.primary },
  radioDot: { width: 11, height: 11, borderRadius: radius.pill, backgroundColor: C.primary },
  reasonText: { flex: 1, fontFamily: font.bodyBold, fontSize: 16, color: C.ink },
  noteInput: { minHeight: 80, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.md, padding: 12, fontFamily: font.body, fontSize: 14, color: C.ink },

  okIc: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: C.riskSafe, alignItems: 'center', justifyContent: 'center' },
  blockSuggest: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  blockSuggestText: { fontFamily: font.bodyBold, fontSize: 14, color: DESTRUCTIVE },
  blocking: { fontFamily: font.bodyBold, fontSize: 16, color: C.ink },
});
