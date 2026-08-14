/**
 * community/parts.tsx — 피드·상세 공유 부품 (P-087/KB-251).
 * PostCard(트위터형: 제목 없음·5줄 접기·사진 그리드·태그 칩·리액션 바),
 * PhotoGrid(1 풀폭/2 반반/3~4 그리드), ReactionBar(상호배타·프레스=형태+채움
 * 전환 — 색만 전환 금지, 싫어요 0 숨김).
 */
import * as React from 'react';
import { RemoteImage } from '@/components/RemoteImage';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { FLAGS } from '@/lib/flags';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { Flag, IconBubbleEmpty, IconMore, IconThumbsDown, IconThumbsUp, IconProfile, IconFood, IconMapPin } from '@/components';
import type { CommunityAuthor, CommunityPost, Reaction } from '@/lib/community/types';

type TFn = ReturnType<typeof useTranslation>['t'];

export function authorName(author: CommunityAuthor, t: TFn): string {
  return author.nickname ?? t('community.deletedUser'); // 탈퇴 = content 유지 + 표시명 대체
}

export function timeAgo(iso: string, t: TFn): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return t('community.justNow');
  if (mins < 60) return t('community.minsAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('community.hoursAgo', { count: hours });
  return t('reviews.daysAgo', { count: Math.floor(hours / 24) });
}

