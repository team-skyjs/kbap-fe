# KB-870 / P-527·P-528 teamtest prod 및 OTA2 공개

2026-10-23 사용자 승인: 기존 TestFlight teamtest 설치본 전체를 prod API·production 제품 플래그로 전환한다. 별도 채널·새 빌드·마케팅 버전 변경·스토어 제출은 하지 않는다. 이 문단은 P-527 당시 승인 범위다. 이후 P-528에서 사용자가 K-pop·큐레이션·회피6의 선택 공개와 production OTA2를 승인했다. 아래 표는 OTA2 코드 기준이며 실제 발행 완료 여부는 배포 기록으로 확인한다.

`src/lib/teamtest-target.json`의 backend를 정본으로 사용한다. 현재 prod다. flags.ts는 teamtest의 개발 기능 게이트만 이 값을 따른다. development/local 경로는 기존대로 유지하며 가공식품은 prod 연결 채널에서 숨긴다. OTA2의 K-pop·큐레이션·회피6은 채널과 무관하게 ON이다. unknown target은 teamtest 개발 기능을 열지 않으며 발행 스크립트는 실패한다.

| 항목 | teamtest 현재 | production |
|---|---|---|
| BE | prod | prod |
| PF 목록/상세/스캔·성분표·리뷰 쓰기 | OFF | OFF |
| K-pop·큐레이션·회피 묶음6종 | ON | ON |
| 전역·내 리뷰 읽기 | 기본1.1 | 기본1.1 |
| 제품 FLAGS 전체 | production과 동일 | 기준 |
| 진단·AdMob·Sentry·OTA 적용 정책 | 기존 내부 테스트 정책(데모 광고·진단·Sentry dev) | 운영 정책 |

자동 workflow는 export와 publish 양쪽에서 같은 정본으로 BE를 결정한다. `scripts/teamtest-target.mjs`는 eas.json의 build.teamtest env/channel도 정본과 일치하는지 검사한다. 정본을 dev로 되돌리는 경우에는 build profile도 일치시켜야 한다. 불일치·unknown·대상 호스트0·반대 호스트 잔존이면 발행을 막는다. export 후와 publish 직전 모두 호스트를 검사한다. 기존 clear 캐시·플랫폼별 지문·연속 develop push 직렬화는 유지한다.

코드는 개발 기능을 삭제하지 않는다. target=dev의 실모듈 회귀가 개발 기능 복원 가능성을 검사한다. 현재 요청에서는 prod 리허설을 선택했으므로 이후 develop 자동 OTA가 종전의 dev BE로 덮어쓰지 않는다.

새 버전·native 입력 변경은 없다. 양OS 실제 지문은 iOS9ee06892b67f66f1ea72c0bc5725eb853442df11 / Android05ba070d45f3df21fc66e67cc457e6e976d844f4로 유지됨을 확인했다. eas.json은 기존 fingerprint ignore 대상이다. 값 강제 override는 하지 않는다.

게스트/API 공개 GET과 mock 회귀는 실제 사용자 기기의 prod 로그인·설정 보존·CTA/ScanLoading 검증을 대신하지 않는다. 서버 환경이 달라 개발 세션을 prod 회원 상태라고 가정하지 않으며, 실제 prod 계정/서버 응답을 기준으로 확인한다. 사용자 데이터·토큰을 추출하거나 임의로 삭제하지 않는다.

검토·머지 후 develop 자동 teamtest workflow 단독 발행을 우선한다. 중복 수동 OTA를 하지 않는다. 실제 group/platform/runtime/commit/BE·호스트 검사 결과를 확인한 뒤 알린다. TestFlight prod 연결 실기 확인·production OTA1·서버 release26.10.5 배포는 완료됐다. 현재 단계는 승인된 production OTA2이며 main 승격·CI/리뷰·발행 번들/런타임·심사 동결 검사를 거친다.

기존 dev 기능 테스트7개의 채널 fixture는 teamtest→development로 전환했다. 기능 단언·스냅샷을 약화/갱신하지 않는다. teamtest 자체는 별도 실모듈 회귀에서 production FLAGS·리뷰1.1·진단 유지와 대조한다.
