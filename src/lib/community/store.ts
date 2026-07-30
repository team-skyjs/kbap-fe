/**
 * community/store.ts — 인메모리 목 스토어 (P-087/KB-251). 세션 한정 상태 —
 * 앱 재시작 시 시드로 복원되는 게 정상 (실 API는 KB-251 후속 스왑).
 *
 * BE 시맨틱을 그대로 흉내낸다 (스왑 시 화면 무변이 목표):
 *  - 커서 페이징 최신순 (PAGE_SIZE=5, cursor = 오프셋 문자열)
 *  - 차단 = 단방향 뮤트 — 조회 시 차단 유저 콘텐츠 필터(BE 필터 흉내)
 *  - 댓글 삭제 = 무흔적 통삭제(하위 대댓글 동반) · 대댓글 삭제 = 단독
 *  - 글 삭제 = 하위 댓글 통삭제
 *  - 리액션 = 좋아요/싫어요 상호배타 토글 (같은 것 다시 = 해제)
 *  - 신고 = 적재만 (즉시 숨김 없음)
 */
import type {
  BlockedUser,
  CommunityAuthor,
  CommunityComment,
  CommunityPage,
  CommunityPost,
  FoodTagRef,
  PlaceTagRef,
  Reaction,
  ReportReason,
  ReportTarget,
} from './types';

export const PAGE_SIZE = 5;
export const MY_ID = 'me';

/* ---- 시드 (다국어 8~10개 — 영·한·태·스·일·베 혼합) ---- */

const A = {
  me: { id: MY_ID, nickname: 'Yejin', nationality: 'KR' } as CommunityAuthor,
  mina: { id: 'u-mina', nickname: 'Mina', nationality: 'US' } as CommunityAuthor,
  somchai: { id: 'u-somchai', nickname: 'Somchai', nationality: 'TH' } as CommunityAuthor,
  diego: { id: 'u-diego', nickname: 'Diego', nationality: 'MX' } as CommunityAuthor,
  yuki: { id: 'u-yuki', nickname: 'Yuki', nationality: 'JP' } as CommunityAuthor,
  linh: { id: 'u-linh', nickname: 'Linh', nationality: 'VN' } as CommunityAuthor,
  sasha: { id: 'u-sasha', nickname: 'Sasha', nationality: 'RU' } as CommunityAuthor,
  gone: { id: 'u-gone', nickname: null, nationality: null } as CommunityAuthor, // 탈퇴한 사용자
};

const pic = (seed: string) => `https://picsum.photos/seed/kbap-${seed}/900/600`;

function seedPosts(): CommunityPost[] {
  return [
    {
      id: 'p1',
      author: A.mina,
      body: "Finally tried the famous kimchi stew place near Hongdae — told them I can't eat shrimp and they were SO kind about it. They even brought a separate ladle. This app's scan saved me twice this week already.\n\nPro tip: go before 6pm, the line gets wild.",
      photos: [pic('p1a'), pic('p1b')],
      foodTags: [{ foodId: 'kimchi-jjigae', name: 'Kimchi stew' }],
      placeTag: { name: 'Hongdae Kimchi House', roadAddress: '12 Wausan-ro, Mapo-gu, Seoul' },
      likes: 24, dislikes: 1, myReaction: null, commentCount: 4,
      createdAt: '2026-07-30T09:10:00Z',
    },
    {
      id: 'p2',
      author: A.somchai,
      body: 'อาหารเกาหลีเผ็ดจริง แต่ต่อมต้องลอง 555 ใครแพ้กุ้งระวังซอสนะครับ',
      photos: [pic('p2a')],
      foodTags: [{ foodId: 'tteokbokki', name: 'Tteokbokki' }],
      placeTag: null,
      likes: 11, dislikes: 0, myReaction: null, commentCount: 2,
      createdAt: '2026-07-30T07:40:00Z',
    },
    {
      id: 'p3',
      author: A.diego,
      body: 'Bibimbap sin huevo = perfección. El dueño entendió mi alergia a la primera. 10/10 volvería.',
      photos: [],
      foodTags: [{ foodId: 'bibimbap', name: 'Bibimbap' }],
      placeTag: null,
      likes: 8, dislikes: 0, myReaction: null, commentCount: 1,
      createdAt: '2026-07-29T22:05:00Z',
    },
    {
      id: 'p4',
      author: A.yuki,
      body: '韓国のコンビニおにぎり、意外と乳成分入りが多いので成分表チェック必須です。スキャン機能が本当に便利。',
      photos: [pic('p4a'), pic('p4b'), pic('p4c')],
      foodTags: [],
      placeTag: null,
      likes: 19, dislikes: 2, myReaction: null, commentCount: 0,
      createdAt: '2026-07-29T15:30:00Z',
    },
    {
      id: 'p5',
      author: A.me,
      body: '오늘 처음으로 회사 근처 백반집에서 스캔 없이 주문 성공! 조금씩 늘고 있는 기분.',
      photos: [],
      foodTags: [],
      placeTag: null,
      likes: 5, dislikes: 0, myReaction: null, commentCount: 1,
      createdAt: '2026-07-29T12:00:00Z',
    },
    {
      id: 'p6',
      author: A.linh,
      body: 'Mọi người ơi, món sundubu ở đây có tôm khô trong nước dùng — app báo caution là đúng đó. Hỏi chủ quán trước khi ăn nha!',
      photos: [pic('p6a')],
      foodTags: [{ foodId: 'sundubu', name: 'Sundubu jjigae' }],
      placeTag: null,
      likes: 15, dislikes: 0, myReaction: null, commentCount: 3,
      createdAt: '2026-07-28T19:20:00Z',
    },
    {
      id: 'p7',
      author: A.sasha,
      body: 'Наконец нашла кафе с халяльным корейским барбекю. Если кому нужно — напишу адрес в комментариях.',
      photos: [pic('p7a'), pic('p7b'), pic('p7c'), pic('p7d')],
      foodTags: [],
      placeTag: null,
      likes: 31, dislikes: 3, myReaction: null, commentCount: 2,
      createdAt: '2026-07-28T10:45:00Z',
    },
    {
      id: 'p8',
      author: A.gone,
      body: 'This gimbap place uses imitation crab — heads up for shellfish folks. The scan caught it from the menu photo.',
      photos: [],
      foodTags: [{ foodId: 'gimbap', name: 'Gimbap' }],
      placeTag: null,
      likes: 7, dislikes: 0, myReaction: null, commentCount: 0,
      createdAt: '2026-07-27T16:00:00Z',
    },
    {
      id: 'p9',
      author: A.mina,
      body: 'Weekly appreciation post for every restaurant owner who answers ingredient questions patiently. You make eating abroad possible for us.',
      photos: [],
      foodTags: [],
      placeTag: null,
      likes: 42, dislikes: 1, myReaction: 'like', commentCount: 5,
      createdAt: '2026-07-27T09:00:00Z',
    },
  ];
}