/** 작성자 행 — 탈퇴자는 기본 프로필 아이콘(국기 없음). */
export function AuthorRow({ author, when, onMore, t }: { author: CommunityAuthor; when: string; onMore?: () => void; t: TFn }) {
  return (
    <View style={styles.authorRow}>
      {author.nationality ? (
        <Flag code={author.nationality} size={26} />
      ) : (
        <View style={styles.anonAvatar}>
          <IconProfile size={15} color={C.ink3} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.authorName} numberOfLines={1}>
          {authorName(author, t)}
        </Text>
        <Text style={styles.when}>{when}</Text>
      </View>
      {onMore && (
        <Pressable hitSlop={10} onPress={onMore}>
          <IconMore size={18} color={C.ink3} />
        </Pressable>
      )}
    </View>
  );
}

/** 트위터식 사진 그리드 — 1장 풀폭 / 2장 반반 / 3장 1+2 / 4장 2×2. */
export function PhotoGrid({ photos }: { photos: string[] }) {
  const n = photos.length;
  if (n === 0) return null;
  if (n === 1) return <RemoteImage uri={photos[0]} style={[styles.photoBase, styles.photoFull]} />;
  if (n === 2) {
    return (
      <View style={styles.photoRow}>
        {photos.map((uri) => (
          <RemoteImage key={uri} uri={uri} style={[styles.photoBase, styles.photoHalf]} />
        ))}
      </View>
    );
  }
  if (n === 3) {
    return (
      <View style={styles.photoRow}>
        <RemoteImage uri={photos[0]} style={[styles.photoBase, styles.photoTall]} />
        <View style={styles.photoCol}>
          <RemoteImage uri={photos[1]} style={[styles.photoBase, styles.photoQuarter]} />
          <RemoteImage uri={photos[2]} style={[styles.photoBase, styles.photoQuarter]} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.photoGrid2}>
      {photos.slice(0, 4).map((uri) => (
        <RemoteImage key={uri} uri={uri} style={[styles.photoBase, styles.photoQuad]} />
      ))}
    </View>
  );
}

/** 리액션 버튼 — 활성=채움(형태+채움 전환, 색만 금지). 싫어요 카운트 0은 숨김.
 *  P-142: 토글 API 부재 → 플래그 off = **카운트 표시만**(비인터랙티브), 댓글
 *  이동 버튼은 유지. 표시할 것이 하나도 없으면 행 자체 미렌더(댓글 행 등). */
export function ReactionBar({
  likes,
  dislikes,
  myReaction,
  commentCount,
  onReact,
  onComment,
}: {
  likes: number;
  dislikes: number;
  myReaction: Reaction;
  commentCount?: number;
  onReact: (r: 'like' | 'dislike') => void;
  onComment?: () => void;
}) {
  const interactive = FLAGS.communityReactionsEnabled;
  if (!interactive && likes <= 0 && dislikes <= 0 && !onComment) return null;
  return (
    <View style={styles.reactRow}>
      {(interactive || likes > 0) && (
        <Pressable style={styles.reactBtn} hitSlop={8} onPress={() => onReact('like')} disabled={!interactive} testID="react-like">
          <IconThumbsUp
            size={17}
            color={myReaction === 'like' ? C.primary : C.ink2}
            {...(myReaction === 'like' ? { fill: C.primary, sw: 0 } : {})}
          />
          {likes > 0 && <Text style={[styles.reactCount, myReaction === 'like' && styles.reactCountOn]}>{likes}</Text>}
        </Pressable>
      )}
      {(interactive || dislikes > 0) && (
        <Pressable style={styles.reactBtn} hitSlop={8} onPress={() => onReact('dislike')} disabled={!interactive} testID="react-dislike">
          <IconThumbsDown
            size={17}
            color={myReaction === 'dislike' ? C.ink : C.ink2}
            {...(myReaction === 'dislike' ? { fill: C.ink, sw: 0 } : {})}
          />
          {dislikes > 0 && <Text style={styles.reactCount}>{dislikes}</Text>}
        </Pressable>
      )}
      {onComment && (
        <Pressable style={styles.reactBtn} hitSlop={8} onPress={onComment}>
          <IconBubbleEmpty size={17} color={C.ink2} />
          {commentCount != null && commentCount > 0 && <Text style={styles.reactCount}>{commentCount}</Text>}
        </Pressable>
      )}
    </View>
  );
}

/** 태그 칩 (음식/장소) — 탭 시 바텀시트 미리보기는 호출측. */
export function TagChip({ kind, label, onPress }: { kind: 'food' | 'place'; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.tagChip} onPress={onPress} hitSlop={4}>
      {kind === 'food' ? <IconFood size={13} color={C.primary} /> : <IconMapPin size={13} color={C.accent} />}
      <Text style={styles.tagChipText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 피드 카드 — 본문 5줄 접기 + "더보기"(탭 = 상세 진입). */
export function PostCard({
  post,
  onOpen,
  onMore,
  onReact,
  onTagFood,
  onTagPlace,
  t,
}: {
  post: CommunityPost;
  onOpen: () => void;
  onMore: () => void;
  onReact: (r: 'like' | 'dislike') => void;
  onTagFood: (foodId: string, name: string) => void;
  onTagPlace: () => void;
  t: TFn;
}) {
  const [clamped, setClamped] = React.useState(false);
  return (
    <View style={styles.card}>
      <AuthorRow author={post.author} when={timeAgo(post.createdAt, t)} onMore={onMore} t={t} />
      <Pressable onPress={onOpen}>
        <Text
          style={styles.body}
          numberOfLines={5}
          onTextLayout={(e) => setClamped(e.nativeEvent.lines.length >= 5)}
        >
          {post.body}
        </Text>
        {clamped && <Text style={styles.more}>{t('community.seeMore')}</Text>}
      </Pressable>
      <PhotoGrid photos={post.photos} />
      {(post.foodTags.length > 0 || post.placeTag) && (
        <View style={styles.tagRow}>
          {post.foodTags.map((f) => (
            <TagChip key={f.foodId} kind="food" label={f.name} onPress={() => onTagFood(f.foodId, f.name)} />
          ))}
          {post.placeTag && <TagChip kind="place" label={post.placeTag.name} onPress={onTagPlace} />}
        </View>
      )}
      <ReactionBar
        likes={post.likes}
        dislikes={post.dislikes}
        myReaction={post.myReaction}
        commentCount={post.commentCount}
        onReact={onReact}
        onComment={onOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 14, gap: 10, ...shadow.sh1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  anonAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  authorName: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  when: { fontFamily: font.body, fontSize: 11, color: C.ink3, marginTop: 1 },
  body: { fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 21 },
  more: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText, marginTop: 3 },

  photoBase: { backgroundColor: C.surface2, borderRadius: 12 },
  photoFull: { width: '100%', aspectRatio: 3 / 2 },
  photoRow: { flexDirection: 'row', gap: 4 },
  photoCol: { flex: 1, gap: 4 },
  photoHalf: { flex: 1, aspectRatio: 1 },
  photoTall: { flex: 1, aspectRatio: 0.744 },
  photoQuarter: { width: '100%', flex: 1 },
  photoGrid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  photoQuad: { width: '49%', aspectRatio: 4 / 3, flexGrow: 1 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 220 },
  tagChipText: { fontFamily: font.bodyBold, fontSize: 12, color: C.ink },

  reactRow: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingTop: 2 },
  reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reactCount: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  reactCountOn: { color: C.primaryText },
});
