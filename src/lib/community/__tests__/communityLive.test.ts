/**
 * P-142: 커뮤니티 실 API 스왑 잠금 — 어댑터 계층.
 * - 피드/상세: lang 하드 필수 전달 + cursor · wire→내부 매핑(placeTag 항상 null)
 * - 작성/수정: content·imagePaths(로컬=COMMUNITY 업로드, CDN URL=path 역변환)·foodIds
 * - 댓글: replies 1뎁스 평탄화(parentId 배선·멘션 계약 부재=null) · cursor 루프
 */
jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
  apiLang: () => 'ja',
}));
const mockUpload = jest.fn();
jest.mock('@/lib/api/scanImage', () => ({ uploadImage: (f: unknown, p: string) => mockUpload(f, p) }));

import * as adapter from '../adapter';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client');

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload.mockResolvedValue({ path: 'community/1/a.jpg', publicUrl: 'https://cdn/community/1/a.jpg' });
});

const POST_WIRE = {
  postId: 7,
  author: { memberId: 42, nickname: 'Amy', profileImageUrl: 'https://cdn/p.png' },
  content: 'hello',
  imageUrls: ['https://cdn/img/1.jpg'],
  foodTags: [{ foodId: 3, name: 'Kimchi' }],
  likeCount: 5,
  dislikeCount: 1,
  commentCount: 2,
  createdAt: '2026-08-10T00:00:00Z',
};

describe('피드/상세 — lang 필수 + 매핑', () => {
  it('피드: GET /community/posts?lang=&cursor= + wire→내부(placeTag null·myReaction null)', async () => {
    api.get.mockResolvedValueOnce({ items: [POST_WIRE], hasNext: true, nextCursor: 'c2' });
    const page = await adapter.fetchFeedPage(null);
    expect(api.get).toHaveBeenCalledWith('/community/posts?lang=ja');
    expect(page.hasNext).toBe(true);
    expect(page.nextCursor).toBe('c2');
    const p = page.items[0];
    expect(p).toMatchObject({
      id: '7',
      body: 'hello',
      photos: ['https://cdn/img/1.jpg'],
      foodTags: [{ foodId: '3', name: 'Kimchi' }],
      placeTag: null,
      likes: 5,
      dislikes: 1,
      myReaction: null,
      commentCount: 2,
    });
    expect(p.author).toMatchObject({ id: '42', nickname: 'Amy', profileImageUrl: 'https://cdn/p.png' });
    // 커서 전달
    api.get.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    await adapter.fetchFeedPage('c2');
    expect(api.get).toHaveBeenLastCalledWith('/community/posts?lang=ja&cursor=c2');
  });

  it('상세: GET /community/posts/{id}?lang= · 탈퇴 작성자(author null) 방어', async () => {
    api.get.mockResolvedValueOnce({ ...POST_WIRE, author: null });
    const p = await adapter.fetchPost('7');
    expect(api.get).toHaveBeenCalledWith('/community/posts/7?lang=ja');
    expect(p?.author.nickname).toBe(null); // 탈퇴 = 익명 표시
  });
});

describe('작성/수정 — imagePaths·foodIds payload', () => {
  it('작성: 로컬 사진 → COMMUNITY 업로드 path, foodIds 수치화, placeTag 미전송', async () => {
    api.post.mockResolvedValueOnce({ postId: 9 });
    await adapter.createPost({
      body: 'yum',
      photos: ['file:///local/a.heic'],
      foodTags: [{ foodId: '3', name: 'Kimchi' }],
      placeTag: { name: '식당', roadAddress: '주소' }, // 계약 부재 — 드롭
    });
    expect(mockUpload).toHaveBeenCalledWith({ uri: 'file:///local/a.heic', width: 0, height: 0 }, 'COMMUNITY');
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe('/community/posts');
    expect(body).toEqual({ content: 'yum', imagePaths: ['community/1/a.jpg'], foodIds: [3] });
  });

  it('수정: 기존 CDN URL은 업로드 없이 path 역변환 → PUT', async () => {
    await adapter.updatePost('7', {
      body: 'edit',
      photos: ['https://cdn.example.com/community/1/keep.jpg'],
      foodTags: [],
      placeTag: null,
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(api.put).toHaveBeenCalledWith('/community/posts/7', {
      content: 'edit',
      imagePaths: ['community/1/keep.jpg'],
      foodIds: [],
    });
  });
});

describe('댓글 — replies 1뎁스 평탄화 + cursor 루프', () => {
  it('최상위+replies → parentId 배선(멘션 계약 부재=null), 다페이지 취합', async () => {
    api.get
      .mockResolvedValueOnce({
        items: [
          {
            commentId: 1,
            author: { memberId: 42, nickname: 'Amy' },
            content: 'top',
            createdAt: '2026-08-10T00:00:00Z',
            replies: [{ commentId: 2, author: { memberId: 43, nickname: 'Ken' }, content: 're', createdAt: '2026-08-10T00:01:00Z' }],
          },
        ],
        hasNext: true,
        nextCursor: 'c2',
      })
      .mockResolvedValueOnce({
        items: [{ commentId: 3, author: { memberId: 44, nickname: 'Zed' }, content: 'top2', createdAt: '2026-08-10T00:02:00Z', replies: [] }],
        hasNext: false,
        nextCursor: null,
      });
    const list = await adapter.fetchComments('7');
    expect(api.get).toHaveBeenNthCalledWith(1, '/community/posts/7/comments');
    expect(api.get).toHaveBeenNthCalledWith(2, '/community/posts/7/comments?cursor=c2');
    expect(list.map((c) => [c.id, c.parentId, c.mention])).toEqual([
      ['1', null, null],
      ['2', '1', null],
      ['3', null, null],
    ]);
  });

  it('작성: parentId → parentCommentId 수치 전송, 최상위는 필드 생략, mention 드롭', async () => {
    api.post.mockResolvedValue({ commentId: 5, author: { memberId: 42 }, content: 'x' });
    await adapter.createComment({ postId: '7', parentId: '1', mention: 'Amy', body: 'x' });
    expect(api.post).toHaveBeenLastCalledWith('/community/posts/7/comments', { content: 'x', parentCommentId: 1 });
    await adapter.createComment({ postId: '7', parentId: null, mention: null, body: 'y' });
    expect(api.post).toHaveBeenLastCalledWith('/community/posts/7/comments', { content: 'y' });
  });

  it('수정/삭제: PUT·DELETE /community/comments/{id}', async () => {
    await adapter.updateComment('5', 'edited');
    expect(api.put).toHaveBeenCalledWith('/community/comments/5', { content: 'edited' });
    await adapter.deleteComment('5');
    expect(api.del).toHaveBeenCalledWith('/community/comments/5');
  });
});
