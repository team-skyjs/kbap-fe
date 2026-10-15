# Research — 008-home-top-rated-foods

- **R-1 FlatList 유지** — Decision: `Animated.FlatList` 를 그대로 두고 `data` 만 `topRated` 로. Rationale: 스티키 헤더 `onScroll` 워클릿·당겨서 새로고침·노출 계측 스크롤 props 가 걸려 있어 ScrollView 교체는 회귀 위험. Alternatives: ScrollView+map(20행이라 성능 무관하나 배선 재작업).
- **R-2 null 평점 표시** — Decision: `Stars value={v ?? 0}`(빈 별 = 기존 비활성 색) + 숫자 "—". Rationale: 계약상 속도·친절도 null 은 "입력 0건". 0.0 표기는 "최저점"으로 오독.
- **R-3 총평점 줄** — Decision: `overallRating` 사용(세부 평균), 리뷰 수는 `overall.count`(기존 `review.count`). null 이면 "—".
- **R-4 섹션 노출 노드** — Decision: 헤더를 감싼 View 에 `useImpressionRef('top_rated')`. 카드 노출은 행 `ref`.
- **R-5 CTA 내비** — Decision: `router.navigate('/scan')`(탭바 FAB 과 동일). 계측은 `Btn` testID 자동 `ui_click`.
- **R-6 구 홈 피드 테스트** — Decision: `homeFeed317` 의 피드 전용 케이스는 삭제하고 새 테스트(`homeTopRated800`)로 대체. 다른 테스트의 `useGlobalReviews`·`ModerationFlow` 목은 무해하나 홈이 더는 import 하지 않으므로 홈 전용 목은 정리.
