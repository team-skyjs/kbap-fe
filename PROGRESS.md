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


## ✅ 헤더 = hide-on-scroll (Blind 패턴, §6 갱신 d63068e)
- 스펙 해석차였음(버그 아님): §6이 "always-pinned"→"hide-on-scroll"로 정식 변경됨.
- 공유 StickyHeader: absolute 오버레이 + reanimated `translateY`(withTiming). 내림→숨김/올림→표시, 맨위(scrollY<8) 항상표시, 방향+delta threshold 7px, discrete `shown` 상태로 상태변화시에만 애니메이션(떨림방지). large-title 제거, 항상 solid+hairline/그림자(sh-1) 컴팩트. `useStickyScroll`→{onScroll,hidden}, `useHeaderHeight`로 콘텐츠 paddingTop.
- 5개 화면(홈·음식·프로필·디테일·리뷰) 공유 헤더로 적용. tsc0/tests17. web 검증(내림숨김/올림표시/맨위표시). 실기기 최종확인은 사용자.

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

### 랭킹 디테일 화면 (§15, 신규) — 완료
- [x] `app/profile/ranking` 구현. 확정 조합(department 히어로 · medal 엠블럼 · bar 게이지 · path 사다리) 그대로.
  계약 `Ranking`에 `breakdown`+`RankingFactor` 추가(옵셔널 — 기존 profile.tsx MOCK_RANKING 무손상), `useRanking()` 훅+mock,
  TIERS SSOT(`lib/ranking.ts`, 7등급 0/30/80/180/350/600/1000 + 웜 컬러 램프 + 가중치 10/5/2), i18n `ranking.*`(tier EN/KO 병기).
  medal/medallion은 SVG 로컬 컴포넌트(scallop disc+ribbon+cream inner, 이모지 0). 프로필 랭킹 카드 탭 → 진입 연결.
  tsc 0 · jest 17/17 · web 목업 대조(히어로/게이지/내역/사다리/CTA 전부 렌더 확인).
- [x] **원본 대조 수정(2차)**: DesignSync로 `my-ranking.jsx`+`My Ranking.html` 실제 원본을 읽어 1:1 정합.
  - 사다리: 순서 정순(입문자 lv1 위→뼛속까지 한국인 lv7 아래, 이전엔 역순이었음), 노드=단순 원형 medallion(스캘럽X, 히어로만 starburst),
    2-세그먼트 트레일(현재까지 solid·이후 muted), 우측 라벨 done="✓ Done"/current="{at}+ pts"/locked="🔒 {at} pts", 섹션명 "All ranks / 전체 등급".
  - KO 등급명 원본대로(입문자/맛보기/탐험가/단골/미식가/한식 고수/뼛속까지 한국인), 컬러 램프 TIER_COLOR 일치.
  - 히어로 엠블럼=starburst 메달(주황 그라데이션+흰 숫자+리본+sheen), 게이지 "단골까지" KO 서브+눈금 "N pts"(+ 제거),
    내역 detail 몬스페이스 "N reviews × 10 pts", 이중언어 헤더(StickyHeader에 `titleKo` 옵셔널 슬롯 추가 — 컴포넌트 1개 유지).
  - [x] CTA "Write a review" 라우트: **음식 탭(`/food`) 유지 확정**(사용자 승인). 특정 음식 없이 리뷰 불가 → /food 탐색 진입. 스캔 히스토리 생기면 "최근 먹은 음식 리뷰" 바로가기 fast-follow.
  - [x] 헤더 이중언어: StickyHeader에 옵셔널 `titleKo` 슬롯 추가 → "My Ranking / 내 랭킹" 병기(컴포넌트 1개 유지). 원본 대조 2차에서 반영됨.

### i18n 9개 언어 + 다중 스크립트 폰트 + 언어 전환 (T070/T071) — 완료
- [x] ①감사+en(ed5a2d7): 전 화면 하드코딩 감사(위반 4건만: scan stage, profile 'English', ranking 접미사, SearchOverlay 최근검색) 전부 i18n화. `lib/i18n/languages.ts`(9개 언어·endonym·resolveLang). en=SSOT.
- [x] ②8개 번들(fcf256e): zh-Hans/zh-Hant/ja/vi/id/th/ru/es 기계번역(각 `_meta.status`). 검증 스크립트로 키 286개 정합·placeholder·배열·한국어 악센트 유지 전부 통과. 9개 리소스 등록.
- [x] ③폰트(fae48bd, T071): `fonts.ts`(스크립트별 FontSet+remapFamily) · `useScriptFonts`(비라틴 온디맨드 로드) · `Txt`(렌더 시 라틴 폰트→활성 스크립트 재매핑, `Text`로 aliased 스왑) · `LocaleProvider`(기기 로케일 감지+en 폴백, AsyncStorage 영속, i18next 라이브 전환, 활성 스크립트 제공). CJK→Noto SC/TC/JP, Thai→Noto Thai, ru(키릴)→Nunito(Baloo는 키릴 미포함).
- [x] ④전환 UI(52289f4, T070): `LanguagePicker`(9개 endonym 모달, 활성 체크) + 프로필 언어 행 연결(기존 no-op 수정).
- [x] ⑤검증(web): ja/th/ru 전환 — 두부 0(제목/큰 숫자 포함), place=ko 악센트(내 랭킹/탐험가/단골까지/점수 내역/리뷰/음식 다양성/스캔/전체 등급) 한국어 유지, 러시아어 장문 레이아웃 OK, 풀 리로드 후 언어 유지(영속) 확인. tsc 0.

