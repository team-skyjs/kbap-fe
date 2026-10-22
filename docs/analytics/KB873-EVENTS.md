# Schema 2 공통 이벤트 사전 (foundation, 아직 runtime 연결 전)

기존 analytics.track/SDK/키 없음 noop 유지. 과거 EVENTS/ALLOWED/화면조회/홈노출 의미를 바꾸지 않고 새6개만 등록한다. 공통 ui_click과 도메인 클릭은 합산하지 않는다. 이 사전은 화면에서 실제 전송됐다는 증거가 아니다.

| 이름 | 한국어 표시 제안 | trigger/분모 |
|---|---|---|
| screen_visit_start | 화면 방문 시작 | 실제 route focus/동일route 콘텐츠교체마다새방문, 네비게이션연결은후속 |
| screen_visible_time | 화면 가시 시간 | 포커스+foreground+가림없음의delta밀리초. checkpoint/visibility_end/exit |
| screen_surface_impression | 영역 연속 노출 | 영역가시면적50%이상연속1000ms,visit+area+generation당1회 |
| screen_surface_visible_time | 영역 가시 시간 | 같은50%가시조건누적delta밀리초. 사람의읽기/주의집중아님 |
| screen_scroll_depth | 영역 도달 구간 | visit+area+generation+depth25/50/75/90/100당1회,origin으로initial/user/programmatic구분 |
| screen_scroll_summary | 영역 스크롤 요약 | checkpoint/visibility_end/exit때변경된영역1건,누적최대/횟수(합산금지) |

## 속성/값과 계산

- 모든새이벤트: schema_version=2, screen(enum라우트패턴), source=navigation/content_change/unknown, screen_visit_id(프로세스내단기v숫자_순번). 실제ID/URL/쿼리미수집.
- RuntimeContext: app_env development/release/unknown, be_env dev/prod/other/unknown, channel허용목록, app_version/build숫자버전, os, update_id(UUID/unknown), runtime_version(해시/unknown). 검증기는비밀원문·잘못된형식을드롭한다. 실제expo/native/env정보해석은후속연결단위,release를__DEV__만으로판단하지않음.
- surface: screen/body/rail/photos/card/sheet/dialog; area_id는body_N/rail_N/photos_N/card_N/sheet_N/dialog_N. ID는UI등록소에서할당할단기숫자이고개인주문/분석서버ID사용금지. 공개entity id/section/source확장과안정된가상화매핑은후속연결전에정의한다.
- duration은주입한monotonic clock차이. Date.now는프로세스ID접두에만사용,시간계산에사용하지않음. 단위ms. delta음수/NaN방어. checkpoint기본15000ms이상. (visit,event,area,generation,sequence)단위dedup. 배경/가림진입은그직전delta만flush. 계정경계reset은미전송구간폐기.
- 영역은intersection/min(target,viewport)>=0.5. viewport보다큰영역도관측가능. 가림을geometry만으로판별못하므로호출자가uncovered를명시해야함. 중앙집계기에는타이머0개,후속runtime관리자에공용tick스케줄러1개예정.
- 스크롤본문도달률=min(100,(clamped offset+viewport)/content length*100),이동거리비율아님. 끝도달오차2layout units. content<=viewport이면milestone0. initial도달은origin=initial. 100이사용자완독을뜻하지않음.
- 무한목록append는같은generation(이전milestone재전송0),length/pages/max_position/has_more요약갱신. 필터/정렬/검색은새generation. summary의max_depth는당시분모들에서최대값이라마지막content_length와재계산해비교하지않고pages/position함께분석한다.
- user_scrolls는begin-drag별호출,callback개수아님. direction_changes는origin=user의비영방향전환만. 프로그램이동은사용자조작횟수0. 횟수·max값은누적snapshot이므로기간합이아닌방문별최종/최대를취한다.
- remove시영역구간flush후폐기. 가상화detach를remove로연결하면재노출이생기므로후속연결에서안정된등록수명을보장해야한다. 기존home_card_view는이정의로무음변경하지않음.

## 전달/분석 한계

콜렉터send는동기수집경계일뿐SDK수신ACK아님. 기본Amplitude큐/네트워크/강제종료delivery보장없음. checkpoint는최종방문유실범위를줄이나kill후미발송분복원보장아님. 화면·영역시간은겹치므로합쳐총사용시간으로계산하지않음. idle을이탈로단정하지않음. CTR은같은visit/generation의uniqueimpression대clickeditem분모로후속연결한다. 현재엔entity click join이없으므로CTR완료로사용금지.

5분/10분여정성능은현재collector시뮬레이션만가능. 실제양OS타이머/observer/scroll성능·수신·payloadbyte는연결후증거필요. 기존teamtest키없음noop을실수신으로보고하지않는다. 새키/서비스/동의설정변경0.
