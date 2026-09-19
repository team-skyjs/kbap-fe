/**
 * useFeedback (P-394/KB-586) — 사용자 문의(피드백) 전송·조회.
 *
 * 계약: `specs/admin-rebuild/feedback-contract.md` §1~2.
 * - 인증 **선택**(게스트 포함). 식별 = `X-Installation-Id` 헤더 — 공용 client가 전 요청에
 *   이미 붙인다(신고·알림함과 같은 문법). **바디에 installationId를 넣지 않는다.**
 * - 사진은 기존 presigned 업로드 재사용(purpose=FEEDBACK). 게스트도 첨부 가능(9/18 예진 재확정).
 * - "내 문의" 조회는 서버가 installationId OR memberId로 매칭한다(게스트 → 가입 후에도 보인다).
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { uploadImage } from '@/lib/api/scanImage';
import { collectDeviceInfo } from '@/lib/deviceInfo';
// 와이어 변환은 어댑터 층에만 둔다(AGENTS.md 어댑터 격리 — Codex #170)
import { adaptFeedbackPage, type FeedbackPageWire } from '@/lib/api/feedbackAdapter';

export type { FeedbackItem, FeedbackReply, FeedbackStatus } from '@/lib/api/feedbackAdapter';
export { adaptFeedback } from '@/lib/api/feedbackAdapter';

export const FEEDBACK_IMAGE_PURPOSE = 'FEEDBACK';
export const FEEDBACK_MAX_PHOTOS = 3;
export const FEEDBACK_MAX_LEN = 2000;

/** 문의 전송 — 사진은 먼저 업로드해 path로 바꾼 뒤 한 번에 보낸다. */
export async function submitFeedback(input: { content: string; photoUris: string[] }): Promise<{ id: string }> {
  const paths: string[] = [];
  for (const uri of input.photoUris.slice(0, FEEDBACK_MAX_PHOTOS)) {
    const { path } = await uploadImage({ uri, width: 0, height: 0 }, FEEDBACK_IMAGE_PURPOSE);
    paths.push(path);
  }
  const payload = await api.post<{ id?: number | string }>('/api/feedbacks', {
    content: input.content,
    // 빈 배열도 보내지 않는다 — 계약상 선택 필드(서버가 "없음"과 "빈 값"을 구분할 이유를 만들지 않는다)
    ...(paths.length ? { imagePaths: paths } : {}),
    deviceInfo: collectDeviceInfo(),
  });
  return { id: String(payload?.id ?? '') };
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitFeedback,
    // 보낸 문의가 "내 문의"에 바로 보이도록 — 서버 재조회가 정본(낙관 삽입 없음)
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['feedbacks', 'me'] }),
  });
}

export function useMyFeedbacks(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['feedbacks', 'me'],
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const q = pageParam ? `?cursor=${encodeURIComponent(pageParam)}&size=20` : '?size=20';
      const wire = await api.get<FeedbackPageWire>(`/api/feedbacks/me${q}`);
      return adaptFeedbackPage(wire);
    },
    getNextPageParam: (last) => last.nextCursor,
    select: (data) => ({ ...data, flat: data.pages.flatMap((p) => p.items) }),
  });
}