### 브랜드 자산 리프레시 + 통합 재빌드 — 진행
- [x] onboarding i18n 갭 수정: 다중 줄 `react-native` import라 T071 코드모드가 놓쳤던 `Text`를 `Txt`로 교체(전 파일 raw Text 0 확인).
- [x] 네이티브 브랜드(6d9cfdf, 재빌드 필요): app.json — 잘못된 `ios.icon` 경로 삭제(→ 최상위 icon 폴백), android adaptiveIcon bg #E2580C, expo-splash-screen 루트 image(양 플랫폼)+#E2580C+imageWidth 230 contain. 새 아이콘/스플래시/파비콘 PNG + kbowl.svg.
- [x] 인앱 로고(57fc940, JS/OTA): `Brand.tsx`(KbowlMark/BrandTile/BrandLockup — 오렌지 radial 타일+흰 마크+"K-Bap" teal 하이픈). StickyHeader·온보딩 적용. web 렌더 확인.
- [~] 통합 dev 빌드 실행: iOS build `a2a0ab78` (fingerprint `dee1ba23`). https://expo.dev/accounts/rocher/projects/kbap/builds/a2a0ab78-2336-4d87-9b6b-7a1e90ffb4e7
  - 이 빌드 하나로 (1) 브랜드 아이콘/스플래시(네이티브) + (2) AsyncStorage 언어영속(신규 네이티브 모듈) + (3) 인앱 로고·폰트·번역(번들 포함) 전부 활성. 이후 JS 변경만 OTA.

### KB-6 프로필 편집 UI (Screen I 포팅 + 오버라이드) — 완료
- [x] 데이터(7a94ecb): `mocks/ingredients.ts` 평면 81종 카탈로그(code+name, BE 스텁) + `ingredientLabel`. restrictions=평면 재료코드(kind는 계약용 vestigial). 랭킹=7등급 FR-025 재사용(MOCK_RANKING→explorer). User.email(옵셔널), `useUpdateMe`(PATCH /me, MOCK 캐시 병합). NATIONALITIES에 native/suggested.
- [x] 공유 컴포넌트(8797324): **`src/components/IngredientFilter.tsx`** — I6 + 온보딩 KB-8 공유. 검색 81종 + active 칩(× 제거), 카테고리 없음, 재료별 프리 위험색 없음, "왜"는 안 물음.
- [x] 화면(1165516): `app/profile/edit.tsx`(I3) · `nationality.tsx`(I4) · `restrictions.tsx`(I6 오버라이드). I5=기존 LanguagePicker 재사용, I2=기존 delete-account 재사용.
- [x] I1 배선(9c5d149): 랭킹 7세그먼트+지역화 tier, 평면 중립 재료칩, 연필→edit, Edit/Add→restrictions.
- web 대조: I1/I3/I4/I6 전부 렌더 확인(7등급 진행바, 국적 Suggested/All, 81종 평면 필터 선택=오렌지·프리컬러 없음). tsc 0 · jest 17/17.
  - ❕ 편차: (a) I1 5-tier 라벨행 제거(7등급 이름이 요약행에 안 들어감 — 전체는 랭킹 디테일에). (b) 국적/reader언어는 선택 즉시 반영(닉네임만 Save에 staged) — LanguagePicker 즉시반영과 일관. (c) 홈 "avoid N things" 배너의 빨간 점은 경고배너 프레이밍(유지). (d) reader언어 SSOT=LocaleProvider `lang`(me.readerLanguage는 미러).
- [x] 81종 필터 공유 컴포넌트 위치: `src/components/IngredientFilter.tsx` (KB-8 온보딩에서 import).

- [x] 재료 카탈로그(81종) i18n 완료: `ingredients.<slug>` 9개 언어(en + 8 기계번역), `ingredientLabel`이 i18n으로 해석 → 언어 전환 시 재료명·홈배너·I6 필터 모두 번역. 브랜드 로고는 항상 Baloo 고정(raw Text).

