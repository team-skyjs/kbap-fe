# Data Model — 010-home-idol-kfood-section

## HomeWire.idolPickFoods (서버 → 어댑터)

`MenuSummaryWire[] | null | 부재` — 항목 키 = `foodId, name, koreanName, imageRef, spiciness, overallRiskStatus, publishedAt, bookmarked, review`(popularFoods 와 동일).

## HomeResponse.idolPicks (화면 모델)

`FoodCard[]` — `adaptMenuSummary`. 부재·null → `[]`. 순서 = 서버(화제성↓ → 게시월↓ → foodId↑).

## FoodDetailWire.idolVideo

`{ url: string; platform: string } | null | 부재`.

## IdolVideo / FoodDetail.idolVideo

`{ url: string; platform: 'youtube' | 'tiktok' } | null` — 알 수 없는 platform·빈 url → null.

## 계측

- `HomeSection` += `'idol_pick'`
- `home_idol_pick_list_view`: `count`
- `food_idol_video_open`: `food_id`, `platform`, `video_position`
- `food_detail_view.source` += `idol_pick`
