# K-Bap FE (React Native + Expo, TypeScript)

외국인 대상 한국 음식 안전(기피 재료 위험도) 앱의 FE 레포. 3-repo 폴리레포의 하나
(spec=커맨드 센터 · kbap-server=BE). 이 세션의 역할은 **구현** — 태스크는 아래 브릿지로 받는다.

## 작업 브릿지 (지시 수신 · 보고)

- **새 작업**: `/Users/yejinkim/dev/kfood/spec/bridge/PROMPTS.md`를 읽고, 예진이 지목한
  ID(지목 없으면 **위에서부터** ⬜ 항목)를 처리한다 — 파일 정렬 자체가 처리 순서다
  (최상단 = 가장 먼저).
- **상태 갱신**: 착수 시 해당 항목의 ⬜→🔄, 완료 시 →✅ + 커밋 해시 병기.
  PROMPTS.md에서 고칠 수 있는 건 **상태 표시뿐** — 본문 수정은 커맨드 센터 몫.
- **완료 보고**: `/Users/yejinkim/dev/kfood/spec/bridge/REPORTS.md` **최상단**에 같은 ID로
  작성 — 커밋 해시, 변경 파일, 항목별 결과, tsc/jest 결과, 특이사항·BE 질의.
- 프롬프트가 기존 결정과 충돌해 보이면 **작업 전에 보고에 질문으로 남길 것**
  (선례: 로그아웃 chevron 오독 — 되물어서 잡힘).

## 불변 규칙

- **Jira 전환/체크 금지** — 완료 판정은 spec 레포의 검토 게이트가 한다. 자기 완료 선언 금지.
- API 계약 SSOT는 **BE Swagger** — dev https://dev.kbap.site/swagger-ui · prod https://prod.kbap.site/swagger-ui (~~meogo.handev.site~~ 폐기 7/24. spec 레포 openapi.yaml은 참고용).
- **서버가 아는 사실은 서버가 정본** (P-147 사고, 2026-08-10): 회원 속성(provider·가입 상태·
  판정·권한)을 **클라 로컬 상태(Firebase providerData·AsyncStorage·Keychain)로 판별 금지** —
  프로필/서버 API 응답이 정본. 로컬 상태는 기기에 잔존물이 쌓여(탈퇴 후 재가입·재설치·
  계정 전환) 서버와 어긋난다 — KB-152 Keychain 잔존·P-147 애플 링크 잔존이 같은 족보.
  로컬 판별이 불가피하면(오프라인 등) 발주문에 명시된 경우만 + 서버값 도착 시 서버 우선.
- **계정 생애주기 유닛 상비**: 인증·프로필·게이팅 로직 변경 시 "탈퇴→재가입 / 재설치 /
  계정 전환(애플↔구글)" 시나리오 중 해당되는 것을 테스트에 포함 — 잔존 상태 버그의 표준 재발 지점.
- **API 뮤테이션 버튼은 공용 제출 가드 필수** (P-168 리뷰 중복 5건·P-173 탈퇴 7발 실사고):
  새 제출/확정 버튼은 `useSubmitGuard` + `Btn busy`를 쓴다(동기 ref+busy+스피너·메트릭 불변).
  화면별 자체 가드 구현 금지. 예외 = 낙관 토글류(멱등)뿐.
- **OTA 게이트 커밋 동승 금지** (P-166 동승 발행 사고): "실기 확인 후 발행" 게이트가 걸린
  커밋이 main에 있는 동안 후속 OTA를 발행하면 게이트 커밋이 함께 실린다 — 발행 전
  `git log` 대조로 동승 여부 확인, 동승이 불가피하면 발행 전에 보고하고 지시를 기다린다.
- **선택/상태 변화는 색만 — 프레임 불변** (P-103 원칙의 전면 일반화, P-151 회귀로 승격 2026-08-10):
  선택·담김·활성 등 상태 전환이 **레이아웃 메트릭(높이·패딩·보더 폭·라운딩·슬롯 크기)을 바꾸면 안 된다**
  — 보더는 미선택에도 같은 폭의 투명 보더로 자리 유지, 배지/부속은 고정 슬롯. 상태로 바뀌는 건
  색·틴트·불투명도뿐. 이런 요소엔 **선택 전후 스타일 메트릭 비교 유닛**(P-138① 방식)을 동반한다.
- 완료 기준: tsc 0 · jest 전체 통과 + 신규 로직엔 그 버그를 정확히 잡는 테스트 동반.
- 위험도 표시는 false-safe 금지(불확실→unable/caution 강등, 헌법 III) — 관련 코드는 보수적으로.
- 진행 기록은 PROGRESS.md 관례 유지.
- **`eas update`는 env 인라인 주입 + export 사전 grep 검증 필수** (P-073 사고):
  `--environment` 플래그는 EAS 서버 env를 쓰므로 로컬 .env/eas.json build env가 안
  먹는다 — 발행 명령 앞에 `EXPO_PUBLIC_BE_BASE=… npx eas-cli update …` 인라인 강제,
  그 전에 같은 셸에서 `npx expo export` 후 dist 번들 grep(목표 호스트 1+·이전 호스트 0)
  확인을 거친다.
- **OTA 발행 전 fingerprint 대조 필수** (P-195/196 도달 0 사고, P-199 승격 2026-08-13):
  네이티브 소스(패키지·config plugin·app.json) 변경은 runtime fingerprint를 회전시켜
  **발행은 성공해도 설치 빌드에 도달 0**이 된다(runtimeVersion policy = fingerprint) —
  발행 전 `npx expo-updates fingerprint:generate --platform ios|android`의 해시를
  `eas build:list`의 최신 설치 빌드 runtimeVersion과 **양 플랫폼 대조**, 불일치면
  발행 중단·보고(네이티브 재빌드 필요 신호). 기준(빌드18 — ios vc18/and vc12, P-200):
  ios `57d46bc8…` · and `2c73e616…` — 재빌드 시 갱신.
- **제스처·워클릿 코드는 실기기 확인 후 발행** (P-065 교훈): reanimated/gesture-handler의
  UI 스레드 콜백에서 호출되는 JS 함수는 `'worklet';` 지시자 필수 — jest는 워클릿 경계를
  못 잡으므로(mock이 JS로 실행) 핀치·팬 등 제스처 변경은 Metro 실기 확인을 발행 전 거칠 것.
- **기호(−·+·×·✓ 등)를 텍스트로 렌더해 아이콘 대용 금지** — 폰트 메트릭(어센트 편향)이
  시각 중심을 틀어서 컨테이너 center 정렬이 무력화된다(선례: 주문카드 스테퍼 −/+ 위로 붙음,
  P-040). 기호는 전부 `components/icons.tsx`의 SVG로. 헌법 "이모지 금지·SVG only"와 동일 계열.
