# Data Model

- `Review.foodNameKo?: string | null` — 음식 칩 부제. null = 부제 없음.
- 쿼리 키 `['reviews','detail',reviewId]` → `Review`. `['reviews','global',…]` 프리픽스와 분리(전역 피드 무효화가 상세를 건드리지 않음 — 작성·수정·삭제 무효화는 상세 프리픽스를 따로 건다).
