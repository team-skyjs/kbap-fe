/**
 * useChat (KB-1008) — 운영진 1:1 채팅(S-971 계약 v0). 식별 = 로그인 JWT 또는 게스트 X-Installation-Id
 * (공용 client가 이미 붙인다 — 기존 문의와 같은 헤더). 사진 = 기존 문의 업로드(purpose FEEDBACK) 재사용.
 * - 메시지: 커서(before) 페이지, 열려 있는 동안 5초 폴링(화면이 active 전달)
 * - 읽음: 조회로는 안 된다 — 화면이 열려 있고 맨 아래를 볼 때만 markChatRead
 * - 안읽음: FAB 빨간 점·미리보기(탭 화면이 보일 때 30초 주기)
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { uploadImage } from '@/lib/api/scanImage';
import { UploadAbortedError } from '@/lib/api/uploadAbort';
import { adaptChatMessage, adaptChatPage, adaptChatUnread, type ChatMessage, type ChatMessageWire, type ChatPageWire, type ChatUnreadWire } from '@/lib/api/chatAdapter';
import { currentGen } from '@/lib/auth/beTokens';
import { queryClient as sharedQueryClient } from '@/lib/queryClient';
import { useAppActive } from '@/lib/useAppActive';
import { collectDeviceInfo } from '@/lib/deviceInfo';
import { FEEDBACK_IMAGE_PURPOSE, FEEDBACK_MAX_LEN, FEEDBACK_MAX_PHOTOS } from './useFeedback';

export type { ChatMessage, ChatUnread } from '@/lib/api/chatAdapter';

/** S-971: 채팅 엔드포인트 버전 */
export const CHAT_API_VERSION = '1.0';
const H = { headers: { 'X-API-Version': CHAT_API_VERSION } };
export const CHAT_POLL_MS = 5000;
export const CHAT_UNREAD_POLL_MS = 30_000;
export const CHAT_PAGE_SIZE = 30;
export const CHAT_MAX_LEN = FEEDBACK_MAX_LEN; // 1~2000
export const CHAT_MAX_PHOTOS = FEEDBACK_MAX_PHOTOS; // 3
export const CHAT_KEYS = { messages: ['chat', 'messages'] as const, unread: ['chat', 'unread'] as const };

/** 11/6 운영 실기: 앱이 켜진 채 운영진 채팅 푸시가 오면 FAB 미리보기가 옛 메시지에 머묾(30초 폴링뿐) → 푸시 수신 즉시 안읽음·메시지 재조회.
 *  접두 ['chat'] = unread + messages(채팅 화면이 열려 있으면 새 말풍선이 바로 붙는다). 관찰자 없는 키는 표시만 stale. */
export function invalidateChat(qc = sharedQueryClient): void {
  void qc.invalidateQueries({ queryKey: ['chat'] });
}

/** 세션 경계(로그아웃·계정 전환 = 세대 bump) 뒤에 도착한 옛 응답은 버린다 — queryClient.clear()는 진행 중 요청을 취소하지 않아
 *  이전 사람의 대화가 새 세션 캐시에 내려앉을 수 있다(useMe·useNotifications와 같은 currentGen 규칙) */
export class ChatSessionChangedError extends Error {}
async function sameSession<T>(req: () => Promise<T>): Promise<T> {
  const gen = currentGen();
  const out = await req();
  if (currentGen() !== gen) throw new ChatSessionChangedError('session changed');
  return out;
}

export function useChatMessages(active: boolean) {
  return useInfiniteQuery({
    queryKey: CHAT_KEYS.messages,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const q = `?limit=${CHAT_PAGE_SIZE}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`;
      return adaptChatPage(await sameSession(() => api.get<ChatPageWire>(`/api/chat/messages${q}`, H)));
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // ponytail: 폴링은 불러온 페이지 전부를 다시 부른다(TanStack infinite 기본) — 지난 이력을 여러 장 넘긴 경우만 무거움, 문제 되면 첫 장만 재조회로
    refetchInterval: active ? CHAT_POLL_MS : false,
    select: (d) => ({ ...d, flat: d.pages.flatMap((p) => p.items) }),
  });
}

/** 보내기 — 사진은 먼저 업로드해 path로 바꾼 뒤 한 번에(방은 서버가 자동 생성) */
export async function sendChatMessage(input: { content: string; photoUris: string[]; signal?: AbortSignal }): Promise<ChatMessage> {
  const paths: string[] = [];
  for (const uri of input.photoUris.slice(0, CHAT_MAX_PHOTOS)) {
    const { path } = await uploadImage({ uri, width: 0, height: 0 }, FEEDBACK_IMAGE_PURPOSE, { signal: input.signal });
    paths.push(path);
  }
  if (input.signal?.aborted) throw new UploadAbortedError();
  // deviceInfo = 문의와 같은 허용 키 수집 재사용(어드민 국가·언어 표시 — S-971 확정)
  const w = await api.post<ChatMessageWire>('/api/chat/messages', { content: input.content, ...(paths.length ? { imagePaths: paths } : {}), deviceInfo: collectDeviceInfo() }, H);
  return adaptChatMessage(w);
}

export function useSendChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendChatMessage,
    // 서버 재조회가 정본 — 화면은 재조회가 끝날 때까지 보낸 말풍선을 '보내는 중'으로 들고 있다
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAT_KEYS.messages }),
  });
}

export async function markChatRead(lastMessageId: string): Promise<void> {
  // int64 id = 문자열 그대로(정밀도 보존 — 서버 Long은 숫자 문자열을 받는다, REVIEW_REMINDER orderId와 같은 규칙)
  await api.post('/api/chat/read', { lastMessageId }, H);
}

export function useChatUnread(enabled: boolean) {
  // 백그라운드 = 조회·폴링 멈춤(RN엔 창 포커스가 없어 refetchInterval이 백그라운드에서도 돈다) → 전경 복귀(enabled false→true) 때
  // staleTime 0이라 1회 재조회. 탭 포커스 복귀도 같은 경로.
  const appActive = useAppActive(); // 조건부 호출 금지 — 항상 먼저
  const on = enabled && appActive;
  return useQuery({
    queryKey: CHAT_KEYS.unread,
    enabled: on,
    staleTime: 0,
    queryFn: async () => adaptChatUnread(await sameSession(() => api.get<ChatUnreadWire>('/api/chat/unread', H))),
    refetchInterval: on ? CHAT_UNREAD_POLL_MS : false,
  });
}
