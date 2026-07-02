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
  - ✅ 갤러리 가져오기(expo-image-picker, 1장만 selectionLimit:1) + 플립 버튼 추가(목업 D1 하단행). UI 렌더 확인.
    시뮬레이터엔 카메라가 없으므로 OCR 테스트는 갤러리 경로 권장(Photos에 메뉴 이미지 넣고 불러오기).
    실물폰 카메라 OCR은 dev client를 폰에 설치(`npx expo run:ios --device`/EAS dev build). Expo Go ❌.

## T072 — 스캔 결과 세그멘테이션 (핸드오프 §14) — ✅ 6단계 완료 (tsc 0, jest 18/18)
- [x] step1 줄 분류기 `classifyLine.ts` (순수함수) + 단위테스트 8
- [x] step2 `segmentMenu.ts` 방사형 최근접(가격·로마자 best-effort) + 테스트 5
- [x] step3 dishName만 BE 전송 (설명·가격·원산지·잡음 제외)
- [x] step4 결과 Original/Risk(마커)/List 3-토글, 마커/행 탭→상세(카탈로그 nameKo→foodId 매핑)
- [x] step5 안전: 미매칭→unable 맨아래 정렬·숨김금지, 구조로만 거르기, personalRisk 통과
- [x] step6 **실제 58줄 OCR fixture**(spec eb2ed72, FE에 vendored)로 스냅샷 잠금 + 분류기 보정
  - 안전 검증(§14-3/5): expected.dishNames 10개 전부 포착(누락 0) + expected.junk 전부 드롭(소한: 등).
  - 분류기 보정 2건(안전): `탄산음료`→섹션(료 접미사), 끝-콜론 파편(`소한:`)→junk.
  - ❓ over-inclusion 결정: 타이틀/배너(`한식당`·`메뉴판`·`한국 전요리`)는 dishName로 남겨 **unable로 표시**(SSOT notes "매칭 실패해도 안전"). 폰트/위치 기반 타이틀-제거 휴리스틱은 **다른 메뉴에서 큰 폰트 요리명을 떨굴 위험**(§14-3 누락금지)이라 넣지 않음. → 타이틀 필터 원하면 그 리스크 감수 여부 확인 요망. 그래서 테스트는 정확일치 대신 **superset + junk-drop**로 검증.
- web 대조: 샘플 스캔 → Risk 마커 4개 + List(맥북=Unable 맨아래). jest-expo, 테스트는 tsconfig exclude.
> jest-expo 도입(단위테스트), 테스트파일은 tsconfig exclude(앱 tsc 0 유지).
> ❓ 확정 필요한 임계값/UI(임의로 정했으니 확인):
>   - section "짧고" 최대 길이 = 6자 (§14 미명시, 내가 택함)
>   - description 최소 = 12자 또는 구두점/공백 ≥3 (§14 "대략 ≥12자")
>   - 3-토글 기본값 = Risk, 마커 = 요리명 bbox 위 위험도색 작은 배지(RiskMark). (§14-4 "마커" 세부 내가 택함)
>   - 실제 58줄 OCR 로그 원본이 spec에 없어 §14-1 확인사실로 대표 fixture 구성(step6).

## 화면 — Session 2 (무인 구현, 빌드순서 §8, 화면당 커밋). 스캔 화면은 ⛔ 건드리지 않음.
- [x] 1. 온보딩(+스파이스) — `app/onboarding` 7스텝 스텝퍼(환영/인증/프로필/제약/맵기/관심/동의), 5-세그 진행바. web 대조 OK.
  - ✅ (SSOT ef18332) 제약 skip 허용 확정 + **안전 불변식**: 빈 프로필은 personalRisk()로 safe→caution 강등(false-safe 0, 헌법 III/SC-003). 전 화면 적용+검증.
  - 이탈: 알러지 라벨 영어(목업 한국어) — 헌법 I/II reader 언어. 코드는 영어 슬러그(`allergy:shrimp`).
  - 이탈: 온보딩은 런치 게이팅 안 함(mock 영속성 없음) → `/onboarding`로 진입, 완료 시 `/(tabs)`. A7 관심 확장은 A6 단일 그리드로 단순화.
- [x] 2. 홈 — `(tabs)/index` 실 구현(인사말/다이어트배너/스캔CTA/Safe추천/최근스캔/카테고리/안전고지). useHome+useMe, StickyHeader. web 대조 OK.
  - 빈 상태(스캔 0건) 분기 포함. 최근 행 썸네일은 카테고리 글리프 대신 IconFood+위험배지(FoodCard에 카테고리 없음).
  - detail/review 링크는 전방 라우트라 `as Href` 캐스트(스크린 4·6에서 생성).
- [x] 3. 음식 탐색(Food) — `(tabs)/food` 인사말+검색박스+카테고리칩+2열 그리드. useFoods, web 대조 OK. 카테고리 필터는 mock 시각만.
- [x] 4. 음식 디테일 — `app/food/[id]` 판정pill/평점2카드/성분(위험순+근거reason+ask owner)/미등록 unable. web 대조 OK.
  - ✅ (SSOT ef18332) FoodDetail.spiceLevel(0~10 nullable) 추가됨 → mock 채우고 디테일에 "X/10 · analogy" 표기 + spiceTolerance 비교(초과 시 경고).
