# Contract — KB-836 (01_cto_plan.md "API 계약" 절 그대로)

공통: 경로 무버전 `/api/...`, `X-API-Version` 필수, 봉투 `{ success, payload, message, code }`(FE client 가 payload 만 반환). 신규 경로 없음.

| ID | 메서드 경로 | X-API-Version | 응답 payload 변경 | 에러 |
|----|------------|---------------|------------------|------|
| C-1 | `GET /api/home?lang={lang}` | FE `HOME_API_VERSION = '1.4'`. 1.3 이하 = 키 부재 | `idolPickFoods: FoodSummaryResponse[]`(0~N, 화제성 순) — 항목 모양 = `popularFoods` | `COMMON-002`·400(헤더·lang 누락, 1.4 모르는 구 서버) |
| C-2 | `GET /api/foods/{foodId}?lang={lang}` | 기본 1.1, 버전 분기 없음 | `idolVideo: { url, platform: "YOUTUBE" \| "TIKTOK" } \| null` — 키 항상 존재 | 기존 그대로 |

## C-1 예시 (1.4, 비회원)

```json
{ "success": true, "payload": { "authenticated": false, "avoidedSubstances": [], "popularFoods": [], "mostReviewedFoods": [], "recentScans": [], "topRatedFoods": [],
  "idolPickFoods": [
    { "foodId": 491, "name": "Fried Chicken", "koreanName": "후라이드치킨", "imageRef": "https://cdn.example/foods/491.webp", "spiciness": 0, "overallRiskStatus": "SAFE", "publishedAt": "2026-09-02T03:00:00Z", "bookmarked": false, "review": { "averageRating": 4.5, "count": 12 } },
    { "foodId": 5, "name": "Samgyeopsal", "koreanName": "삼겹살", "imageRef": null, "spiciness": 0, "overallRiskStatus": "SAFE", "publishedAt": "2026-08-21T03:00:00Z", "bookmarked": false, "review": { "averageRating": 0.0, "count": 0 } }
  ] }, "message": null, "code": null }
```

## C-2 예시 (발췌)

```json
{ "success": true, "payload": { "name": "Tteokbokki", "koreanName": "떡볶이", "...": "기존 필드 무변",
  "idolVideo": { "url": "https://www.youtube.com/watch?v=4gTHQqAKNA8", "platform": "YOUTUBE" } }, "message": null, "code": null }
```

매핑 없는 음식: `"idolVideo": null`. `idolVideo` 키 집합 = `url, platform` 정확히.

## FE 어댑트

- C-1 → `HomeResponse.idolPicks = (idolPickFoods ?? []).map(adaptMenuSummary)`
- C-2 → `FoodDetail.idolVideo = adaptIdolVideo(idolVideo)` — `YOUTUBE → youtube`, `TIKTOK → tiktok`, 그 밖·빈 url → `null`