### KB-8 온보딩 UI 정립 (Screen A 포팅 + 오버라이드) — 완료
- [x] 공유 국적피커 추출(022ac50): `src/components/NationalityPicker.tsx`(I4 모달). KB-6 edit이 route 대신 모달 사용 → `app/profile/nationality.tsx` 삭제. 온보딩 A3와 공용.
- [x] KB-8 온보딩 정립(72a7d9c): A1~A8 Screen A. 오버라이드:
  1. **A4 = 공유 `IngredientFilter`**(평면 81종, KB-6 I6과 동일 컴포넌트). 추상 Dietary/Religion 프리셋·재료 프리위험색 제거. Optional/Skip + "이게 모든 안전경고 좌우" 고지 유지. 저장=평면 재료코드.
  2. 브랜드 K-Bap: K-Bowl BrandTile + 워드마크 + CTA "Start using K-Bap".
  3. A3 국적/언어 = 공유 NationalityPicker(I4)/LanguagePicker(I5, 9개 endonym). 옛 샘플 시트·4언어 목록 제거.
  - 로컬 PickerModal/Chip·프리셋 데이터 사용 제거. tsc 0 · jest 17/17 · web 검증(A1 브랜드/A3 9언어 피커/A4 평면필터).
  - 범위 밖(별도): 첫실행 게이팅·영속은 실 API 통합 단계.
- **공유 컴포넌트·선택기 위치**: 81종 필터=`src/components/IngredientFilter.tsx` · 국적=`NationalityPicker.tsx` · 언어=`LanguagePicker.tsx` · 81종 카탈로그=`src/lib/mocks/ingredients.ts`.

## ❓ i18n 후속/갭 (사용자 결정)
- **네이티브 감수 필요**: 8개 비-en 번들은 기계번역(각 `_meta.status="machine translation — pending native review"`). 서브에이전트가 flag한 애매 키(예: tier 등급명 축약, "Shrimp paste" 현지어, "Spike"/"Metro" 개발용어)는 감수 시 확인.
- **알레르기/제한 라벨·국가명 미번역**: `lib/onboarding/data.ts`의 allergen 라벨("Shellfish" 등)·그룹명·국가명은 아직 영어. 파일 주석대로 "서버 구동 카탈로그로 대체 예정"인 **도메인 데이터**로 간주(음식명 미번역과 동일 논리)라 이번 범위서 제외. 지금 i18n화 원하면 알려주세요(9개 언어 ~30키 추가 번역 필요).
- [x] **AsyncStorage 재빌드**: 유지 확정(사용자). 브랜드 재빌드(build `a2a0ab78`)에 통합 → 설치 후 언어 영속 동작. (expo-file-system 대체안은 불필요로 폐기.)
- **번들 크기**: CJK/Thai 폰트 전 weight가 번들에 포함(런타임 로드만 온디맨드). 프로덕션은 서브셋/지연로드 권장 — fast-follow.
- [x] `assets/images/*.png` + `kbowl.svg`: 브랜드 자산 교체분(무관 변경 아님) — 커밋 6d9cfdf에 포함 완료.
- iOS 아이콘 알파: App Store는 투명 채널 거부. Expo 빌드가 배경색으로 평탄화하지만, 빌드 산출 아이콘에 투명 픽셀 없는지 설치 후 확인 권장.

## ❓ 결정 필요 (사용자에게 질문)
- BE 스캔이 현재 mock(itemId 순환). 실제 카탈로그 매칭/개인화 위험도 탑재 후 false-safe 재테스트 필요(§13-6).
- 오버레이 전략 A 채택(위험도 색만 즉시, 이름/성분은 탭 시 detail) — 단, detail/번역명은 이번 범위 밖이라 미구현.
  스캔 응답에 `displayName` 1필드 추가(전략 B)를 BE에 요청할지?
- ML Kit OCR이 iOS dev build에서 `use_frameworks!`/Pod 충돌 가능성 — 사용자 dev build 시 빌드 에러 나면 보고 요망.

## KB-68 반려 수정 (2026-07-14) — restrictions 변경 후 개인화 즉시 반영
- [x] 버그: 성분 추가 후 홈이 stale 위험도 유지(수동 리로드 필요) — false-safe 성격이라 최우선 처리.
- 원인(코드 검증): `useUpdateMe` onSuccess가 `['me']`만 invalidate — 홈(['home'])·목록/검색(['foods'])·상세(['food']) 개인화 쿼리 미무효화.
- 수정: restrictions 포함 패치 + 실세션이면 `queryClient.clear()` (온보딩 제출 KB-75와 동일 의미 — 개인화 기준 변경 = 파생 캐시 전부 stale). 키 열거 invalidate는 새 개인화 쿼리 추가 때 이 버그가 재발하는 패턴이라 기각. mock 경로(무세션)는 캐시 병합이 진실이라 clear 제외. 닉네임/국가/언어는 기존 `['me']` 범위 유지(비범위).
- 회귀 테스트 2건: restrictions 변경→개인화 캐시 전부 제거 / 닉네임만→유지 (useUpdateMe.test.tsx). tsc 0, jest 62/62.
