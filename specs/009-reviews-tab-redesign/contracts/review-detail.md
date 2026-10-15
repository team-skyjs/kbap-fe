# Contract (cto 01_cto_plan.md C-1·C-2 그대로)

## C-1 `GET /api/reviews/{reviewId}?lang={lang}`
- 헤더 `Authorization` 선택(게스트 likedByMe=false). 응답 `data` = 목록 항목과 같은 `ReviewResponse`.
- 에러: `REVIEW-001`(400) 없음·삭제·차단 작성자·음식 삭제 / `COMMON-002`(400) / `AUTH-00x`(401).
- FE 는 HTTP 상태가 아니라 `ApiError.code` 로 분기. 4xx 는 재시도하지 않는다.

```json
{ "reviewId": 42, "rating": 5, "servingSpeed": 4, "staffKindness": 0,
  "content": "Broth was rich and the meat was tender.", "language": "en",
  "imageUrls": ["https://cdn.kbap.app/reviews/7/a.jpg"], "createdAt": 1760572800000,
  "author": { "memberId": 7, "nickname": "foodie", "profileImageUrl": null, "countryCode": "VN", "tier": "GOURMET", "level": 2, "score": 15 },
  "authorWithdrawn": false, "likeCount": 34, "likedByMe": true,
  "food": { "foodId": 1, "name": "Seolleongtang", "koreanName": "설렁탕", "imageUrl": "https://cdn.kbap.app/foods/1.jpg" },
  "place": null }
```

## C-2 `food.koreanName: string | null`
- 목록·`/me`·단건의 `food` 에 추가. lang=ko 이면 null. 구서버 = 필드 없음 → FE `foodNameKo = null`.

## FE 매핑
| wire | 내부 |
|---|---|
| `food.koreanName` | `Review.foodNameKo` (undefined/null → null) |
| C-1 응답 | `adaptReview` 그대로 |
