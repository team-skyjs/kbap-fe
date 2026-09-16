# Contract: 알림함 앱 내부 계약 (훅 API · 화면 · 무효화 · i18n) · KB-499

2026-09-16 clarify 반영: 항목 탭 이동(`type`·`foodId`) · 게스트 = 로그인 Redirect · "모두 읽음" 제거 · zh 공백.

## 1. `src/lib/api/notificationAdapter.ts`

```ts
export interface NotificationWire {
  id: number; title: string; body: string; receivedAt: number; read: boolean;
  type?: string;                       // BE 확장분(dev 배포 대기) — 없으면 undefined
  foodId?: number | string | null;     // REVIEW_REMINDER만
}
export interface InboxItem {
  id: number; title: string; body: string; at: string /* ISO */; read: boolean;
  type?: string; foodId?: string;
}
export function toInboxItem(w: NotificationWire): InboxItem
```

- `at = new Date(receivedAt).toISOString()`; `receivedAt`이 유한수가 아니면 현재 시각.
- `type`은 그대로 통과(검증은 `routeForNotificationData`), `foodId`는 `w.foodId != null ? String(w.foodId) : undefined`.

## 2. `src/lib/data/useNotifications.ts`

```ts
export const NOTIFICATIONS_KEY = ['notifications'] as const;
export function fetchNotifications(): Promise<InboxItem[]>;              // GET /api/notifications → map(toInboxItem)
export function markNotificationRead(id: number): Promise<InboxItem>;   // PATCH /api/notifications/{id}/read
export function useInbox(): UseQueryResult<InboxItem[]>;                // enabled = useSession() === true, staleTime 0
export function useUnreadCount(): number;                               // select: read===false 개수, 비활성 = 0
export function useMarkRead(): UseMutationResult<InboxItem, unknown, number, Ctx>; // 낙관·롤백(세대 가드)·onSettled invalidate
export function invalidateNotifications(qc?: QueryClient): void;        // 공유 queryClient 기본
export function onPushTapped(notificationId?: number | string): Promise<void>; // hasBeSession() → PATCH(실패 무시) → invalidate
```

- `useMarkRead` 컨텍스트 `{ prev: InboxItem[] | undefined; gen: number }`. `onError`는 `gen === currentGen()`일 때만 `prev` 복원.
- `onPushTapped`는 `notificationId == null`이면 즉시 종료. 문자열 id는 `Number()`로 변환, NaN이면 종료.
- `useSubmitGuard` 미사용(멱등 낙관 토글 예외).

## 3. 배선 지점

| 파일 | 변경 |
|------|------|
| `src/app/(tabs)/index.tsx` · `(tabs)/food.tsx` · `src/features/community/ReviewFeed.tsx` | `import { useUnreadCount } from '@/lib/data/useNotifications'` (1줄) — `bellCount={unread}`·`onBell` 사용 무변 |
| `src/app/_layout.tsx` | AppState `active` 분기에 `invalidateNotifications()` · 탭 콜백 `(href, id) => { void onPushTapped(id); if (href) router.push(href) }` |
| `src/lib/push/pushAdapter.ts` | `record()` 본문 → `require('@/lib/data/useNotifications').invalidateNotifications()`; 유형 검사·`recordInboxNotification` 제거. `routeForNotificationData`·`isPushType` export 무변(알림함 항목 탭이 재사용) |
| `src/components/Skeleton.tsx` | `export function SkeletonInbox()` — `testID="skeleton-inbox"`, 행 3개(패딩 16 · 바 3줄 · 하단 헤어라인) |
| `src/lib/flags.ts` | `notificationCenter` 주석에서 "로컬 목(notifications/inbox.ts)" 문구 제거 |
| `src/components/AuthGateSheet.tsx` | **무변**(게이트 시트 사용 안 함) |

## 4. 화면 `src/app/notifications.tsx`

| 요소 | testID / 키 | 비고 |
|------|-------------|------|
| 플래그 게이트 | — | `!FLAGS.notificationCenter → <Redirect href="/" />` 유지 |
| 게스트 게이트 | — | `useIsGuest()` true → `<Redirect href={`/login?returnTo=${encodeURIComponent('/notifications')}`} />`. 목록·헤더 렌더 0 |
| 헤더 | `inbox.title` | trailing **없음**(`inbox-mark-all` 제거) |
| 스켈레톤 | `skeleton-inbox` | `isPending` |
| 에러 | `query-error-block` (공용) | `isError && !data`, `onRetry = refetch`, `onGoBack = router.back()` |
| 빈 상태 | `notif-empty` | 기존 인라인 센터 구조·리터럴 유지(`items.length === 0 && { flexGrow: 1 }`) |
| 행 | `inbox-${item.id}` | `title`(1줄) · `body`(2줄) · `timeAgo(item.at, t)` · `title` 스타일 리터럴 `fontSize: 15, fontWeight: '700'` 유지 |
| 미읽음 점 | `unread-${item.id}` | 고정 `dotSlot` 안. 읽음 행은 점 없음 |
| 탭 | — | `if (!item.read) markRead.mutate(item.id); const href = routeForNotificationData({ type: item.type, foodId: item.foodId }); if (href) router.push(href as Href);` — `type` 없음/미지 = 이동 없음 |

프레임 불변: 읽음/미읽음 행 flatten 스타일은 `backgroundColor` 외 전부 동일.

## 5. i18n (10로케일: ko en ja zh-Hans zh-Hant vi id th ru es)

- 제거 `inbox.*` 11키: `markAllRead helpfulTitle helpfulBody reminderTitle reminderBody scanSuggestionTitle scanSuggestionBody newsTitle newsBody mealTimeTitle mealTimeBody`
- 변경 ko `community.justNow`: "방금" → "방금 전"
- 변경 zh-Hans·zh-Hant `reviews.daysAgo`: "{{count}} 天前" → "{{count}}天前"
- 신설 없음. 재사용(무변): `community.minsAgo` `community.hoursAgo` `reviews.daysAgo`(그 외 8로케일) `inbox.title` `inbox.empty` `inbox.newBadge`

## 6. 소스 잠금(SC-007)

`src/` 전체에서 `notifications/inbox` · `kbap.inbox` · `recordInboxNotification` · `markAllInboxRead` 문자열 0 (테스트 파일 포함). `src/app/notifications.tsx`에 `AuthGateSheet`·`inbox-mark-all`·`relativeDate` 부재, `routeForNotificationData`·`timeAgo` 존재.
