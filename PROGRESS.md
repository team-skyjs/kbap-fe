# kbap-fe Build Progress
> 규칙: 한 번에 1개. [ ]→[~]→[x]. 각 화면 완료 시 목업 대조 + 커밋.
> 목업 SSOT: Claude Design `43cc8ad0-38d8-4afa-a66f-a7412eae2a49` ("KLens Hi-Fi (Direction G)", hifi-*.jsx, hifi-g.css).
> 계약 SSOT: spec 레포 `specs/001-personalized-menu-mvp/contracts/openapi.yaml` (재조정 중 — 미확정 필드에 로직 강결합 금지).
> 브랜드: 목업 "KLens" → 표시명 **K-Bap** 치환.

## 기반
- [x] Expo(TS+expo-router) 초기화 + 의존성 — SDK 56, src/app 구조, @/*→src/*
- [x] lib/theme.ts (토큰/폰트) — src/lib/theme.ts + useAppFonts (Baloo2/NunitoSans/NotoSansKR)
- [x] mock seam (types / mocks / useXxx, MOCK_MODE=true) — src/lib/{api,mocks,data}
## 디자인시스템
- [x] RiskMark + Icon* (SVG) — RiskMark.tsx (4상태 실루엣+글리프), icons.tsx (탭/UI/aux), Stars.tsx
- [x] Btn / StickyHeader(scroll-aware) / SubHeader / TabBar / TopBar / Stars / 상태 컴포넌트 — src/components/*
## 앱 셸
- [x] 5-탭 + Scan FAB + Community(잠김) + 검색/알림 패널 — (tabs)/_layout custom TabBar + scan 모달 + 정적 오버레이
## ⭐ 최우선 — 스캔 E2E 스파이크 (핸드오프 §13)
> 목표: 카메라→OCR→실제 BE menu-scans→촬영 이미지 위 위험도 오버레이. 영어만. 다른 화면/다국어 deferred.
- [~] 스캔 스파이크: BE 왕복 + 어댑터 + 오버레이 = 검증됨(web). 카메라/OCR = 코드 완료, dev build 필요(사용자).
  - ✅ 실제 BE `POST /api/v1/menu-scans` 왕복 OK. `BaseResponse` 래퍼, success 분기, payload null 방어.
  - ✅ 어댑터 enum 매핑(SAFE/CAUTION/DANGER/UNKNOWN→safe/caution/danger/unable). 모르는 값→unable(never safe).
  - ✅ §13-5/SC-003: "맥북"(비음식)→UNKNOWN→unable, false-safe=0 (node+web 둘 다 PASS).
  - ✅ 오버레이: 촬영 이미지 위 정규화 bbox→화면 좌표 매핑, 4색 박스+RiskMark+reason, 원본↔위험도 토글.
  - ✅ 영어 i18n만. useScan만 LIVE(BE_BASE=meogo.handev.site), 나머지 훅 MOCK_MODE 유지.
  - ⏳ 카메라(expo-camera)+OCR(@react-native-ml-kit/text-recognition): 코드/타입/번들 OK, **온디바이스 동작 미검증**.
    → 사용자가 `npx expo run:ios`(또는 run:android) dev build로 실기기 테스트 필요 (Expo Go/web 불가).

## 화면 (DEFERRED — 스캔 스파이크 후로 미룸)
- [ ] 온보딩(+스파이스)  - [ ] 홈  - [ ] 카메라/스캔(mock OCR)  - [ ] 음식 탐색
- [ ] 음식 디테일  - [ ] 사장님 확인  - [ ] 리뷰 작성  - [ ] 프로필  - [ ] 상태(빈/로딩/에러)

---

## 세션 로그
> 각 단위 시작 시 `[~]`+메모, 완료 시 `[x]`+결과 1줄.

### Session 1 — 범위: 기반 → 디자인시스템 → 앱 셸 (3단위 후 멈춤)
- [x] 기반: Expo SDK 56 스캐폴드 + 의존성 + theme.ts + mock seam. tsc 0 errors, web export OK.
  - 이탈점: 핸드오프의 `lib/*` 경로 → 템플릿 관례 따라 `src/lib/*` (`@/lib/...`). seam 원칙은 동일.
  - 폰트는 weight별 고유 fontFamily(`Baloo2_700Bold` 등)로 등록(RN weight 합성 불가).
- [x] 디자인시스템: 전 컴포넌트 RN 이식 완료. tsc 0, web 렌더 스크린샷 대조 OK (RiskMark 4상태 모양/색/폰트 일치).
  - StickyHeader: useStickyScroll()(scrollY+onScroll) + useHeaderHeight() seam, large-title 축약 구현.
  - 임시: src/app/index.tsx = DS 갤러리(검증용) → 앱 셸 단위에서 탭 셸로 교체.
- [x] 앱 셸: expo-router Tabs(index/food/community/profile) + custom TabBar, Scan=루트 모달 라우트(FAB push).
  검색/알림 패널 정적 구현. tsc 0. web 스크린샷 대조: B1 홈/B3 알림/B4 Community 잠김 + sticky 헤더 스크롤 전환 모두 목업 일치.
  - 탭 화면(food/profile/home)은 ShellPlaceholder 스텁 — 실제 콘텐츠는 화면 단위에서.
  - web 정적 deep-link은 `(tabs)` 그룹에서 깨짐(앱/네이티브 무관, 웹 export 한정). SPA 내부 네비는 정상.

### 세션 1 종료 — 다음 세션 범위: 개별 화면 (온보딩/스파이스부터, 빌드순서 §8)

## ❓ 결정 필요 (사용자에게 질문)
- BE 스캔이 현재 mock(itemId 순환). 실제 카탈로그 매칭/개인화 위험도 탑재 후 false-safe 재테스트 필요(§13-6).
- 오버레이 전략 A 채택(위험도 색만 즉시, 이름/성분은 탭 시 detail) — 단, detail/번역명은 이번 범위 밖이라 미구현.
  스캔 응답에 `displayName` 1필드 추가(전략 B)를 BE에 요청할지?
- ML Kit OCR이 iOS dev build에서 `use_frameworks!`/Pod 충돌 가능성 — 사용자 dev build 시 빌드 에러 나면 보고 요망.
