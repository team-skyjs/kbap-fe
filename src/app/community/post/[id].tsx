/**
 * Community post detail + 댓글 스레드 (P-087/KB-251 D-04·05).
 *
 * 본문·사진·태그 칩(→시트 2종) · 리액션 상호배타 · 번역 토글(모든 글·댓글 —
 * 목 단계는 상태 표시만, 번역문은 원문 유지) · 게스트 = 본문 열람 + 댓글 블러
 * (개수는 선명) · 댓글 = 등록순·1뎁스 유튜브식(@멘션 primary·탭 무동작,
 * "View n replies" 접기, 답글 상태 @프리셋+X, 삭제 무흔적 통삭제) · ⋯ = 공용
 * ModerationFlow(상세발 차단 = 피드 복귀+토스트).
 */
import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, IconClose, IconLock, IconSend, Spinner, Input } from '@/components';
import { useBottomInset } from '@/lib/useBottomInset';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { QueryErrorBlock } from '@/components/StateBlock';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import {
  useCommunityComments,
  useCommunityPost,
  useCreateComment,
  useDeleteComment,
  useDeletePost,
  useReact,
  useUpdateComment,
} from '@/lib/community/hooks';
import { useMe } from '@/lib/data/useMe';
import { FLAGS } from '@/lib/flags';
import { setPendingToast } from '@/lib/community/pendingToast';
import type { CommunityComment } from '@/lib/community/types';
import { AuthorRow, PhotoGrid, ReactionBar, TagChip, authorName, timeAgo } from '@/features/community/parts';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { FoodTagSheet, PlaceTagSheet } from '@/features/community/tagSheets';
import { EVENTS, track } from '@/lib/analytics';

type TFn = ReturnType<typeof useTranslation>['t'];

/** 답글 입력 상태 — 대상 최상위 댓글 + @멘션(원 작성자). */
interface ReplyState {
  parentId: string;
  mention: string;
}

