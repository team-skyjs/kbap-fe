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

## KB-68 2차 반려 수정 (2026-07-14) — 홈 '수정' 동선에서 홈 미갱신
- [x] 원인(코드+RQ v5 소스 검증): 1차 수정의 `qc.clear()`는 캐시 제거만 하고 **마운트된 옵저버를 재조회시키지 않음** — 탭 화면은 언마운트되지 않으므로 홈이 stale 판정 유지(빌드 시점 무관, 구조적 결함). 저장 경로는 restrictions.tsx(useUpdateMe) 단일 확인(온보딩은 별도 submit + 리마운트라 무관).
- 수정 ①: `clear()` → **인자 없는 `invalidateQueries()`** — 전체 stale 마킹 + 활성 쿼리 즉시 재조회. 전면성(키 미열거) 유지.
- 수정 ②: useHome에 포커스 재조회 — `useFocusEffect` + `isStale`일 때만 refetch (fresh면 no-op, 전면 폴링 아님). 60s staleTime 경과·타 화면발 변경도 홈 진입 시 최신화.
- 회귀 테스트 갱신: invalidate 의미론(캐시 제거 아님)에 맞춰 `isInvalidated` 단언 — restrictions→홈·목록·상세 invalidated / 닉네임→미invalidated. tsc 0, jest 62/62.
- 비범위 준수: 상세 재료별 위험 뱃지 로직 무변 (BE 버그 별도 전달건).
- (후속 지시 대사, 7/14) "38e632e에 작업 2 누락" 지적 확인 — 포커스 재조회는 직후 커밋 5bdc35c에 포함되어 이미 반영 상태(useHome.ts:51 useFocusEffect + stale 조건부 refetch). 추가 변경 없음.

## KB-125 실기기 2건 (2026-07-14)
- [x] 미완료 프로필 닉네임: 검정 '—' → muted "미설정" 표기 (profile.nicknameUnset ×10개 언어, ink3 톤).
- [x] 온보딩/프로필 성분 언어 혼재: KB-75 재키잉 때 i18nKey 없던 신규 29종에 키 부여 + ingredients.* 29키 ×10개 언어 번역. 번역 원칙: 각 언어 통용 식재료 명칭, 현지 고유어 없는 것(Ghee·Rennet·Dashi·Mirin·Asafoetida·Carmine 등)은 관용 외래어 표기(+괄호 보충). 온보딩(IngredientFilter)·프로필 편집 화면은 동일 ingredientLabel 경유 확인; 프로필 탭 칩의 restrictionLabel이 BE 코드를 카탈로그로 라우팅하지 않아 "FISH_SAUCE" 원시 노출되던 것도 수정(BE_CODES 분기 추가 — 표시 전용, 와이어 값 무변).
- 참고: 패리티 검사에서 saved.count_* 복수형 차이는 병렬 북마크 작업(KB-142)의 정상적 언어별 복수형 — 검사를 복수형 접미사 제외로 보정해 통과 확인.

## KB-141 스캔 가로 방향 차단 (2026-07-15)
- [x] 기술 체크(선행): **expo-sensors 불필요 — 재빌드 없음 확정**. 이미 설치된 expo-camera의 `responsiveOrientationWhenOrientationLocked` + `onResponsiveOrientationChanged`(iOS)가 portrait-lock 상태에서도 기기 회전(landscapeLeft/Right)을 이벤트로 제공. JS-only → OTA 가능, 7/16 빌드 일정 영향 0. **한계: 콜백이 iOS 전용 — Android는 미감지(현행 유지)**, 출시 타깃 iOS라 수용, Android 커버 필요 시 그때 expo-sensors 재논의.
- [x] 구현: 가로 감지 시 카메라 위 어두운 오버레이 + IconFlip + "세로로 들어주세요" 카피(기기 방향에 맞춰 ±90° 회전해 바로 보이게) + 셔터 비활성(opacity+disabled) + capture() 함수 단 가드(진입 경로 무관 차단, 헌법 게이트). 세로 복귀 시 state 기반 즉시 해제. portraitUpsideDown은 세로 종횡비라 허용.
- [x] i18n: scan.rotateToPortrait ×10개 로케일.
- 비범위 준수: 갤러리 가로 사진 미처리(별도 논의), 스캔 파이프라인/API 무변. tsc 0, jest 62/62.
- 실기기 확인 대기(예진): 가로로 들면 오버레이+셔터 잠금, 세로 복귀 시 즉시 해제, 촬영물 세로 정상.

## KB-140 스캔 결과 재구조 (2026-07-15)
- [x] 기본 화면 리스트 전환: 초기 view state + 스캔 성공 시 둘 다 'list' (2026-07-14 결정 — 오버레이 버튼/메뉴 겹침 회피). 토글 순서도 List·Risk·Original로(기본이 앞). 오버레이는 토글 조회.
- [x] 오버레이 마커 겹침 완화(best-effort): 같은 x-구역(150px)에서 세로 34px 이내로 겹치는 pill을 아래로 스태거 — 완전 겹침(뒤 pill 터치 불가) 방지. 원 앵커에서 다소 밀릴 수 있음(한계 명시).
- [x] unmatched 탭 안내: 비활성·무반응 → 탭 시 중립 톤 안내 카드(unable 마크 + "아직 등록되지 않은 음식" + 사장님 확인 권고 — 안전 인상 문구/색 없음). 상세 이동 불가 유지. 리스트 행·오버레이 pill 모두 적용. scan.unmatchedSheetTitle/Body ×10 로케일.
- 안전 불변식 유지: unable 정렬 후순위·미숨김(§14-5) 그대로, personalRisk 경로 무변, 스캔 API/mergeResults 무변(비범위).
- 회귀 테스트 +1: 스캔 완료 시 오버레이 미렌더 + 리스트 렌더 + unmatched(맥북) 미숨김 (scanDefaultView.test.tsx, 화면 단위). 기존 scanAdapter 6건 포함 전체 63/63 그린.
- 실기기 확인 대기(예진): 스캔→리스트 기본 표시→토글로 오버레이 전환, unmatched 탭 시 안내 카드, 마커 겹침 완화 체감.

## KB-142 북마크(저장) 실연결 (2026-07-15)
- [x] Swagger 재확인(구현 전): GET `/api/v1/bookmarks?cursor=&lang=` → {items: FoodSummaryResponse[], hasNext, nextCursor} / POST `/api/v1/bookmarks` {foodId:int64} / **취소는 PATCH `/api/v1/bookmarks/{foodId}` (DELETE 아님)** — 전부 인증 필수.
- [x] `bookmarks.ts` 전면 재작성(로컬 AsyncStorage → BE): useBookmarks=useInfiniteQuery 커서 페이지네이션(게스트 disabled), useToggleBookmark=낙관적 업데이트(onMutate 캐시 prepend/filter)+onError 롤백+onSettled invalidate, useRemoveBookmark/useRestoreBookmark(스와이프 삭제→Undo 유지).
- [x] 상세 저장 버튼: 실패 시 롤백 + 에러 스낵바(saved.error ×10 로케일). 저장 성공 스낵바(View→saved) 기존 유지.
- [x] saved 리스트: 서버 무한스크롤(onEndReached 0.6 + footer 스피너), 기존 카드/스와이프/personalRisk 재평가 구조 재사용.
- ~~⚠️ 계약 갭~~ **해소됨(2026-07-15 저녁 Swagger 재배포)**: FoodDetailResponse에 `bookmarked` 추가 → 상세 저장 상태를 서버 필드 기반으로 교체(후속 섹션 참조). 목록 캐시 유도(useIsBookmarked)와 그 한계는 소멸.
- 비범위 준수: 디자인 현행 재사용, 비회원 북마크 없음(AuthGateSheet save 게이트), BE API 무변. tsc 0, jest 63/63.
- 실기기 확인 대기(예진): 상세 저장 토글→saved 리스트 반영→앱 재조회 시 서버 상태 일치, 무한스크롤, 실패 시 롤백+에러 토스트.

## KB-142/150 후속 — Swagger 재배포 반영 (2026-07-15 저녁)
- [x] 상세 bookmarked 실연결: FoodDetailWire/FoodDetail(옵셔널 — mock 경로 미설정=false)에 필드 추가, adaptFoodDetail 매핑(누락 방어 false), 상세 saved를 목록 캐시 유도 → `food.bookmarked` 기반으로 교체, useIsBookmarked 제거(사용처 상세뿐). 토글 onMutate가 상세 캐시(['food', id, lang])의 bookmarked도 반전 + onError 롤백 + onSettled에서 목록·상세 둘 다 invalidate. saved 리스트 해제/Undo도 상세 invalidate 동기화.
- [x] 맵기 서버 실연결(TODO 3곳 해소): useUpdateMe PATCH body `spicinessPreference`, adaptProfile `wire.spicinessPreference`(숫자만 신뢰) ?? 로컬 fallback(마이그레이션 기간 유지), 온보딩 body 포함(스킵=필드 생략, not required 확인).
- ⚠️ **BE 질의 2건 (미해결)**:
  1. MyProfileResponse의 spicinessPreference가 required인데 **"미설정" 표현이 계약에 없음** — 0은 SPICE_SCALE상 "맵지 않음"이라 미설정과 의미가 다름. FE는 null/누락 시 로컬 fallback으로 방어 중. 서버의 미설정 표현 확정 필요.
  2. **"설정 해제"(null)를 PATCH로 전달하는 방법 미정** (null 전송 vs 필드 생략 의미) — 확정 전까지 해제는 로컬만 반영(필드 생략=서버 유지). 서버에 값이 이미 있으면 해제 후 재조회 시 서버 값이 되살아나는 한계 있음.
- profileImageUrl은 비범위(KB-149 — presigned API 대기). 테스트: bookmarked 매핑 2건(신규 foodAdapter.test) + 낙관 반전 단언 2건(toggleBookmark 확장) + spice PATCH body/해제 2건(useUpdateMe 갱신). tsc 0, jest 73/73.
- 실기기 확인 포인트: 상세 저장 → 다른 기기/재설치에서도 저장 표시 정확, 맵기 수정→저장→재조회(서버 왕복) 값 유지, 온보딩 spice 포함.

