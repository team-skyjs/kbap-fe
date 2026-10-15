# Data Model — 008-home-top-rated-foods

## TopRatedFoodWire (서버 → 어댑터)

`MenuSummaryWire` + `taste`·`servingSpeed`·`staffKindness`·`overallRating`: `number | null`(계약: taste·overallRating 은 항상 값이나 FE 는 null 방어).

## TopRatedFood (화면 모델)

`FoodCard` + 같은 네 필드(`number | null`). null 은 그대로 전달 — 화면이 빈 별 + "—".

## HomeResponse

`topRated: TopRatedFood[]` 추가. 와이어 부재·null → `[]`. 순서 = 서버 순서(리뷰 수↓ → 총평점↓ → foodId↓).

## HomeSection (계측)

`'popular' | 'saved' | 'food' | 'safe' | 'most_reviewed' | 'recent' | 'top_rated' | 'guest_cta'` — `reviews` 제거.
