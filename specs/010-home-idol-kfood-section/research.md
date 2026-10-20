# Research — 010-home-idol-kfood-section

- **R-1 목록 데이터** — Decision: 전용 쿼리 `useIdolPicks`(D2, 사용자 결정). Alternatives(폐기): 홈 1.4 `idolPickFoods` 재사용 — 기존 API 에 섞지 않기로 결정.
- **R-2 상세 카드 데이터** — Decision: `useIdolPickVideo` = 같은 queryKey·queryFn + `enabled:false`(캐시 구독만, D3). Rationale: 상세 API 무변경 + 상세 진입 시 목록 요청 0. 캐시가 나중에 채워지면 옵저버가 갱신된다. 한계: 직진입·캐시 만료 시 카드 없음(가정에 기록).
- **R-3 배너 사진** — Decision: 번들 `assets/images/dishes/dish-01·02·03.jpg` 를 RN `Image` 로(login.tsx 선례, 용량 증가 0). 인물 확인: 01·02·03 음식만, 04 는 배경 인물이라 제외.
- **R-4 포스터 사진 폴백** — Decision: `IdolPhoto` = `RemoteImage`(Shimmer) + `onError`/URL 없음 → ink + IconQuestion. RemoteImage 는 실패 렌더를 호출부에 맡긴다.
- **R-5 눌림 표현** — Decision: Pressable children 함수의 `pressed` 로 항상 마운트된 오버레이 opacity 0↔1, CTA bg primary↔primaryPress. 조건부 마운트는 노드 수가 바뀌어 "색만" 원칙 위반 소지.
- **R-6 배너 클릭 id** — Decision: `trackHomeCardClick(section, position, id?)` — id 없으면 `{section, position}`(D4). 기존 호출 무변.
- **R-7 이벤트 이름** — Decision: `home_idol_pick_list_view`·`food_idol_video_open`(analyticsNaming215 도메인 접두 잠금, cto 승인).
- **R-8 위험도 배지 노출** — Decision: `useIsGuest() === false`(R-07). 위험도 값 자체는 서버 요약.
- **R-9 무효화** — Decision: 추가 코드 없음. 기피 성분 변경 시 `useMe` 의 `qc.invalidateQueries()` 전면 무효화가 `['idolPicks', lang]` 도 덮는다 — 소스 잠금 + QueryClient 유닛.
- **R-10 StatusBar** — Decision: 목록 화면 포커스 중에만 `<StatusBar style="light" />`(scan.tsx 선례).
