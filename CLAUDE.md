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
- API 계약 SSOT는 **BE Swagger** https://meogo.handev.site/swagger-ui (spec 레포 openapi.yaml은 참고용).
- 완료 기준: tsc 0 · jest 전체 통과 + 신규 로직엔 그 버그를 정확히 잡는 테스트 동반.
- 위험도 표시는 false-safe 금지(불확실→unable/caution 강등, 헌법 III) — 관련 코드는 보수적으로.
- 진행 기록은 PROGRESS.md 관례 유지.
