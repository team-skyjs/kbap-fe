/**
 * P-108 → P-142: 신고·차단 어댑터 잠금 (목 스토어 철거 후).
 * - 리뷰 신고만 실 POST /reports (사유 매핑 고정) · 커뮤니티(post/comment)는
 *   호출 0 (targetType enum REVIEW뿐 — UI도 플래그 off, 도달 불가 경로 방어)
 * - 차단: 항상 BE(멤버 단위 — 커뮤니티 작성자도 실 memberId)
 * - 차단 목록: GET /members/me/blocks 수신(null 방어) — 로컬 병행 소멸
 */
jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue(undefined),
    put: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
  apiLang: () => 'en',
}));

import * as adapter from '../adapter';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('신고', () => {
  it('리뷰 신고 → POST /reports (targetType REVIEW · 사유 매핑 고정)', async () => {
    await adapter.submitReport('review', '42', 'misinfo', null);
    expect(api.post).toHaveBeenCalledWith('/reports', { targetType: 'REVIEW', targetId: 42, reason: 'FALSE_INFO' });
  });

  it('사유 매핑 — spam→SPAM·harassment→ABUSE·inappropriate→SEXUAL·other→OTHER(+detail)', async () => {
    await adapter.submitReport('review', '1', 'spam', null);
    expect(api.post).toHaveBeenLastCalledWith('/reports', expect.objectContaining({ reason: 'SPAM' }));
    await adapter.submitReport('review', '1', 'harassment', null);
    expect(api.post).toHaveBeenLastCalledWith('/reports', expect.objectContaining({ reason: 'ABUSE' }));
    await adapter.submitReport('review', '1', 'inappropriate', null);
    expect(api.post).toHaveBeenLastCalledWith('/reports', expect.objectContaining({ reason: 'SEXUAL' }));
    await adapter.submitReport('review', '1', 'other', '광고 반복');
    expect(api.post).toHaveBeenLastCalledWith('/reports', expect.objectContaining({ reason: 'OTHER', detail: '광고 반복' }));
  });

  it('커뮤니티(post/comment) 신고 → API 호출 0 (P-142: enum REVIEW뿐 — 플래그 off 표면)', async () => {
    await adapter.submitReport('post', 'p1', 'spam', null);
    await adapter.submitReport('comment', 'c1', 'spam', null);
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('차단 — 항상 BE(멤버 단위)', () => {
  it('차단 → POST /members/me/blocks', async () => {
    await adapter.blockUser({ id: '42', nickname: 'A', nationality: null });
    expect(api.post).toHaveBeenCalledWith('/members/me/blocks', { memberId: 42 });
  });

  it('해제 → DELETE /members/me/blocks/{id}', async () => {
    await adapter.unblockUser('42');
    expect(api.del).toHaveBeenCalledWith('/members/me/blocks/42');
  });
});

describe('차단 목록', () => {
  it('GET /members/me/blocks 수신 — 닉네임 null 방어', async () => {
    api.get.mockResolvedValueOnce([{ memberId: 42, nickname: null, profileImageUrl: null }]);
    const list = await adapter.fetchBlockedUsers();
    expect(list).toEqual([expect.objectContaining({ id: '42', nickname: null, nationality: null })]);
  });

  it('빈 응답/널 방어', async () => {
    api.get.mockResolvedValueOnce(undefined);
    await expect(adapter.fetchBlockedUsers()).resolves.toEqual([]);
  });
});