export default function CommunityPostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const bottomInset = useBottomInset();
  const isGuest = useIsGuest();
  const myId = useMe().data?.id ?? ''; // P-142: 내 글 판별 = 실 회원 id (목 MY_ID 소멸)

  const { data: post, isLoading, error, refetch } = useCommunityPost(id ?? ''); // P-164
  const { data: comments } = useCommunityComments(id ?? '');
  const react = useReact();
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const deletePost = useDeletePost();

  const [gateOpen, setGateOpen] = React.useState(false);
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const [foodSheet, setFoodSheet] = React.useState<{ foodId: string; name: string } | null>(null);
  const [placeOpen, setPlaceOpen] = React.useState(false);
  const [translated, setTranslated] = React.useState(false); // 목: 상태 표시만 (번역문 = 원문 유지)
  const [input, setInput] = React.useState('');
  const [reply, setReply] = React.useState<ReplyState | null>(null);
  const [editing, setEditing] = React.useState<CommunityComment | null>(null);

  const requireMember = (action: () => void) => {
    if (isGuest) return setGateOpen(true);
    action();
  };

  const tops = (comments ?? []).filter((c) => c.parentId == null);
  const repliesOf = (topId: string) => (comments ?? []).filter((c) => c.parentId === topId);
  const commentTotal = comments?.length ?? post?.commentCount ?? 0;

  // P-173: 댓글 작성/수정 비멱등 — 공용 가드
  const { busy: sending, run: runSend } = useSubmitGuard();
  const send = () => {
    const body = input.trim();
    if (!body || !id || sending) return;
    void runSend(
      () =>
        new Promise<void>((resolve) => {
          const opts = { onSettled: () => resolve() };
          if (editing) {
            updateComment.mutate({ id: editing.id, body }, opts);
            setEditing(null);
          } else {
            track(EVENTS.community_comment_submit, { is_reply: reply?.parentId != null }); // P-214: 본문·대상 금지
            createComment.mutate({ postId: id, parentId: reply?.parentId ?? null, mention: reply?.mention ?? null, body }, opts);
            setReply(null);
          }
          setInput('');
        }),
    );
  };

  const startReply = (top: CommunityComment, source: CommunityComment) => {
    // 대댓글에 답글 = 같은 최상위 블록 마지막에 + 원 작성자 @멘션 (유튜브식)
    requireMember(() => {
      setEditing(null);
      setReply({ parentId: top.id, mention: authorName(source.author, t) });
    });
  };

  if (isLoading) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('community.postTitle')} onBack={() => router.back()} />
        <View style={styles.center}>
          <Spinner size={22} color={C.ink2} />
        </View>
      </View>
    );
  }
  // P-164: 로드 실패 = 공용 에러(+재시도) — postGone(삭제됨) 위장 금지
  if (!post && error) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('community.postTitle')} onBack={() => router.back()} />
        <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />
      </View>
    );
  }
  if (!post) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('community.postTitle')} onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.missing}>{t('community.postGone')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader title={t('community.postTitle')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AuthorRow
            author={post.author}
            when={timeAgo(post.createdAt, t)}
            onMore={() => setMod({ type: 'post', id: post.id, author: post.author, mine: post.author.id === myId })}
            t={t}
          />
          <Text style={styles.postBody}>{post.body}</Text>

          {/* P-142: 번역 토글 = 플래그 off — lang 하드 필수 계약이라 원문 조회 수단
              부재(본문은 항상 서버측 리더 언어 응답). 원문 규약 배포 시 재개. */}
          {FLAGS.communityTranslateEnabled && (
            <Pressable hitSlop={6} onPress={() => setTranslated((v) => { track(EVENTS.review_translate_toggle, { action: v ? 'original' : 'translate', target: 'post' }); return !v; })} style={styles.txRow}>
              <Text style={styles.txLink}>{translated ? t('reviews.showOriginal') : t('reviews.translate')}</Text>
              {translated && <Text style={styles.txState}>{t('community.translatedState')}</Text>}
            </Pressable>
          )}

          <PhotoGrid photos={post.photos} />
          {(post.foodTags.length > 0 || post.placeTag) && (
            <View style={styles.tagRow}>
              {post.foodTags.map((f) => (
                <TagChip key={f.foodId} kind="food" label={f.name} onPress={() => setFoodSheet(f)} />
              ))}
              {post.placeTag && <TagChip kind="place" label={post.placeTag.name} onPress={() => setPlaceOpen(true)} />}
            </View>
          )}
          <ReactionBar
            likes={post.likes}
            dislikes={post.dislikes}
            myReaction={post.myReaction}
            onReact={(r) => requireMember(() => react.mutate({ target: 'post', id: post.id, reaction: r }))}
          />

          <View style={styles.divider} />
          <Text style={styles.commentsTitle}>{t('community.commentsTitle', { count: commentTotal })}</Text>

          {isGuest ? (
            /* 게스트 — 개수는 선명, 내용은 **고스트 스켈레톤**(P-100: 실 텍스트
               미렌더 = 판독 차단 + 실연결 시 비회원엔 댓글 데이터 자체가 안 오는
               BE 필터 정책과 정합. opacity 반투명 폐기 — 내용이 읽혔음) */
            <View>
              <View pointerEvents="none" style={styles.guestGhost}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.ghostRow}>
                    <View style={styles.ghostAvatar} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <View style={[styles.ghostLine, { width: `${46 + i * 12}%` }]} />
                      <View style={[styles.ghostLine, { width: `${82 - i * 9}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.guestPop}>
                <View style={styles.guestPopIc}>
                  <IconLock size={18} color={C.ink2} />
                </View>
                <Text style={styles.guestPopText}>{t('community.guestComments')}</Text>
                <Pressable style={styles.guestPopBtn} onPress={() => setGateOpen(true)}>
                  <Text style={styles.guestPopBtnText}>{t('intro.signUp')}</Text>
                </Pressable>
              </View>
            </View>
          ) : tops.length === 0 ? (
            <Text style={styles.noComments}>{t('community.noComments')}</Text>
          ) : (
            <View style={{ gap: 14 }}>
              {tops.map((c) => (
                <CommentBlock
                  key={c.id}
                  top={c}
                  replies={repliesOf(c.id)}
                  t={t}
                  onReact={(target, r) => requireMember(() => react.mutate({ target: 'comment', id: target.id, reaction: r }))}
                  onReply={(top, source) => startReply(top, source)}
                  onMore={(cm) => setMod({ type: 'comment', id: cm.id, author: cm.author, mine: cm.author.id === myId })}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* 댓글 입력바 — 답글 상태(@프리셋+X) / 수정 상태 */}
        {!isGuest && (
          <View style={[styles.inputBar, { paddingBottom: bottomInset + 10 }]}>
            {(reply || editing) && (
              <View style={styles.inputState}>
                <Text style={styles.inputStateText} numberOfLines={1}>
                  {editing ? t('community.editingComment') : t('community.replyingTo', { name: reply!.mention })}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setReply(null);
                    setEditing(null);
                    setInput('');
                  }}
                >
                  <IconClose size={15} color={C.ink3} />
                </Pressable>
              </View>
            )}
            <View style={styles.inputRow}>
              <Input
                value={input}
                onChangeText={setInput}
                placeholder={t('community.commentPlaceholder')}
                placeholderTextColor={C.ink3}
                style={styles.input}
                multiline
              />
              <Pressable style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]} onPress={send} disabled={!input.trim() || sending}>
                <IconSend size={17} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <FoodTagSheet target={foodSheet} onClose={() => setFoodSheet(null)} />
      <PlaceTagSheet place={placeOpen ? post.placeTag : null} onClose={() => setPlaceOpen(false)} />

      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => {
          if (m.type === 'post') return router.push(`/community/compose?editId=${m.id}` as Href);
          const cm = (comments ?? []).find((c) => c.id === m.id);
          if (cm) {
            setEditing(cm);
            setReply(null);
            setInput(cm.body);
          }
        }}
        onDelete={(m) => {
          if (m.type === 'post') {
            deletePost.mutate(m.id);
            router.back(); // 내 글 삭제 → 피드 복귀
          } else {
            deleteComment.mutate(m.id); // 무흔적 — 최상위면 대댓글 동반(스토어)
          }
        }}
        onBlocked={(m) => {
          if (m.type === 'post') {
            // 상세발 차단 — 피드 복귀 + 토스트 (확정 플로우)
            setPendingToast(t('community.blockedToast'));
            router.back();
          }
          // 댓글발 차단 — 무효화 재조회가 그 유저 콘텐츠 제거 (BE 필터 흉내)
        }}
      />

      <AuthGateSheet context="profile" open={gateOpen} onClose={() => setGateOpen(false)} />
    </View>
  );
}

/* ---- 댓글 블록 (최상위 + 1뎁스 대댓글, 접기) ---- */

function CommentBlock({
  top,
  replies,
  t,
  onReact,
  onReply,
  onMore,
}: {
  top: CommunityComment;
  replies: CommunityComment[];
  t: TFn;
  onReact: (c: CommunityComment, r: 'like' | 'dislike') => void;
  onReply: (top: CommunityComment, source: CommunityComment) => void;
  onMore: (c: CommunityComment) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <View style={styles.commentBlock}>
      <CommentRow c={top} t={t} onReact={onReact} onReply={() => onReply(top, top)} onMore={onMore} />
      {replies.length > 0 && (
        /* 접기 컨트롤 — 블록 최상단 고정 (확장자 아래가 아니라) */
        <Pressable hitSlop={6} style={styles.repliesToggle} onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.repliesToggleText}>
            {expanded ? t('community.hideReplies') : t('community.viewReplies', { count: replies.length })}
          </Text>
        </Pressable>
      )}
      {expanded &&
        replies.map((r) => (
          <View key={r.id} style={styles.replyIndent}>
            <CommentRow c={r} t={t} onReact={onReact} onReply={() => onReply(top, r)} onMore={onMore} />
          </View>
        ))}
    </View>
  );
}

function CommentRow({
  c,
  t,
  onReact,
  onReply,
  onMore,
}: {
  c: CommunityComment;
  t: TFn;
  onReact: (c: CommunityComment, r: 'like' | 'dislike') => void;
  onReply: () => void;
  onMore: (c: CommunityComment) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <AuthorRow author={c.author} when={timeAgo(c.createdAt, t)} onMore={() => onMore(c)} t={t} />
      <Text style={styles.commentBody}>
        {/* @멘션 — primary 색 텍스트, 탭 무동작 (타인 프로필 없음) */}
        {c.mention && <Text style={styles.mention}>@{c.mention} </Text>}
        {c.body}
      </Text>
      <View style={styles.commentActions}>
        <ReactionBar likes={c.likes} dislikes={c.dislikes} myReaction={c.myReaction} onReact={(r) => onReact(c, r)} />
        <Pressable hitSlop={8} onPress={onReply}>
          <Text style={styles.replyLink}>{t('community.reply')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missing: { fontFamily: font.body, fontSize: 14, color: C.ink2 },
  body: { padding: 18, gap: 12, paddingBottom: 30 },
  postBody: { fontFamily: font.body, fontSize: 15, color: C.ink, lineHeight: 22 },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txLink: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.accent },
  txState: { fontFamily: font.body, fontSize: 12, color: C.ink3 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.hair, marginVertical: 6 },
  commentsTitle: { fontFamily: font.display, fontSize: 16, color: C.ink },
  noComments: { fontFamily: font.body, fontSize: 13.5, color: C.ink3, paddingVertical: 16, textAlign: 'center' },

  commentBlock: { gap: 8 },
  commentBody: { fontFamily: font.body, fontSize: 14, color: C.ink, lineHeight: 20, paddingLeft: 35 },
  mention: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingLeft: 35 },
  replyLink: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  repliesToggle: { paddingLeft: 35 },
  repliesToggleText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.accent },
  replyIndent: { paddingLeft: 35 },

  // P-100: 고스트 스켈레톤 — 정적(애니 없음), 판독 불가
  guestGhost: { gap: 16, minHeight: 140, paddingVertical: 4 },
  ghostRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ghostAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.surface2 },
  ghostLine: { height: 11, borderRadius: 6, backgroundColor: C.surface2 },
  guestPop: { position: 'absolute', left: 8, right: 8, top: 18, alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 16, ...shadow.sh2 },
  guestPopIc: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  guestPopText: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, textAlign: 'center' },
  guestPopBtn: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  guestPopBtnText: { fontFamily: font.bodyBold, fontSize: 13, color: '#fff' },

  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, backgroundColor: C.surface, paddingHorizontal: 14, paddingTop: 10, gap: 8 },
  inputState: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface2, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  inputStateText: { flex: 1, fontFamily: font.bodyBold, fontSize: 12, color: C.ink2 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  input: { flex: 1, maxHeight: 110, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontFamily: font.body, fontSize: 14, color: C.ink },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: C.ink3 },
});
