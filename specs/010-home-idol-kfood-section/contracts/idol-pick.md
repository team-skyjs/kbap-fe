# Contract — KB-836 (01_cto_plan.md "API 계약" C-1 그대로, 2026-10-21 ② 변경본)

공통: 경로 무버전 `/api/...`, `X-API-Version` 필수(이 경로는 값 무관 — FE 기본 1.1, 전용 헤더 없음), 봉투 `{ success, payload, message, code }`(FE client 가 payload 만 반환). **기존 홈·상세 API 는 바뀌지 않는다**(FE 홈 1.3 유지).

| ID | 메서드 경로 | X-API-Version | 요청 | 응답 payload | 에러 |
|----|------------|---------------|------|-------------|------|
| C-1 | `GET /api/foods/idol-picks?lang={lang}` | 필수, 값 무관 | `lang` 필수, `Authorization` 선택(있으면 회원 기준 위험도·북마크) | `{ items: IdolPickResponse[] }` — 항목 = FoodSummaryResponse 9키(평탄) + `video{url, platform: YOUTUBE\|TIKTOK}`(null 아님). 화제성 순. 0건 = `{ "items": [] }` | `COMMON-002`·400(lang·헤더 누락, 이 경로를 모르는 구 서버) |

## C-1 예시 (회원, 앞 2개)

```json
{ "success": true, "payload": { "items": [
  { "foodId": 491, "name": "Fried Chicken", "koreanName": "후라이드치킨", "imageRef": "https://cdn.example/foods/491.webp", "spiciness": 0, "overallRiskStatus": "CAUTION", "publishedAt": "2026-09-02T03:00:00Z", "bookmarked": true, "review": { "averageRating": 4.5, "count": 12 }, "video": { "url": "https://www.youtube.com/watch?v=KOvl7TcdK98", "platform": "YOUTUBE" } },
  { "foodId": 5, "name": "Samgyeopsal", "koreanName": "삼겹살", "imageRef": null, "spiciness": 0, "overallRiskStatus": "SAFE", "publishedAt": "2026-08-21T03:00:00Z", "bookmarked": false, "review": { "averageRating": 0.0, "count": 0 }, "video": { "url": "https://www.youtube.com/shorts/VS17PUpMtN0", "platform": "YOUTUBE" } }
] }, "message": null, "code": null }
```

항목 키 집합 = `foodId, name, koreanName, imageRef, spiciness, overallRiskStatus, publishedAt, bookmarked, review{averageRating,count}, video{url,platform}` 정확히.

## FE 어댑트

- `api.get('/foods/idol-picks?lang=…')` → `adaptIdolPicks` → `IdolPick[]` = `adaptMenuSummary(item)` + `video{url, platform 소문자}`. 알 수 없는 platform·빈 url 항목 제외.
- 상세 카드: `useIdolPickVideo(foodId)` = 같은 키 캐시에서 `find(foodId)?.video ?? null`.