function seedComments(): CommunityComment[] {
  const c = (
    id: string, postId: string, parentId: string | null, author: CommunityAuthor, body: string,
    createdAt: string, mention: string | null = null, likes = 0, dislikes = 0,
  ): CommunityComment => ({ id, postId, parentId, mention, author, body, likes, dislikes, myReaction: null, createdAt });
  return [
    c('c1', 'p1', null, A.somchai, 'That ladle detail is so sweet. Adding this place to my list!', '2026-07-30T09:30:00Z', null, 3),
    c('c2', 'p1', 'c1', A.mina, 'Do it! Tell them about your allergy first.', '2026-07-30T09:45:00Z', 'Somchai', 1),
    c('c3', 'p1', 'c1', A.linh, 'Same, going this weekend.', '2026-07-30T10:00:00Z', 'Mina'),
    c('c4', 'p1', null, A.diego, '¿Aceptan tarjeta extranjera?', '2026-07-30T11:00:00Z'),
    c('c5', 'p2', null, A.yuki, '辛いの苦手だけど挑戦してみたい…', '2026-07-30T08:00:00Z', null, 2),
    c('c6', 'p2', 'c5', A.somchai, 'Start with the mild one! Rose tteokbokki is a lot gentler.', '2026-07-30T08:10:00Z', 'Yuki'),
    c('c7', 'p3', null, A.me, 'Which branch was this?', '2026-07-29T23:00:00Z'),
    c('c8', 'p5', null, A.mina, 'Proud of you!! The small wins add up.', '2026-07-29T12:30:00Z', null, 2),
    c('c9', 'p6', null, A.me, 'Thanks for the heads up — caution save.', '2026-07-28T20:00:00Z', null, 1),
    c('c10', 'p6', 'c9', A.linh, 'Anytime! Stay safe.', '2026-07-28T20:30:00Z', 'Yejin'),
    c('c11', 'p6', null, A.sasha, 'Same thing happened to me there.', '2026-07-28T21:00:00Z'),
    c('c12', 'p7', null, A.linh, 'Please share! My roommate needs this.', '2026-07-28T11:00:00Z', null, 4),
    c('c13', 'p7', 'c12', A.sasha, 'DM-ing you the address (jk — comments only). Itaewon, Usadan-ro 10.', '2026-07-28T11:20:00Z', 'Linh', 2),
  ];
}

/* ---- 상태 ---- */

interface StoreState {
  posts: CommunityPost[];
  comments: CommunityComment[];
  blocked: Map<string, BlockedUser>;
  reports: { target: ReportTarget; id: string; reason: ReportReason; note: string | null }[];
  seq: number;
}

let S: StoreState = fresh();

function fresh(): StoreState {
  return { posts: seedPosts(), comments: seedComments(), blocked: new Map(), reports: [], seq: 0 };
}

/** 테스트·개발용 리셋. */
export function __resetCommunityStore(): void {
  S = fresh();
}

