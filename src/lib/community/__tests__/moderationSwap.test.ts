/**
 * P-108(KB-73/257): 신고·차단 실연결 스왑 잠금 — 어댑터 계층.
 * - 리뷰 신고만 실 POST /reports (사유 매핑 고정) · 커뮤니티(post/comment)는 목 유지
 * - 차단: 실 회원(수치 id) = BE + 로컬 병행 / 목 시드 작성자 = 로컬만
 * - 차단 목록: GET /members/me/blocks 수신(null 방어) + 로컬 목 차단 병행 노출
 */
jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/lib/flags', () => ({ FLAGS: { reviewsLiveEnabled: true } }));

import * as adapter from '../adapter';
import { __resetCommunityStore } from '../store';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client');

beforeEach(() => {
  jest.clearAllMocks();
  __resetCommunityStore();
});

describe('신고 스왑', () => {
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

  it('커뮤니티(post) 신고 → API 호출 0 (계약에 POST/COMMENT 없음 — 목 적재 유지)', async () => {
    await adapter.submitReport('post', 'p1', 'spam', null);
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('차단 스왑', () => {
  it('실 회원(수치 id) 차단 → POST /members/me/blocks + 로컬 병행', async () => {
    await adapter.blockUser({ id: '42', nickname: 'A', nationality: 'US' });
    expect(api.post).toHaveBeenCalledWith('/members/me/blocks', { memberId: 42 });
    expect((await adapterLocalBlocked()).some((b) => b.id === '42')).toBe(true); // 로컬 병행(커뮤니티 목 필터용)
  });

  it('목 시드 작성자(비수치 id) 차단 → API 호출 0, 로컬만', async () => {
    await adapter.blockUser({ id: 'u2', nickname: 'B', nationality: 'JP' });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('해제 — 수치 id는 DELETE /members/me/blocks/{id}, 비수치는 로컬만', async () => {
    await adapter.unblockUser('42');
    expect(api.del).toHaveBeenCalledWith('/members/me/blocks/42');
    await adapter.unblockUser('u2');
    expect(api.del).toHaveBeenCalledTimes(1);
  });
});

describe('차단 목록', () => {
  it('GET /members/me/blocks 수신 — 닉네임 null 방어 + 로컬 목 차단 병행 노출', async () => {
    await adapter.blockUser({ id: 'u2', nickname: '목시드', nationality: 'JP' }); // 로컬만
    api.get.mockResolvedValueOnce([{ memberId: 42, nickname: null, profileImageUrl: null }]);
    const list = await adapter.fetchBlockedUsers();
    expect(list).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '42', nickname: null, nationality: null }),
      expect.objectContaining({ id: 'u2', nickname: '목시드' }),
    ]));
  });

  it('빈 응답/널 방어', async () => {
    api.get.mockResolvedValueOnce(undefined);
    await expect(adapter.fetchBlockedUsers()).resolves.toEqual([]);
  });
});

/** 로컬 스토어 차단 목록 — 플래그 on이라 fetchBlockedUsers는 BE 경유이므로 스토어 직접 조회. */
async function adapterLocalBlocked() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const store = require('../store') as typeof import('../store');
  return store.blockedUsers();
}
