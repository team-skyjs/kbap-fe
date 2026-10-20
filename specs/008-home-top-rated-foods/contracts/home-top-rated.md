# Contract: GET /api/home — X-API-Version 1.3 (KB-800)

> 01_cto_plan.md "API 계약" 절을 그대로 옮김(정본은 cto 계획). FE 와이어 타입 `TopRatedFoodWire` 의 정본.


공통: `GET /api/home?lang={lang}` · 인증 선택(`Authorization: Bearer …`) · 응답 래퍼 `BaseResponse`. 엔드포인트·요청 파라미터는 무변, **`X-API-Version` 값으로만 분기**.

| ID | 메서드 경로 | X-API-Version | 요청(JSON 예) | 응답(JSON 예, 필드 전부) | 에러(code·HTTP) |
|----|------------|---------------|---------------|--------------------------|-----------------|
| C-01 (R-01~05) | `GET /api/home?lang=en` | **`1.3`** (신규) | 바디 없음. 헤더 `X-API-Version: 1.3`, 선택 `Authorization: Bearer {accessToken}` | 아래 **C-01 응답** | `lang` 누락·공백 → 400 `COMMON-002` · 토큰 위조/만료 → 401 `AUTH-003`/`AUTH-004` · 미등록 버전 → 400(기존 Spring 버전 검증 그대로) |
| C-02 (R-04) | `GET /api/home?lang=en` | `1.2` 이하 (기존) | 동일 | 기존 응답 그대로 — `authenticated`·`avoidedSubstances`·`popularFoods`·`mostReviewedFoods`·`recentScans` 다섯 키만. **`topRatedFoods` 키 없음** | 기존과 동일 |

**C-01 응답** (회원 예시 — 비회원이면 `authenticated:false`, `avoidedSubstances:[]`, `recentScans:[]`, 각 항목 `bookmarked:false`, `topRatedFoods` 는 같은 목록):

```json
{
  "success": true,
  "payload": {
    "authenticated": true,
    "avoidedSubstances": [
      { "code": "EGG", "name": "Egg" }
    ],
    "popularFoods": [
      {
        "foodId": 101,
        "name": "Bibimbap",
        "koreanName": "비빔밥",
        "imageRef": "https://img.kbap.app/foods/101.jpg",
        "spiciness": 2,
        "overallRiskStatus": "CAUTION",
        "publishedAt": "2026-09-01T03:00:00Z",
        "bookmarked": false,
        "review": { "averageRating": 4.5, "count": 12 }
      }
    ],
    "mostReviewedFoods": [
      {
        "foodId": 205,
        "name": "Kimchi Stew",
        "koreanName": "김치찌개",
        "imageRef": "https://img.kbap.app/foods/205.jpg",
        "spiciness": 6,
        "overallRiskStatus": "SAFE",
        "publishedAt": "2026-08-20T09:30:00Z",
        "bookmarked": true,
        "review": { "averageRating": 4.7, "count": 23 }
      }
    ],
    "recentScans": [
      {
        "foodId": 307,
        "name": "Tteokbokki",
        "koreanName": "떡볶이",
        "imageRef": null,
        "spiciness": 7,
        "overallRiskStatus": "DANGER",
        "publishedAt": null,
        "bookmarked": false,
        "review": { "averageRating": 0.0, "count": 0 },
        "scannedAt": "2026-10-15T03:15:00Z"
      }
    ],
    "topRatedFoods": [
      {
        "foodId": 205,
        "name": "Kimchi Stew",
        "koreanName": "김치찌개",
        "imageRef": "https://img.kbap.app/foods/205.jpg",
        "spiciness": 6,
        "overallRiskStatus": "SAFE",
        "publishedAt": "2026-08-20T09:30:00Z",
        "bookmarked": true,
        "review": { "averageRating": 4.7, "count": 23 },
        "taste": 4.7,
        "servingSpeed": 4.4,
        "staffKindness": 4.6,
        "overallRating": 4.6
      },
      {
        "foodId": 412,
        "name": "Japchae",
        "koreanName": "잡채",
        "imageRef": "https://img.kbap.app/foods/412.jpg",
        "spiciness": 0,
        "overallRiskStatus": "UNKNOWN",
        "publishedAt": "2026-09-12T00:00:00Z",
        "bookmarked": false,
        "review": { "averageRating": 4.0, "count": 3 },
        "taste": 4.0,
        "servingSpeed": null,
        "staffKindness": null,
        "overallRating": 4.0
      }
    ]
  },
  "message": null,
  "code": null
}
```

`topRatedFoods` 항목 필드 규칙 (FE 타입의 정본):

| 필드 | 타입 | null | 의미 |
|------|------|------|------|
| `foodId`·`name`·`koreanName`·`imageRef`·`spiciness`·`overallRiskStatus`·`publishedAt`·`bookmarked`·`review{averageRating,count}` | 기존 `FoodSummaryResponse` 와 동일 | 기존과 동일 | `review` 는 기존 `getFoodRatings` 값 그대로(`averageRating` = `rating` 평균, `count` = 활성 리뷰 수) |
| `taste` | number(소수 1자리) | 항상 값 | 활성 리뷰 `rating` 평균. 정의상 `review.averageRating` 과 같은 값 |
| `servingSpeed` | number \| null | 속도 입력(>0) 리뷰가 0건이면 null | 활성 리뷰 중 `serving_speed_rating > 0` 인 것만의 평균 |
| `staffKindness` | number \| null | 친절도 입력(>0) 리뷰가 0건이면 null | 활성 리뷰 중 `staff_kindness_rating > 0` 인 것만의 평균 |
| `overallRating` | number(소수 1자리) | 항상 값 | **null 이 아닌** 세 항목의 (반올림 전) 평균을 소수 1자리로 반올림. 예: 4.7·4.4·4.6 → 4.6 / 4.0·null·null → 4.0 |

- 배열 규칙: 1.3 이상에서 `topRatedFoods` 는 **null 을 내리지 않는다** — 결과가 없으면 `[]`.
- 정렬: `review.count` 내림차순 → `overallRating`(반올림 전 값) 내림차순 → `foodId` 내림차순. 최대 20개. 컷오프 없음.
- 반올림: 기존 `ReviewService.roundToFirstDecimal`(`Math.round(x*10)/10.0`, half-up) 과 동일.

