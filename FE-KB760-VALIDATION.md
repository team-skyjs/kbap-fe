# KB-760 / P-487-R2 검증 인계

2026-10-16. base develop 06d67070. D22v4 A12236:7813/B7855/C7897 context+스크린샷 직접 확인. dev Swagger1.1 직접 재조회 SHA256 70d74eafe007ebc9ed16e0e3808af3c33d6b3cda5b12d643d57f6c211a45cf2d; profile/ad-rewards/scans/tickets 확인. 다른 조회시점의 파일 해시와 같다고 주장하지 않는다.

## 동작

- 같은 회원·세대에서 서버 false→true만 전역 전이로 생성. guest/mock·초기true·불명확 필드는 축하 근거가 아니다. 앱 재시작은 baseline부터 다시 시작하고 미표시 축하의 영속 복구를 보장하지 않는다.
- scan 네이티브 화면 안의 호스트와 일반 라우트 루트 호스트가 같은 이벤트를 소비한다. 리뷰 작성/로그인/온보딩 및 스캔 관련 라우트는 루트 호스트에서 제외. 리뷰 완료·후속 유도는 기존 흐름을 끝내고 복귀한 화면에서 Done을 표시한다.
- 광고 SDK showing/QuotaDialog native dismissal 동안 보류. 작은 뱃지 폭죽은 대체되어 조용히 숨는다. 기존 CountdownBadge 파편과 FlameShape, Btn, DS 색·서체 재사용.
- 스캔 CTA 이후 실제 Modal 종료→기존 preflight, 연타/계정세대/화면이탈 가드. Close는 자동 카메라 없이 시작 버튼을 남김. 늦은 광고 콜백은 소비된 전이를 우회하지 못한다. SCAN-004/권한/실패 경로 유지.
- app 종료 시 전이 UI 메모리는 소멸. 서버 권리·광고 횟수·분석 귀속 규칙·production flags 변경 없음. 공유 wrapper의 success=false 거절 유지, reward null/누락/잘못된 정수는 adRewardAdapter에서 거절.

## U01~U16 실행 구분

| ID | 코드 검증 | 네이티브 |
|---|---|---|
| U01 | scanAdUnlock759 실제 Scan/광고 mutation/모달 연결: CTA전 ticket0, 닫힘후1회 | 미실행 |
| U02 | owner done context + UI Done/back continuation0 | 미실행 |
| U03 | owner 초기true/이전관측없음0 | 해당 없음 |
| U04 | KB699 빈 프로필 관측 사이 baseline 유지 | 해당 없음 |
| U05 | owner 중복refetch/present·consume + UI 재마운트 재노출0 | 미실행 |
| U06 | UI close/back + 재실행 baseline 시뮬레이션0 | 실제 앱 재시작 미실행 |
| U07 | generation reset/다른회원/늦은응답 취소, 닫힘중 계정전환 CTA0 | 실계정 전환 미실행 |
| U08 | 서버false/unknown0, reward invalid 필드 throw | 실광고/리뷰 쓰기 미실행 |
| U09 | 응답유실 후 profile 전이 fixture | 실제 네트워크 유실 미실행 |
| U10 | null/누락/음수 reward 거절, profile scanUnlocked unknown0; 공통 successfalse 처리 기존 유지 | 미실행 |
| U11 | 기존 SCAN-004/실패 재시도 회귀 + CTA연타1회 | 미실행 |
| U12 | 기존 권한 흐름 코드 보존. 새 권한 호출 없음 | 권한거절 QA 미실행 |
| U13 | ReduceMotion 켜짐/미확인/실패/늦은조회 역전에도 읽기·닫힘 유지 | OS 실제설정 미실행 |
| U14 | 모달 blocker/eligible route fixture, navigation interaction 뒤 루트표시 | 실제 모달·background 경합 미실행 |
| U15 | 10locale 신규키/보간 패리티 10/10 확인, 스크롤 가변 레이아웃 | 작은화면·큰글씨·VoiceOver/TalkBack 미실행 |
| U16 | true→false 취소 후 새전이, 단순true반복0 | 미실행 |

실행 로그/최종 결과는 PR 본문 및 REPORTS에 갱신한다. 초회 전체검사는 구 뱃지 소유권 기대/소스문자열 기대 및 flaky timeout으로 실패했고 개별 재검증 통과. bb05099f 로컬 tsc·변경줄 lint(20파일 새 문제0)·핵심9suites89tests 통과. 해당 CI는 315/317suites 통과, 기존 mock의 SharedValue.set 누락 및 범위 밖 DishRow 삭제로 2suites6tests 실패. mock API 보완·DishRow 복원 후 해당2suites18tests/1snapshot 통과. 후속 커밋의 전체 CI 결과는 PR 본문·REPORTS에 기록. 테스트 단언 삭제·skip 없으며 KB699의 전이 검증을 새 전역 소유자로 옮겼다.

## 미승인 카피 / QA

K100 후보 신규 scan.unlockedBody/startScanning 두 키×10언어. ko 본문 ‘이제 한국어 메뉴판을 횟수 제한 없이 스캔할 수 있어요.’, CTA ‘스캔 시작’. 기존 scan.unlockedTitle 및 review.done/common.close 재사용. 최종 카피 승인 전 Draft 유지.

adb devices 연결0. iOS booted kbap-qa-264 / kbap-qa-se는 기존 QA 기기이며 이 HEAD를 실행하지 않았다. 기기 접근 불가라고 주장하지 않는다. 실광고 요청/클릭·설치·Metro 변경·빌드·OTA·배포 없음. iOS/Android native dismissal, 실제 광고창, 카메라/권한, 화면읽기/큰글씨/10언어 QA가 남는다. 이 결과는 native 통과·머지 승인 근거가 아니다.

새 표면: UnlockCelebrationHost / UnlockCelebration / unlockCelebrationStore / adRewardAdapter. testID unlock-celebration, unlock-celebration-action, unlock-celebration-close. FEATURE-MAP 전이 역색인에 연결 요청.
