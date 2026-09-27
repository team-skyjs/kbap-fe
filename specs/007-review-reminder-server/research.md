# Research — 007 리뷰 리마인더 서버 전환

Technical Context에 NEEDS CLARIFICATION 없음(스택·의존성·테스트 전부 기존). 계약 정본 = 발주문(서버 PR #305) + dev Swagger. 아래는 설계 결정 9건.

## R-1. 로컬 예약 경로는 플래그 off가 아니라 삭제

- **Decision**: `pushAdapter.ts`의 "로컬 리뷰 유도 알림" 섹션(`REMINDERS_KEY`·`REVIEW_REMINDER_SECONDS`·`getReminderMap`·`setReminderMap`·`scheduleReviewReminder`·`cancelReviewReminder`)을 통째로 지우고 호출부 2곳(`FlippedOrderCard.tsx` done 탭·`review.tsx` 작성 성공)의 import·호출도 지운다. 10로케일 `push.reviewReminderTitle/Body`도 삭제(다른 사용처 0 — grep 확인).
- **Rationale**: 발주 "끕니다"의 최소 구현은 호출 삭제. 죽은 코드를 플래그 뒤에 남기면 다음 사람이 3am에 "이거 왜 안 울리지"를 추적한다. 서버가 같은 문구를 기기 언어로 만들어 보내므로 앱 문구 키도 존재 이유가 없다.
- **Alternatives**: `FLAGS.localReviewReminder=false` 유지 — 거부(재활성화 계획 없음, 서버 배치가 정본). 잔존 AsyncStorage 키 `kbap.push.reminders.v1` 부팅 시 삭제 — 거부(읽는 코드가 없으니 무해한 고아, 코드 1줄이라도 늘리지 않음).
- **Consequence**: 이전 버전이 기기에 남긴 예약은 최대 1회 발화한다(1시간 안). 그 data는 `{type:'REVIEW_REMINDER', foodId}`라 새 매핑에서 null → 이동 없음(스펙 US1-5, US3-2). 서버 배치와 겹치는 창은 앱 갱신 후 1시간뿐.

## R-2. orderId 검증 = 숫자 문자열 정규식 1줄, 정밀도는 문자열로 보존

- **Decision**: `case 'REVIEW_REMINDER': { const s = d.orderId == null ? '' : String(d.orderId); return /^\d+$/.test(s) ? `/profile/order/${s}` : null; }`.
- **Rationale**: 발주 "orderId는 숫자(64비트 정수)". JSON 파싱 단계에서 2^53 초과는 이미 정밀도를 잃지만 그건 플랫폼 한계(서버 id는 auto-increment라 현실적으로 도달 안 함). 문자열 `"12"`도 같은 경로(구 foodId 규약과 동일한 관용). `String(1e21)`="1e+21"·음수·소수·빈 값·객체는 정규식에 걸려 null → 오착지 금지(스펙 FR-001). `Number.isSafeInteger` 검사는 문자열 입력을 다시 파싱해야 해 더 길다.
- **Alternatives**: `Number(orderId)` 후 경로화 — 거부(큰 값 정밀도·"12abc"→NaN 처리 분기 필요). 별도 `parseOrderId` 헬퍼 — 거부(호출처 1곳).

## R-3. 알림함 항목은 `foodId`를 `orderId`로 교체(병존 아님)

- **Decision**: `NotificationWire.foodId` → `orderId?: number | string | null`, `InboxItem.foodId` → `orderId?: string`(`!= null`이면 `String()`), `notifications.tsx` `open()`은 `{ type, orderId }`를 넘긴다. 와이어 `foodId`는 타입에서도 지운다.
- **Rationale**: 발주 "foodId는 호환용으로 남지만 항상 null이므로 사용하지 않는다". 타입에 남기면 누군가 다시 읽는다. JSON에 필드가 와도 TS 타입에 없으면 무시될 뿐 깨지지 않는다. 구 응답(orderId 필드 없음)은 옵션 필드라 렌더 무해(스펙 엣지).
- **Alternatives**: 둘 다 두고 orderId 우선 — 거부(죽은 분기).

## R-4. nav 헬퍼·루트 배선·콜드 스타트는 무변

- **Decision**: `openNotificationRoute(router, '/profile/order/12')`는 기존 "그 외 = navigate" 분기를 탄다. `_layout.tsx` 탭 콜백·`addNotificationTapListener`·`bump()`·콜드 스타트 1회 전달 모두 손대지 않는다.
- **Rationale**: specs/005 R-2와 동일 — expo-router 56 `navigate`는 최상단이 같은 라우트면 params만 갱신(`profile/order/[id].tsx`는 `useLocalSearchParams` → `useOrderDetail(id)` 반응형). 같은 주문 재탭 = no-op, 다른 주문 = id 갱신(스펙 US1-3). 스택 리셋 대상은 홈뿐.
- **Verification**: 실기 D-3(주문 A 상세 위에서 주문 B 리마인더 탭).

## R-5. 주문 상세는 무변(B안, 2026-09-28 종한)

- **Decision**: `profile/order/[id].tsx` 코드 변경 0. 항목 행 탭 = 음식 상세(`ready===false`·`foodId==null` 비활성)는 이미 P-259로 구현돼 있고 음식 상세에 리뷰 작성 진입이 있다.
- **Rationale**: 발주 "자연스럽게 보이면 좋습니다"는 권고이고 현재 경로가 이미 발주의 `items[].foodId·ready` 규칙을 만족한다. 새 버튼 = 프레임 불변 유닛 + 10로케일 + 리뷰 화면 진입 파라미터 논의가 따라온다.
- **Consequence**: 스펙 US4는 회귀 확인만(기존 `myFoods253` 테스트 커버). 게스트·타 계정·삭제 주문은 `q.isError` 표면이 처리(착지 로직 무판단).

## R-6. Android 채널 무변

- **Decision**: `ensureChannels`(activity MAX · news HIGH, KB-498)는 그대로. 서버가 `channelId:'activity'`로 보낸다.
- **Rationale**: 발주 5번 명시. 로컬 예약이 쓰던 `channelId:'activity'`는 예약 코드와 함께 사라지지만 채널 자체는 HELPFUL이 쓴다.

## R-7. 테스트 갱신 범위

- **Decision**: 삭제된 export를 참조하는 테스트 7파일을 갱신하고, 재도입 방지용 삭제 잠금 유닛 1개를 신설한다(`reviewReminderServer500.test.ts`: 어댑터 소스 `scheduleNotificationAsync`·`cancelScheduledNotificationAsync`·`kbap.push.reminders` 0건 · 카드 소스 `scheduleReviewReminder` 0건 · 작성 화면 `cancelReviewReminder` 0건 · 10로케일 `push.reviewReminderTitle/Body` 부재). 매핑 테스트는 pushAdapter192에 5케이스로 교체(contracts §4).
- **Rationale**: `pushSurfaces192`·`orderHistory252`는 소스 잠금으로 예약 호출 **존재**를 단언하고 있어 그대로 두면 빨간불. 반대 방향 잠금이 이 변경의 회귀 지점(누군가 "왜 로컬 알림 없어졌지"로 복원)을 정확히 잡는다.
- **jest.mock 정리**: `modalSerialize267`·`reviewEditCompose521`은 존재하지 않는 export를 목으로 만들어도 통과하지만 죽은 줄이므로 함께 정리.

## R-8. 문서 갱신 범위

- **Decision**: specs/002(spec FR-002·data-model 표·로컬 리마인더 문단·contracts 표 3행), specs/004(data-model·contracts 2파일의 foodId 행), specs/005(data-model·contracts 리마인더 2행), PROGRESS.md 항목. 스펙 FR-012.
- **Rationale**: 세 명세가 "리마인더 = 음식 상세(foodId)"를 명시하고 있어 방치하면 다음 작업이 옛 계약을 읽는다.

## R-9. 배포·릴리스 동기(열린 항목)

- **Decision**: 코드는 JS 전용이라 OTA 가능하나, **로컬 예약 제거가 서버 배치 prod 활성화보다 먼저 기기에 도달**해야 중복 알림이 없다. 발주가 요구한 "릴리스 일정 회신"은 종한이 BE에 전달할 항목으로 PR 본문·PROGRESS에 명기하고, 배포 경로(OTA vs 네이티브)·시점은 예진 승인 후 지시를 따른다(production OTA 금지 메모리 9/11).
- **현재 기준**: app.json version 1.0.3, 최신 빌드 태그 `build-v1.0.3-b38.vc25`.
