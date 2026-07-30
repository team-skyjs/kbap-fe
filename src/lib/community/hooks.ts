/**
 * community/hooks.ts — React Query 배선 (P-087). 데이터 접근은 전부 adapter 경유
 * (계약 배포 시 adapter만 스왑). 뮤테이션은 ['community'] 프리픽스 무효화 —
 * 목 스토어가 진실이라 재조회로 화면 갱신 (실 API와 동일 시맨틱).
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adapter from './adapter';
import type { CommunityAuthor, FoodTagRef, PlaceTagRef, Reaction, ReportReason, ReportTarget } from './types';

export function useCommunityFeed() {
  return useInfiniteQuery({
    queryKey: ['community', 'feed'],
    queryFn: ({ pageParam }) => adapter.fetchFeedPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : undefined),
  });
}

export function useCommunityPost(id: string) {
  return useQuery({
    queryKey: ['community', 'post', id],
    queryFn: () => adapter.fetchPost(id),
    enabled: !!id,
  });
}

export function useCommunityComments(postId: string) {
  return useQuery({
    queryKey: ['community', 'comments', postId],
    queryFn: () => adapter.fetchComments(postId),
    enabled: !!postId,
  });
}

export function useBlockedUsers() {
  return useQuery({ queryKey: ['community', 'blocked'], queryFn: adapter.fetchBlockedUsers });
}

function useInvalidateCommunity() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['community'] });
}

export function useCreatePost() {
  const invalidate = useInvalidateCommunity();
  return useMutation({
    mutationFn: (input: { body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }) =>
      adapter.createPost(input),
    onSuccess: invalidate,
  });
}

export function useUpdatePost() {
  const invalidate = useInvalidateCommunity();
  return useMutation({
    mutationFn: (input: { id: string; body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }) =>
      adapter.updatePost(input.id, input),
    onSuccess: invalidate,
  });
}

export function useDeletePost() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (id: string) => adapter.deletePost(id), onSuccess: invalidate });
}

export function useCreateComment() {
  const invalidate = useInvalidateCommunity();
  return useMutation({
    mutationFn: (input: { postId: string; parentId: string | null; mention: string | null; body: string }) =>
      adapter.createComment(input),
    onSuccess: invalidate,
  });
}

export function useUpdateComment() {
  const invalidate = useInvalidateCommunity();
  return useMutation({
    mutationFn: (input: { id: string; body: string }) => adapter.updateComment(input.id, input.body),
    onSuccess: invalidate,
  });
}

export function useDeleteComment() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (id: string) => adapter.deleteComment(id), onSuccess: invalidate });
}

export function useReact() {
  const invalidate = useInvalidateCommunity();
  return useMutation({
    mutationFn: (input: { target: 'post' | 'comment'; id: string; reaction: Exclude<Reaction, null> }) =>
      input.target === 'post' ? adapter.reactToPost(input.id, input.reaction) : adapter.reactToComment(input.id, input.reaction),
    onSuccess: invalidate,
  });
}

export function useSubmitReport() {
  return useMutation({
    mutationFn: (input: { target: ReportTarget; id: string; reason: ReportReason; note: string | null }) =>
      adapter.submitReport(input.target, input.id, input.reason, input.note),
  });
}

export function useBlockUser() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (author: CommunityAuthor) => adapter.blockUser(author), onSuccess: invalidate });
}

export function useUnblockUser() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (id: string) => adapter.unblockUser(id), onSuccess: invalidate });
}