const nextId = (p: string) => `${p}-${++S.seq}`;
const notBlocked = <T extends { author: CommunityAuthor }>(x: T) => !S.blocked.has(x.author.id);
const byRecent = (a: CommunityPost, b: CommunityPost) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
const byOldest = (a: CommunityComment, b: CommunityComment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/** 공개 commentCount = 차단·삭제 반영 실측 (BE 계산 흉내). */
function liveCommentCount(postId: string): number {
  return S.comments.filter((c) => c.postId === postId && notBlocked(c)).length;
}

const withCount = (p: CommunityPost): CommunityPost => ({ ...p, commentCount: liveCommentCount(p.id) });

/* ---- 조회 ---- */

export function feedPage(cursor: string | null): CommunityPage<CommunityPost> {
  const all = S.posts.filter(notBlocked).sort(byRecent);
  const start = cursor ? Number(cursor) : 0;
  const items = all.slice(start, start + PAGE_SIZE).map(withCount);
  const hasNext = start + PAGE_SIZE < all.length;
  return { items, hasNext, nextCursor: hasNext ? String(start + PAGE_SIZE) : null };
}

export function getPost(id: string): CommunityPost | null {
  const p = S.posts.find((x) => x.id === id);
  return p && notBlocked(p) ? withCount(p) : null;
}

/** 등록순(오래된 먼저) 전체 — 화면이 1뎁스 그룹핑. 차단 유저 필터(BE 흉내). */
export function commentsFor(postId: string): CommunityComment[] {
  return S.comments.filter((c) => c.postId === postId && notBlocked(c)).sort(byOldest);
}

/* ---- 글 CRUD ---- */

export function addPost(input: { body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }): CommunityPost {
  const post: CommunityPost = {
    id: nextId('p'),
    author: { ...A.me },
    body: input.body,
    photos: input.photos.slice(0, 4),
    foodTags: input.foodTags.slice(0, 3),
    placeTag: input.placeTag,
    likes: 0, dislikes: 0, myReaction: null, commentCount: 0,
    createdAt: new Date().toISOString(),
  };
  S.posts.unshift(post);
  return post;
}

export function updatePost(id: string, input: { body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }): void {
  const p = S.posts.find((x) => x.id === id);
  if (!p) return;
  // 수정 허용 · "(edited)" 표시 없음 (7/29 확정) — createdAt 유지
  p.body = input.body;
  p.photos = input.photos.slice(0, 4);
  p.foodTags = input.foodTags.slice(0, 3);
  p.placeTag = input.placeTag;
}

/** 글 삭제 = 하위 댓글 통삭제. */
export function deletePost(id: string): void {
  S.posts = S.posts.filter((x) => x.id !== id);
  S.comments = S.comments.filter((c) => c.postId !== id);
}

/* ---- 댓글 CRUD ---- */

export function addComment(input: { postId: string; parentId: string | null; mention: string | null; body: string }): CommunityComment {
  const comment: CommunityComment = {
    id: nextId('c'),
    postId: input.postId,
    parentId: input.parentId,
    mention: input.mention,
    author: { ...A.me },
    body: input.body,
    likes: 0, dislikes: 0, myReaction: null,
    createdAt: new Date().toISOString(),
  };
  S.comments.push(comment); // 등록순 — 뒤에 붙는다 (대댓글도 "마지막 대댓글로")
  return comment;
}

export function updateComment(id: string, body: string): void {
  const c = S.comments.find((x) => x.id === id);
  if (c) c.body = body;
}

/** 댓글 삭제 = 무흔적. 최상위면 하위 대댓글 통삭제, 대댓글이면 단독 삭제. */
export function deleteComment(id: string): void {
  S.comments = S.comments.filter((c) => c.id !== id && c.parentId !== id);
}

/* ---- 리액션 (상호배타 토글) ---- */

function applyReaction(target: { likes: number; dislikes: number; myReaction: Reaction }, r: Exclude<Reaction, null>): void {
  if (target.myReaction === r) {
    // 같은 것 다시 = 해제
    target.myReaction = null;
    target[r === 'like' ? 'likes' : 'dislikes'] -= 1;
    return;
  }
  if (target.myReaction) target[target.myReaction === 'like' ? 'likes' : 'dislikes'] -= 1; // 반대편 자동 해제
  target.myReaction = r;
  target[r === 'like' ? 'likes' : 'dislikes'] += 1;
}

export function reactToPost(id: string, r: Exclude<Reaction, null>): void {
  const p = S.posts.find((x) => x.id === id);
  if (p) applyReaction(p, r);
}

export function reactToComment(id: string, r: Exclude<Reaction, null>): void {
  const c = S.comments.find((x) => x.id === id);
  if (c) applyReaction(c, r);
}

/* ---- 신고 · 차단 ---- */

export function report(target: ReportTarget, id: string, reason: ReportReason, note: string | null): void {
  S.reports.push({ target, id, reason, note }); // 적재만 — 즉시 숨김 없음
}

export function __reports(): StoreState['reports'] { return S.reports; }

export function blockUser(author: CommunityAuthor): void {
  if (author.id === MY_ID) return;
  S.blocked.set(author.id, { id: author.id, nickname: author.nickname, nationality: author.nationality });
}

export function unblockUser(id: string): void {
  S.blocked.delete(id);
}

export function blockedUsers(): BlockedUser[] {
  return [...S.blocked.values()];
}
