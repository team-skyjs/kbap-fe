# KB873 lifecycle ① 실제 방문 연결

기반 PR341의 squash merge `10e16bef83233c7792c10f4f5ef25e4b96c88842` 위의 작은 후속 단위다. 전체 KB873 및 lifecycle 전체 완료가 아니다.

## 실제 연결한 것

- 앱 루트에서 스플래시 뒤 VisitTrackingHost 하나를 마운트한다. 기존 useScreenTracking/screen_view/app_tab_view 호출·의미는 그대로다.
- useRootNavigationState의 실제 active leaf와 route key를 사용한다. 첫 진입 미정착·보류 딥링크·navigator 미완성·미등록 경로에서는 기다린다. query 변경만으로 방문을 늘리지 않는다.
- 동일 패턴의 id/key 또는 stack key 교체는 새 방문이다. route params와 stack key는 메모리 비교에만 사용하며 원문/실제 ID/URL을 이벤트에 추가하지 않는다.
- 실제 AppState가 active일 때만 방문 시작. 백그라운드 중 목적지 변경은 복귀 뒤 기록하고 같은 목적지 복귀/재렌더는 중복 발화하지 않는다.
- token session generation 증가 직전에 새 계측을 suspend/reset한다. SDK 식별 설정·익명 reset 성공 또는 키 없음 noop 뒤 재개한다. SDK 오류 시 계측은 중단을 유지해 이전 식별자로 새 방문을 보내지 않는다. 인증 처리·캐시·토큰 정책은 바꾸지 않는다.
- 실제 channel/updateId/runtimeVersion/Platform/BE_BASE를 공통 context에 넣는다. 전체 URL은 전송하지 않는다. 설치된 native metadata가 없으면 unknown이고 OTA manifest의 app version/build로 추정하지 않는다. 새 native 의존성 없음.

## 가시 체류는 아직 OFF

현재 연결된 신규 이벤트는 **screen_visit_start 하나**다. collector의 visibility를 true로 바꾸지 않으며 interval/timer를 추가하지 않았다. 기존 모달·OS picker/권한/외부 브라우저 가림을 아직 전수 연결하지 않은 상태에서 foreground만으로 체류를 보내면 잘못된 시간이 된다.

다음 lifecycle ②는 공용/개별 modal·OS surface 가림, 공용 scheduler와 monotonic delta 실배선, 중첩 가림 및 종료 회귀다. 이후 영역/스크롤·5내비게이션·행동/결과·양OS 실수신을 순차 연결한다. 기존 audit CSV pending 행을 이번 방문 연결만으로 폐쇄하지 않는다.

## 검증 경계

실제 pure manager 테스트와 React host의 entry/hold/StrictMode/AppState/listener cleanup, canonical leaf/콘텐츠 변경, identity reset·환경 whitelist 회귀. SDK 실수신·실기 focus/전환 애니메이션·OS 가림·시간계측·성능은 아직 미검증이다. 아래 기반 테스트와 전체 CI 성공도 실제 운영 수신 증거를 대신하지 않는다.
