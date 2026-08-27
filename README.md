# K-Bap FE (kbap-fe)

외국인 대상 한식 안전 안내 앱 — React Native + Expo (TypeScript).
메뉴판 스캔(온디바이스 OCR) → 개인 프로필 기반 위험도 판정 → 사장님 확인 카드 → 리뷰.

- BE: [kbap-server](https://github.com/team-skyjs/kbap-server) (Kotlin/Spring · API 정본 = dev/prod Swagger)
- 오케스트레이션·제품 정본: kbap-spec (private)

## 개발 시작

```sh
npm install
npx expo start        # dev client 필요 (Expo Go 아님 — 아래 참조)
npx tsc --noEmit && npx jest   # 머지 전 필수 그린
```

### Metro를 볼 기기 준비 (dev client)

Expo Go로는 안 열린다(커스텀 네이티브 모듈) — **EAS development 빌드(dev client)**를 설치해야 한다.
Metro를 켠 맥과 **같은 네트워크**에서 dev client를 실행하면 자동 연결(QR/URL도 가능).

| 방법 | 기기 등록 | 준비 |
|---|---|---|
| **iOS 시뮬레이터 (가장 간단)** | 불요 | EAS `development-sim` 빌드 다운로드 → 시뮬레이터에 드래그 설치 |
| Android 실기기 | 불요 | `development` 프로필 안드 APK 설치 |
| iOS 실기기 | **필요** — Apple 프로비저닝에 UDID 등록(예진 계정) | ① 예진이 `eas device:create` 링크 발급 → 기기에서 열어 등록 ② development 빌드 재생성 → 설치 |

- 빌드 산출물은 expo.dev 프로젝트의 Builds 탭에서 받는다(프로필 컬럼 = development / development-sim).
- dev client는 **dev API(.env의 EXPO_PUBLIC_BE_BASE)** 를 따른다. 앱 확인만 필요하면 TestFlight
  teamtest 빌드(dev API 연결)로도 충분 — 코드 수정을 실시간으로 볼 때만 Metro가 필요하다.
- BE를 로컬로 띄웠다면 `.env`의 호스트를 로컬 주소로 바꾸면 된다(커밋 금지).

## 브랜치 체계 (2026-08-26~)

```
main     스토어에 나간 상태만. develop→main 릴리스 PR로만 유입
develop  통합 브랜치(기본). PR로만 유입 (직푸시는 룰셋이 차단)
feat|fix/kbXXX-슬러그   모든 작업 단위 — 지라 키(KB-XXX) 필수
hotfix/kbXXX-슬러그     스토어 긴급 수정 — main에서 분기, main+develop 양쪽 PR
```

## PR 규칙

- **작업 완료 = push + PR 오픈까지.** 제목 `[KB-XXX] 요약`. base = develop
- 단일 작업 = ready PR / 연속 작업 브랜치 = Draft로 열고 마지막 작업 후 ready 전환
- 머지 = **squash** (PR 하나 = develop 커밋 하나). 릴리스 PR(develop→main)만 merge commit
- 리뷰 이중 구조: **Codex 자동 리뷰**(PR 오픈/ready 시 — 기준은 [AGENTS.md](AGENTS.md))
  + **커맨드 센터(스펙 세션) 검토 후 머지**. 사람 계정별 Codex는 각자 관리
- 테스트를 약화(단언 완화·스킵)하는 수정 금지

## 태그 3종

| 태그 | 시점 | 예 |
|---|---|---|
| `build-vX.Y.Z-bNN.vcNN` | production 네이티브 빌드 커밋 | `build-v1.0.1-b19.vc13` |
| `build-tt-bNN.vcNN` | teamtest 네이티브 빌드 커밋 | `build-tt-b18.vc12` |
| `vX.Y.Z` | 스토어 실제 제출/출시 | `v1.0.1` |
| `ota-prod-YYYYMMDD(-n)` | production OTA 발행 | `ota-prod-20260826-2` |

플랫폼 비대칭 빌드(한쪽만 재빌드)는 **해당 플랫폼만 기재** — 예: iOS 단독 `build-v1.0.2-b21`.
동시 빌드는 한 태그에 병기(현행). 미리 플랫폼별로 분리하지 않는다.

## 빌드·배포 규칙 (안전 게이트)

- **빌드는 "푸시된 클린 커밋"에서만** — 로컬 스냅샷 빌드 금지(유실 커밋 빌드 사고 이력 있음).
  절차: 워킹트리 클린 확인 → HEAD가 origin에 존재 확인 → 빌드 → 빌드 태그 푸시
- **채널·소스 게이트**: teamtest 빌드/OTA = develop 체크아웃 · production = main 체크아웃에서만
- **export·`eas update`는 항상 `--clear`** — Metro 캐시가 env(API 호스트)만 바뀐 재수출에서
  이전 번들을 재사용한 실측 사례 있음. 발행 전 번들 grep(대상 호스트 1·타 호스트 0) 필수
- BE 연결: teamtest = dev API / production = prod API (eas.json 프로필에 고정)
- 스토어 제출·OTA 발행은 **예진 승인 후에만**
- CI/CD: EAS Workflows 도입 예정(태그 트리거 빌드 — 예진 확정 시). 그 전까지 수동 발행

## 코드 관례 (요약 — 상세는 AGENTS.md)

- 유니코드 이모지 UI 금지(SVG 벤더 아이콘) · 위험도 4상태는 색+형태 병행 · false-safe 금지
- 사용자 노출 문자열은 i18n(10개 로케일 키 패리티) — 한국어 카피는 Codex 검수 트랙 경유
- 서버 와이어 변환은 `src/lib/api/*Adapter.ts` 격리 · 채널 게이트는 `src/lib/flags.ts` 단일 소스
- `src/lib/order/orderCard.ts`(사장님 카드)는 안전 크리티컬 — 문구·로직 변경 시 유닛 동반
