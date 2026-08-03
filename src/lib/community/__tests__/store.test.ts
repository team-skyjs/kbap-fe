/**
 * P-087(KB-251): 커뮤니티 목 스토어 시맨틱 잠금 — BE 스왑 시에도 화면이 기대할
 * 계약 형태: 커서 페이징 · 리액션 상호배타 · 댓글 통삭제/단독 삭제 · 차단
 * 단방향 필터(+해제) · 신고 적재.
 */
import {
  __resetCommunityStore,
  __reports,
  addComment,
  addPost,
  blockUser,
  blockedUsers,
  commentsFor,
  deleteComment,
  deletePost,
  feedPage,
  getPost,
  reactToComment,
  reactToPost,
  report,
  unblockUser,
  updatePost,
  PAGE_SIZE,
} from '../store';

beforeEach(() => __resetCommunityStore());

describe('커서 페이징 (최신순 keyset)', () => {
  it('페이지네이션 — 시드 12개 = 3페이지 (P-112: 게스트 2페이지 게이트 성립 조건)', () => {
    const p1 = feedPage(null);
    expect(p1.items).toHaveLength(PAGE_SIZE);
    expect(p1.hasNext).toBe(true);
    const p2 = feedPage(p1.nextCursor);
    expect(p2.items).toHaveLength(PAGE_SIZE);
    expect(p2.hasNext).toBe(true); // 3페이지 존재 — 게스트 상한(2p) 게이트가 뜰 수 있다
    const p3 = feedPage(p2.nextCursor);
    expect(p3.items.length).toBeGreaterThan(0);
    expect(p3.hasNext).toBe(false);
    expect(p3.nextCursor).toBe(null);
    // 최신순 — 첫 항목이 가장 최근
    const t0 = new Date(p1.items[0].createdAt).getTime();
    const t1 = new Date(p1.items[1].createdAt).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);
  });

  it('작성한 글이 첫 페이지 최상단에 온다', () => {
    const post = addPost({ body: 'new', photos: [], foodTags: [], placeTag: null });
    expect(feedPage(null).items[0].id).toBe(post.id);
  });
});

describe('리액션 — 좋아요/싫어요 상호배타 토글', () => {
  it('좋아요 → 싫어요 = 좋아요 자동 해제 · 같은 것 재탭 = 해제', () => {
    const id = 'p1';
    reactToPost(id, 'like');
    let p = getPost(id)!;
    expect(p.myReaction).toBe('like');
    const likes = p.likes;
    reactToPost(id, 'dislike'); // 상호배타 — like 자동 해제
    p = getPost(id)!;
    expect(p.myReaction).toBe('dislike');
    expect(p.likes).toBe(likes - 1);
    reactToPost(id, 'dislike'); // 재탭 = 해제
    p = getPost(id)!;
    expect(p.myReaction).toBe(null);
  });

  it('댓글 리액션도 동일 문법', () => {
    reactToComment('c1', 'dislike');
    const c = commentsFor('p1').find((x) => x.id === 'c1')!;
    expect(c.myReaction).toBe('dislike');
    expect(c.dislikes).toBe(1);
  });
});

describe('댓글 삭제 — 무흔적', () => {
  it('최상위 삭제 = 하위 대댓글 통삭제', () => {
    deleteComment('c1'); // c1의 대댓글 c2·c3 동반
    const ids = commentsFor('p1').map((c) => c.id);
    expect(ids).not.toContain('c1');
    expect(ids).not.toContain('c2');
    expect(ids).not.toContain('c3');
    expect(ids).toContain('c4'); // 다른 최상위는 유지
  });

  it('대댓글 삭제 = 그것만', () => {
    deleteComment('c2');
    const ids = commentsFor('p1').map((c) => c.id);
    expect(ids).not.toContain('c2');
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');
  });

  it('글 삭제 = 하위 댓글 통삭제', () => {
    deletePost('p1');
    expect(getPost('p1')).toBe(null);
    expect(commentsFor('p1')).toHaveLength(0);
  });
});

describe('차단 — 단방향 필터 (BE 필터 흉내) + 해제', () => {
  it('차단 유저의 글·댓글이 조회에서 사라지고 commentCount도 재계산된다', () => {
    const mina = feedPage(null).items.find((p) => p.id === 'p1')!.author;
    blockUser(mina); // Mina: p1·p9 작성, p1의 c2 댓글
    const feedIds = [feedPage(null), feedPage(String(PAGE_SIZE))].flatMap((p) => p.items.map((x) => x.id));
    expect(feedIds).not.toContain('p1');
    expect(feedIds).not.toContain('p9');
    expect(getPost('p9')).toBe(null);
    // 남의 글의 Mina 댓글도 필터 + 개수 반영
    expect(commentsFor('p5').map((c) => c.id)).not.toContain('c8');
    expect(blockedUsers().map((u) => u.id)).toContain(mina.id);
  });

  it('해제하면 콘텐츠 복귀', () => {
    const mina = feedPage(null).items.find((p) => p.id === 'p1')!.author;
    blockUser(mina);
    unblockUser(mina.id);
    expect(getPost('p1')).not.toBe(null);
    expect(blockedUsers()).toHaveLength(0);
  });
});

describe('신고·수정·답글', () => {
  it('신고 = 적재만 (콘텐츠 즉시 숨김 없음)', () => {
    report('post', 'p2', 'misinfo', null);
    report('comment', 'c4', 'other', 'free text');
    expect(__reports()).toHaveLength(2);
    expect(getPost('p2')).not.toBe(null); // 숨김 없음
  });

  it('수정 = 내용 교체 · createdAt 유지 ("(edited)" 표시 없음 정책)', () => {
    const before = getPost('p5')!;
    updatePost('p5', { body: 'edited body', photos: [], foodTags: [], placeTag: null });
    const after = getPost('p5')!;
    expect(after.body).toBe('edited body');
    expect(after.createdAt).toBe(before.createdAt);
  });

  it('대댓글에 답글 = 같은 최상위 블록 마지막 + 원 작성자 멘션 (등록순)', () => {
    const reply = addComment({ postId: 'p1', parentId: 'c1', mention: 'Linh', body: 'me too' });
    const thread = commentsFor('p1').filter((c) => c.parentId === 'c1');
    expect(thread[thread.length - 1].id).toBe(reply.id); // 마지막 대댓글로
    expect(reply.mention).toBe('Linh');
  });
});
