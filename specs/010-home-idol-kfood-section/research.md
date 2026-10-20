# Research — 010-home-idol-kfood-section

- **R-1 목록 데이터** — Decision: `useHome()` 재사용(D2). Rationale: 캐시 히트면 요청 0, 위험도·북마크·무효화 경로 공유. Alternatives: 별도 엔드포인트(계약에 없음).
- **R-2 사진 폴백** — Decision: `IdolPhoto` = `RemoteImage`(Shimmer) + `onError`/URL 없음 → 바탕 + IconQuestion. Rationale: RemoteImage 는 실패 렌더를 호출부에 맡긴다. `CardPhoto` 기본 이미지는 시안의 물음표 폴백과 다르다.
- **R-3 눌림 표현** — Decision: Pressable children 함수의 `pressed` 로 항상 마운트된 오버레이의 opacity 0↔1, CTA bg primary↔primaryPress. Rationale: 조건부 마운트는 노드 수가 바뀌어 "색만" 원칙 위반 소지.
- **R-4 배너 클릭 id** — Decision: `trackHomeCardClick(section, position, id?)` — id 없으면 `{section, position}`(D4). 기존 호출 무변.
- **R-5 이벤트 이름** — Decision: `home_idol_pick_list_view`·`food_idol_video_open`. Rationale: analyticsNaming215 도메인 접두 잠금. 선례 KB-832 `home_curation_gallery_open`.
- **R-6 로딩 판정** — Decision: 배너 `loading = isPending`, 데이터 없을 때만 Shimmer. `isLoading` 이면 홈 전체 SkeletonHome 이 헤더를 대체해 배너는 렌더되지 않는다.
- **R-7 StatusBar** — Decision: 목록 화면 포커스 중에만 `<StatusBar style="light" />`(scan.tsx 선례). 루트의 dark 는 블러 후 복귀.
