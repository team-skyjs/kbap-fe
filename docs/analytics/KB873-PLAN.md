# KB-873 / P-526 단위 계획 · 2026-10-23

기준 develop4d38fb19. A/B/C 감사 전문·CSV·독립 검토를 대조했다. CSV167/943/138행은 중복 구문으로 고유 행동 분모가 아니다. 원문 CSV는 spec/bridge/ops/amplitude-coverage-2026-10-23에 보존한다. 현재 코드와 감사 기준 동일. PR339 b9c54ed4/PR187 994b7281 미머지·이 작업에 합치지 않음.

1. foundation(이번 PR): 새 schema2 이벤트 계약·값 검증, 주입 clock 기반 방문/가시구간 delta·연속 노출·스크롤 집계. 아직 runtime 호출자 없음. 기반 테스트는 실수신 아님.
2. lifecycle: 루트 focus/content identity·5내비게이션·foreground·session boundary·모달/외부앱 가림 연결. 기존 screen_view/app_tab_view 의미 보존. runtime context(OS/app/build/channel/BE/update/runtime)는 실제 설정에서 해석, 미확인은 unknown. 계정 경계는 이전 버퍼를 폐기.
3. discovery: A의 홈·Food·검색·저장·Kpop·큐레이션 전체 스크롤 영역/카드/배너·장소, 검색 북마크·요청 결과 연결. 기존 home 노출 정의는 변경하지 않음.
4. reviews: C의 카드·본문·사진·도움·편집/삭제/신고/차단 결과·취소와 B/C 교차19행, MyFoods source 보완. ui_click과 domain 합산 금지.
5. scan-account: B 스캔/주문/계정/온보딩/법적/알림·광고·native picker/Alert/gesture 결과. charged unknown은 새schema 결과로 명시, 개인 원문/회피 선택값 미수집.
6. PR339 전용 후속: 원 PR 검토/통합 순서에 맞춰 새 후보화면/label 결과·unknown 연결. 별도 의존행 유지, 운영 OFF·리뷰 버전 유지.
7. closure: 전 CSV의 고유route/surface/action manifest 최종화, 기능OFF/타PR/기기대기 이유별 추적. 양OS 실수신은 기존 승인 테스트경로/커맨드센터 협조로 검증. 5~10분 여정량·bytes·타이머·성능·중복 및 분석가이드. 새키/설정/QA세션 호출 없음.

모든 후속 단위는 KB873 범위이며 번호순 진행. 첫 PR만으로 전표면 완료·수신완료·production 공개를 선언하지 않는다. 완료/머지/배포는 리뷰어, 구현자는 진행중/검토중까지만. active sprint 없음(보드2): 종료sprint 재사용/새sprint 시작 없음.

KB873-AUDIT-TRACKING.csv는A/B/C 원문1248개구문행을hash+원문행번호로보존한작업대장이다. 모두pending_normalization_and_wiring이며기반구현으로기존행을완료처리하지않는다. 최종고유행동manifest는화면연결단위에서부모위임/상태/버전중복을확인하며정규화한다. rowsum은고유버튼수/coverage아님.
