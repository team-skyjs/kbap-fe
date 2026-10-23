# KB-870 / P-528 OTA2 — 선택 공개

사용자 검수 완료 및 공개 승인: “켜고 걍 내보내면되는딩 내가 검수 다했음”(2026-10-23, 커맨드센터 원문 확인). 이는 새 후보/OS별 기술 검증을 실행했다는 기록이 아니다. 기존 P524/P527/OTA1 OFF 단계 이력은 보존한다.

- `curationEnabled`, `idolPicksEnabled`, `avoidGroupCodesEnabled`만 true. production 및 prod 연결 teamtest에 적용하며 development 기존 공개도 유지한다.
- `processedFoodEnabled`, `packagedLabelScan`, `packagedReviewWrite`는 DEV_SERVER_CHANNEL 유지. prod 연결 채널에서는 OFF다. isDevServerChannel 및 리뷰 헤더는 바꾸지 않아 기본1.1 유지.
- 회피6 와이어/타일/레거시/프리셋 87개, 기존1기반 카탈로그 위치, 견과 알레르기 폴백의 NUTS 제외를 함께 검증한다. 새 false-safe 로직 없음.
- BEprod. 카피/디자인/API/네이티브 변경 없음. PR342/339/187은 범위 밖.

## 머지·발행 선행조건

아래 세 기능의 운영 선행조건을 모두 센터가 확인하기 전 **develop 머지 금지**. develop 머지 자체가 prod 연결 teamtest 자동 OTA를 발행한다. 큐레이션 GET만으로 나머지 두 기능의 계약까지 통과 처리하지 않는다.

| 기능 | 운영 근거 / 남은 게이트 |
|---|---|
| 서버 기반 | release26.10.5 main `a0a7df4cd178523dd7c2a7dd86c5cf98d7227e6c`, API20·batch18 HEALTHY/Flyway7개 성공. spec `bridge/ops/2026-10-23-approved-release-sequence.md` 16:31 기록(센터/서버 보고) |
| K-pop | **16:57:26 KST FE 공개HTTP 재확인:** `GET https://prod.kbap.site/api/foods/idol-picks?lang=en`, X-API-Version1.1 → HTTP200/success=true/items25. 이전 OTA1의 prod400 메모는 서버467 배포 전 기록이며 현재 응답과 다름 |
| 회피 카탈로그 | 같은 시각 FE `GET /api/ingredients?lang=en`, 1.0 → HTTP200/success=true/87행, NUTS·CRUSTACEAN·MOLLUSK·MEAT·LAMB·MEAT_BROTH 전부 존재. 10언어 이름·이미지 확인은 기존 센터/서버 보고이며 이번 영어GET 검증과 구분 |
| 회원 저장 | **사용자 실기 확인 완료(회원12).** 아래 절차를 안내한 뒤 사용자가 “아 응 고고 됨 발행해”로 확인하고 발행을 지시했다. 이는 에이전트 PATCH HTTP 로그가 아닌 사용자 실기 근거다. 안내한 절차: 정상 회원 인증으로 `GET /members/me/profile` → 기존 회피/식단 기록 → 기존 값과 6코드 합집합을 `PATCH /members/me/profile`(X-API-Version1.1) → GET에서 6코드 및 기존 값·식단 보존 → 원래 회피 목록만 PATCH → GET 원복 확인. nickname/국적/식단 등 무관 필드 미전송. 저장·원복 실패 시 중단 보고. 실사용 계정 임의 변경/토큰 추출/관리자 토큰의 회원 대용/DB 직접 변경 금지 |
| 큐레이션 | **사용자 이관 및 센터 공개 검증 완료.** prod sectionVersion1, 3모음 각10항목/10언어·문서SHA 일치·79READY. 10언어 공개 GET에서 30곳/76갤러리 사진·출처가 dev와 동일하고 fallback 없음. 표지 포함79개 공개사진 HEAD200 image/* |

회원 저장의 필요한 접근은 prod 테스트 회원 지정과 정상 앱 로그인 가능 경로 또는 담당자의 동일 회원 API 실행 근거다. 회원12 지정·설정 변경과 원복 범위는 사용자 승인됐고, 위 구체 절차에 대한 사용자 실기 확인을 수신했다. 사용자 일괄 검수완료 진술, dev 회원41의 PATCH 통과, mock 보존 회귀를 prod PATCH 왕복 PASS로 바꾸어 쓰지 않는다. FE 공개HTTP의 비밀값 없는 요약은 spec `bridge/ops/2026-10-23-ota2-prod-contract-gates.md`에 기록한다.

PR 생성/검증은 진행하며 자동 리뷰 재호출·다른 PR의 대기 예외 승계는 하지 않는다. P1 comment4357327876은 위 문서 보완과 실제 미검증 게이트 충족을 구분해 센터가 검토한다.

센터 검토/머지 → main 정상 릴리스 PR/리뷰 → clean pushed main → 양OS 실제 runtime/스토어 동결·중복 발행 검사 → --clear export/실행 launch bundle prod 호스트·3종 ON/PF3종 OFF/리뷰1.1 확인 → 승인된 production OTA2. 각 플랫폼 update/group/SHA/runtime 증거를 기록한다. production OTA1 c5cad2e3 재발행은 하지 않는다.