## KB-72 스캔 실연결 마무리 — imagePath + 가격 (2026-07-16, P-002)
- [x] Swagger 재실측(구현 전): ScanRequest에 `imagePath` **required**(minLength 0, 패턴 ^(?!https?://)) 추가 확인. `POST /api/v1/images/complete` {path, contentType, size}→{path} 배포됨. **presigned 발급 API 미배포** → 시나리오 ②(업로드 스텁 + 나머지 완성). 응답 `idx` nullable화("사진 추출됐지만 대응 OCR 항목 없으면 null"), `price`(KRW 정수, 미표기 null, 응답 전용) 추가.
- [x] 요청 전환: `{ imagePath, items }` — 온디바이스 OCR·박스 유지(7/16 예진×종한 합의). 발급 API 대기 동안 imagePath는 `''`(텍스트-only 폴백, 스캔 무중단 — DoD "발급 API 부재 시 안전한 폴백").
- [x] 업로드 흐름 어댑터 `scanImage.ts` 신규: `completeImageUpload()`(실코드 — 발급 후 그대로 사용 가능) + `resolveScanImagePath()`(발급 파트만 TODO(KB-72) 스텁, null→'' 폴백). ⑦(KB-137) 순서 확인: 업로드 해석은 postScan 초입 — 파일 삭제 트리거(교체/언마운트)보다 항상 먼저.
- [x] 가격 표시: 리스트 행 + 오버레이 pill에 **서버 price 그대로**(formatKrw 포맷만, 환율·추정 금지), null=미표시. OCR 추정가(priceKrw)를 서버값으로 대체(세그멘테이션은 payload 절감용으로 유지).
- [x] 착수 질의→커맨드 센터 확정(7/16): 응답에 없는 idx = **드롭 유지**(7/10 결정, unable 지시 철회). **idx=null 결과는 버리지 않고 리스트 전용 노출**(photoOnlyResults — 좌표 부재로 오버레이 마커 없음, 위험도 규칙 동일·음수 itemId 합성 키). DANGER 미노출 갭 차단(헌법 III).
- ⚠️ **BE 질의 1건**: imagePath required인데 발급 API 부재 — `''` 전송이 허용되는지(스키마상 minLength 0으로 통과 추정) 확정 필요. 거부로 확정되면 정직한 에러 표시로 전환 예정(scanImage.ts 주석).
- 테스트: 가격 매핑(정상/null/비숫자 방어) + idx=null 조인 제외 + photoOnlyResults(danger 유지·unable 강등·koreanName 폴백) + 요청 body imagePath/items 잠금(useScan.test 신규 — 사진 유무 2경로) + 리스트 노출 회귀(scanDefaultView 확장). tsc 0, jest 80/80 (15 suites).
- 실기기 확인 포인트: 스캔 정상 동작(imagePath '' 서버 수용 여부 — 거부 시 에러 화면 뜨는지 공유 요망), 가격 표기 메뉴에 ₩ 표시·미표기 메뉴 미표시, 리스트에 박스 없는 항목(사진 전용) 노출 여부.

## KB-162 탈퇴 시 애플 재인증 + 토큰 revoke — 경로 A (2026-07-16, P-005)
- [x] `appleRevoke.ts` 신규 (NATIVE ONLY): 애플 시트 재호출(expo-apple-authentication 기존 경로 재사용, 새 라이브러리 없음 — 로그인과 달리 credential 미생성이라 nonce/scope 불필요, signInWithCredential 호출 금지=타계정 세션 갈아타기 방지) → `credential.user`(sub)를 현재 Firebase apple.com providerData.uid와 대조 → 일치 시 `revokeToken(auth, authorizationCode)`(RNFB v25 modular, iOS 브릿지) 즉시 호출.
- [x] delete-account 분기: iOS+애플 회원이면 탈퇴 확정 버튼 → 재인증 게이트 카드(안내→"Apple로 계속") → revoke 성공 시에만 기존 탈퇴 흐름(withdrawBe→logOut→/login). 구글 회원·웹·안드로이드는 기존 흐름 무변.
- [x] 엣지 3종: 시트 취소→cancelled / 타계정(또는 대조 불가)→mismatch / revoke·시트 실패→failed — 전부 탈퇴 중단 + 사유 안내 카드 (revoke 없는 탈퇴를 만들지 않음, 심사 요건).
- [x] i18n +5키 ×10 로케일 (appleGateBody/Btn/Cancelled/Mismatch/Failed).
- 테스트 +11 (`appleRevoke.test.ts`): provider 판별(구글 false·양쪽 true·미로그인 크래시 없음) / 타계정·식별자 부재 거부 / 엣지 3종에서 revoke 미호출·중단 신호. tsc 0, jest 91/91.
- 실기기 확인 포인트(예진): 애플 계정 탈퇴 → 설정→Apple로 로그인 목록에서 K-Bap 소멸 / 재가입 시 이메일 선택 화면 재등장 / 구글 계정 탈퇴는 게이트 없이 기존과 동일 / 시트 취소·다른 애플 계정 선택 시 계정 유지 + 안내.

## P-003 — 맵기 -1 센티널 + presigned 발급 실연동 (2026-07-16, KB-150 후속·KB-72 마무리)
- [x] Swagger 재실측: `POST /images/upload-url` 배포 확인 — req {purpose, contentType, contentLength(정확값)} 전부 required / res {uploadUrl, method, requiredHeaders, publicUrl, objectKey, expiresAt} 전부 required. spicinessPreference: 응답 required int, 요청(Update·Onboarding) optional.
- [x] 맵기 -1 센티널(회의 확정): `adaptSpice()` 신설 — -1 포함 0..10 밖·비정수 → null(미설정), 칩 "-1/10" 노출 오작동 차단. 서버가 항상 값을 주므로 서버값 우선, 로컬 fallback은 필드 누락(구서버)일 때만. 해제는 PATCH `spicinessPreference: -1` 전송(값 되살아나던 한계 소멸 — 기존 "로컬만" 처리 폐기).
- [x] 온보딩 스킵: **필드 생략 유지 판단** — 계약상 optional + BE 정책 "미설정 유저 DB에 -1 저장"이라 생략=미설정으로 수렴. 실측에서 다르게 확인되면 -1 명시 전송으로 전환(주석 명시).
- [x] presigned 실연동: scanImage.ts TODO(KB-72) 해소 — `uploadImage(file, purpose)` 발급→PUT(requiredHeaders 그대로, BINARY_CONTENT)→complete(objectKey). contentLength는 getInfoAsync 정확값, contentType은 확장자 매핑(기본 jpeg). **purpose 파라미터화** — P-004(프로필)와 공용 전제. 실패는 어느 단계든 null→imagePath '' 폴백(BE 허용 확정 7/16), PUT 비2xx면 complete 미호출(신고값 불일치 방지). KB-137 삭제보다 선행 순서 유지.
- 테스트 +12: adaptSpice 경계(-1→null·0 유효·10/11/3.5·누락 fallback) / 해제 → -1 전송·0 전송 경계(useUpdateMe 갱신) / 업로드 성공 경로 body·헤더 잠금 + 발급/PUT/파일소실 실패 폴백(scanImage.test 신규) / 성공 path 전송·실패 '' 폴백(useScan 갱신). tsc 0, jest 103/103.
- 실기기 확인 포인트: 스캔 시 Metro 로그 `[scan] upload-url issued`→`image upload complete`→`POST /scans | imagePath = scan/...` 실경로 확인 / 맵기 해제→재조회 후에도 미설정 유지 / 미설정 계정 프로필에 "-1" 노출 없음.

## KB-149 프로필 이미지 업로드 — 온보딩·수정·조회 실연결 (2026-07-16, P-004)
- [x] 사전 확인: **expo-image-picker 이미 설치**(~56.0.18, 스캔 갤러리에서 사용 중) → **리빌드 불필요, OTA 가능**. profileImageUrl 3계약(Onboarding·Update·MyProfile) 전부 optional string 배포 확인.
- [x] 업로드 공용화: scanImage.uploadImage(file, purpose) 재사용(P-003에서 파라미터화 완료) — 반환을 { path, publicUrl }로 확장(스캔은 path, 프로필은 publicUrl). profileImage.ts 신규: pickProfileImage(1:1 크롭) + uploadProfileImage.
- [x] 온보딩 profile 스텝: 아바타+카메라 뱃지(선택 사항) — 선택 즉시 업로드, draft에 URL 보존(중단 복귀 시 유지), 제출 body에 포함(미선택=필드 생략). 실패 시 정직한 에러 문구 + 사진 없이 진행 가능.
- [x] 프로필 수정: 아바타 탭 → 선택→업로드→즉시 PATCH(국적 행과 같은 즉시 적용 시맨틱). 조회(프로필 탭·수정 화면): profileImageUrl 렌더, 없으면 기존 플레이스홀더.
- ⚠️ **BE 질의 2건 (진행로그·보고 기록)**: ① 프로필용 purpose 값 미명시(예시 MENU_SCAN뿐) — `PROFILE_IMAGE` 추정 사용(profileImage.ts 상수 한 곳), 확정 시 그 값으로 교체 ② profileImageUrl에 publicUrl vs objectKey 미명시 — **필드명이 Url이라 publicUrl 우선** 채택, 반증되면 path로 전환.
- 테스트 +4: uploadImage publicUrl 반환(기존 확장) / adaptProfile profileImageUrl 매핑(URL·누락·빈문자열) / PATCH body 포함+invalidate / 온보딩 body 포함·미선택 생략. tsc 0, jest 107/107.
- 실기기 확인 포인트: 온보딩 사진 선택→가입 후 프로필 탭 표시 / 수정에서 교체 즉시 반영·재조회 유지 / 미설정 플레이스홀더 / 업로드 실패(비행기 모드) 시 에러 문구 + 가입·수정 계속 가능. ⚠️ purpose 추정값이라 발급 400 가능 — 에러 로그 공유 요망.

## P-006 — profileImageUrl 전송값 path(objectKey) 교체 (2026-07-20, KB-149 후속)
- [x] BE 확정 반영(종한 7/16 저녁): purpose `PROFILE_IMAGE` 확정(추정→확정, 질의 소멸) · 전송값 publicUrl → **path(objectKey)** (CDN distribution 교체 대응 — 도메인 조합은 서버 몫). P-004에 명시해둔 전환 지점 그대로 한 곳(uploadProfileImage) 교체.
- [x] 조회 방어: `adaptProfileImageUrl()` — 비-http 값(path로 오는 등)은 렌더 불가 → 플레이스홀더(null) + 감지 로그("BE 확인 필요"). 렌더는 서버 조합 절대 URL만.
- [x] 온보딩 미리보기 분리: 제출용 photoPath(objectKey) + 미리보기용 photoPreview(로컬 파일 uri) — path는 Image 렌더 불가라서. draft 복귀 시 미리보기는 소실돼도 path는 유지·제출됨. 수정 화면은 PATCH→['me'] invalidate 재조회로 서버 URL 렌더(기존 경로 그대로).
- 테스트 +3: uploadProfileImage가 path 반환+purpose 확정값 잠금(profileImage.test 신규) / 조회 비-http 방어 / PATCH·온보딩 body 잠금 값 path로 갱신. tsc 0, jest 110/110.
- 실기기 확인 포인트: 프로필 사진 교체→탭·수정 화면 렌더(서버 조합 URL) / Metro에 "절대 URL이 아님" 로그 뜨면 조회 응답이 path로 오는 것 — BE 확인 필요.

## KB-174 공통 상태 UI — 에러·오프라인·스켈레톤 적용, false-empty 제거 (2026-07-20, P-007)
- [x] 사전 확인: 디자인 J 시리즈 원자가 **이미 구현되어 있었음** (StateBlock/SkeletonList/아이콘/states.* i18n ×10 — states.tsx 카탈로그) — 미적용이 문제. 신규 문구 불필요(패리티 검증 완료), 배선만 수행.
- [x] 공용 렌더 1개: `QueryErrorBlock({error, onRetry, onGoBack?})` (StateBlock.tsx) — J3(err 톤+IconAlertTri+Try again[+Go back]) / J4(IconWifiOff+Retry) 분기. `classifyQueryError`: 'NETWORK' 프리픽스(공용 클라이언트가 fetch 거부 시 부여) = offline, 그 외 = error — **JS-only(NetInfo 없음, 리빌드 회피)**, 한계 주석 명시.
- [x] 적용: 홈(isError 분기 신설 — 에러가 "아직 스캔이 없어요"로 위장되던 false-empty 제거) · 음식 탭(기존 자체 에러 블록 → 공용 교체, 오프라인 분기 획득) · 프로필 탭(로딩 스켈레톤 + 에러 블록 — 백지 제거) · 음식 상세(톤 통일 + Go back, 자체 스타일 삭제). Try again은 해당 쿼리 refetch만.
- [x] 빈 상태는 성공+0건일 때만 — 홈 테스트로 잠금.
- 테스트 +6 (tabStates.test 신규, 풀스크린 렌더): 탭별 에러→J3 단언 3건 + 홈 false-empty 잠금 + NETWORK→J4 분류 + 프로필 로딩 스켈레톤. tsc 0, jest 116/116.
- 실기기 확인 포인트(DoD): 기내모드에서 세 탭 J4+Retry / (BE 5xx 시) 세 탭 J3+Try again 재요청 / 홈 정상 0건이면 기존 빈 상태 그대로.

## P-008 — useFoods 401 삼키기 제거 (2026-07-20, KB-174 후속)
- [x] useInfiniteFoods·useSearchFoods의 401→빈 목록 특례 제거 (게스트 정숙 임시책 — foods 인증-선택 전환 완료로 소생 조건 충족). try/catch 자체가 그것뿐이라 통째 제거. 남는 401=죽은 토큰 → isError로 표면화되어 P-007 에러 블록이 뜬다(음식 탭 백지 소멸).
- [x] 겸사 grep 재확인: 같은 패턴 다른 훅에 없음 (beAuth/client의 401은 refresh 로직 — 별개).
- 테스트 +3 (useFoods401.test 신규): browse·search 401→isError(빈 목록 위장 없음) + 게스트 정상 응답 무변. tsc 0.

## P-009 — 탭별 스켈레톤 (실제 레이아웃 미러) (2026-07-20, KB-174 후속)
- [x] Skeleton.tsx에 화면별 조립 3종 추가 — Shimmer 원자·톤·애니메이션 재사용, 블록 구성만 상이(새 디자인 결정 없음): SkeletonHome(인사말 2줄→기피 배너→히어로 CTA→섹션+카드 행 2), SkeletonFoodGrid(2열 그리드 카드 ×6 — 사진 102 + 이름/뱃지 줄, 카드 폭 48.5% 실측 일치), SkeletonProfile(아바타 원 56→랭킹 카드→섹션 행 3).
- [x] 시프트 0 목표: 패딩을 각 화면 body와 동일(18/4/20), 카드·아바타 치수 실측값 미러. 화면 레이아웃 변경 시 동반 갱신 주석 명시.
- [x] 배선 교체: 홈→SkeletonHome, 음식 탭→SkeletonFoodGrid(FlatList 패딩 안), 프로필→SkeletonProfile. 범용 SkeletonList는 리스트형 화면(검색·카탈로그) 유지.
- 테스트: 탭별 로딩→전용 스켈레톤 렌더 잠금 3건(기존 1건 강화 + 2건 신규). tsc 0, jest 121/121.
- 실기기 확인 포인트(예진): 각 탭 첫 로드에서 스켈레톤이 실제 화면 골격과 겹쳐 보이는지 + 로딩→렌더 전환 시 점프 없음.

## KB-177 탈퇴 후 로컬 잔재 정리 — 게스트 재개 모달 버그 (2026-07-20, P-010)
- [x] `clearMemberLocal.ts` 신규 — 탈퇴 성공 시 **회원 귀속** 로컬 상태 일괄 정리: 온보딩 draft(kbap.onboardingDraft.v1) + 맵기 로컬(kbap.profile.spice.v1). 유지(기기 귀속 판단): introSeen·lang·installed 센티널·recentSearches(서버 미전송 기기 검색기록). 세션(토큰·서버캐시)은 withdrawBe, Keychain은 freshInstall이 각자 담당 — 계층 분리 주석. 새 회원 키 추가 시 등록 지점 명시. SPICE_KEY 중복 정의(3곳→submit.ts export 1곳) 겸사 해소.
- [x] doWithdraw 배선: withdrawBe → clearMemberLocalState → logOut 순. 파일 내 관례 따라 lazy require(웹 번들 안전+jest 호환 — 기존 await import는 jest 미지원이라 전환).
- [x] 방어 분기(이중 방어): `shouldShowResume()` 순수 함수 추출 — **게스트는 draft/플래그 무관 미노출**, 회원은 KB-75 규칙 무변(서버 플래그 원천, 플래그 없으면 draft 기준).
- [x] 로그아웃 draft 방침 현행 유지 + 판단 기록: 타계정 재로그인 시 이전 draft 노출 리스크는 방어 분기 이후 "플래그 없는 로그인 회원"뿐 — 실회원은 서버 플래그가 원천이라 실해 제한적, 범위 확장 안 함(보고 기록).
- 테스트 +5: 정리 키 2종+타 키 미접촉 / 게스트 미노출 3케이스 / 회원 무변 4케이스 / 탈퇴 배선 통합(동의→확정→withdrawBe+정리+/login). tsc 0, jest 126/126.
- 실기기 확인 포인트(예진·DoD): 탈퇴 완주→"둘러보기" 게스트 진입 시 재개 모달 없음 / 정상 회원 온보딩 중단→재개 무변.

## KB-178 기피 재료 선택 UI — B안 (2026-07-20, P-011)
- [x] IngredientFilter 선택 요약: 세로 wrap → **고정 높이 1줄 가로 스크롤** (공용 컴포넌트 1곳 수정 → 온보딩·프로필 양쪽 자동 적용, 복붙 없음). 칩 탭=제거 유지, **선택 순서 유지**(selected 배열 순서 — 기존 카탈로그 순 재정렬 제거), 새 선택 시 자동 끝 스크롤(제거 시엔 안 움직임). 카운트 소제목(기존 activeHead) 유지.
- [x] 0건 처리 판단: 줄 자체 미표시(현행 유지) — 0↔1 전환 1회 높이 변화만 남음(placeholder 유지 여부는 실물 확인 후 판단, 보고 기록). 1→n은 높이 불변.
- [x] 온보딩 restrictions CTA 하단 스티키: Restrictions 스텝의 foot을 ScrollView 밖 스티키 바로 이동("계속 · n개" + skip 링크, restrictions.tsx savebar 톤), 목록 하단 패딩 130으로 가림 방지. 프로필 수정 화면은 savebar가 이미 하단 고정 — 요약 줄만 공용으로 적용됨.
- 테스트 +3: 요약 줄 horizontal 1줄+선택 순서 잠금 / 0건 미표시 / 온보딩 CTA가 ScrollView 밖(스티키) 잠금. tsc 0, jest 129/129.
- 실기기 확인 포인트(예진·DoD): 선택/해제 시 목록 스크롤 위치 유지·밀림 없음 / 새 선택이 줄 끝에 보임(자동 스크롤) / CTA 항상 노출 / 0↔1 전환 점프 체감 시 placeholder 논의.

## KB-179 상세 가격 — 스캔 진입 param 전달 (2026-07-20, P-012)
- [x] 방향(BE 확정): 가격은 메뉴판 속성 — detail API 불가. 스캔 결과 → 상세 이동에만 `?price=` param, 타 경로(홈·목록·검색·북마크) 미표시가 정상.
- [x] 첨부: scan.tsx openDish 한 곳(리스트 행·오버레이 마커·사진 전용 항목 전부 경유) — `scanPriceParam()`: 양의 정수만 첨부, null/0/비정수 미첨부.
- [x] 표시: 상세 metaRow 아래 한 줄 "₩9,000 · 스캔한 메뉴판 기준"(i18n ×10, ₩ 포맷만). `parseScanPrice()` 방어 — 정수 파싱 실패·음수·0·안전 정수 초과·지수 표기 전부 null(미표시), 표시 전용·저장 안 함.
- 테스트 +5 (scanPrice.test): 첨부 잠금 2건 + 파싱 게이트 3건(조작값 포함). tsc 0, jest 134/134.
- 실기기 확인 포인트: 스캔 결과에서 가격 있는 메뉴 탭 → 상세 상단 ₩ 표시 / 같은 음식을 목록·검색으로 진입하면 미표시.

## KB-149 후속 — 프로필 사진 삭제 (2026-07-20, P-013)
- [x] 프로필 수정 화면 아바타 아래 "사진 삭제" 액션 — **사진 설정 상태에서만 노출**(미설정·업로드 중 미노출). 확인 얼럿 없이 즉시 실행 판단(재선택으로 복구 용이 — 계정 삭제급 아님), danger 톤 텍스트 링크.
- [x] **전송값 게이트(null vs '') 미확정** → 잠정 `''` 채택: 스키마 `type: string`(비-nullable)이라 null은 검증 위반 소지 + imagePath '' 선례 동일 계열. `PROFILE_IMAGE_CLEAR` 상수 한 곳 격리 — 확정 시 한 줄 교체. "생략=유지" 보존(undefined만 미전송). 서버 반응 실측은 계정 필요 → 실기기 확인 포인트로 이관.
- [x] 삭제 성공 시 기존 useUpdateMe onSuccess의 ['me'] invalidate 재조회 → 탭·수정 화면 플레이스홀더 복귀. 온보딩 무변.
- 테스트 +3: 삭제 전송값 '' 잠금+invalidate / 노출 조건(설정 시 노출·탭→mutate) / 미설정 시 미노출. i18n removePhoto ×10. tsc 0, jest 137/137.
- 실기기 확인 포인트(예진·DoD): 삭제 → 플레이스홀더 복귀 + 앱 재시작 후 유지 (**서버가 ''를 삭제로 처리하는지 확정 — 사진이 남으면 null 확정 요청**) / 사진 없으면 액션 없음.

## KB-149 후속 — 기본 프로필 사진 서버 일원화 (2026-07-20, P-014)
- [x] 기본 아바타 png 산출: IconProfile 글리프를 512×512 png로 재현(rsvg-convert) — 배경 단색 #FDF1EC(흰 배경 위 아바타 버블 rgba(226,88,12,0.08) 합성값 — 원형 크롭·타 배경에서도 동일 룩 판단), 글리프 primary #E2580C stroke 2/24 round. `dropbox/yj/profile-default/`에 svg+png 전달 (종한 서버 서빙용).
- [x] 삭제 전송값 '' → **null** 교체 (BE 확정 7/20): PROFILE_IMAGE_CLEAR 상수 한 곳 + UserUpdate/ProfileUpdateWire 타입 `string | null`. 생략=유지 보존. 스펙 스키마는 아직 비-nullable 표기 — 진행로그 기록, 종한 배포와 동시 적용.
- [x] 조회 렌더: 서버 기본 URL 오면 기존 절대 URL 렌더 경로 그대로 동작. FE svg 플레이스홀더 분기·비-http 방어(adaptProfileImageUrl) **유지** — 제거 안 함.
- 테스트: 삭제 null 잠금으로 교체(PATCH body null + invalidate / 화면 mutate null). tsc 0, jest 137/137.
- ⚠️ **OTA 주의**: 서버가 null 삭제를 배포하기 전에 이 커밋이 OTA에 실리면 삭제가 무동작(400 가능) — **서버 배포 확인 후 OTA 포함**.

## KB-187 언어 전환 즉시 반영 + 맵기 라벨 i18n (2026-07-20, P-015)
- [x] **잔상 원인 실조사 결과**: placeholderData/keepPreviousData 아님(미사용 확인). `setLang`이 컨텍스트 리렌더(동기)와 `i18n.changeLanguage`(비동기)를 분리 실행 → 완료 전 리렌더에선 쿼리 키의 `i18n.language`가 이전 언어라 **키가 안 바뀌고**, staleTime 60s 동안 구언어 데이터가 fresh로 유지되는 잔상.
- [x] 최소 수술: changeLanguage 완료 직후 lang 종속 루트 키(home/foods/food/me)만 1회 invalidate — 활성 쿼리 즉시 재조회, 새 키는 fresh 마운트라 P-009 스켈레톤이 그대로 뜸. 매 탭 진입 재호출 아님(지시 준수).
- [x] SPICE_SCALE i18n 이전: 영어 하드코딩 11개 → `spice.scale.0~10` 키 ×10 로케일(110 문구), 사용처 4파일 5곳 전부 `t()` 래핑 (온보딩 스텝·프로필 칩·수정 칩·상세).
- [x] 스캔 리스트 name 한국어 고정은 범위 제외 준수(BE 질의 중 — 무접촉).
- 테스트 +12: 언어 전환→lang 종속 4키 무효화+비언어 무접촉 잠금 / SPICE 키 11개+패리티 ×10. tsc 0, jest 149/149.
- 실기기 확인 포인트(예진·DoD): 언어 변경 직후 홈·음식 탭 스켈레톤→새 언어 (이전 언어 잔상 0) / 맵기 설명이 선택 언어로 (온보딩·프로필·상세).

## KB-149 최종 — 프로필 사진 컨벤션: 기본 path 전송 (2026-07-20, P-016)
- [x] 3차 최종 확정 반영(''→null→**기본 path**): `PROFILE_IMAGE_DEFAULT_PATH = 'images/default/profile/profile-default-512.png'` (memberAdapter, 경위 주석). PROFILE_IMAGE_CLEAR = 그 값 (상수명 유지 — 화면 무변). 타입 string 원복(null 폐기).
- [x] 온보딩 미선택도 기본 path **명시 전송** (필드 생략 폐기 — submit.ts, 필드는 항상 값).
- [x] 삭제 액션 노출 판별: `isDefaultProfileImage(url)` (URL에 images/default/profile/ 포함) — 기본 사진이면 사진 없음 취급·미노출, 커스텀만 노출. 렌더는 서버 URL(기본 포함) 그대로, svg 플레이스홀더는 URL 부재·비-http 방어용 유지.
- [x] 실측: 스펙 표기 여전히 optional(MyProfileResponse) — "항상 값" 서버 배포 여부 스펙만으론 확인 불가, 진행로그 기록. 코드 완성 상태.
- 테스트 갱신 +2: 삭제·온보딩 미선택 전송 기본 path 잠금 / isDefault 판별 5케이스 / 기본 URL 시 삭제 액션 미노출. tsc 0, jest 151/151.
- ✅ **P-014 OTA 게이트 소멸**: 기본 path는 항상 유효한 string이라 이 커밋부터 서버 무관 OTA 가능.

## KB-176 Android 첫 빌드 — 공기계 스모크용 apk (2026-07-20, P-017)
- [x] 사전 점검: google-services.json 루트 존재 ✓ (Firebase Android 등록돼 있음 — 즉시 보고 사유 없음), app.json android 설정(com.rocher.kbap) 정상.
- [x] **eas.json 무변경 판단**: preview(distribution: internal)는 Android 기본 산출물이 apk — buildType 명시는 동작 동일하면서 eas.json이 fingerprint 소스라 다음 iOS 프로덕션 OTA에 eas.json 스왑 부담을 추가함(스킬 3-1 함정 계열) → 생략. 산출물 .apk 확장자로 검증 완료.
- [x] 첫 빌드 성공 (빌드 00ba0336, ~26분 — 첫 빌드 콜드 캐시): keystore EAS 자동 생성(Build Credentials 3TdEsf5DKE). preview 채널/브랜치 자동 생성됨.
- [x] SHA-1 추출: eas credentials가 인터랙티브라 apk 서명 블록(v2)을 직접 파싱 — SHA1 D2:F7:2B:1A:F4:5C:C4:23:13:18:CB:98:D4:65:7D:6D:F8:2A:A3:35. **구글 로그인 동작하려면 예진이 Firebase 콘솔에 이 SHA-1 등록 필요.**
- 확인 포인트: 애플 로그인 버튼은 Android에서 미노출이 정상(appleAvailable = iOS 전용 기구현) / 코드 변경 0 (PROGRESS 기록만).

## KB-194 스플래시 개선 — 태그라인 제거 + 부트 게이팅 (2026-07-20, P-018)
- [x] **에셋(네이티브 — 빌드 7 반영)**: splash-icon.png 알파 밴드 분석(900×1200 — 심볼 326..625 / 워드마크 708..815 / 태그라인 838..857) → 태그라인 스트립 제거 + 투명 여백 정리 크롭(391×535, 패딩 24 — 하단은 태그라인 직전 캡). PIL 부재로 PNG 디코드/인코드 직접(stdlib zlib). 미리보기: dropbox/yj/splash-v2-preview.png (푸시됨). app.json imageWidth 280→230 원복(_comment의 예약 이행).
- [x] **부트 게이팅(JS — OTA 가능)**: bootGate.ts — `gateSplash`(min 1200ms / cap 4000ms, reject=settle 취급 — 오프라인이 스플래시 안 붙잡음) + `prefetchBootData`(홈·목록, 세션 시 me). 프리페치 키는 실키와 일치: 훅 queryFn 3개를 fetchHome/fetchFoodsPage/fetchMe로 추출 공유 + `resolveInitialLang()`으로 저장 언어를 LocaleProvider 마운트 전에 선적용(키·Accept-Language 정합). _layout의 entryChecked 게이트에 합류 — 기존 intro/freshInstall 시맨틱 유지.
- 테스트 +4 (가짜 타이머): min 전 hide 절대 없음 / min~cap settle 즉시 / cap 강제 / reject 무지연. tsc 0, jest 155/155.
- ⚠️ **OTA 주의(다음 발행 시)**: 이 커밋은 네이티브(에셋·app.json)+JS 혼합 — 빌드 7 전에 게이팅만 OTA로 내려면 발행 순간 app.json·splash-icon.png를 직전 상태로 스왑(기존 gitignore 스왑에 추가). 빌드 7 재베이스라인 후 소멸.
- 실기기 확인 포인트: (OTA 후) 빠른 네트워크 ~1.2초 균일 스플래시 / 기내모드 최대 4초 후 스켈레톤·J4 / (빌드 7) 태그라인 없는 스플래시 + 230 크기.

## KB-195 온보딩 맵기 스킵 = -1 명시 전송 (2026-07-20, P-019)
- [x] 스웨거 재실측: `OnboardingRequest.spicinessPreference` **required 승격 확인** (겸사: profileImageUrl도 required 승격 — P-016이 이미 항상 전송이라 무대응 OK). P-003의 전환 예약 주석("실측되면 -1 명시 전송 전환") 이행.
- [x] submit.ts: 조건부 스프레드 제거 → 스킵(UNSET) 시 `spicinessPreference: -1` 명시 전송 (KB-150 센티널 정책 그대로). 헤더 주석 "전 필드 required" 갱신. 로컬 보관·UNSET 처리 무변.
- 테스트 +1: 스킵→-1 / 설정→실값 잠금. tsc 0, jest 156/156. JS-only — OTA 가능.

## KB-196 Android 구글 로그인 accessToken 누락 (2026-07-20, P-020)
- [x] 원인(브릿지 실측 그대로): useSocialAuth.signInWithGoogle이 GoogleAuthProvider.credential(idToken)로 idToken만 전달 — @react-native-firebase Android 네이티브는 accessToken도 요구("accessToken cannot be empty", iOS는 idToken만으로 통과해 iOS만 동작해옴).
- [x] 수정: idToken 확보 직후 `GoogleSignin.getTokens()`로 accessToken 받아 `credential(idToken, accessToken)` 2인자 전달. 취소·에러 분기 무변, iOS 무해(회귀 없음).
- 테스트 +1 (socialAuthGoogle.test): 네이티브 모킹 수준에서 getTokens 호출 + credential(idToken, accessToken) 2인자 잠금. tsc 0, jest 157/157.
- 발행: preview 채널 OTA (JS-only, 공기계 재빌드 불요) — 발행 ID는 REPORTS 병기.
- 발행 완료: preview 채널 OTA — Android update 019f7e7b-929e-7b31 (runtime cbbec117 = 공기계 preview 빌드 일치, 도달 확인). ⚠️ 발행 순간 P-018 이전 에셋(app.json·splash-icon.png)을 096a954~1로 스왑 — preview 빌드가 P-018 네이티브 변경 전이라 fingerprint 매칭 필요(스킬 3-1 선례, iOS _photostyle과 별개). JS 번들은 에셋 무관이라 셔먼 동일. 발행 후 즉시 복원.

## KB-197 Android UI 정리 — 온보딩 제출 버튼 짤림 + 언어 선택 리플 (2026-07-20, P-021)
- [x] **온보딩 제출 버튼 짤림 원인 정정**: stickyFoot(restrictions만)은 insets 적용 상태였고, 실제 짤린 "제출" 버튼은 **마지막 spice 스텝의 in-scroll `foot`**(marginTop:auto, body paddingBottom 28뿐 — 내비바 클리어런스 없음). 안드 edge-to-edge에서 insets.bottom 과소보고(0) 기기 대비: `bottomInset = Platform.OS==='android' ? Math.max(insets.bottom, 48) : insets.bottom`. in-scroll foot 스텝은 body paddingBottom을 `28+bottomInset`으로, restrictions stickyFoot는 `bottomInset+14`로. iOS는 실측값 그대로(무회귀).
- [x] **언어 선택 리플**: LanguagePicker row에 `android_ripple={{color:'rgba(226,88,12,0.12)'}}` 명시(안드 기본 회색 리플이 padding까지 번지던 것 → 브랜드 톤) + row `overflow:'hidden'`으로 라운드 코너 클립. 선택 상태는 기존 테두리+틴트(rowOn) 유지. iOS는 android_ripple 무시. 공용 컴포넌트라 프로필 수정·프로필 탭 동시 반영.
- tsc 0, jest 157/157. 스타일-only, 신규 테스트 없음(렌더 회귀는 기존 스위트가 커버). JS-only — preview OTA.
- 발행: preview 채널 OTA — ID는 REPORTS 병기. ⚠️ P-018 이전 에셋 스왑 필요(공기계 preview 빌드 fingerprint 매칭 — P-020 선례).
- 발행 완료: preview OTA — Android update 019f7e9c-bb69-76cd (runtime cbbec117 일치). 에셋 스왑 후 복원.

## KB-198 Android 스캔 가로 감지 — expo-sensors 포팅 (2026-07-20, P-022) ⚠️ 재빌드 필요(OTA 불가)
- [x] **expo-sensors 추가**(~56.0.6) — 네이티브 모듈, autolink. app.json plugins에 `["expo-sensors", {"motionPermission": false}]` 등록: Android DeviceMotion(가속도)은 런타임 권한 불요, iOS는 Platform 가드로 미사용이라 불필요한 NSMotionUsageDescription 선언 회피(App Store 리뷰 클린). ⚠️ 재빌드에만 실림 — preview OTA로 못 감.
- [x] `deviceOrientation.ts` 순수 함수: 중력 벡터 → portrait/landscapeLeft/landscapeRight. 임계각 35°+flat(위/아래 향함) 가드로 45° 떨림 방지. 좌표계 부호를 KB-141 오버레이 rotate와 일치(landscapeLeft→+90°).
- [x] scan.tsx: Android 전용 useEffect로 DeviceMotion.addListener(200ms) → 기존 camOrientation state에 공급(같은 state 두 소스, 오버레이 로직 무변). iOS는 expo-camera 콜백 현행 유지 — 안드만 추가(회귀 최소화). 언마운트 시 sub.remove().
- 테스트 +5 (deviceOrientation.test): 세워듦/임계 미만·이상/flat/거꾸로 경계. tsc 0, jest 162/162.
- ⚠️ **발행**: OTA 아님 — 다음 안드 빌드(빌드2)·다음 iOS 빌드(빌드7과 함께)에 포함. 실기기 확인은 재빌드 후.

## KB-197 재수정 — 언어 선택 회색 = Android elevation (2026-07-20, P-024)
- [x] P-021 리플 오진 정정: LanguagePicker row의 회색 padding은 android_ripple이 아니라 **sh1(elevation:1) + overflow:'hidden'(P-021 추가) 공존**이 원인(안드 알려진 버그 — elevation 그림자가 클립되며 padding 회색 채움). 증거대로 closeBtn(sh1은 있지만 overflow 없음)은 멀쩡했음.
- [x] row에서 `...shadow.sh1` 제거 — borderWidth 1(C.hair)로 이미 구분, sh1 opacity 0.04라 시각 손실 미미. overflow:'hidden'은 유지(리플 라운드 클립, elevation 없으면 무해). android_ripple(P-021) 정상이라 유지. rowOn 틴트/테두리 무변.
- tsc 0, jest 162/162. 스타일-only, JS-only — preview OTA. 발행 ID는 REPORTS 병기.
- 발행: preview OTA — Android update 019f7f2f-05a0-72f9 (runtime cbbec117 = 공기계 build1 일치). ⚠️ P-022(expo-sensors 네이티브) 이후라 build1 도달·크래시 방지 위해 발행 순간 app.json·splash·package.json을 0e9f884로 + scan.tsx를 eecbe52~1(센서 없음)로 스왑(번들 크래시 방지, JS는 P-024만 실림), 후 전량 복원. build2 나오면 스왑 폐기.

## KB-198 후속 — expo-sensors 지연 require (dev 빌드 크래시 수정) (2026-07-20, P-022 보강)
- [x] 실기(iOS dev 빌드) 크래시 발견(예진): `Cannot find native module 'ExponentPedometer'`. 원인 — scan.tsx 최상단 `import {DeviceMotion} from 'expo-sensors'`가 파일 로드 시 네이티브 모듈을 즉시 require → expo-sensors 추가 전 빌드(현 dev 빌드)엔 그 모듈이 없어 iOS에서도 앱 전체 크래시(라우트 파일이라). Android 가드는 사용부에만 있어 import 자체를 못 막음.
- [x] 수정: 최상단 import 제거 → Android 가드 **안에서 try-require** + catch 폴백. iOS는 expo-sensors를 아예 안 건드림(현 dev 빌드 즉시 정상 — metro 리로드만). Android 네이티브 미탑재(재빌드 전)면 조용히 가로 힌트만 비활성, 스캔은 정상.
- tsc 0, jest 162/162. **iOS는 재빌드 불필요(로컬 metro 리로드로 해결)**. Android 가로 감지 실동작은 여전히 Android 재빌드 필요(변함없음).

## KB-178 재수정 — 기피 재료 요약 줄 0→1 밀림 (2026-07-20, P-026)
- [x] P-011 보고 유보분("0↔1 전환 높이 변화, placeholder 판단 요망") 확정 처리(Q-11 2·6). 원인: activeCard 안 칩 ScrollView가 selected>0일 때만 렌더 → 첫 선택 시 칩영역+gap이 새로 생기며 아래 목록 1회 밀어냄.
- [x] 수정: 칩 영역을 항상 고정 높이(36 = rmChip 높이) View로 렌더 — 빈 상태엔 placeholder 텍스트(restrictionsEdit.chipPlaceholder ×10 로케일), 선택 시 기존 horizontal ScrollView. 빈↔선택 레이아웃 높이 불변 → 목록 밀림 0. 공용 IngredientFilter라 온보딩·프로필 동시 반영.
- 테스트: 0건 placeholder+ScrollView 미렌더 / 0↔1 칩영역 높이 36 불변 잠금(밀림 0 근거). tsc 0, jest 163/163. JS-only — preview OTA.
- 발행: preview OTA — Android update 019f7f46-3946-7b5a (runtime cbbec117 = build1 일치). build1 호환 스왑(app.json·splash·package.json·scan.tsx) 후 복원.

## KB-174 후속 — 음식 탭 오프라인 전체화면 에러 (2026-07-20, P-027)
- [x] Q-08 실기: 음식 탭 오프라인 시 헤더(제목·부제·검색바)가 그대로 뜨고 그 아래 오프라인 에러 겹침. 원인: FlatList가 ListHeaderComponent(Header)를 항상 렌더 + ListEmptyComponent로 QueryErrorBlock을 아래 깖.
- [x] 수정: `ListHeaderComponent={isError ? null : Header}` — 에러/오프라인 시 헤더 미렌더 → QueryErrorBlock 전체화면(홈 탭 톤 통일). 로딩(스켈레톤)·정상·빈 상태는 헤더 유지. StickyHeader(브랜드 크롬)는 홈 탭과 동일하게 유지.
- 테스트 +1: 에러→헤더(food.title·searchPlaceholder) 미렌더 / 정상→헤더 렌더 잠금. tsc 0, jest 164/164. JS-only — preview OTA.
- 발행: preview OTA — Android update 019f7f49-e9ad-74bf (runtime cbbec117 = build1 일치). build1 호환 스왑 후 복원.

## KB-199 홈 lang 파라미터 — /home?lang= (2026-07-21, P-023) 🔴긴급
- [x] BE가 lang을 모든 대상 API에서 필수 승격(7/20 밤) — /home만 미전송이라 홈 조회 400날 상태. fetchHome()을 `/home?lang=${apiLang()}`로(/foods 동일 패턴), apiLang import 추가. bootGate 프리페치 키는 이미 ['home', lang]이라 정합.
- [x] 표시 언어를 파라미터가 담당 → Q-13 언어 전환 잔상·게스트/미설정 영어도 동시 해결(회원 DB appLanguage 기반 → 요청 언어 기반). appLanguage PATCH(선호 저장)는 무변.
- 테스트 +1: /home 요청 URL에 lang 포함 잠금. tsc 0, jest 165/165. JS-only.
- 발행(🔴긴급 홈 400): preview OTA Android 019f827f-1b3d-7727(cbbec117) + production OTA iOS 019f8283-3088-74f7(8d0d5504 = 테플 빌드 일치). 프로덕션 스왑 = _photostyle gitignore 제거 + app.json·splash·package.json·scan.tsx를 pre-P018/P022(0e9f884/eecbe52~1)로, 후 전량 복원.

## KB-203 프로필 계정 연동 — provider 표시 (2026-07-21, P-029)
- [x] 실측: MyProfileResponse.provider required 배포 확인. MyProfileWire·adaptProfile·User에 provider 매핑(구서버 방어 옵셔널). email 행은 계약에 없어 항상 undefined였음 — provider 행으로 교체.
- [x] edit.tsx 연동 행: APPLE→IconApple / GOOGLE→IconGoogleG(로그인 화면 SVG 재사용, 헌법 준수) / 미지원·누락→IconProfile+중립 폴백. `providerLabelKey()` 순수 함수 — 빈 값 금지. i18n linkedVia/Apple/Google/Social ×10.
- 테스트 +2: providerLabelKey 4케이스(APPLE/GOOGLE/미지원/누락) + adaptProfile provider 매핑. tsc 0, jest 167/167. JS-only — preview OTA(공기계), production은 검토 후 묶음.
- 발행: preview OTA — Android 019f828b-21bf-7230 (cbbec117 일치, build1 호환 스왑 후 복원).

## KB-174 후속 검색 오프라인 J4 — search.tsx (2026-07-21, P-028)
- [x] empty 상태(최근+인기)는 로컬·mock이라 자체 에러 신호가 없음 → 음식탭과 캐시 공유하는 useInfiniteFoods()를 프로브로 재사용(같은 키·추가 트래픽 없음). NETWORK(J4)일 때만 empty를 전체화면 QueryErrorBlock으로 대체 — 서버 5xx(J3)는 로컬 콘텐츠를 가리지 않고 empty 유지.
- [x] 온라인 동작 무변(인기 6종 정렬·최근 검색 로직 그대로 — 변경 금지 준수). 재량 항목: 제출 검색 에러 StateBlock→QueryErrorBlock 교체(J3/J4 분기 공짜 확보, 홈·음식탭 톤 통일).
- 테스트 +4(searchOffline.test.tsx): 오프라인→J4+최근/인기 미렌더 / 온라인→무변 잠금 / 프로브 500→empty 유지 / 제출 검색 NETWORK→J4. tsc 0, jest 171/171. JS-only — preview OTA.

## KB-202 스캔 캡처 WYSIWYG — 미리보기 밖 크롭 (2026-07-21, P-025) ⚠️재빌드
- [x] Q-12 원인: CameraView(cover)는 센서 중앙만 표시, takePictureAsync는 센서 전체 반환 → 미리보기 밖(브라우저 탭·상호명·가격 줄)이 업로드 혼입. `coverCropRect()` 순수 함수로 cover 표시 역산(비율 비교 → 잘린 축만 중앙 크롭, 비율 일치 시 재인코딩 생략) — src/lib/scan/coverCrop.ts.
- [x] capture 경로에 expo-image-manipulator 크롭 배선(새 API manipulate→renderAsync→saveAsync). **지연 require**(expo-sensors 선례 — 미탑재 빌드 크래시 방지), 실패 시 원본 폴백으로 스캔 지속. 원본(과다 캡처)은 크롭 직후 삭제(KB-137 캐시 위생). 업로드·OCR·결과 "원본 사진" 전부 크롭본. 오버레이 마커는 preview 정규화 공간이라 정합 유지. 갤러리 경로는 대상 아님(미리보기 없음).
- 테스트 +5(coverCrop.test.ts): 좌우 크롭(4:3 센서×세로 폰 실측 치수)/상하 크롭/비율 일치 null/무효 입력 null/경계 불변식. tsc 0, jest 176/176.
- ⚠️ **OTA 불가 — 네이티브(expo-image-manipulator) 추가.** expo-sensors(P-022)와 같은 빌드(안드 빌드2/차기 iOS)에 배치. 그 전 빌드에선 lazy-require 폴백으로 크롭만 생략.

## KB-205 음식 상세 주문+고지 원카드 (2026-07-21, P-030)
- [x] orderCard.ts 순수 조립: 을/를 받침 산술 분기(비한글은 병기 폴백), ko 라벨은 `getFixedT('ko')` 고정(UI 언어 무관 — place=ko 헌법), 기피 나열 6개 초과 "외 n개" 접기(조사는 '개'에), 기피 0개 → 고지 null(순수 주문 카드). 종교·식이 한 줄은 코드 보유 시 조건부 — ⚠️ 현행 와이어는 재료 81종만 왕복이라 live에선 미도달(서버 확장 시 자동 활성).
- [x] order.tsx: owner.tsx 동일 패밀리 풀스크린 카드 — 메뉴명 하이라이트+수량 스테퍼(1~5, SVG 없이 텍스트 ±), 고지 문단, reader 요약 캡션(order.caption)+닫기(owner.done 재사용). 상세·프로필 캐시 재사용, BE 호출 0.
- [x] 상세 최하단 CTA(order.cta): 개인화 판정 safe/caution만 노출(danger·unable·게스트 미노출). 빈 프로필은 false-safe 강등으로 caution → CTA 유지(순수 주문 카드). i18n cta/caption ×10.
- 테스트 +16(orderCard.test.ts 9 + orderCta.test.tsx 7): 을/를·ko 고정·0개 생략·접기·CTA 노출 조건·카드 문단 유무. tsc 0, jest 192/192. JS-only — preview OTA.

## KB-206 UI 폴리시 1 — 대비·큰글씨·press·시트 스프링·reduced-motion (2026-07-21, P-031)
- [x] A1 대비: ink3 #B0A395(2.28:1)→#837363(white 4.57✓/surface 4.23) — 토큰 한 곳 수정, 더 어두우면 ink2와 위계 구분 소멸이라 절충. 신규 primaryText(#c44a08, 4.85:1) 토큰 + 소형(≤14px) primary 텍스트 19곳 전환(15px+ 디스플레이 숫자·34px 카드 메뉴명은 brand primary 유지 — 대형 3:1 충족). 위험도 4색 불변.
- [x] A2 Txt maxFontSizeMultiplier 1.3 기본(전 화면 관통, prop 우선) · A3 스캔 unmatched 안내 numberOfLines 2.
- [x] B4 Btn press: onPressIn 즉시 scale 0.97 damped 스프링(AnimatedPressable) · B5 시트/모달: AuthGateSheet SlideInDown.springify(바운스 0)+Modal fade 유지, Snackbar 등장 스프링/퇴장 페이드, StickyHeader 숨김 timing→withSpring. LanguagePicker는 OS 네이티브 slide 유지(플랫폼 표준 — 커스텀 timing 아님). 스프링 프리셋은 src/lib/motion.ts 일원화(press/sheet/move).
- [x] B6 루트 ReducedMotionConfig(System) — reduce-motion 시 스프링 전역 비활성, Modal fade만 남아 크로스페이드 폴백.
- 테스트 +6(uiPolish.test.tsx): WCAG 대비 수식 잠금(ink3·primaryText·ink2 ≥4.5 on card)·위험도 4색 hex 불변·Txt 1.3 기본/override·press 스프링 즉발. 기존 테스트 9본 reanimated mock 표면 보강(withSpring·entering 빌더). tsc 0, jest 198/198. JS-only — preview OTA.

## KB-207 UI 폴리시 2 — kinetics 마이크로 인터랙션 (2026-07-21, P-032)
- [x] ① 칩 팝인/아웃(IngredientFilter 요약 칩, ZoomIn.springify spring.pop — P-026 고정높이 36 불변) ② 북마크 팝 timing 시퀀스→스프링 통일(StickyHeader) ③ Tab Pill Glide(스캔 세그먼트 — onLayout 실측+스프링 글라이드, 첫 배치 무애니메이션) ④ Error Shake(useShake 공용 훅: 감쇠 진동·재트리거 — 로그인 실패 SocialAuthButtons + 온보딩 제출 에러) ⑤ Success Check(SVG strokeDashoffset 드로잉 — 온보딩 제출 성공 0.9s 오버레이 후 홈) ⑥ Stagger Entrance(스캔 결과 리스트 FadeInDown 60ms 간격·상한 8행) ⑦ Step Progress 노드 팝(TopBar Seg) ⑨ 수량 스테퍼 값 팝(주문카드 bump — 소량 바운스).
- [x] ⑧ Shimmer는 기구현 확인(P-009 sweep) — 무변. 바운스는 탭 모멘텀 있는 곳(칩·북마크·수량·노드)만 spring.pop, 등장류는 전부 damped. reduced-motion: 전역 ReducedMotionConfig가 entering/스프링 스킵(스태거 생략 요건 충족).
- 테스트 +1(orderStepper — bump 클램프·비활성·문장 갱신 잠금) + 기존 40 스위트 무회귀. 테스트 mock 표면 2차 보강(withSequence·withDelay·useAnimatedProps·Zoom/FadeInDown 체인). tsc 0, jest 199/199. JS-only — preview OTA.

## KB-205 정정 — 주문카드 종교·식이 문단 제거 (2026-07-21, P-033)
- [x] 회피 모델 평면 81종 확정(religion:/diet: 폐기)에 따라 P-030의 ③(lifestyleLinesKo)은 죽은 코드 — orderCard.ts 조립 로직·order.tsx 렌더·테스트 2케이스 제거. ②(기피 재료 고지)가 종교·식이를 재료 단위로 커버. tsc 0, jest 198/198(-1). JS-only — 다음 OTA 편승.

## 프로덕션 OTA 묶음 발행 (2026-07-21)
- P-024/026/027/028/029/030/031/032/033 묶음 — iOS update 019f82cb-7e3d-7f65, runtime 8d0d5504(테플 빌드 a6aebbf8 일치). 스왑(gitignore _photostyle 제거 + app.json·splash·package.json→0e9f884 + scan.tsx→pre-P022) 후 전량 복원, 트리 클린. 네이티브분(P-022 센서·P-025 크롭)과 scan.tsx 의존 효과(P-032 글라이드·스태거)는 스왑 특성상 미포함 — 차기 iOS 빌드에서 합류. Android 그룹은 무해 orphan(안드 프로덕션 빌드 없음).

## KB-203 재수정 — 연동 아이콘 공식 로고 (2026-07-21, P-034, Q-16 반려 대응)
- [x] icons.tsx의 IconApple/IconGoogleG 스트로크 근사치를 공식 로고로 교체(이름 유지 = 사용처 무변): 애플 필드 마크(단색 채움, 기본 ink) + 구글 4색 G. SocialAuthButtons의 로컬 GoogleG 제거하고 공용 IconGoogleG로 SSOT화 — 로그인 버튼과 연동 행이 같은 마크. 로그인 화면 무변(애플은 OS 네이티브 버튼).
- 테스트 +2(brandIcons — 4색 payload 고정·애플 채움/스트로크 회귀 방지). tsc 0, jest 200/200. JS-only — preview OTA(프로덕션 묶음 후보).

## KB-207 재수정 — 기피 칩 애니메이션 제거 (2026-07-21, P-035, Q-11 피드백)
- [x] P-032 ①(칩 ZoomIn/ZoomOut) 완전 제거 — 연속 선택 화면에서 매 칩 바운스가 소음(절제 원칙 실사례). 온보딩·프로필 공용 IngredientFilter 한 곳 원복, P-026 고정높이 36·placeholder 무변, 타 화면 P-032 효과 무변. tsc 0, jest 200/200. JS-only — preview OTA.

## KB-174 재수정 — 음식탭 캐시+오프라인 J4·스피너 공전 (2026-07-21, P-036, Q-08 반려)
- [x] ① food.tsx: 에러/오프라인 시 FlatList 자체를 전체화면 QueryErrorBlock으로 조건부 대체 — P-027의 ListEmptyComponent 경유는 캐시가 있으면 리스트가 비어있지 않아 에러 화면 미표시(캐시 목록+무헤더 어중간 상태). 리스트 미렌더로 onEndReached·푸터 스피너 경로 원천 차단, 헤더 미렌더 유지.
- [x] ② Spinner.tsx: 회전 래퍼 width/height=size + alignSelf center — 너비 미지정으로 FlatList 푸터 직속에서 전폭 stretch된 띠가 통째로 회전(아이콘 공전). 사용처 전수(scan/search/detail/saved 등 좁은 컨테이너) 무회귀 — 크기 고정은 기존 렌더와 동일 결과.
- 테스트 +2: 캐시 존재+NETWORK 에러 → J4·캐시 카드/헤더 미렌더(tabStates) · Spinner 래퍼 크기 고정(uiPolish). tsc 0, jest 202/202. JS-only — preview OTA.

## KB-125 랭킹 UI 2건 — 현재 카드 정렬·점수내역 코너 (2026-07-21, P-037, Q-15)
- [x] ① nodeBodyCur에 marginHorizontal:-14.5(패딩13+테두리1.5 상쇄) — 현재 등급 카드 내부 텍스트가 비카드 행들과 같은 좌/우 기준선, 테두리는 바깥으로. ② breakTotal에 하단 코너 radius 19(카드 20−테두리 1) — 음수 마진 확장 배경의 코너 뚫림 봉합. overflow:hidden 회피(P-024 안드 elevation 회색 선례). 스타일 상수만 — 신규 로직 없음. tsc 0, jest 202/202. JS-only — preview OTA.

## KB-212 빈 프로필 첫 스캔 배너 (2026-07-21, P-038)
- [x] 스캔 결과 상단 비차단 1줄 배너 — 회원 && 기피 0 && 세션 내 미닫음일 때만(게스트 제외 — 라우트 가드로 결과 화면 자체 미진입). absolute 오버레이(Close 버튼 우측 정렬)라 리스트/오버레이 토글 레이아웃 불변. 탭→/profile/restrictions, ×→세션 억제(모듈 플래그 nudgeSession.ts — 영구 아님, 재실행 시 리셋이 사양).
- [x] i18n scan.nudge ×10, SVG 아이콘만(IconChevron/IconClose).
- 테스트 +4(scanNudge): 기피0 노출/기피1+ 미노출/게스트 미노출/닫기 후 재마운트 억제. tsc 0, jest 206/206. JS-only — preview OTA(단, 스캔 화면이라 build1 preview에선 스왑 특성상 미확인 — 차기 빌드에서 확인).

## KB-195 재수정 — 맵기 미조작=미설정 (2026-07-21, P-039 🔴)
- [x] spice useState(5)→null: 미선택으로 시작, 불꽃 조작해야만 값 확정. 미조작+계속=UNSET(-1), 명시 건너뛰기 존치. UI: 대시(–/10)+선택 힌트(i18n spiceUnsetHint ×10)·불꽃 전체 회색·노브 미표시.
- [x] 근본 정리: 제출식에서 skipped.spice 제거 — **값의 null 여부가 단일 진실**. finish(spiceFinal) 인자화로 같은 탭 setState의 stale closure 경로 봉쇄(발견된 기저 버그: draft 복귀 skipped=true 상태에서 조작 후 계속해도 UNSET 제출 / 조작 후 건너뛰기가 실값 제출). 조작 즉시 skip 해제(setLevel 래퍼 — draft 저장 일관). draft null 왕복 유지, 프로필 수정 화면 무변.
- 테스트 +3(onboardingSpiceUnset — 미조작+계속=UNSET/조작 7=실값/건너뛰기=UNSET, 화면 레벨. body -1은 기존 submit.test가 잠금). tsc 0, jest 209/209. JS-only — preview OTA.

## KB-205 재수정 — 스테퍼 −/+ SVG 교체 (2026-07-21, P-040, Q-17)
- [x] 주문카드 StepBtn의 텍스트 글리프(Baloo2 어센트 편향으로 원 중심 이탈) → IconMinus 신규(수평선 1개)+IconPlus 재사용, stepText 스타일 제거. 크기 20·C.ink·비활성 opacity 무변.
- [x] 전수 점검: 기호를 아이콘 대용 텍스트로 렌더하는 곳은 order.tsx −/+ 뿐 — 나머지(· 구분점, — 빈값 대시, ≈ 근사, –/10 미선택 대시)는 활자 구두점으로 판단(문장 흐름 내 텍스트, 정렬 무관). 영구 규칙(기호=SVG)은 커맨드 센터가 CLAUDE.md 반영.
- 스타일/마크업 교체만 — 스테퍼 동작 테스트(orderStepper) 기존 잠금 통과. tsc 0, jest 209/209. JS-only — preview OTA.

## KB-152 재수정 — 부트 레이스: 정리→프리페치 직렬화 (2026-07-21, P-041 🔴 프라이버시)
- [x] cleanupIfFreshInstall()과 prefetchBootData()가 같은 틱 병렬 발사 → 신규 설치 첫 부팅에서 프리페치의 hasBeSession()이 아직 안 지워진 옛 Keychain 토큰으로 /home·/me 인증 프리페치 → 홈 캐시 이전 계정 오염(Q-05). bootGate에 prefetchAfterCleanup(cleanupDone, prefetch) 헬퍼 — cleanup settle 후에만 프리페치 시작(실패해도 진행), _layout 배선 + 주석 "정리가 프리페치·렌더 모두보다 선행"으로 갱신. gateSplash min/cap 시맨틱 무변.
- 테스트 +2(bootGate — cleanup 완료 전 prefetch 미시작 / cleanup reject여도 진행). 기존 게이트 타이밍 4케이스 무회귀. tsc 0, jest 211/211. JS-only — preview+production 양 채널 즉시 OTA.

## Q-18 후속 3건 — press 확산·스테퍼 위치·노드 팝 제거 (2026-07-21, P-042)
- [x] ① 공용 PressScale 래퍼(Btn과 동일 프리셋) 신설 — 생 Pressable 버튼류 적용: StickyHeader(back·search·bell·bookmark·Sign in pill), SubHeader back, search back, owner/order close·Done, 주문 StepBtn. 제외(과적용 금지): 리스트 행/카드 내비, ranking Cta(기존 pressed 배경 있음), 텍스트 링크, 시트 내부, 스캔 화면(OTA 스왑 표면 밖 — 빌드2 합류 시 별도).
- [x] ② 주문카드 수량 스테퍼를 문장 아래 → Done 바로 위(foot 내부)로 이동 — 문장은 위, 조작은 손 근처. 문장 내 {n}개 갱신·팝 무변(orderStepper 테스트 통과).
- [x] ③ TopBar 스텝 노드 팝(P-032 ⑦) 제거 — 즉시 전환, 제거 사유 주석(P-035 선례).
- 테스트 +1(PressScale 즉발 잠금). tsc 0, jest 212/212. JS-only — preview OTA.

## 테스트플라이트 재빌드·제출 (2026-07-21, 빌드 67ea3cd2)
- iOS production 빌드+제출 완료 (submission 64870fcb) — Apple 처리 후 테플 노출(수십 분). 새 runtime `c43664ed`로 재베이스라인.
- 이 빌드에 합류: expo-sensors(P-022)·expo-image-manipulator/WYSIWYG 크롭(P-025)·스플래시 에셋 정식 반영(P-018)·스캔 세그먼트 글라이드/스태거(P-032)·빈 프로필 스캔 배너(P-038) — 그간 OTA 스왑 제외분 전량.
- **프로덕션 OTA 스왑 절차 소멸**: 이후 production OTA는 스왑 없이 발행(런타임 c43664ed 기준). preview 공기계 build1(cbbec117) 스왑은 Android 빌드2 전까지 존치.

## Android 빌드2 (2026-07-21, P-043, 빌드 24277e9c)
- preview apk 빌드 완료 — runtime `f96ae4f7`. 합류: expo-sensors 가로 감지(P-022 — 안드 실동작), WYSIWYG 크롭(P-025), 스캔 글라이드/스태거(P-032), 스캔 배너(P-038) + 최신 JS 전량.
- **preview OTA 스왑 절차 완전 소멸**: 구 build1(cbbec117)은 orphan — 공기계는 새 apk 재설치가 기준, 이후 preview OTA는 스왑 없이 발행. 코드 무변(기록만).

## KB-215 사장님 카드 실데이터 조립 (2026-07-22, P-045)
- [x] mocks/owner.ts(PHRASES 사전 — 2개 음식 외 '이 음식') 폐기. useOwnerConfirmation을 클라 조립으로 재작성: 상세 캐시 nameKo(스캔 미등록도 decode 실명) + ownerQuestionKo(81종 코드→ko 라벨, 신규 이/가 조사 유틸) — "{실명}에 {재료ko}이(가) 들어가나요?", 재료 없으면 일반 질문. explanationKo 정적 유지. renderQuestion 하이라이트는 실명 menuNameKo 기준 자연 동작.
- [x] 사장님 노출 전수: owner.tsx(이번 수정으로 실데이터)·order.tsx(nameKo·81종 라벨 — 기왕 실데이터) 외 mock/하드코딩 잔재 없음.
- 테스트 +3(iGa 분기·재료 있음/없음 조립·ko 고정). tsc 0, jest 215/215. JS-only — preview OTA(스왑 소멸 후 첫 발행).

## KB-216 스캔 진입 오프라인 게이트 (2026-07-22, P-046)
- [x] 진입(카메라 phase) 시 오프라인 → 전체 J4(QueryErrorBlock)+Retry, 카메라 미기동 — 판정은 P-027/028과 동일 프로브(useInfiniteFoods 캐시 공유). 촬영 화면 자체를 대체하므로 갤러리·샘플 진입로도 자연 차단. Retry 성공 시 카메라 기동. 서버 5xx는 게이트 미발동(스캔은 오프라인만 불가). 밝은 배경으로 타 탭 J4 톤 통일.
- 테스트 +3(오프라인→J4·카메라/갤러리/샘플 미렌더, 온라인 무회귀, 5xx 미발동). 기존 scan 테스트 2본 프로브 mock 보강. tsc 0, jest 218/218. JS-only — preview OTA.

## KB-217 헤더 바운싱 — timing 복귀 (2026-07-22, P-047)
- [x] 원인: P-031이 숨김/복귀를 withSpring으로 바꾼 뒤, 빠른 방향 반복 스크롤에서 재타겟마다 미정착 속도를 승계 → 진동. 수정: 이 헤더만 withTiming(200ms ease-out) 복귀 — 스크롤 크롬은 즉답 우선(절제 원칙, 과제 유력안 B). 북마크 팝 스프링·타 화면 스프링 무변. StickyHeader 전 사용처(홈·음식탭·상세) 공통 반영.
- 기존 스위트 무회귀(orderStepper mock에 Easing 보강). tsc 0, jest 218/218. JS-only — preview OTA.

## KB-125 랭킹 리뷰 흔적 정리 (2026-07-22, P-048)
- [x] ① 리뷰 쓰기 CTA 삭제 — 스캔 CTA 단독 filled로 정리 ② breakTotal("리뷰 하나 더 +10점") 행 삭제 — P-037 하단 radius 이슈도 행 제거로 자연 소멸, 카드 마감 정상 ③ 리뷰 팩터를 FLAGS 무관 dim 예고 행으로 상시 노출(opacity 0.55+IconLock+ranking.reviewsComing ×10, 탭 무반응). 점수 로직 무변.
- 테스트 +2(oneMore·리뷰CTA 부재/스캔 유지, dim 예고 렌더). tsc 0, jest 220/220. JS-only — preview OTA.

## KB-218 프로필 사진 촬영 (2026-07-22, P-049)
- [x] 시스템 UI만: choosePhotoSource — iOS ActionSheetIOS(촬영/갤러리/[사진 있으면]삭제 destructive/취소), 안드 시스템 Alert 3버튼(촬영/갤러리/취소 — Alert 3버튼 제약상 삭제는 기존 화면 링크 존치가 커버). captureProfileImage — 기설치 expo-image-picker launchCameraAsync(1:1 크롭, 갤러리와 동일 옵션), 권한 거부는 CAMERA_PERMISSION → pickBySource가 설정 유도 Alert 후 null(흐름 불막음).
- [x] 프로필 수정+온보딩 공용 배선(pickBySource) — 업로드 파이프라인·삭제(P-016)·busy/에러 표시 무변. iOS NSCameraUsageDescription은 expo-camera 플러그인 기존 문구. i18n photo.* 6키 ×10.
- 테스트 +6(photoSheet — iOS 시트 옵션/인덱스·안드 3버튼·권한 거부/허용/취소). tsc 0, jest 226/226. JS-only — preview OTA. 실기 권한 플로우 확인은 예진 몫(DoD 명시).

## KB-219 CI (2026-07-22, P-050)
- [x] .github/workflows/ci.yml — push(main)+PR에서 npm ci → tsc --noEmit → jest --ci (node 20 = 로컬 일치, npm 캐시). 1회 green 확인: https://github.com/team-skyjs/kbap-fe/actions/runs/29887022483 (run #1 success). 브랜치 보호(실패 시 병합 차단)는 예진 콘솔 설정 몫. 참고: actions 런타임 Node20 deprecation 어노테이션은 액션 자체 런타임 경고(스텝의 node 20 사용과 무관·무해).

## KB-195 후속 — 맵기 UI 원복: 화면=전송 일치 (2026-07-22, P-051)
- [x] Q-03 피드백으로 P-039 미선택 UI(대시·힌트·회색 불꽃) 원복 — 기본 5 표시, Continue(미조작 포함)=화면값 그대로 제출, Skip=-1(P-019 경로). stale closure 수정(finish 인자화)은 유지 — Continue=finish(spice)/Skip=finish(null). draft null(구 스킵분)→5 표시 호환. i18n spiceUnsetHint ×10 제거.
- 테스트 교체: 미조작+Continue→5 / 조작 7→7 / Skip→UNSET. tsc 0, jest 226/226. JS-only — preview OTA.

## KB-215 반려 대응 — 사장님 질문 원문 노출 봉쇄 (2026-07-22, P-052 🔴)
- [x] P-045 구멍: 상세 IngredientResponse엔 81종 코드가 없어 어댑터 합성 키(ing:{i}:{name})가 질문에 원문 통과("ing:0:Egg이(가)"). resolveIngredientKo 신설 — 직접 코드는 기존, 합성 키는 name 추출 후 81종 en 카탈로그명·현재 언어 라벨·ko 라벨 역인덱스 검색(정규화 비교) → ko 라벨. 실패·미지 형식은 null → ownerQuestionKo가 일반 질문 강등 — 내부 식별자 노출 경로 원천 봉쇄(원문보다 덜 구체적인 게 항상 낫다).
- 테스트 +3분기(합성 키 en/대소문자/ko 역매핑 · 미지 name·형식→일반 질문 · 직접 코드 기존). tsc 0, jest 229/229. JS-only — preview OTA 즉시.

## KB-206 반려 — 게이트 시트 애니 원복 (2026-07-22, P-053)
- [x] AuthGateSheet 등장의 SlideInDown.springify(P-031 B5) 제거 — Modal fade 단독 원복(P-031 이전). 게이트 시트엔 스프링 부적합(예진 실기, P-035·047 계열 절제 사례 — 사유 주석). 퇴장·backdrop·Snackbar 스프링(반려 대상 아님) 무변. tsc 0, jest 229/229 무회귀. JS-only — preview OTA.

## KB-194 후속 — Android 12+ 스플래시 원형 마스크 (2026-07-22, P-054 ⚠️재빌드)
- [x] 원인: Android 12+ windowSplashScreenAnimatedIcon이 앱 이미지를 OS 원형 마스크에 강제 배치 — 세로 조합(로고+워드마크)이 원 밖에서 클립("K-Bar"). 수정: 심볼 전용 정사각 에셋 분리(splash-icon-android.png — 기존 png의 심볼 밴드(300×300) 크롭, 450 캔버스 = 2/3 안전영역) + app.json expo-splash-screen android.image/imageWidth 200 오버라이드. iOS는 기존 조합 이미지 무변. 원형 마스크 시뮬 미리보기 spec/bridge/assets/p054-android-splash-preview.png.
- ⚠️ 네이티브 — OTA 불가, 안드 빌드3/차기 iOS 빌드 합류(제출용 최종 빌드에 배치 — 커맨드 센터 의견). **fingerprint 재회전**(안드 c71456e3·iOS 584a401b) — 빌드3 전 OTA 발행 시 app.json+splash-icon-android.png 2파일 임시 되돌림 필요(축소판 스왑 부활). tsc 0, jest 229/229.

## KB-225 안드 하단 내비바 클리어런스 전수 (2026-07-22, P-055)
- [x] P-021 국소 처치를 공용 훅 useBottomInset(안드 max(bottom,48)/iOS 실측)으로 승격, 전수 적용: AuthGateSheet(이번 짤림 — 인셋 미반영 고정 34가 원인, 안드만 18+보정 인셋·iOS 34 유지), login, intro, scan(카메라+결과 2곳), owner, order, 온보딩(기존 처치 교체). TabBar는 실기 정상 전제 무변(과보정 회피 — 짤리면 동일 유틸).
- 테스트 +2(bottomInsetFloor 분기 — 안드 floor·iOS 통과). tsc 0, jest 231/231. JS-only — preview OTA. 실기 확인 목록(3버튼 에뮬): 게이트 시트 '나중에 하기'·로그인 하단·인트로 CTA·스캔 하단 바(카메라/결과)·owner/order Done·온보딩 CTA.

## KB-176 안드 스캔 오버레이 좌표 2배 오프셋 (2026-07-22, P-056 🔴)
- [x] adb 실측 확정 원인: 안드 저장 파일이 절반 다운스케일(1883×4080→942×2040)인데 ML Kit frame은 원치수 기준 → measured 분모로 y 2배 뻥튀기·y≥1 클램프 미표시("마커 2개"도 동일). 수정: chooseDenominator — frame 최대 좌표를 수용하는 쪽 채택(우선 measured=iOS 정답 유지 → reported → 둘 다 못 담으면 큰 쪽), 2% 반올림 여유, 채택 근거 로그([ocr] denominator basis). 플랫폼 하드코딩 없음 — 정수배 관계면 스케일 보정과 동치.
- 부수 확인(조사만): 절반 저장은 안드 저장 경로(P-025 ImageManipulator saveAsync 추정) — OCR 인식은 정상 동작, 2040px면 메뉴판 텍스트 해상도 여유. 화질 이슈 미관측 — 필요 시 별도 과제.
- 테스트 +5(chooseDenominator — 안드 실측 재현·iOS 무회귀·null 폴백·larger-fallback·경계 여유). tsc 0, jest 236/236. JS-only — preview OTA. ⚠️ 스캔 화면 아님·ocr.ts는 OTA 대상(스왑 무관 — lib 파일).

## KB-212 후속 — 스캔 배너 리스트 첫 카드 편입 (2026-07-22, P-057 A안)
- [x] 어두운 absolute 오버레이 폐기 → 결과 리스트 첫 카드(메뉴 카드와 같은 폭·radius·간격 리듬). 밝은 브랜드 틴트(#fdf0e6/#f0d9c4), 좌측 원형 primary IconBulb(신규 SVG), 본문 ink2 + "기피 재료를 설정"만 primaryText 강조(i18n nudgeAction/nudgeRest 분리 ×10 — 구 nudge 키 제거). 목록 뷰 전용(위험도/원본 미노출). 동작·노출 조건 무변, 스태거 대열 첫 항목으로 합류(delay 0).
- 테스트 갱신+1(목록 뷰 전용) — 기존 4케이스 카드 구조로 이전. tsc 0, jest 237/237. JS-only — preview OTA.

## KB-125 후속 — 다양성 행 dim 예고 (2026-07-22, P-058)
- [x] 다양성 점수는 리뷰 작성 적립 구조 — MVP에선 죽은 지표라 리뷰 팩터와 동일 dim 처리. 공용 ComingRow 컴포넌트 추출(P-048 인라인 리뷰 행도 이전), 다양성 행 opacity 0.55+IconLock+reviewsComing 재사용·탭 무반응. 활성 팩터는 스캔뿐 — dim 2행/활성 1행 사이 breakRowBorder로 시각 균형 유지. 점수 로직 무변.
- 테스트 +1(다양성 dim·실적 detail 부재·예고 2행·스캔 활성). tsc 0, jest 238/238. JS-only — preview OTA.

## KB-175 API 도메인 전환 1단계 (2026-07-23, P-059)
- [x] dev(Metro/.env)=dev.kbap.site 배선(.env untracked·.env.example 문서화·.gitignore에 .env 추가), preview/production은 eas.json 각 프로파일 env에 meogo 명시 고정(dev가 빌드에 스미지 않게). config.ts에 도메인 로드맵 주석(prod.kbap.site는 시딩 신호 후 후속 P, meogo는 그때 폐기·fallback 정리).
- [x] dev 계약 동일 실증(curl): home/foods/foods/{id} — 엔벨로프·payload 키·아이템 형태 dev=meogo 완전 동일, dev 20종 시딩 확인. Metro 실기 스모크(스캔 포함)는 예진 확인 요청.
- ⚠️ fingerprint 실측: eas.json·.gitignore 편집이 회전 유발(P-017 선례 재확인) — **발행 스왑 목록 확장**: app.json·eas.json·.gitignore 되돌림 + splash-icon-android.png·.env 치우기 → 베이스라인(f96ae4f7/c43664ed) 복원 검증 완료. 빌드3 재베이스라인 때 전체 소멸.
- 테스트 +2(BE_BASE env 분기/meogo fallback). tsc 0, jest 240/240. 발행 불요(빌드/OTA 무변 — dev 전용 배선).

## 언어 설정 대개편 1차 — OS 정본화 (2026-07-23, P-060 진행 중)
- [x] ① LocaleProvider 단순화: kbap.lang 저장·복원/setLang/라이브 전환·무효화(P-015 계열) 전부 제거 — 언어 = getLocales() 기기 언어(미지원 en), resolveInitialLang은 시그니처 유지(bootGate). 온보딩 국적→언어 제안도 소멸.
- [x] ④ 인앱 피커 철거: LanguagePicker.tsx 삭제, 온보딩 언어 필드 행 삭제(별도 스텝이 아니라 프로필 스텝 내 필드였음 — 스텝 수 무변 실측), 프로필 탭·수정 화면 언어 행 → OS 앱 설정 열기(Linking.openSettings, 안드12- 숨김 Platform.Version<33).
- [x] ⑤ OS 앱별 언어 선언: expo-localization plugin supportedLocales(ios/android ×10) — CFBundleLocalizations 생성 확인(expo config), localeConfig는 빌드 시 생성. ⚠️ 네이티브 — 최종 빌드(iOS8/안드3) 탑승, app.json 회전은 기존 스왑이 커버.
- [x] ⑥ 테스트: osLocale(기기 추종·en 폴백·resolveInitialLang=기기) +2, P-015 라이브 전환 테스트 폐기(기능 소멸). tsc 0, jest 241/241.
- [ ] ②appLanguage 전송 중단·③/scans lang — **BE 스웨거 미갱신(실측: /scans params [], appLanguage 11회 잔존)** — 갱신 신호 후 이어서.
- OTA 보류 판단: 피커 제거를 OTA로 선발행하면 OS 언어 항목(⑤ 빌드 후 노출) 전까지 언어 변경 수단 공백 — 7/24 최종 빌드에 일괄 탑승이 정합.

## 7/23 QA 묶음 (2026-07-23, P-061)
- [x] ① 셔터/갤러리 중복 방지: capturing 상태로 첫 탭 즉시 비활성(+opacity 피드백), finally 복구 — A90 연타 다중 촬영 봉쇄, 전 플랫폼.
- [x] ② 미설정=BE 그대로: personalRisk safe→caution 강등 폐지(헌법 v2.1.0 — spec 정본 개정 실확인 후 착수). SAFETY INVARIANT 주석 v2.1.0으로 개정, chokepoint·시그니처 유지(정책 재변경 대비). 강등 잠금 테스트 반전(orderCta) + risk.test 신설. 스캔 배너 안전망 유지.
- [x] ③ 프로필 안전 고지 행 → kbap-legal/safety.html 열기(Linking.openURL). 실측: 약관·개인정보 행은 코드에 부재 — 안전 고지 행만 존재했고 미연결 상태였음(보고 명시).
- [x] ④ 알림 UI 전면 삭제: NotificationsPanel.tsx 삭제, StickyHeader bell/bellDot/패널/게이트 제거(+미사용 AuthGateSheet·useIsGuest import 정리), 홈·음식·프로필 진입점 제거, 프로필 알림 행 삭제, GateContext 'notifications' 제거, i18n(notifications.*·profile.notifications·gate.notif*) ×10 정리.
- 테스트 +2(risk v2.1.0)·반전 1. tsc 0, jest 243/243. JS-only — preview OTA.
