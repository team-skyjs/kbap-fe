# Data Model — 010-home-idol-kfood-section

## IdolPicksWire (서버 → 어댑터, C-1)

`{ items: IdolPickWire[] }` — `IdolPickWire = MenuSummaryWire & { video: { url, platform: "YOUTUBE" | "TIKTOK" } }`(평탄).

## IdolPick (화면 모델)

`FoodCard & { video: IdolVideo }` — 요약은 `adaptMenuSummary`. 순서 = 서버(화제성↓ → 게시월↓ → foodId↑). items 부재·null → `[]`.

## IdolVideo

`{ url: string; platform: 'youtube' | 'tiktok' }` — 알 수 없는 platform·빈 url 항목은 목록에서 제외.

## 쿼리

- `['idolPicks', lang]` — `useIdolPicks()`(목록) · `useIdolPickVideo(foodId)`(상세, enabled:false)

## 계측

- `HomeSection` += `'idol_pick'`
- `home_idol_pick_list_view`: `count`
- `food_idol_video_open`: `food_id`, `platform`, `video_position`
- `food_detail_view.source` += `idol_pick`