- [x] 5. 사장님 확인 — `app/food/[id]/owner` 풀스크린 카드(한국어 질문+메뉴명 강조+ko 설명+reader 캡션). useOwnerConfirmation mock. web 대조 OK.
- [x] 6. 리뷰 작성 — `app/food/[id]/review` 별점선택+본문+Post, 제출완료(랭크 Rosette). useFoodDetail+useMe. tsc OK (스윕서 시각확인).
- [x] 7. 프로필 — `(tabs)/profile` ID/랭킹(Rosette+ladder)/제약칩/내리뷰/계정 + `app/delete-account`(FR-032 익명화 고지). web 대조 OK.
- [x] 8. 상태(빈/로딩/에러) — 공통 StateBlock/Skeleton(Session1) + `app/states` 카탈로그(로딩/빈/에러/오프라인/판정불가). web 대조 OK.
- [x] (스캔/카메라 — Session 1에서 완료, 잠금: 사용자가 별도 다듬음)

### Session 2 종료 — 8개 화면 무인 구현 완료. 전부 tsc 0 + web 스크린샷 대조 OK. 스캔 화면 미터치.
> ❓ 모음: ① 온보딩 제약 skip 허용 여부(목업 vs 핸드오프) ② FoodDetail per-dish 스파이스 필드 계약 추가 여부
> ③ 카테고리/검색 실필터는 BE 연결 시(현재 mock 시각) ④ Edit/언어/알림 등 일부 설정 액션은 no-op(라우트 미정).
> [x] 리뷰 목록 화면(G2) — `app/food/[id]/reviews`: 평점요약·같은국적 토글·익명·빈상태. 디테일 평점카드 화살표→연결.
> [x] G2 번역 UX(FR-023 c63daf1): 전역토글 제거 → **리뷰별 개별 번역**. useReviewTranslation seam(프리번역 즉시/온디맨드 로딩·에러·재시도, MOCK 지연+플래키), SVG Spinner, 원문↔번역 개별토글, reader=원문 리뷰엔 버튼 미표시. web 대조 OK(즉시/온디맨드/에러→재시도).
> 미구현: 9개 다국어 i18n(영어만). menuName vs id 리컨실은 BE 회의 대기(방향: BE가 foodId 실어주고 [id] 유지).


## 🐛 sticky 헤더 네이티브 버그 수정 (진행중 — 사용자 sim 확정 대기)
- 증상: 실기기/네이티브에서 스크롤 시 헤더가 안 고정되고 위로 사라짐(웹은 통과).
- 근본원인 가설: StickyHeader가 `position:absolute` 형제 오버레이 → Fabric(신아키)에서 ScrollView 레이어 합성 시 pin 어긋남. 웹은 CSS라 항상 pin(웹만 통과한 이유).
- 수정: 공유 StickyHeader를 **absolute → flex 고정**(ScrollView 위 실제 레이아웃 요소)으로 전환. 레이아웃상 스크롤에 물리적으로 안 쓸려감. scroll-aware(hairline/그림자 페이드인+large-title 축약)은 reanimated 유지. 5개 화면(홈·음식·프로필·디테일·리뷰) 헤더를 ScrollView 위로 이동 + paddingTop 제거. tsc 0, tests 17/17, web 회귀 OK.
- ⚠️ 네이티브 최종확정: iOS 시뮬 빌드가 Xcode26/iOS26 `-destination` 이슈로 막힘 → 사용자 sim(8082 Metro reload)에서 확정 예정. (웹만으로 완료 처리 안 함.)

## OTA (EAS Update) — 밖에서 폰만으로 최신 화면 확인
- [x] OTA 1회 설정: `eas update:configure` → expo-updates 설치, updates.url, eas.json 채널(development).
  runtimeVersion 정책 = **fingerprint**(사용자 선택). 네이티브 변경 시 자동 bump → 비호환 OTA가 구 빌드에 안 감.
- [x] 재사용 스킬 `.claude/skills/ota-publish/SKILL.md` — "밖에서 확인할 수 있게 올려줘" 류 요청에 발동.
  스킬: 커밋 점검 → 채널/브랜치 일치 점검 → fingerprint로 네이티브 변경 감지(변경 시 "OTA 불가, 재빌드 필요") →
  `eas update --branch development` → 폰 안내(앱 완전종료 후 재실행 = 자동 다운로드). baseline=`.ota/runtime-fingerprint.txt`.
- [x] OTA-가능 dev build 재빌드+설치 완료(빌드 a0f052ad, runtime 8c9263af). 폰 Updates 탭에서 OTA 수신 검증됨.
  스킬 수정 반영: `eas update`에 `--environment` 필수, dev 빌드는 Updates 탭에서 수동 로드(자동 아님), 빌드 runtimeVersion과 비교.

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
