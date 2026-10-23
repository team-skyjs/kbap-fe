# KB-870 / P-528 OTA2 — 선택 공개

사용자 검수 완료 및 공개 승인: “켜고 걍 내보내면되는딩 내가 검수 다했음”(2026-10-23, 커맨드센터 원문 확인). 이는 새 후보/OS별 기술 검증을 실행했다는 기록이 아니다. 기존 P524/P527/OTA1 OFF 단계 이력은 보존한다.

- `curationEnabled`, `idolPicksEnabled`, `avoidGroupCodesEnabled`만 true. production 및 prod 연결 teamtest에 적용하며 development 기존 공개도 유지한다.
- `processedFoodEnabled`, `packagedLabelScan`, `packagedReviewWrite`는 DEV_SERVER_CHANNEL 유지. prod 연결 채널에서는 OFF다. isDevServerChannel 및 리뷰 헤더는 바꾸지 않아 기본1.1 유지.
- 회피6 와이어/타일/레거시/프리셋 87개, 기존1기반 카탈로그 위치, 견과 알레르기 폴백의 NUTS 제외를 함께 검증한다. 새 false-safe 로직 없음.
- BEprod. 카피/디자인/API/네이티브 변경 없음. PR342/339/187은 범위 밖.

## 머지·발행 선행조건

운영 큐레이션 정식 게시 및 공개 GET 성공을 센터가 확인하기 전 **develop 머지 금지**. develop 머지 자체가 prod 연결 teamtest 자동 OTA를 발행한다. PR 생성/검증은 진행하며 자동 리뷰 재호출·다른 PR의 대기 예외 승계는 하지 않는다.

센터 검토/머지 → main 정상 릴리스 PR/리뷰 → clean pushed main → 양OS 실제 runtime/스토어 동결·중복 발행 검사 → --clear export/실행 launch bundle prod 호스트·3종 ON/PF3종 OFF/리뷰1.1 확인 → 승인된 production OTA2. 각 플랫폼 update/group/SHA/runtime 증거를 기록한다. production OTA1 c5cad2e3 재발행은 하지 않는다.
