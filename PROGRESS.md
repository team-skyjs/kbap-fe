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

## KB-232 스캔 화면 디자인 정합 (2026-07-23, P-062)
- [x] ⓪ [반려 보수] 셔터 가드 레이스: state 가드는 리렌더 전 탭을 못 막음 — capturingRef 동기 가드(진입 즉시 검사·세트)로 실차단, state는 시각 disable 전용. capture·pickFromGallery 동일. 레이스 테스트(pending 중 재탭 → 픽커 1회).
- [x] ① Run sample scan 제거: SAMPLE_DISHES·카메라/에러 화면 버튼·scan.sample 키(×10) 삭제. 기존 테스트 2본은 갤러리 경로(OCR mock→실 segmentMenu)로 결과 진입 재배선.
- [x] ② D2 스캐닝 오버레이: 검은 화면+스피너 → 촬영/선택 사진 배경 + 코너 브래킷 4 + 주황 스캔라인 스윕(글로우 트레일, withRepeat 1.8s — reduced-motion 시 전역 config가 정지) + scan.reading 캡션+소형 스피너 + X 유지. 갤러리 경로 동일.
- [x] ③ D3 하단 바: 다크 시트(상단 라운드+핸들) — resultCaption(신규 ×10)+위험도 범례 칩 3(RiskMark SVG+기존 risk.* 라벨, 색맹 축)+원형 버튼 4(IconList 신규/IconScanLines/IconGallery/IconRetry — 라벨 기존 키, 활성=주황 원, 사진저장 제외). 기존 세그먼트(ToggleRow)·다시찍기 Btn 대체.
- 테스트 +3(레이스·샘플 부재·D3 4버튼/활성) — P-032 글라이드 테스트는 세그먼트 폐기로 소멸 대상 아님(별도 파일 없었음). tsc 0, jest 246/246. JS-only — preview OTA.

## KB-125 랭킹 — All ranks 리스트형 (2026-07-23, P-063)
- [x] PathRow·세로 연결선(path) 폐기 → LadderRow 독립 카드 7행(gap 8, 카드 bg+헤어라인+r-sm+sh1): 좌 Medallion 42(done 체크/current 티어색/locked 뮤트), 중 티어명 EN+NOW 필+ko 병기, 우 done ✓/current pts(primaryText — 대비 계열)/locked 자물쇠+pts. current 행 = primary 7% 틴트+2px 30% 링, locked opacity 0.62. 미사용 dim/nodeBody/path류 스타일 정리.
- [x] 스코프 엄수: 히어로·게이지·점수 내역(리뷰/다양성 dim)·스캔 CTA diff 0.
- 테스트 +1(7행·상태 3종). tsc 0, jest 247/247. JS-only — preview OTA.

## KB-233 스캔 결과 파파고식 개편 (2026-07-23, P-064)
- [x] ① 스캔라인 왕복(withRepeat reverse=true) — 리셋 점프 소멸 ② 다크 시트·캡션·범례 삭제(resultCaption ×10 정리) → 사진 풀블리드 + (사진 뷰) 하단 옅은 그라데이션 + 원형 버튼 4개만 플로팅(활성 주황·safe-area) — degradedNote는 안전 고지라 버튼 위 유지.
- [x] ③ 원본 피크: 위험도 뷰 빈 영역 꾹 → 마커(오버레이 내 Animated fade)+버튼(pointerEvents none) 페이드아웃, 뗌 복귀 — 마커 탭(상위 레이어)과 비간섭 ④ 핀치 줌+팬+더블탭(RNGH Pinch/Pan/Tap Race·Simultaneous): 이미지+마커 동일 transform 컨테이너(확대 시 마커 정위치 추종), zoom.ts 순수 클램프(1~4x·경계 팬·더블탭 2.5x 토글), 1x에선 팬 무시(피크 롱프레스 비간섭), 줌 중 마커 탭 동작.
- 테스트 +4(왕복은 파라미터 — 클램프 유닛 3·피크 토글·파파고 레이아웃 갱신), scan 테스트 4본 RNGH mock 보강. tsc 0, jest 250/250. JS-only — preview OTA.

## KB-233 파파고식 개편 — 워클릿 반려 보수 (2026-07-23, P-065)
- [x] 실기 반려: 핀치 즉시 `Tried to synchronously call a non-worklet function 'clampScale'` — zoom.ts clampScale/clampPan에 'worklet' 지시자 추가(제스처 onUpdate/onEnd = UI 스레드). ScanResultOverlay 제스처 콜백 전수 감사: 그 외 JS 헬퍼 호출 없음(shared value·reanimated 내장·상수만).
- [x] 재발 방지: jest는 워클릿 경계를 못 잡음(mock이 JS 실행) — CLAUDE.md에 "제스처·워클릿 코드는 실기기 확인 후 발행" 영구 규칙 추가. Metro 실기 확인은 예진 요청.
- 테스트 ±0(기존 클램프 유닛 3 통과 — 지시자는 동작 불변). tsc 0, jest 251/251. JS-only — preview OTA 재발행.

## KB-230 언어 OS 정본화 ②③ — 스웨거 게이트 개방분 (2026-07-23, P-060 완결)
- [x] 게이트 실확인: POST /scans 파라미터에 lang 등장·appLanguage 스웨거 언급 0 (BE 재배포 반영).
- [x] ② appLanguage 전송 중단: onboarding submit body에서 `appLanguage: payload.language` 제거(+주석 정리), useMe PATCH의 readerLanguage→appLanguage 매핑 제거 — 서버는 언어 무저장, 매 요청 lang 쿼리만.
- [x] ③ /scans lang 부착: `api.post(\`/scans?lang=${apiLang()}\`)` — 타 엔드포인트와 동일 패턴.
- 테스트 +1(온보딩 body appLanguage 부재 잠금)·반전 3(useScan URL 잠금 → `/scans?lang=en`). tsc 0, jest 251/251. ①(OS 정본 LocaleProvider)·④(피커 제거)는 선행 커밋 탑승 완료, ⑤(supportedLocales)는 네이티브 — 차기 최종 빌드.

## KB-233 파파고식 — 하단 그라데이션 반려 보강 (2026-07-23, P-066)
- [x] 원인: 렌더 순서·elevation 아님(그라데이션이 오버레이 뒤 형제 = 최상위, pill elevation은 서브트리 내부) — **contain 레터박스**: 카메라 사진(3:4)이 세로 화면 중앙 배치되면 하단 ~220px는 배경(#16110d)뿐 → 검정→검정이라 시각 소멸. 사진·줌이 하단을 채우면 정상 표시되는 구조였음.
- [x] 보강: 높이 170→220·검정 0→0.6, 사진 뷰(위험도·원본) 상시 렌더 유지 — 레터박스 시에도 배경이 어두워 버튼 가독은 항상 보장. 피크 연동: peekFade 래퍼로 버튼과 동반 페이드(원본 감상 비방해, 파파고 동일).
- [x] 한계 명시: 레터박스 구간에선 보강 후에도 그라데이션 자체는 비가시(물리적 동일색) — 완전한 파파고 동일감은 촬영 화면비 크롭이 필요(후속 P 후보로 보고).
- 테스트 +1(사진 뷰 존재·리스트 부재). tsc 0, jest 252/252. 실기기(Metro) 확인 후 preview OTA — P-066 지시 4.

## KB-233 리스트 뷰 하단 버튼 A안 (2026-07-23, P-068)
- [x] 배경 페이드: 리스트 뷰 하단 150px, 배경 동색(#16110d=rgb(22,17,13)) 투명→0.96 — 버튼 뒤 카드가 자연스럽게 잠김. 레이어는 P-066 규칙 동일(리스트 위·floatBar 아래 형제, pointerEvents none).
- [x] 바닥 여백: contentContainer paddingBottom 150(고정) → bottom+140 — 끝 스크롤 시 마지막 카드가 버튼 위로 완전 가시(안드 제스처 내비 inset 포함).
- [x] 배너·카드·버튼 로직 무변.
- 테스트 +1(paddingBottom 140+inset·페이드 150 존재). tsc 0, jest 253/253. 실기기 확인 후 P-066과 preview OTA 합류.

## KB-194 QA용 빌드 — iOS 빌드8 + 안드 빌드3, env=dev (2026-07-24, P-069)
- [x] eas.json preview·production env → dev.kbap.site 임시 배선 (d817c73) — prod 미시딩, 내일 제출 빌드(P-067)에서 prod 교체.
- [x] iOS 빌드8: 2328c807, runtime 36d1708a — 테플 제출 완료(ASC 처리 중). P-054 스플래시·supportedLocales 등 네이티브 전부 탑승.
- [x] 안드 빌드3: 29328c51, runtime 13a68799 — 내부 배포 APK (공기계 설치용, AAB는 내일 제출 라운드).
- [x] production 지문 재베이스라인 c43664ed→36d1708a. **P-054+P-059 확장 스왑 절차 소멸** — 현 HEAD 그대로 OTA 가능(메모리 절차 삭제).
- 임베드 커밋 d817c73(=P-066·P-068 포함) · tsc 0 · jest 253/253.

## KB-240 스캔 마커 사다리 버그 (2026-07-24, P-070)
- [x] 가설 유닛 재현: 조밀 2열(줄 18pt·열 145pt) 픽스처에서 구 알고리즘 누적 이동 ≥3단 확인 — X_CLUSTER 150이 두 열 병합 + while 스태거 연쇄. 커맨드 센터 가설 그대로 실증.
- [x] 보수: 배치 로직을 pillLayout.ts 순수 함수로 추출 — ① 고정 X_CLUSTER → 실폭(estimatePillWidth: 전각 12.5/반각 7pt 근사, 상한 220) 수평 교차 판정 ② 스태거 원 앵커 대비 1단(PILL_H) 상한 — 초과 겹침은 수용(핀치 줌 해소).
- [x] 오버레이 배선: useMemo가 pillLayout 호출로 축소, PILL_MAX_W도 단일 정의로 이동.
- 테스트 +5(구 로직 사다리 재현·1단 상한·열 비간섭·근접 무회귀·동일줄 스태거 유지·폭 추정). tsc 0, jest 258/258. P-069 빌드는 이미 발행 — OTA 경로, 실기기(원거리 촬영) 확인 후 발행.

## KB-233 스캔 직후 기본 뷰 = 사진(위험도) (2026-07-24, P-071)
- [x] 기본 뷰 list → risk (초기값·onSuccess 리셋 동일) — "찍었으니 사진이 보여야지"(신규 유저 멘탈 모델, 예진 확정 7/24). KB-140 리스트 기본의 근거(버튼 겹침)는 파파고 개편으로 소멸.
- [x] 잠금 반전: scanDefaultView(기본=risk·마커 표시 + 리스트 버튼 전환 무회귀), scanDesign P-066(기본 뷰 그라데이션 상시)·P-068(리스트 전환 후 검증), scanNudge(배너=목록 전용이라 헬퍼에 리스트 전환 추가).
- 테스트 반전 4개 파일·순증 0. tsc 0, jest 258/258. P-070과 같은 preview OTA로 발행(실기 확인 후).

## KB-233 P-071② 마커 가격 제거 + 묶음 OTA (2026-07-24, P-071 완결)
- [x] [추가 7/24] 마커 pill 가격 제거 — 번역 메뉴명만(가격은 리스트·상세 유지). Metro 실측: 가격 포함 폭 ~220pt가 좌우 열을 실제 겹침 → P-070 실폭 판정이 한 클러스터로 묶어 전원 1단 밀림. 제거로 열 분리 + 스태거 미발동 = 정위치. estimatePillWidth 가격 항 동기 제거.
- [x] 잠금: 기본(risk) 뷰 가격 텍스트 부재 +1, pillLayout 테스트 가격 인자 정리.
- 테스트 258/258(가격 부재는 기존 잠금에 단언 추가), tsc 0. P-066·068·070·071 묶음 preview OTA 발행(빌드8/3 runtime) — 예진 재스캔 실증은 발행 후.

## 🚨 P-073 묶음 OTA env 오염 재발행 + KB-240 P-072 말줄임 상한 (2026-07-25)
- [x] P-073 원인 2중 확정: ① `--environment` 플래그 = EAS 서버 env 사용(로컬 .env 미적용, 서버에 EXPO_PUBLIC_BE_BASE 부재 → meogo 폴백) ② Metro 변환 캐시가 오염 번들 재사용(캐시 미클리어 재수출에서 iOS meogo 잔존 실측).
- [x] 발행 전 검증: `EXPO_PUBLIC_BE_BASE=dev npx expo export --clear` → strings grep iOS·안드 모두 dev:1·meogo:0 확인 후, 인라인 env + `--clear-cache`로 재발행 (안드 preview 612df697 · iOS production 628f03b6, 4d598fd).
- [x] 재발 방지: [api] 로거 full URL(호스트 포함) + CLAUDE.md "eas update는 env 인라인+export 사전 grep" 영구 규칙 (4d598fd).
- [x] P-072: PILL_MAX_W 220→150 — 긴 영문명 pill이 열 경계 넘어 우측 열 교차→1단 밀림 잔여 보수. 렌더 말줄임(maxWidth+numberOfLines)·추정 폭 상한 자동 동기. 긴 영문명 2열 정위치 잠금 +1(상한 단언 150 갱신).
- 테스트 259/259, tsc 0.

## KB-175 도메인 2단계 — prod.kbap.site 전환 (2026-07-25, P-067)
- [x] eas.json preview·production env → prod.kbap.site. config.ts fallback meogo→prod(주석 정리), .env.example 갱신(로컬 dev 유지). meogo 참조 0(폐기 기록 제외).
- [x] prod 계약 스모크: /home?lang·/foods 모두 HTTP 200 + 신계약 봉투 정상 — 데이터 0건(시딩 병렬 중, 심사 제출 클릭은 시딩 스모크 후 게이트).
- [x] beBase fallback 잠금 반전(meogo→prod). eas.json 지문 회전은 P-074 빌드 재베이스라인으로 소멸 — 스왑 불요.
- 테스트 259/259, tsc 0.

## KB-82·KB-194 제출 빌드 — iOS 빌드9 + 안드 빌드4 (2026-07-25, P-074)
- [x] 빌드 전 grep: prod:1·dev:0·meogo:0 (iOS·안드). 임베드 c1c4d3a(prod 배선+P-072).
- [x] iOS 빌드9 5030cd67 — 테플 제출 완료(ASC 처리 중). Expo 플랜 업그레이드로 쿼터 해소.
- [x] 안드 빌드4: AAB 83db48cf(스토어 제출용) + 공기계 APK a3bcc1f6.
- [x] runtime 불변 실측(iOS 36d1708a·안드 13a68799 — eas.json env는 지문 비대상) → 재베이스라인·스왑 불요, 기존 OTA 브랜치 그대로 유효.
- 심사 제출 클릭은 커맨드 센터 prod 시딩 스모크 통과 후(게이트).

## 🚨 Play 제출 블로커 — ACTIVITY_RECOGNITION 제거 (2026-07-25, P-075)
- [x] 원인: expo-sensors가 자기 매니페스트에 ACTIVITY_RECOGNITION 무조건 주입 — 우리는 DeviceMotion(가로 감지)만 쓰고 Pedometer 안 씀. app.json android.blockedPermissions 추가.
- [x] prebuild 실증: AndroidManifest에 `tools:node="remove"` 확인(산출물 미커밋). DeviceMotion은 이 권한과 무관(Pedometer 전용) — 가로 감지 로직 변화 없음, 기존 orientationFromGravity 유닛 유효.
- [x] 안드 production 재빌드(versionCode 4 자동) + 공기계 APK 재빌드.

## 🚨 안드 구글 로그인 복구 — google-services.json 교체 (2026-07-28, P-076)
- [x] vc4 출시본이 구버전 json(웹 클라이언트만)으로 빌드 → DEVELOPER_ERROR 10 전면 불가. 예진 Firebase 지문 2개(업로드 키·Play 앱 서명 키) 등록본 커밋 — type 1×2+웹 실측 재확인, 내용 무수정.
- [x] 재빌드 2종(AAB vc5 + 공기계 APK) — json은 빌드타임 임베드라 OTA 불가. runtime 지문 변화는 빌드 결과로 실측 보고.

## KB-16 리뷰 CRUD 화면 — 목 선작업 (2026-07-28, P-077)
- [x] 잔재 재사용 우선(지시 4): KB-148 제외분이 플래그 뒤에 완성형으로 생존 — 작성 폼(별점 필수·텍스트)·음식 리뷰 목록(국기+랭킹·번역·같은국적 필터)·내 리뷰 조회/인라인 수정/삭제(캐시 반영) 3화면 805줄. FLAGS.reviewsEnabled true로 복원(홈·상세·프로필·인트로 진입점 포함), 신규 작성 없음.
- [x] 사진 첨부(신규): 최대 3장·미리보기·개별 삭제 — reviewPhotos.ts 순수 헬퍼(addReviewPhotos 상한 잘림·removeReviewPhoto·canPostReview 1~5 정수) + 업로드 어댑터(목=URI 패스스루, KB-73 때 presigned 스왑). Review 타입 photos?: string[] 목 선반영(BE 계약 질의).
- [x] 작성→목 CRUD 반영: post가 ['me','reviews']·['food',id,'reviews'] 캐시에 삽입+overall 재계산 — 목록·프로필 즉시 반영, 기존 수정/삭제 캐시 흐름과 접합.
- [x] 목록 내 리뷰 진입: useMyReviews id 집합으로 mine 판별 → 내 리뷰 필+chevron → 상세(수정/삭제). 목록·상세에 사진 스트립 렌더. 장소태그 UI 미작성(KB-249 별개).
- [x] i18n 4키×10언어(photosLabel·addPhoto·removePhoto·mine). 이모지 0(별·국기 기존 SVG).
- 테스트 +3(사진 상한·개별 삭제·폼 유효성). tsc 0, jest 262/262 — 플래그 복원 회귀 0.

## KB-192 일부 — 프로필 국적 수정 불가 (2026-07-29, P-078)
- [x] 수정 화면 국적 읽기 전용: 피커·chevron 제거 → 국기+국가명+잠금 아이콘, 회색 필드. NationalityPicker 사용처·natOpen 제거. editProfile.nationalityLocked ×10(구 nationalityHint 전 언어 제거 — 사용처 소멸).
- [x] payload 제거: useMe PATCH 매핑에서 countryCode 미전송 + UserUpdate 타입에서 nationality 삭제(컴파일 차단). 런타임 우회 주입도 무시하는 부재 잠금 +1.
- [x] 온보딩 최초 선택 무변(submit.ts countryCode 유지).
- 테스트 263/263, tsc 0.

## KB-238 촬영 화면비 크롭 — 결과 사진 cover (2026-07-29, P-079)
- [x] 표시 전환: 결과 오버레이 contain → cover(coverDisplay.ts 순수 함수) — 사진이 항상 하단까지 참(레터박스 0, P-066 동색 소멸 문제도 근본 해소). rect가 컨테이너 밖 확장(x·y 음수) 가능, root overflow hidden.
- [x] 마커 정합(본체): 투영식(lx=rect.x+box.x·rect.w)이 cover rect를 그대로 쓰므로 크롭·스케일 자동 반영. 스태거(layoutPills)는 전체 마커로 먼저 계산 후 화면 밖 앵커 숨김(markerVisible) — 필터 선행 시 크롭 여부에 따라 겹침 판정이 흔들리는 것 방지. 줌 파이프라인 무변(rect는 pre-zoom 레이아웃).
- [x] 유닛 +5: 화면비 2종(19.5:9·16:9)×3:4 픽스처 — 가득 참·종횡비 보존·투영 좌표 실측·좌우 크롭 구간 숨김·무효 폴백. 기존 사다리·클램프 유닛 회귀 0.
- Metro 실기 확인(기존 사진 재스캔) 예진 대기 — P-066·068 확인 항목과 합류 가능.

## KB-261 온보딩 재구조 2차 — 6화면 + 맵기 5단계 (2026-07-30, P-080)
- [x] 6화면 플로우: ①약관 동의(전체 동의+필수 3행, 행별 chevron→전문 바텀시트, 시트 Agree=행 체크+닫힘) ②프로필(무변) ③위험도 마크 인터랙티브 데모 ④회피재료(무변) ⑤맵기 5단계 ⑥완료 요약 카드. 기존 골격(로컬 수집→1회 제출·드래프트 재개) 유지, 진행 바 6-세그(채움 애니는 P-042 절제 전례로 즉시 전환).
- [x] ① 약관: 구 안전 고지 화면 삭제·①로 흡수(BE consented 단일 기록 무변). 전문 소스 = kbap-legal fetch→htmlToPlainText(legalText.ts, JS-only — 웹뷰 의존성 없음·OTA 가능) / 안전 고지 = 기존 i18n 3문구 재사용. 헤드라인은 현행 "Before you start" 유지(시안 "One last step" 모순 미도입).
- [x] ③ 마크 데모: RiskMark 재사용(신규 제작 0) — 탭 순환 safe→caution→danger→unable + 의미 텍스트 동기 크로스페이드(reduced-motion 시 즉시 전환).
- [x] ⑤ 맵기: 노랑→빨강 히트 그라데이션(expo-linear-gradient, 맵기 트랙 한정) 5스톱 스냅 슬라이더(탭+JS PanResponder 드래그, 워클릿 없음) + 🌶️ 카운트 히어로(None=0개 점등 — 시안 1개 점등 오류 보정). 저장 = 앵커 0/2/5/7/10 (10-스케일 API 무변, 기본 Medium=5는 종전 기본과 와이어 동일).
- [x] 표시·경고 5단계 통일: spice.ts 구간 함수 하나(0=None/1–3=Mild/4–6=Medium/7–8=Hot/9–10=Extreme)를 음식 상세 표시(🌶️×단계+라벨)와 경고 판정(단계(음식)>단계(유저), 원값 비교 폐기)이 공유.
- [x] ⑥ 요약: 국적(국기)·언어(현행 앱 언어, 표시 전용)·회피(칩 미리보기+개수)·맵기(🌶️ 카운트, 불꽃 금지) + 행별 수정 chevron(요약 복귀 동선). SuccessCheck는 요약 진입 연출로 결합 — 제출 성공 시 홈 직행(구 완료 오버레이 소멸). 제출은 요약 CTA 단일 지점.
- [x] i18n 신규 18키+밴드 5키 ×10언어(spiceNone/Extreme 폐기), 이모지는 🌶️만(헌법 v2.2.0 예외). 유닛 +9: 구간 경계값(0/1/3/4/6/7/8/9/10)·앵커 왕복·경고 판정 / htmlToPlainText / 약관 게이트(미동의 진행 불가·전체 동의) / 마크 4상태 순환 / 맵기 앵커 제출 실측(5·7·UNSET). tsc 0, jest 277/277.
- 실기 확인(예진) 대기: 6화면 순서·시트 스크롤·슬라이더 드래그 감·🌶️ 렌더. 프로필 화면·수정의 유저 맵기 표시(0~10 불꽃)는 발주 범위 외 — 5단계 전환 여부 커맨드 센터 질의.

## KB-261 후속 — 맵기 enum 6종 전환 + 프로필 5단계 통일 (2026-07-30, P-081)
- [x] 내부 표현 = enum: `lib/spice.ts` 재편 — SpiceLevel(NONE~EXTREME)+SpiceChoice(+SKIP), spiceRank 순서 비교, 라벨/예시 키 맵. 숫자 지식(앵커·구간) 전부 퇴거. SKIP = 구 -1/UNSET/null 승계(경고 없음·미설정·설정 해제).
- [x] 와이어 격리: `api/spiceAdapter.ts` 신설 — 송신 앵커(0/2/5/7/10·SKIP→-1), 수신 구간 스냅(중간값 근사), 유저 수신 무효값→SKIP, 음식 수신 비숫자→null, 로컬 보관 파서(enum+구 숫자 문자열 마이그레이션). **스웨거 enum 문자열 재배포 시 이 파일만 스왑**(주석 명시). 경유지: submit.ts(온보딩)·useMe PATCH·memberAdapter(adaptSpice)·foodAdapter.
- [x] 타입 전환: User.spiceTolerance=SpiceChoice · UserUpdate 동일 · FoodDetail.spiceLevel=SpiceLevel|null. draft.spice는 enum(구 number 드래프트는 로더 근사 스냅). 음식 상세 표시·경고, 온보딩 ⑤/요약 전부 enum 참조 — 정수 비교 잔재 0(grep 실측).
- [x] 프로필 5단계 통일(P-080 질의 답변 반영): 슬라이더를 `components/SpiceLevelSlider`로 공용 승격(level=null=미선택 지원) — 프로필 수정 = 동일 5스톱 히트 슬라이더+🌶️ 표시, "설정 해제"=SKIP. 프로필 화면 표시 = 🌶️ 카운트+라벨. 불꽃(IconFlame) 사용처 0. SPICE_SCALE(10단)·detail.spice 키 폐기, spice.example.0~4는 각 언어 scale 앵커값 복사로 승계(신규 번역 0).
- [x] 유닛: enum 코어 4(순서·SKIP 경고 없음·키 완전성·판별) + 어댑터 6(앵커·왕복·경계값 전수·SKIP·음식 null·로컬 마이그레이션) + 패리티 20(band·example ×10, scale 폐기 잠금) + 기존 갱신(submit -1/7, useUpdateMe HOT/SKIP/NONE, adaptSpice enum, 온보딩 MEDIUM/HOT/SKIP). tsc 0, jest 293/293.
- 실기 확인(예진) 대기: 프로필 수정 슬라이더 감·미설정 진입 시 무선택 스톱. BE 스웨거 enum 재배포 시 spiceAdapter 스왑 후속(P 발주 대기).

## 🚨 spiceAdapter 스왑 — dev 스웨거 enum 문자열 전환 (2026-07-30, P-084)
- [x] 스왑(P-081 헤더 예고 지점): 유저 송신 = enum 문자열 통과(spiceChoiceToWire — 앵커 정수 폐기) · 수신 = 문자열 strict 파싱 우선(비레벨 문자열→SKIP) + **정수(구계약 prod) 근사 스냅 폴백** — 같은 빌드가 dev/prod 어느 쪽을 봐도 동작. ProfileUpdateWire.spicinessPreference=string, MyProfileWire=number|string 겸수신.
- [x] 음식 spiciness = 정수 구간 스냅 유지 (스웨거 실측: FoodDetail/SummaryResponse integer — "음식도 enum"은 BE 후속, 전환 시 wireToFoodSpice만 갱신).
- [x] 스웨거 실측 대조: dev /v3/api-docs — OnboardingRequest·ProfileUpdateRequest·MyProfileResponse 전부 string("SKIP"/"HOT" 예시 포함), 음식 integer. 어댑터 외 코드 변화 0 (P-081 격리 효과 — 화면·훅·타입 무변).
- [x] 유닛 교체(어댑터 테스트 헤더 예고대로): 문자열 왕복 6종·strict(소문자/오타→SKIP)·정수 폴백 경계값 전수·음식 정수 유지·로컬 마이그레이션 + 송신측(submit 'SKIP'/'HOT', useUpdateMe HOT/SKIP/NONE 문자열)·adaptSpice 문자열 수신. tsc 0, jest 295/295.
- ⚠️ 발행 순서 제약: **preview·production OTA 발행이 종한 prod enum 배포의 선행 조건** (정수 전송 라이브 앱 보호). Metro 실왕복(온보딩 제출·프로필 저장/해제)은 예진 확인 대기.

## KB-73 리뷰 실연결 — dev 리뷰 API 6종 (2026-07-30, P-085)
- [x] 목 CRUD → 실 API 스왑: reviewAdapter.ts(와이어 경계 신설 — ReviewWire/PageWire adapt, BaseResponse는 클라이언트 해체) + useFoodReviews(useInfiniteQuery — keyset cursor·hasNext·nextCursor, 하단 더보기) + useMyReviews(GET /members/me/reviews 커서 전량 수집, 상한 20페이지) + useReviewMutations(POST/PATCH/DELETE, 성공 시 ['food',id] 프리픽스+['me','reviews'] 무효화 — 목 캐시 수동 삽입 전부 폐기).
- [x] ⚠️ PATCH "생략=제거" 함정 봉쇄: buildReviewUpdate 풀 페이로드 — rating·imagePaths(현재 사진 전량, URL→path 역변환) 항상 포함, content는 비면 의도된 제거로 생략. 유닛 4본(본문만 변경 시 사진 소실 0·별점만 변경·본문 비움·빈 사진 명시).
- [x] 사진 업로드 실연결: uploadReviewImages → 기존 presigned 플로우(scanImage.uploadImage) 재사용, purpose="REVIEW"(스웨거 enum 실측). 전송=path·조회=완전 URL. 무세션 개발 경로만 패스스루 유지.
- [x] 평점 = 서버값: FoodDetailWire에 averageRating·reviewCount·sameCountryAverageRating 추가, 어댑터가 overall/sameNationality 채움(목 재계산 폐기). 리뷰 화면 집계도 음식 상세 소스로 교체(sameCountry는 count 미제공 — 0이면 표기 생략). 같은 국적 필터 = 서버 countryCode 파라미터(목 경로는 훅이 클라 필터 흉내).
- [x] author 방어 3케이스: 탈퇴(author null)=익명 렌더·nickname null=국적 코드 폴백·countryCode null=중립 아바타 — 어댑터 유닛 잠금. 랭킹 필은 실 tier·level. 내 리뷰 판별 = 서버 memberId(목 id 집합 폐기).
- [x] 본문 상한 500→1000(작성·수정, 카운터 동기). 번역 버튼 FLAGS.reviewTranslationEnabled=false 비노출(useReviewTranslation 코드 보존 — 계약 배포 시 복원). i18n +2키×10(loadMore·postError). 작성/수정/삭제 실패는 화면 유지+표면화.
- 유닛 +10(어댑터 풀 페이로드·author 3케이스·URL→path·페이지 어댑트). tsc 0, jest 60스위트 305/305.
- Metro 실왕복(작성 사진 2장→목록→본문만 수정→사진 유지→삭제·같은국적 필터·평점 서버값) 예진 확인 대기. BE 질의: 조회 URL→전송 path 역변환 규약(pathname 추출 가정) 확인.

## 🚨 리뷰 실연결 플래그 봉인 (2026-07-30, P-086)
- [x] FLAGS.reviewsLiveEnabled=false 신설 — **원복 아님**, P-085 코드 보존·런타임 스위칭. 봉인 이유: BE 리뷰 엔드포인트 변경 예고(7/30 종한) + prod 미배포(실연결 OTA 시 라이브 리뷰 화면 파손 — P-084 맵기 OTA 동승 위험).
- [x] off 경로 = P-077 목 복원(화면 코드 무변): 목록/내리뷰 페처(fetchFoodReviewsPage·fetchMyReviews로 분리 — off면 목·세션 유저 빈 내리뷰) · 뮤테이션 3종(off면 API 호출 0, 캐시 직접 CRUD — 내 리뷰 prepend/수정/삭제 + 음식 목록 infinite 첫 페이지 삽입, 무효화 생략으로 목 삽입분 보존) · 사진 업로드 패스스루.
- [x] 평점 서버값 필드 부재(prod) 방어 확인: FoodDetailWire 옵셔널 + `?? null`/`?? 0` — 부재 시 '—'/카운트 생략 렌더(P-085 구현이 방어형, 변경 0).
- [x] 스위칭 유닛 +6: off=목 반환+리뷰 API 호출 0(countryCode 클라 필터 흉내 포함)·on=실 GET(cursor·countryCode 부착)·내리뷰 off 빈 목록/on keyset·작성 off 캐시 직접 반영/on 실 POST. P-085 어댑터 유닛 무변. tsc 0, jest 311/311.
- 재개 절차(발주 대기): BE 확정 → 계약 diff → reviewAdapter 보정 → 플래그 on.

## KB-258 아이콘 시스템 정비 — Lucide 규격 + circle-flags (2026-07-30, P-082)
- [x] 규격 확정(icons.tsx 헤더 명문화): 도형 = Lucide(ISC) 세트, 24×24 그리드·스트로크 2px·round cap/join·아웃라인 우선. 공용 29종 전수 교체(이름·IconProps API 무변 — 사용처 diff 0). 미사용 3종(Bell·Envelope·Flame) 삭제. 브랜드 시맨틱(RiskMark·Apple/GoogleG 로고·Cat* 일러스트·SuccessCheck) 교체 금지 명시.
- [x] 배포 형태 = **벤더링**(경로 데이터 내장 + ISC 고지): lucide-react-native 패키지는 Metro barrel 전량 번들로 **+1.81MB 실측**(5.22→7.03MB) → 기각, 동일 도형 벤더는 +7KB. 신규 아이콘 추가 절차(lucide.dev 복사) 헤더에 명시.
- [x] 국기 = circle-flags(MIT) 도입: Flag.tsx — 내장 16개국(추천 12 + FR·DE·HK·SG, flagAssets.ts ~11.5KB, mask id 국가별 유니크 치환) 실국기 + 미내장국 모노그램 폴백 유지. 전량(250+국 ~170KB) 대신 상위국 전략 — 번들 실측 근거.
- [x] 번들 증가량 실측(iOS .hbc): 5,221,824 → **5,233,585B (+11.8KB, +0.23%)** — 아이콘+국기 합산.
- [x] 탈퇴 화면 RiskMark 틴트 칩 solid 통일(outline 2곳 정리 — 게이트 카드와 문법 일치).
- tsc 0, jest 61스위트 311/311(회귀 0 — 아이콘 이름·API 유지 효과). 전후 스크린샷은 시뮬레이터 런타임 부재로 예진 실기 캡처 위임(전=현 설치본, 후=Metro — 목록 보고에 명시).

## KB-251 커뮤니티 게시판 — 목 선작업 전 화면 (2026-07-30, P-087)
- [x] 데이터 계층 격리: lib/community — types + 인메모리 목 스토어(다국어 시드 글 9·댓글 13, 커서 페이징 PAGE 5·리액션 상호배타·통삭제·차단 단방향 필터·신고 적재) + **adapter.ts 스왑 지점**(계약 배포 시 이 파일만 실 호출로) + React Query 훅(['community'] 무효화).
- [x] 피드(탭 개방): 트위터형 카드(5줄 접기+더보기·사진 그리드 1/2/3/4장·태그 칩·리액션) 최신순 무한스크롤, **게스트 2페이지 게이트**(AuthGateSheet), 알림 벨 자리만, 작성 FAB. 상세발 차단 복귀 토스트(pendingToast).
- [x] 작성: 2,000자 카운터(1,800 노출→1,950 강조→초과 Post 비활성)·사진 4장(커버 배지, **길게 눌러 커버 승격** = 재정렬 최소 해석)·태그 92% 시트(음식 = **실 /foods/search 재사용**, 장소 = 목 6곳, 원탭·상한 3/1·상한 시에도 시트 열림+안내)·툴바 틴트 에코(점 뱃지 금지)·이탈 확인(빈 초안 조용히 닫힘)·성공 모달(SuccessCheck 대체)·수정 모드(editId).
- [x] 상세+댓글: 리액션 상호배타(형태+채움 전환·**싫어요 0 숨김**)·번역 토글(모든 글·댓글 — 목은 상태 표시만)·태그 시트 2종(음식 = **RiskMark 재사용** 위험도 라인 / 장소 = 3사 지도 **중립 글리프**+딥링크·웹 폴백)·게스트 댓글 블러(개수 선명)·댓글 등록순 1뎁스 유튜브식(@멘션 primary 비탭·View n replies 접기 블록 상단·답글 @프리셋+X·수정 상태·통삭제).
- [x] 신고·차단: 사유 5종(확정 라벨)+Other 300자·미선택 비활성·확인 상태("Thanks — we'll review this")+차단 2차 제안 · 차단 확인(단방향 카피)→**"Blocking…" 텍스트만 ≥2초**(스피너 없음)→발원지별 후처리(상세=피드 복귀+토스트/댓글=재조회 소멸) · **차단 목록 화면**(+빈 상태·Unblock 즉시) + 프로필 계정 행 추가.
- [x] 공용 ActionSheet('context' 변형) 신설: AuthGateSheet 골격 — 헤더(아바타+대상 제목)+X·Cancel 행 없음·스크림 탭/안드 백버튼 닫기·destructive = 버건디 #8e2f3c(위험도 #cf3a2c와 구분). 글·댓글·대댓글 ⋯ 전부 ModerationFlow 경유.
- [x] 아이콘 8종 추가(lucide 벤더 — thumbs-up/down·ellipsis·map-pin·flag·user-x·send·bell). i18n community 73키×10(구 잠금 카드 2키 폐기), 이모지 0(시드 포함). 유닛 +12(페이징·상호배타·통삭제·차단 필터/해제·신고 적재·수정·답글 멘션). tsc 0, jest 323/323.
- 비범위 준수: 실 API·알림 인프라·장소 실검색(KB-249)·Amplitude 이벤트·타인 프로필 없음. 실기 확인(예진) 대기.

## KB-261 온보딩 Q-23 실기 보정 1차 (2026-07-31, P-088)
- [x] ① 약관 정렬: "전체 동의" 카드 marginHorizontal -14.5(보더 1.5 보정 포함) + 내부 패딩 13 — 카드 안 체크박스 좌측 x가 아래 3행과 일직선(카드만 살짝 넓은 문법), border 강조 유지.
- [x] ② 마크 데모 에셋 슬롯: assets/images/onboarding-demo-dish.png **플레이스홀더**(surface2 톤 단색 PNG) require — 예진 김치찌개 에셋 수령 시 **같은 파일명 교체만으로 반영**(코드 무변). 서버 이미지 금지 준수.
- [x] ③ 펄스 링 복원: 마크 주위 확대(1→1.45)+페이드 반복 1.5s — **첫 탭 후 영구 정지**(cancelAnimation+비렌더), reduced-motion 미동작. 진행바 애니 절제(P-042)와 별개 명시.
- [x] ④ 스택 차단: lib/nav.resetToOnboarding(dismissAll+replace) — 진입 4곳(login 2·프로필 이어하기·재개 배너) 교체 + 탈퇴→login도 dismissAll. _layout에 onboarding gestureEnabled:false(iOS 스와이프 백 차단, 이중 방어). 안드 하드웨어 백 = 스텝 back 동일(BackHandler, 첫 스텝은 기본 동작).
- [x] ⑤ 슬라이더 재작업(SpiceLevelSlider 공용 — 온보딩·프로필 동시 반영): (a) **트랙 고정 + 틱·노브 전부 absolute(i×25%)** — space-between 플로우 재배치 원인 제거, 선택 전환 시 타 요소 이동 0을 레이아웃 유닛으로 잠금 (b) 시안 일치 — 중간 미선택 자리 = 흰 세로 틱·노브 = 흰 원+잉크 보더·라벨 5개 전부(선택 볼드 잉크, adjustsFontSizeToFit로 러시아어 등 축소) (c) 트랙 전체 드래그 — 개별 Pressable 폐기, 트랙 레벨 PanResponder 단일(드래그 중 노브 자유 추종, 릴리즈 최근접 스냅).
- 유닛 +4(틱 절대 고정 스냅샷·노브 이동·라벨 5+선택 강조·릴리즈 스냅) + 온보딩 Hot 선택 경로를 릴리즈 스냅으로 갱신. tsc 0, jest 63스위트 327/327. Metro 재확인(Q-23 재수행) 예진 대기.

## KB-265 Amplitude 계측 도입 (2026-07-31, P-083)
- [x] 어댑터 격리: lib/analytics.ts — 화면은 track(event, props?) 하나만. **상단 표 = 이벤트 스키마 정본**(9종: 온보딩 view/complete/skip/submit·scan_complete·food_detail_view·review_submit·login_success·guest_enter, snake_case 상수화). 키(EXPO_PUBLIC_AMPLITUDE_API_KEY — .env 주입 완료) 없으면 no-op(콘솔 debug), 키 주입 시 코드 변경 0. 웹 위저드 지시 무시(발주): unified·autocapture·sessionReplay 미사용 — 명시 이벤트만.
- [x] PII 방어 2중: ① setUserId/Identify 미호출 — 익명 device id만 ② **이벤트별 허용 키 화이트리스트(sanitize)** — 스키마 밖 prop(닉네임·이메일·국적·재료 내용)은 전송 전 드롭, 유닛 실측.
- [x] 배선: 온보딩 퍼널(스텝 view = step 변화 effect·complete = advance 경로·skip 분리·submit = avoid_count 개수만+skip 여부 2종) · 스캔 완료(degraded·item_count) · 음식 상세 진입(4 진입처에 ?src= 부착 — scan/list/search/home, 그 외 other) · 리뷰 제출 · 로그인 성공(useSocialAuth — provider GOOGLE/APPLE) · 게스트 진입(인트로 둘러보기+로그인 화면 둘러보기).
- [x] ⚠️ 실측 보정: @amplitude/analytics-react-native 1.6.8은 발주 전제(JS-only)와 달리 **네이티브 모듈 포함** — 단 부재 시 optional chaining 폴백으로 graceful(크래시 없음, 앱 버전 등 컨텍스트 메타만 결손). **기존 빌드 OTA 안전**, 완전 계측은 다음 재빌드(P-089 빌드12)부터 + fingerprint 회전은 그 빌드에서 재베이스라인.
- [x] 유닛 +4: no-op(SDK 호출 0)·init 1회+track 전달·PII 드롭 실측·전 이벤트 스키마 PII 부재. tsc 0, jest 64스위트 331/331. 실이벤트 수신 확인(Metro)은 예진 몫(DoD 분리).

## 팀 공유 배포 — iOS 테플 빌드12 (2026-07-31, P-089)
- [x] 지문 실측(발주 게이트): 양 플랫폼 회전 — iOS 36d1708a→5dfae66a·안드 86eb4381→b20b474c. 원인 = P-083 Amplitude 네이티브 모듈(기보고 건). 발주 "회전 시 중단·보고"에 따라 예진 확인 → **iOS 빌드12만 진행, 안드 preview OTA 보류**(현 HEAD 발행 시 runtime 불일치로 기존 vc4·vc5 기기 도달 불가 — 발주 목적 불성립).
- [x] eas.json preview·production env에 EXPO_PUBLIC_AMPLITUDE_API_KEY 추가(ff16e90 — 클라이언트 공개 키, 빌드12부터 계측 임베드).
- [x] 발행 전 검증(P-073): 인라인 env export → .hbc grep **prod 1 · dev 0 · meogo 0 · Amplitude 키 1**.
- [x] iOS 빌드12: eas build production(03f87d90, runtime 5dfae66a) → 테플 제출 완료(submission 7c5c6662, ASC 처리 중 — 수분 내 테플 노출). 심사 대기 빌드11과 독립.
- [x] iOS production OTA **미발행**(심사 오염 방지 — 발주 준수). 재베이스라인 5dfae66a 커밋(2abacd8).
- 안드 잔여: 기존 기기 대상 맵기 폴백 선반영이 필요하면 ① P-083 직전 커밋(2dee6f5, 지문 86eb4381)에서 OTA ② vc6 재빌드 중 택일 — 커맨드 센터 재발주 대기.

## 안드 preview OTA — 구 runtime 대상 맵기 폴백 (2026-07-31, P-090)
- [x] 워크트리(2dee6f5)에서 발행 — HEAD 무오염(worktree remove·status clean 확인). 안드 지문 실측 86eb4381 = 기존 vc4·vc5 runtime 정확 일치.
- [x] 발행 전 검증(P-073): 인라인 env + export --clear → 안드 .hbc grep prod 1 · dev 0 · meogo 0. --non-interactive가 --environment를 강제 → EAS 서버 preview env 실측(변수 0개 — 인라인 유효 확인) 후 발행.
- [x] 발행: branch preview / android update id 019fb347-3dff-7be8-9198-9fd4553e9deb (group 802b1b20) / runtime 86eb4381 / msg "vc4/vc5 대상 맵기 enum 폴백(P-084·086 포함, ~2dee6f5)".
- 커맨드 센터 → 종한 "안드 폴백 완료" 전달 예정(prod enum 배포는 iOS 심사 통과 후 순서 유지).

## 테플 팀 공유 재작업 — dev 연결 빌드13 (2026-07-31, P-091)
- [x] eas.json teamtest 전용 프로필(db07ebb): channel=teamtest(production/preview 완전 분리 — dev OTA 지뢰 원천 차단), env=dev.kbap.site + Amplitude 키, autoIncrement. submit 프로필 동반.
- [x] 발행 전 grep(이번엔 dev가 정답): dev 1 · prod 0 · meogo 0 · 키 1.
- [x] iOS 빌드13(64b523ec, runtime 5dfae66a, channel teamtest 실측) → 테플 제출 완료(ASC 처리 수분). production/preview 채널 무오염.
- [ ] 빌드12 만료(Expire): ASC 웹 조작(비가역) — 예진 처리 안내(ASC > TestFlight > iOS > 1.0.0 (12) > Expire Build). 이후 팀 테플 빌드는 항상 teamtest 프로필.

## Amplitude 트래픽 분리 — A안 (2026-07-31, P-094)
- [x] 키 제거: .env(Metro — gitignore, 로컬 반영)·eas.json teamtest 프로필 → 두 경로 no-op. production·preview 키 유지(실유저 계측 전용).
- [x] .env.example 운영 주석 + analytics.ts 헤더 운영 노트("일시 주입→반드시 제거·커밋 금지").
- [x] 실측: teamtest 에뮬 export → ampKey 0(dev 1) · production 에뮬 export → ampKey 1(prod 1). tsc 0, jest 331/331.
- 특기: 기제출 빌드13에는 키가 임베드돼 있음(팀 트래픽 Prod 유입) — 차단 원하면 teamtest 채널 OTA(키 없는 현 시점 번들) 1회로 소거 가능(별도 발주 시).

## KB-272 앱 용량 조사 1단계 (2026-07-31, P-093 — 조사만, 코드 변경 0)
- [x] vc5 production AAB(ad0fb109, 107.9MB) bundletool 실측 — arm64·420dpi·en+ko 기기 스펙: **다운로드 45.5MB** / **설치(비압축 합) ~112MB**(master 75 + arm64 36). 예진 실측 185MB와의 갭 = ART 컴파일 아티팩트(DEX 59MB에 비례)+앱 데이터로 설명 — DEX 감량 시 연쇄 감소.
- [x] 기여 분해: **DEX 59.4MB(×6 — R8/minify 미적용이 최대 요인)** · .so 36.2MB(ML Kit OCR 10.6·RN 6.5·barhopper 바코드 4.7·hermes 2.3…) · OCR 모델 5.2 · JS 번들 4.2 · 폰트 2.5(미사용 의심 MaterialSymbols 0.91 — expo-router→expo-symbols 연쇄라 제거 불가) · 바코드 모델 0.8.
- [x] 감량 후보 우선순위: ① R8+resourceShrink 활성(예상 다운로드 -10~15MB·설치 -30MB+, 중리스크 — keep 규칙·전 기능 QA) ② 미사용 의존성 제거: expo-glass-effect·expo-auth-session·expo-device(사용 0 실측, 저리스크, 재빌드 합류) ③ expo-camera의 barcode 계열(5.5MB — 분리 옵션 부재, 고난이도·보류) ④ OCR 모델·엔진(15.8MB — 핵심 기능, unbundled 전환 비권장). 실행은 예진 승인 후 별도 발주.

## KB-257 리뷰 화면 구현 — D-07~10 (2026-07-31, P-095)
- [x] 디테일 범용화(review/[id] 재작성): 작성자 행(아바타·이름·랭킹 필·시간·⋯)·정수 별점+n/5·본문·사진 스와이프 캐러셀(카운트+도트)·좋아요(하트 SVG 채움 전환 — primaryText, red 금지 준수)+정렬 미반영 캡션·장소 섹션(태그 시에만 — 3사 지도 중립 글리프, tagSheets openMap 재사용). 목록 진입은 ?foodId=로 음식 리뷰 캐시 조회, 프로필 진입은 내 리뷰. 기존 인라인 수정/삭제는 ⋯(Edit/Delete)로 통합.
- [x] 목록 갱신: 행 전체 탭(press 상태+chevron)→디테일 · ⋯ per row(ModerationFlow) · 장소 한 줄(핀+이름) · 좋아요 카운트 메타 · minePill 폐기.
- [x] 작성 폼 장소 필드: 접힌 행("Tag a place · Optional")→92% 시트(Recent·typeahead(커뮤니티 목 places 재사용)·무결과·Skip 푸터)→이름 칩(×). create 목 저장(live 전송은 계약 배포 시 스왑 주석). 1000자 유지·성공 화면 기존(SuccessCheck 계열)·언어 자동감지 미구현(보정 ②).
- [x] 좋아요 목: useToggleReviewLike — 캐시 토글(내 리뷰+음식 리뷰 전 필터 키), API 호출 0, 스왑 주석. 유닛 잠금(토글·재탭 해제·호출 0).
- [x] 모더레이션: ReportTarget에 'review' 추가 — 공용 ActionSheet('context')+ModerationFlow 재사용(사유 5종·"Blocking…" ≥2s·버건디 destructive). **리뷰발 차단 = 리스트 복귀+재조회**(디테일)·목록발 = refetch. 번역 버튼 플래그 비노출 유지.
- [x] reviewAdapter 경로 보정(#116): on-경로만 GET /reviews?foodId=·GET /reviews/me — **플래그 off 봉인 그대로**, 유닛 신경로 갱신.
- [x] IconHeart(lucide 벤더 규격 절차) 추가. i18n +10키×10(ratingOutOf·likesCaption·place 6종·reviewBy·yourReview). Review 타입 place/likes/myLike(목 전용) + 목 시드. tsc 0, jest 64스위트 332/332.

## 온보딩 데모 에셋 최적화 (2026-07-31, P-096)
- [x] onboarding-demo-dish: PNG 2,301,410B → JPG q50 269,038B(-88%, 1024² 유지 — 발주 품질 ~80으론 538KB라 DoD ≤300KB 우선, 해상도는 유지). require .jpg 갱신·원본 png 삭제. 렌더 확인은 예진 Metro(Q-23 겸사).

## 온보딩 Q-23 보정 2차 — 펄스·슬라이더 제스처 (2026-07-31, P-098)
- [x] ① 펄스 상시 반복(예진 확정 — "첫 탭 정지" 시안 노트 대체): tapped 정지 로직 제거, 화면 머무는 동안 반복·이탈 시 cleanup(cancelAnimation)·reduced-motion 미동작 유지.
- [x] ② 슬라이더 제스처 재작업(공용 SpiceLevelSlider — 온보딩·프로필 동시): (a) 부모 스크롤 잠금 — onPanResponderTerminationRequest 거부 + onDragStateChange로 양쪽 ScrollView scrollEnabled 토글 배선 (b) 드래그 중 1:1 추종 — grant 시점 (pageX−locationX) 동기 오프셋으로 절대좌표 정합(measure 레이스 없음), 노브 스냅 없이 손가락 추종·라벨/🌶️ 히어로는 통과 스톱 기준 실시간(onChange), **스냅은 릴리즈만**(최근접 스톱 + LayoutAnimation 짧은 스프링) (c) 히트 영역 상하 ±20pt(터치 래퍼 음수 마진 — 레이아웃 자리 무변).
- [x] 유닛: 이벤트 pageX 기반·터치 래퍼 지문(84) 갱신 — 스냅 계산·틱 절대 고정·회귀 0. tsc 0, jest 64스위트 332/332. 제스처 실기감(1:1·스크롤 0·착 붙음)은 예진 Metro 재확인.

## 커뮤니티 FAB 위치 보정 (2026-07-31, P-099 — 초소형, Q-25 반려)
- [x] FAB bottom: bottomInset+86(실측 ~120, 과대) → **고정 18pt** — 탭 콘텐츠가 탭바 위에서 끝나는 구조라 인셋 불요(탭바 관례 위치). 리스트 paddingBottom 96(FAB 54+18+여백 — 마지막 카드 액션 줄 확보). 미사용 useBottomInset 정리. tsc 0, jest 332/332. 스샷 재확인 예진(Q-25 겸사).

## 게스트 댓글 가림 강화 (2026-07-31, P-100 — 소형, Q-25 반려)
- [x] opacity 0.25 반투명(내용 판독됨) 폐기 → **고스트 스켈레톤 3줄**(아바타 원+회색 라인 2개, 정적) — 실 댓글 텍스트 미렌더 = 판독 원천 차단 + 실연결 시 비회원엔 댓글 데이터가 안 오는 BE 필터 정책과 정합. 개수("Comments · n") 선명·게이트 카드 현행 유지. expo-blur 미도입(JS-only). tsc 0, jest 332/332.

## 온보딩 CTA 푸터 통일 (2026-07-31, P-101 — Q-23 반려)
- [x] 공용 푸터 신설(6스텝 전부): 스텝별 제각각이던 in-scroll foot(회피 151pt·맵기 111pt·요약 53.7pt) 폐기 — P-011 restrictions 스티키 방식을 전 스텝으로 확장(스크롤 밖 고정, 배경/보더/패딩 규격 단일). CTA 프레임(y·높이) 전 스텝 픽셀 동일.
- [x] Skip 슬롯 = CTA 아래 고정 높이 34pt — 회피/맵기(Skip)·약관(consent 노트)·그 외(빈 슬롯) 모두 같은 높이 → 어느 스텝에서도 CTA 미동 0. ScrollView 하단 패딩 전 스텝 24로 통일.
- [x] 스텝 컴포넌트 정리: Consent/Profile/RiskDemo/Spice/Interests/Summary에서 개별 foot·onContinue/onSkip/onSubmit 프롭 제거 — CTA 상태(비활성 조건·아이콘·라벨 카운트) 전부 푸터 도출식 한 곳으로.
- [x] 유닛: 푸터 프레임 스타일 동일성(consent vs spice) 잠금 + 기존 스티키(ScrollView 밖) 테스트 라벨 매처 보정. tsc 0, jest 64스위트 333/333. 육안(전환 시 버튼 미동 0)은 예진 Metro.

## 리뷰 작성 완료 화면 랭킹 필 제거 (2026-07-31, P-102 — 초소형, Q-22 반려)
- [x] "Review posted" 성공 화면의 별점 옆 랭킹 필(Rosette+tier) 제거 — 별점·본문 카피·버튼 2개 현행 유지. 미사용 import/스타일 정리. tsc 0, jest 333/333.

## 재료 칩 아이콘 고정 폭 슬롯 (2026-07-31, P-103 — 초소형, Q-23 반려)
- [x] IngredientFilter 카탈로그 칩의 +/✓를 고정 폭 16pt 슬롯에 수납 — ✓(13) vs +(12) 글리프 폭 차로 선택 시 칩이 1pt 자라며 flex-wrap 이웃이 밀리던 문제 해소. 온보딩·프로필 공용 컴포넌트라 한 곳 수정. 텍스트 웨이트는 양 상태 bodyBold 동일(비변인) 확인. 유닛: 슬롯 폭·텍스트 스타일 양 상태 동일 잠금.

## 음식 맵기 None → "Not spicy" (2026-07-31, P-104 — 초소형, Q-23 반려)
- [x] 음식 상세의 맵기 None(🌶️ 0개) 고아 라벨 → 자기설명 `spice.foodNone`("Not spicy") ×10 로케일. 표시 로직은 spice.ts `foodSpiceText()`로 추출(음식 표시 전용 단일 소스) — 음식 맵기 표시처는 상세 1곳뿐임을 전수 확인(프로필·온보딩 요약은 유저 톨러런스, 라벨 있는 행이라 현행 유지). Mild~Extreme 무변. 패리티 테스트에 foodNone ×10 추가(en은 band.0과 불일치 강제).

## 커뮤니티 작성 화면 v2.3 시안 정합 재작업 (2026-07-31, P-105 — 예진 반려, 우선)
- [x] 2존 재구조: warm hero(X 원형 카드 버튼·Post 필 활성/비활성·아바타 52·헤딩 display 22·작성자 행 이름+국기+랭킹 필) + 흰 시트(top radius 26, 내부 스크롤). 시트 블록 gap 16: 1.5px 보더 본문 필드(포커스 primary+글로우, 카운터 1,800~ 우하단)·76px 사진 타일+대시 추가 타일(+, n/4)·태그 행 2개(틴트 아이콘 타일 26·placeholder·mono 카운터·행 내 제거 칩)·번역 힌트(globe). 글리프 바 44px×3 = KAV로 키보드 위 부착. 태그 시트: 그랩바·Done 회색 텍스트→primary 필 전환·검색 primary 보더+글로우·POPULAR(음식 브라우즈)/RECENT(장소 목) 섹션·38 썸네일 2줄 행·+ 원형 30(선택=✓ primary)·하단 mono 캡션. 모달 라운드 26+원형 일러 슬롯. 기능(2000자·상한·목·커버 승격·이탈 확인) 회귀 0. i18n 신규 8키+placeholder 갱신 ×10. 유닛 3본(구조·Post 게이팅·추가 타일).

## 키보드 내리기 UX 전역 (2026-07-31, P-106 — 예진 확정)
- [x] 공용 KeyboardDismissBar + Input 래퍼: iOS=InputAccessoryView(공유 nativeID, 루트 1회 마운트 — 전 Input 자동 연결), 안드=키보드 show/hide 이벤트 하단 고정 바(resize 모드 bottom 0). RN Modal은 별도 레이어라 입력 품은 Modal 4곳(작성 태그 시트·리뷰 장소 픽커·신고 모달·국적 픽커)에 `modal` 변형 추가(iOS null — 중복 등록 방지). 전 TextInput(10파일 13개) → Input 코드모드, 키보드 화면 스크롤러 keyboardDismissMode="on-drag" 일괄(10곳). IconChevronDown 벤더 추가. 유닛 5본. 네이티브 신규 의존 0 — 지문 불변, OTA 안전.

## 음식 상세 리뷰 요약 중첩 반영 (2026-08-03, P-107 — KB-275, #121 breaking)
- [x] foodAdapter 평점 수신 3중 겸수신: ① 신계약 중첩(8/3 스냅샷 정본 review.{overall,sameCountry}.{averageRating,reviewCount}, count 0 = average null 강등 — 0.0점 오표시 금지) ② 발주문 단층 중첩 ③ 구 평면(prod 폴백). sameNationality count 신계약에서 실값 수신. blur 기본값도 null 경로로 자연 강등. 유닛 5본. 표시 로직 무변.

## 리뷰 실연결 스왑 일괄 (2026-08-03, P-108 — KB-73/257, 종한 계약 확정)
- [x] FLAGS.reviewsLiveEnabled=true 봉인 해제(목록·내리뷰·CRUD·presigned 실왕복, PATCH 풀 페이로드 유닛 유지). 좋아요 = POST /reviews/{id}/like?liked= 낙관 토글+실패 롤백, 수신 likeCount/likedByMe 서버값(어댑터 매핑, 목 로컬 계산 폐기 — 표시 전용 유지). 신고(리뷰만) = POST /reports 사유 매핑 고정(SPAM/ABUSE/SEXUAL/FALSE_INFO/OTHER, detail 300자) — 커뮤니티 신고는 목 유지(계약 targetType REVIEW뿐). 차단 = POST·DELETE /members/me/blocks + 목록 GET(null 방어), 실 회원(수치 id)만 BE·목 시드는 로컬만, 커뮤니티 목 로컬 차단 병행 유지. 유닛 17본 추가(좋아요 on/롤백·매핑·신고 스왑·차단 스왑·목록 방어). Metro 실왕복 DoD는 예진.

## 사장님 확인 카드 계란 일반 폴백 버그 (2026-08-03, P-109 — KB-281)
- [x] 원인: reader=ko일 때 상세 API 성분명 = BE ko 사전("계란")인데 FE 카탈로그 ko 라벨은 "달걀" — 동의어 불일치로 역인덱스 실패 → 일반 질문 강등(우유는 양쪽 "우유"라 정상). FE 수정: resolveIngredientKo 역인덱스 실패 시 **순한글 실명칭은 그대로 채용**(구조 해결 — 전 성분 커버, 받침 조사 정상). 비한글·혼합 스크립트는 종전대로 강등(P-052 원문 노출 봉쇄 유지). 81종 전 재료 라운드트립 유닛(ko 라벨·en 명칭 각각 일반 폴백 0) + 순한글 동의어 2례 잠금.

## 안드 1.0.1(vc6) — 목 숨김 + 감량 + AAB (2026-08-03, P-110 — KB-280)
- [x] 채널 기반 노출 플래그: FLAGS.reviewsEnabled/communityEnabled = production 채널이면 숨김(expo-updates channel, 웹/jest/dev 폴백 노출). 진입점 전수: 탭바 커뮤니티 탭(양측 flex 래퍼로 3탭에도 FAB 정중앙)·커뮤니티 화면 가드·설정 차단 목록 행·리뷰 10개 화면(기존 reviewsEnabled 게이트 재사용).
- [x] 감량(KB-272 ①②): expo-build-properties android enableProguardInReleaseBuilds+enableShrinkResourcesInReleaseBuilds, 미사용 3종 제거(expo-glass-effect·expo-auth-session·expo-device). 버전 1.0.1(vc autoIncrement). 발행 전 export grep: prod 1·dev 0·meogo 0.
- [x] 빌드 2벌 완료(둘 다 vc6·1.0.1): production AAB 102.5MB(vc5 107.9 → −5.4MB), 공기계 APK(production-apk 프로필, 동일 구성) 163.0MB(vc5 universal 175.3 → −12.9MB, R8 DEX 감량 부합). 링크는 REPORTS. 전달 순서: 예진 APK 스모크(구글 로그인·스캔·온보딩·상세) → 종한 AAB.

## 최소 지원 버전 게이트 (2026-08-03, P-111 — KB-269, BE 선행 없이 페일 오픈)
- [x] GET /app-config 어댑터 격리(appConfigAdapter — 예상 계약, 운영 규칙 주석: min은 심사 중 버전 이하만) + semver 순수 비교(lib/semver, 형식 불량 null) + versionGate 모듈 스토어(시작+포그라운드 복귀 재조회·5분 스킵, useSyncExternalStore 구독). 하드 게이트 = 루트 풀스크린 오버레이(백핸들러 차단·dismiss 불가·스토어 딥링크 CTA), 소프트 넛지 = 홈 상단 배너(dismiss한 latestVersion 저장 — 같은 버전 재노출 없음). **페일 오픈**: 404·네트워크·파싱·필드 누락·semver 불량 전부 통과 + blocked 후 일시 오류론 해제 안 함. i18n versionGate ×10, IconDownload 벤더. JS-only(지문 불변). 유닛 14본.

## API 타임아웃 도입 (2026-08-03, P-115 — 무한 스켈레톤 구조 봉쇄)
- [x] api/client 전 요청 타임아웃 기본 15s — AbortController+setTimeout(Hermes 안전, finally 정리·누수 0), 타이머 창은 fetch+본문 읽기까지. 타임아웃 = "NETWORK: timeout after Nms" reject → react-query retry 1회 → 기존 에러 UI 합류(classifyQueryError NETWORK 프리픽스 재사용 → offline 재시도 문구). per-call 오버라이드: /scans ML 60s만. 401 재시도 경로에 타임아웃 전파. 유닛 4본(발화 reject·오버라이드·정상 무영향+타이머 0·분류).

## prod 회원가입 400 — 맵기 송신 채널 겸용 (2026-08-03, P-114 — KB-280, Q-27 반려 ②)
- [x] spiceChoiceToWire 채널 겸용: production 채널 = P-081 원규약 정수(NONE 0/MILD 2/MEDIUM 5/HOT 7/EXTREME 10·SKIP -1, CHOICE_TO_WIRE 복원) / 비프로덕션 = enum 문자열(P-084 현행). 채널 판별 = flags isProdChannel() 단일 소스 export(중복 구현 0). 어댑터 단일 적용이라 온보딩 제출·프로필 PATCH 자동 커버(memberAdapter 와이어 타입 string|number 확장, tsc 0). 헤더에 분기 제거 전환 계획 명기. 유닛: prod 정수 5종+SKIP·정수 왕복(채널 목 분리 파일), 비프로덕션 기존 유닛 무변.

## 목 숨김 방식 변경 — coming-soon (2026-08-03, P-113 — KB-280, Q-27 반려 ①)
- [x] P-110의 prod 채널 탭 제거(3탭) 폐기 — 탭바 항상 5슬롯 복원(양측 flex 래퍼는 유지, 2/2라 시각 동일). prod 채널 커뮤니티 탭 진입 시 원조 잠금 화면(870a942) 재사용한 coming-soon 플레이스홀더(흐린 셸+IconLock 카드), 카피만 스토어 톤으로 재작성(lockedTitle/Body ×10 복원). 리뷰 쪽 게이트는 현행 유지. 유닛 3본(off 플레이스홀더/on 실화면/탭 5슬롯).

## 게스트 게이트 실기 가능화 + 로그아웃 즉시 반영 (2026-08-03, P-112 — Q-25 잔여)
- [x] 목 시드 +3(p10 일어·사진1 / p11 베트남어·무사진 / p12 영어·사진2, 기존보다 과거 날짜) → 총 12개 = 3페이지 — 게스트 2페이지 상한 게이트가 실기에서 노출 가능. 페이징 유닛 3페이지 기준 보정.
- [x] 로그아웃 즉시 게스트 반영: 원인 = 인증 경계 clear() 후 세션 판별이 AsyncStorage 재조회(비동기)에 맡겨져 hasSession=undefined 동안 회원 UI 스침. resetServerCache(sessionAfter)로 경계마다 ['auth','session'] 즉시 시드(로그인 true / 로그아웃·탈퇴·만료 false). 유닛 3본(로그아웃 false·로그인 true·탈퇴 실패에도 false).
- [x] vc7 빌드 2벌 완료(1.0.1): AAB 102MB·APK 163MB(vc6 동급 — 변경이 JS/i18n뿐). 링크 REPORTS. 순서: 예진 APK 재스모크(회원가입 복구+coming-soon+5탭) → 종한 AAB.

## 리뷰 장소 태그 전면 숨김 (2026-08-04, P-116 — KB-249, 릴리스 스코프)
- [x] FLAGS.placeTagsEnabled=false 신설(전 채널 — KB-274 배포 시 true 한 줄 복원, 코드 보존). 3지점 게이트: 작성 폼 장소 필드+픽커 시트 / 디테일 장소 카드(지도 3버튼) / 목록 행 장소 한 줄. 커뮤니티 작성 장소 행 무변. 유닛 2본(off 미렌더·on 현행 렌더 — 디테일 기준, 3지점 동일 패턴 게이트).

## 테플 빌드14 (2026-08-04, P-117 — 8/5 멘토 시연 대비)
- [x] iOS teamtest 프로필 빌드14(dev.kbap.site·Amplitude 키 0) → TestFlight 제출 완료(내부 테스터 — 심사 대기 없음). 탑재: P-107~116(리뷰 실왕복·평점 중첩·계란 카드·키보드 ↓바·타임아웃·버전게이트·장소 숨김·시드 12). 발행 전 grep dev 1·prod 0·meogo 0·키 0. 새 runtime 지문 기록(.ota/runtime-fingerprint-teamtest.txt) — 이후 teamtest OTA는 이 지문 기준. 안드 불요(테플 전용 관례).

## 탭바 간격 원복 + 높이 축소 → teamtest OTA (2026-08-04, P-118 — 테플 빌드14 반려)
- [x] 원인 확정 = P-110 양측 flex 래퍼 잔존(P-113이 5탭 복원 시 래퍼가 남아 좌우 묶음 1/3 분배 → 간격 불균등). 평평한 5슬롯 균등(각 flex 1) 원복 — coming-soon·prod 숨김 무변. 높이 -4pt(paddingTop 8→6, 아이콘/라벨 gap 4→2, FAB 랩 동기) — 터치 44pt 유지. 유닛 2본(5슬롯 flex:1 래퍼 부재·높이 값).
- [x] 사고 처리: P-117 git add -A에 예진 임시 계측(CardPhoto, "커밋 금지" 표기)이 오혼입 커밋·빌드14 포함 → 원복 커밋(4a8452b), 디프는 spec/bridge/cardphoto-instrumentation-backup.patch 백업. 이번 OTA가 빌드14에서 계측 제거.
- [x] teamtest OTA 발행 — iOS 그룹 2e8df00f(runtime 7aa41957 = 빌드14 일치). 확인: 테플 앱 완전 종료 → 2회 실행.

## 맵기 NONE 전환 UI 하강 — 히어로 프레임 고정 (2026-08-04, P-119 — 테플 빌드14 반려)
- [x] 상태 가변 줄 전원 고정 슬롯화(P-101/103 원칙): 온보딩 히어로 chiliRow minHeight→height 46·bandName lineHeight/height 38·analogy 필 고정 36 + 🌶️repeat(rank) 혼합 줄 3곳(프로필 수정 spiceVal·프로필 탭 dietChipText·온보딩 요약 sumVal)에 고정 lineHeight — NONE(이모지 0개)에서 줄 높이가 변하던 부류 일괄 봉쇄. 코드 플래튼 비교로는 히어로에 상태 조건 스타일이 없어(4고추 상시+opacity) 발화 지점은 이모지/폰트 폴백 메트릭 추정 — 후보 전원 고정으로 어느 쪽이든 프레임 불변. 유닛: NONE↔HOT 히어로 3줄 스타일 완전 동일+고정값 잠금. CardPhoto 계측은 4a8452b 기제거 확인.
- [x] teamtest OTA 발행 — iOS 그룹 6061ae44(runtime 7aa41957 = 빌드14). 확인: 테플 완전 종료 → 2회 실행.

## 프로필 사진 UX 4종 (2026-08-04, P-120 — KB-192, 테플 실기)
- [x] ① busy 중 진행 차단: 수정 저장(헤더 disabled+opacity·하단 CTA off)·온보딩 계속(off) — 완료/실패 복원. ② 수정 화면 사진 = 로컬 드래프트: 선택 즉시 업로드(로컬 uri 미리보기+스피너)하되 PATCH는 저장 탭 1회 합류(profileImageUrl 드래프트 있을 때만), 삭제도 드래프트(CLEAR 센티널), 뒤로가기 = 폐기·서버 무변. 실패 = 미리보기 원복+드래프트 미반영+에러 라벨. ③ "사진 변경" 상시 라벨 제거(에러 시에만 그 자리) — 온보딩 라벨은 발주 범위 밖 유지. ④ 삭제 텍스트 버튼 iOS 제거(시트 빨간 삭제 일원화)·안드 잔존(유일 경로, 드래프트로 전환). 온보딩은 기존 드래프트 시맨틱 회귀 확인(제출 시 일괄 — 무변). 유닛 7본(iOS 라벨 부재·안드 잔존/드래프트·busy 양화면·1회 PATCH·무전송·실패 미반영).
- [x] teamtest OTA — iOS 그룹 8fddde99(runtime 7aa41957 = 빌드14). 테플 완전 종료 → 2회 실행.

## 안드 teamtest APK (2026-08-04, P-121 — 팀 테스트용 커뮤니티 포함)
- [x] eas.json teamtest에 안드 한정 buildType apk + distribution internal(루트가 아닌 android 블록 — iOS TestFlight 경로 무변). grep dev 1·prod 0·meogo 0. 빌드 → 링크는 REPORTS.
- [x] 안드 teamtest APK vc8(1.0.1) 완료 — 커뮤니티·리뷰 on(teamtest 채널)·dev API. 링크 REPORTS.

## 카메라 권한 거부 후 설정 딥링크 (2026-08-04, P-122 — 예진 실기, iOS·안드 공통)
- [x] 스캔 권한 게이트 분기: canAskAgain=false(거부 이력·silent denial) → 문구 scan.permissionSettingsBody(신규 ×10)+버튼 photo.openSettings 재사용 → Linking.openSettings / true → 현행 requestPermission. AppState active 복귀 시 getPermission 재조회(설정 허용 후 버튼 재탭 없이 카메라 자동 진입). 갤러리 경로는 시스템 픽커(iOS PHPicker·안드 포토피커)라 권한 불요 — 분기 불필요 확인. 유닛 3본. JS-only.
- [x] teamtest OTA 양 플랫폼 — iOS 그룹 953c45f5(7aa41957=빌드14)·안드 그룹 1e358b60(2e6a56f4=vc8 일치 실측). 완전 종료 → 2회 실행.

## 안드 사진 시트 = 커뮤니티 ActionSheet 재사용 (2026-08-04, P-123 — KB-192, P-120 잔여)
- [x] PhotoSourceSheetHost 신설(루트 1회 마운트) — 명령형 choosePhotoSource(Promise)와 선언형 ActionSheet 브릿지(모듈 스토어, 행 선택 즉시 settle·스크림/X 취소는 지연 판정으로 경합 해소). 안드 분기 = Alert 3버튼 폐기 → 호스트 위임(촬영/갤러리/삭제 destructive 버건디 — remove 라벨은 호출측 hasCustomPhoto 조건 그대로). iOS 네이티브 시트 무변. 안드 텍스트 삭제 버튼 소멸(시트 일원화). 호출부 2곳(수정·온보딩) 자동 커버 — 온보딩은 기존 결정대로 삭제 옵션 없음(재선택 대체) 유지. 유닛 8본(시트 구성/색/resolve/분기 + 기존 2스위트 P-123 갱신).
- [x] teamtest OTA 양 플랫폼 발행(빌드14·vc8 runtime 일치). 완전 종료 → 2회 실행.

## 스캔 마커 글래스 캡슐 개편 (2026-08-04, P-125 — KB-240 해소)
- [x] E안(dot-styles-mockup .dotE) 구현: 다크 캡슐(rgba(28,24,20,.62)+그림자, 높이 24, blur는 네이티브 의존이라 rgba 근사) 안에 위험도 글리프(안전 원 #5fd695·주의 사각 #f2b94a·회피 마름모 #ff7a66·정보없음 회색 사각+?)+흰 tabular 숫자. 번호 = itemId 오름차순 안정(assignScanNumbers) — 미니시트 순번 1:1. 이름 필·사다리 알고리즘(pillLayout) 폐기 → layoutCapsules 미세 오프셋 한 단. 줌 추종(P-079) 무변.
- [x] 미니 바텀시트(ScanMiniSheet): 그립+행(번호 칩 16 #eee7dd·음식명·위험도 텍스트 s#2f8f5b/w#a06a00/d#a02418) — 캡슐 탭=해당 행 스크롤+하이라이트(#fdf0e6+primary 아웃라인), 그립 릴리즈 판정(PanResponder JS·워클릿 0)으로 확장=전 항목(photoOnly "–" 칩 포함 — 안전 게이트 유지). 위험도 뷰 = 사진+캡슐+미니시트, 목록 뷰는 보수적으로 존치(대체 여부는 보고에 제안). 유닛 6본.

## 리뷰 게시 CTA 별 제거 (2026-08-04, P-126 — 초소형)
- [x] 하단 게시 버튼 아이콘 제거 — 라벨만. 헤더 링크·기능 무변.

## 스캔 에러 개발 카피 제거 (2026-08-04, P-124 — 카피 감사)
- [x] scan.errOcr/errBe ×10 유저 톤 교체(Metro·개발 용어 0, 다시 찍기 CTA와 연결). i18n 전체 metro 언급 0 잠금 유닛(전 로케일 워크).
- [x] P-124/125/126 합류 teamtest OTA 양 플랫폼(빌드14·vc8). 완전 종료 → 2회 실행.

## HEIC 업로드 400 방어 (2026-08-04, P-127 — 🚨 시연 전 필수)
- [x] uploadImage() 진입부 ensureUploadable: contentType이 jpeg/png 아니면(heic/heif/webp/gif) expo-image-manipulator(기설치 — 지문 무변)로 JPEG q0.8 재인코딩 후 산출물 uri·size로 진행 — 호출처(리뷰·스캔 갤러리·프로필) 수정 0, 한 곳 방어. 재인코딩 실패는 throw 표면화(발급 미호출). 유닛 3본(heic→jpeg 발급·산출물 PUT / jpeg·png 무변환 / 실패 throw).
- [x] teamtest OTA 양 플랫폼 발행. 완전 종료 → 2회 실행 후 HEIC 3장 재검증(Q-22 1번).

## 탭바 높이 플랫폼 권장치 정렬 (2026-08-05, P-128 — 예진 "너무 높음")
- [x] FAB 레이아웃 분리: 절대 배치 오버행(top -30, 시각 돌출·그림자·보더 유지) — 바 높이 견인 소멸. 바 콘텐츠 높이 = TABBAR_CONTENT_H 상수(iOS 49 / 안드 56, Platform 분기) + 세이프에어리어(max(insets,10) 현행). 스캔 슬롯 = 타 탭 동일 골격(23pt 아이콘 스페이서+라벨 — 베이스라인 정렬), 슬롯 수직 중앙 정렬. 터치 = 슬롯 전체 49/56 ≥ 44. 유닛: 높이 상수·FAB absolute 미기여·5슬롯 균등(P-118 회귀).
- [x] teamtest OTA 양 플랫폼(iOS b245720e·안드 9deba3fb). 완전 종료 → 2회 실행.

## 온보딩 v3 선행 — 4스텝·자동 프로필·국기 이모지 (2026-08-06, P-130 — 정본 onboarding-v3-2026-08-06.md)
- [x] 플로우 재배선: 약관→국적→회피→맵기 4스텝 — 프로필(닉네임·사진)·마크 데모·요약 스텝·프로그레스 바 소멸(미니 헤더=백만). 맵기 완료/스킵 = 즉시 제출→홈(finish(spiceSkipped) 명시 인자 — stale state 방지), 실패 에러 표면화·드래프트 유지 무변. 구 draft 스텝 무해 파싱(LEGACY_STEP 매핑: profile→국적·riskdemo→회피·summary/interests→맵기).
- [x] 자동 프로필: lib/onboarding/autoProfile — NICKNAME_POOL 30종 로마자 한식명 + _4자리(형식 ^[A-Za-z]+_\d{4}$), profileImageUrl null→submit 기본 path(BE 색상 세트 TODO). 온보딩 UI 노출 0, 프로필 수정 무변.
- [x] 국적 스텝: 리스트 즉시 노출 — deviceCountry 감지국 최상단 하이라이트(Detected 태그)+전 국가(en명 locale 정렬)+검색. 행 = 국기 이모지+모국어명 메인+영어명 보조(동일 시 생략) — countries.ts NATIVE 196개국 전량 보강. 코드 표기 소멸·불변 문구(editProfile.nationalityLocked 재사용) 유지.
- [x] 국기 이모지 통일: lib/flagEmoji(alpha-2→RI, 방어 '') + components/FlagEmoji — index에서 Flag 별칭 export로 전 노출처(리뷰·프로필·차단·커뮤니티 등) 일괄 전환. Flag.tsx(1.2KB)+flagAssets.ts(11.8KB)+NationalityPicker.tsx(5.8KB) 삭제 — 소스 -18.8KB.
- [x] 약관: agree-to-all 맨 밑 이동. 유닛: 4스텝 순서·소멸 스텝 잔재 0·감지국 최상단·이모지/모국어 행·구 draft 클램프·즉시 제출 1회+자동 닉네임 형식·flagEmoji 정상/방어·풀 소속(신규 파일). i18n 신규 4키 ×10(nationalityTitle/Sub/Search·detectedTag).
- [x] teamtest OTA 양 플랫폼(iOS 2da7063d·안드 dbcde3bd).

## 멘토 피드백 소형 일괄 9건 (2026-08-06, P-129)
- [x] ① 인트로 CTA "Sign in"·"Start K-Bap" ×10(intro.signUp/browseFirst 값 교체 — 재사용처 홈 카드·프로필도 자동 반영) ② 로그인 뒤로가기 복원 — ⑪-3 빈 스택 GO_BACK 에러는 canGoBack 가드로 해소 ③ 홈: emptyTitle "What's your first Korean menu?" ×10·explore 버튼 제거·헤더 sign in 제거(진입=프로필 탭)·See all 옆 chevron·빈 박스 ⅔(패딩 26→14·아이콘 64→44)+스캔 버튼 풀폭 확대 ④ 프로필 탭 게스트 = 로그인 화면 임베드(소셜 버튼 — 게이트 카드 소멸) ⑤ 상세 저장 아이콘 = 별(IconStar 벤더, StickyHeader+스낵바 — saved 목록 화면 북마크는 발주 범위 밖 유지). 유닛 3본+tabStates 소셜 목 보정.
- [x] teamtest OTA 양 플랫폼(iOS dcaa3381·안드 9ac0e6a0).

## 스캔 카메라 가로 허용 + 줌 (2026-08-06, P-131 — KB-240 후속)
- [x] 가로 허용: 세로 유도 오버레이·셔터 가드(KB-141)·rotateOverlay 스타일 폐기 — 방향 감지(iOS 카메라 콜백+안드 DeviceMotion, KB-198 인프라)는 UI 제자리 회전으로 재사용(갤러리·플립·닫기·줌 필 90° 스냅, withTiming 150ms). EXIF 정합은 예진 실기 항목(문제 시 P-127 재인코딩 길목에서 정규화).
- [x] 줌: cameraZoom 순수 로직(프리셋 1x=0/2x≈0.15 근사·핀치 누적 감도 0.5·clamp01·근사 하이라이트) — CameraView zoom prop + Pinch 제스처 runOnJS(true)(워클릿 0, P-065 준수) + 셔터 위 1x/2x 필(상호 동기). 갤러리 경로 무변. 유닛 4본(매핑/클램프/핀치/회전각+렌더 오버레이 부재·프리셋 존재).
- [x] teamtest OTA 양 플랫폼(iOS bc937346·안드 154a6b9d).

## 온보딩 국적 화면 시안 정합 + 플랫 로고 (2026-08-06, P-133 — D-15 화면1·D-14)
- [x] A. 국적 화면(kbap-ob4): 헤더·검색 고정+리스트만 스크롤(스텝 전용 레이아웃 분기) — 타이틀 display 29/-0.72·서브 13.5 시안 카피 ×10(nationalitySub 갱신). 검색 카드 1.5 보더 radius 14·포커스 primary·클리어 X 22 원형. 감지국 = "FROM YOUR PHONE" mono 섹션+핀 카드(primary 1.5 보더+틴트 radius 18 minH 70, 기본 선택 유지 — 본 리스트 중복 제거). quiet 불변 안내(자물쇠 13+11.5 2줄, 신규 키 nationalityNotice — 온보딩만, 수정화면 nationalityLocked 별도 유지). 행 minH 62 고정·이모지 26/34 슬롯·모국어 15.5 볼드(선택 primary)·영어 12(동일 생략)·체크 원 24(선택 primary 채움). 검색 시 핀+안내 숨김. 푸터 시안 규격(패딩 12/20/34·헤어라인·CTA radius 16/패딩 17·primary 글로우 — Btn 오버라이드로 프레임 테스트 보존).
- [x] B. 플랫 로고(kbap-logo-flat): BrandTile 라디얼 그라데이션 폐기 → 단색 primary+흰 마크(radius 0.224 기존 일치), 워드마크 ls -0.02em. 노출처(로그인·인트로·StickyHeader)는 컴포넌트 공용이라 일괄 반영 — 그라데이션/쉐도우 잔재 0 유닛. i18n 신규 2키+1갱신 ×10. 유닛 3본(행 높이·핀·숨김·생략 규칙·로고).

## 한국어 카피 구조 변경분 (2026-08-06, P-132 — 파일럿 승인, K-06 이후)
- [x] KC-0603 skip 3문맥 해체: onboarding.skip="건너뛰기"(스텝 전용 복원) · gate.keepBrowsing="계속 둘러보기"(게이트 닫기 신규) · onboarding.resumeLater="나중에 하기"(재개 배너 신규) — 콜사이트 각각 교체. KC-0210 B: order.caption 폐기 → captionWithAvoids/NoAvoids 분기(avoid 유무). KC-0302 B: review.deleteError 신규 — 삭제 뮤테이션 onError 교체. KC-0329 B: reviews.emptySameNat 신규 — 국적 필터 빈 상태 분기(전체 빈은 emptyBody 갱신). KC-0292: langDetected 칩+키 제거 ×10. KC-0324: reviews.anonymous="탈퇴한 유저"(Deleted user) ×10. 전부 ×10 로케일(ko=확정값 그대로 — Codex 재검수 불요). 유닛 13본(키 존재/부재 ×10·값 잠금·게이트/배너 실렌더).
- [x] P-132/133 합류 teamtest OTA 양 플랫폼(iOS a5dabeaf·안드 dd3e00a5).

## 온보딩 v3 마무리 — 회피 그리드·맵기 히어로·코치마크 (2026-08-06, P-134 — kbap-ob4-b, 온보딩 v3 코드 완결)
- [x] A. 회피: 칩 → 카테고리 섹션(INGREDIENT_SECTIONS 신설 — 주석 그룹 7군 데이터 승격)+4열 정사각 타일. 실81종 전량, 전 타일 폴백(카테고리 틴트 순환+약어 2글자+이름 — imageRef 슬롯 선반영). 선택 카운트+Clear·0개 안내, 스킵 라벨 "Nothing to avoid", 시안 서브카피 ×10.
- [x] B. 맵기: 🌶️ 히어로 공존(개정 8/6)+레벨명+👶배지(NONE/MILD, bandRow 38 고정)+슬라이더 무변+사진 레일(레벨당 3장 — dev 실측 15종 CDN 상수 spiceRail.ts, 폴백 색 카드)+레벨 설명(교정 카피 — 기능 약속 0, 2줄 고정 슬롯 36 = P-119 승계). CTA "Finish setup"/스킵 "Skip — decide later".
- [x] C. 코치마크: ScanCoachMark(스크림+카드·돋보기·RiskMark 24 4행 — 정본 의미 카피·Got it·캡션) — 첫 스캔 결과 1회(AsyncStorage), 재열람 = 스캔 리스트 DishRow 마크 탭 + 상세 verdict 필 탭(마크 데모 대체). 유닛 14본 + 신규 키 패리티 ×10.
- [x] teamtest OTA 양 플랫폼(iOS ab6c598f·안드 d5f7cec8).

## 시스템 폰트 전환 (2026-08-06, P-135 — 멘토 #1·25)
- [x] resolveFont 전면 시스템화 — 전 토큰(display·body·ko 계열)이 스크립트 무관 시스템 폰트+weight 위계(400/500/600/700/800)로 치환(iOS SF/Apple SD Gothic Neo·안드 Roboto/Noto). 키릴 Nunito 강등 분기 소멸. theme.font 키 구조·호출처(fontFamily: font.x) 무수정 — Txt가 전 표면 관통, TextInput은 공용 Input 래퍼에 동일 치환 추가. 워드마크만 Baloo2_800 실로딩(raw Text 우회 — useAppFonts 1종으로 축소). nunito-sans 패키지 제거(참조 0), Noto는 기제거. 폰트 에셋 7종 1,673KB → 1종 409KB(-1.26MB), 번들 총 -1.28MB. 지문 무변(7aa41957) — OTA 발행. 유닛 5본+슬라이더 웨이트 보정.
- [x] teamtest OTA 양 플랫폼(iOS 8c56dfb8·안드 4bfb389b).

## 스캔 플로우 시안 정합 (2026-08-06, P-136 — D-16 확정, 콰이엇 스타일 공식 허용 표면)
- [x] A. 리치 리스트: 결과 목록 전면 교체 — 콰이엇 헤더(백·타이틀·n dishes read·사진/리스트 세그·다시찍기)+프로필 체크 줄(회피명+Edit)+행(마크·한글명·번역명·설명·경고 칩 wrap·₩+환산 이중 통화·썸네일 72 매칭분만·[+]/스테퍼, 담김 초록 틴트)+안내문+sticky View order 필. 경고 칩 = AvoidChip 승격(danger/caution variant), 상세 프리페치 매칭분만. exchange.ts 고정 환율 20통화(어댑터 격리, 통화 = 저장>국적>로케일>USD).
- [x] B. 주문 카드: FlippedOrderCard 공용 — 180° 뒤집힌 primary 틴트 카드(확대→풀스크린)+정방향 미러+Estimated total+Done. 한국어 = orderCard.ts 조립 잠금(시안 문구 0, 유닛 봉인). scan-order 라우트(items JSON)+food/[id]/order.tsx 대체(스테퍼 존치).
- [x] C. 사진 뷰: 캡슐+미니시트 유지, 범례 4종+힌트, 필 공유(카운트 동기). D. 카메라: Scan menu 타이틀+방향 힌트+가로 배지. 구 D3 크롬·original 세그 제거(피크 존치).
- [x] tsc 0 · jest 85스위트 477/477(신규 scanRichOrder 3본+구 크롬 5스위트 보정) · i18n 17키 ×10 · teamtest OTA 양 플랫폼(iOS b0789e85·안드 8effd885) — e03efb3.

## 시스템 카메라 경로 A/B (2026-08-06, P-137 — 예진 실기 비교용, 기본 off)
- [x] FLAGS.systemCamera(기본 off)+SYSTEM_CAMERA_AUTOLAUNCH 상수 — on = 콰이엇 런처(안내+촬영 CTA+갤러리)→launchCameraAsync→기존 scanImage 합류, 취소 = 런처 복귀. autolaunch = 탭 진입 즉시 실행. 권한 거부 = P-122 딥링크 Alert 재사용, HEIC = P-127 길목 커버, 연타 가드 공유. 커스텀 카메라 무변(비교 확정 전 삭제 금지).
- [x] tsc 0 · jest 86스위트 482/482(신규 5본) · i18n 1키 ×10(scan.launcherHint — 나머지 전부 기존 키 재사용) · teamtest OTA(iOS 62ff3015·안드 fccbced0) — eaa06db.

## 스캔 리스트·주문 카드 반려 재작업 (2026-08-07, P-138 — emo급 정돈)
- [x] 행 프레임 불변(우측 열 72 고정+[+]↔스테퍼 슬롯 72×30 공유, 담김 틴트 제거)·행 밀도 조임·미매칭 안내문 삭제+[+] 담기 허용(P-045)·카테고리 헤더 소멸·기본 뷰=List(P-071 대체, 오너 결정 기록).
- [x] 주문 카드 시안 S2 재정합 — 콰이엇 헤더(Your order+서브)·카드 확대 중앙·IconExpand 좌상단·미러 캡션 하단. KRW 병기 생략 유닛 잠금.
- [x] tsc 0 · jest 86스위트 484/484 · i18n 2키 ×10 · teamtest OTA(iOS 62f904b2·안드 8d8fbc2b) — c33e9d3.

## 음식 상세 v2 시안 정합 (2026-08-07, P-139 — D-17, 멘토 #32 완결)
- [x] 히어로 4:3 풀블리드+플로팅 헤더(스크롤 210 솔리드 전환)+타이틀 블록(Translated 필·현행 5단계 맵기)+verdict 성분 조립 이유(맵기-위험도 결합 교정)+재료 헤어라인 행 전부 오픈(caution만 사유+Ask)+About 플랫+평점 2열+리뷰 프리뷰 2.
- [x] 게스트: verdict 잠금 슬롯(현행 미노출 정책 무회귀)+재료 고스트 5행+잠금 줄 단일 CTA. 평점·리뷰 풀 오픈.
- [x] tsc 0 · jest 87스위트 490/490(신규 6본) · i18n 7키 ×10 · teamtest OTA(iOS 1df26651·안드 35b6368e) — 1ff82ae.

## 자동 아바타 6종 랜덤 (2026-08-07, P-140 — D-19 에셋)
- [x] autoProfile 6종 path 랜덤(orange/teal/amber/olive/plum/navy) — path 전송(P-016 컨벤션), 구 기본 path 폴백 보존. isDefaultProfileImage에 webp/default_profile 추가(삭제 미노출 정합). CloudFront 6종 200 실측.
- [x] tsc 0 · jest 87스위트 492/492 · teamtest OTA(iOS 52f68b39·안드 f3c36277) — 8e0961b.

## 커뮤니티 실 API 연결 (2026-08-10, P-142 — BE #129~132)
- [x] adapter 전면 실 API: 피드/상세 lang 필수+cursor·작성/수정 imagePaths(COMMUNITY 업로드/URL 역변환)+foodIds·댓글 replies 1뎁스 평탄화(parentCommentId). 목 스토어·시드 삭제, 내 글 판별 = 실 회원 id. client PUT 추가.
- [x] 계약 부재 표면 플래그 off: 리액션 토글(카운트만)·장소 태그·커뮤니티 신고(REVIEW뿐). 차단 = 멤버 단위 상시 연결. 번역 토글 = 원문 수단 부재로 off+BE 질의.
- [x] tsc 0 · jest 88스위트 486/486 · teamtest OTA(iOS 07f29b7b·안드 7687943e) — 16cebb5.

## 안드 vc9 production 빌드 (2026-08-10, P-141 — Play 스토어 UI 개편분)
- [x] prod 계약 감사(vc7 이후 diff 전수 — 신규 표면 P-111 /app-config 1건, 페일 오픈)·P-114 유닛·목 숨김 확인 통과. 코드 변경 0, 기준 커밋 2d3931d(K-10 포함).
- [x] AAB(fb718b38)+스모크 APK(bce3b543) vc9 빌드 성공 — 스토어 업로드는 예진 스모크 후.

## 회피 타일 실사진 81종 (2026-08-10, P-145 — 예진 S3 업로드분)
- [x] ingredientImageUrl(CDN+code 소문자 webp, imageRef 스왑 지점 주석)+AvoidTile(사진 fill+onError 색 폴백 보존, 프레임 불변) — 온보딩 회피 스텝 배선(노출처 유일 확인).
- [x] tsc 0 · jest 90스위트 490/490 · teamtest OTA(iOS 4dcccae1·안드 17a469e0) — 6a38b0b.

## 앰플리튜드 계측 1차 (2026-08-10, P-144 — 멘토 #39, taxonomy CSV 전사)
- [x] 신규 7종(application_opened·scan_start·scan_result_item_tap·order_card_open·search_query·review_write_tap·bookmark_toggle)+확장 3종(scan_complete success/fail_reason·review_submit 사진/평점·food_detail_view food_id)+온보딩 step v3 와이어명. user property 6종(setUserProps — Identify 익명 유지, 화이트리스트 드롭).
- [x] tsc 0 · jest 91스위트 493/493 · teamtest OTA(iOS db486c0f·안드 4dc84688) — 188ddbf. ⚠️ teamtest는 키 무존재 no-op(P-094) — 수신 확인 경로 질의 보고.

## 검색 유도 (2026-08-10, P-143 — 멘토 #13·14·17)
- [x] discovery.ts 격리(BE ⑥ 스왑 지점) — placeholder 시드 = 랭크 상위 12 로테이션(진입마다·리더 언어 번역명), 빈 상태 인기 사진 레일(사진 우선 8, 탭=상세 진입, 게스트 노출).
- [x] tsc 0 · jest 93스위트 497/497 · i18n 1키 ×10 · teamtest OTA(iOS 8e234875·안드 7c805ac5) — 69628df.

## 프로필 탭 정리 + 탭바 규격 (2026-08-10, P-146 — 예진 실기 지적)
- [x] LoginScreen embedded 분기(프로필 탭 = 로고·백 제거, 독립 /login 무변). 탭바 iOS 49pt+시각 센터 6pt 하향(존 불변)·안드 M3 80dp(56→80)·FAB 돌출 30→24.
- [x] tsc 0 · jest 95스위트 500/500 · teamtest OTA(iOS b7ba2b5e·안드 e72644ef) — 988f236.

## 탈퇴 provider 판별 교정 (2026-08-10, P-147 — 예진 실기 버그)
- [x] 애플 게이트 = 서버 profile.provider 정본(Firebase providerData 판별 폐기 — 링크 잔존 오판), 미로드 시 보수 발동. firebaseCleanup(delete→unlink 폴백, best effort)으로 재발 방지 + drift 진단 로그.
- [x] tsc 0 · jest 96스위트 503/503 · teamtest OTA(iOS 7b21e994·안드 b4908b8f) — 7dd5ca8.

## 온보딩 실기 반려 2건 (2026-08-10, P-148)
- [x] 국적 핀 카드 강조 = 선택 상태 바인딩(타국 선택 시 무강조 — 강조 항상 1곳). 맵기 👶 배지 = 레벨명 아래 고정 슬롯 26(프레임 불변)·사진 캐러셀 화면폭 58%+피크+snap+레벨 전환 리셋.
- [x] tsc 0 · jest 96스위트 506/506 · teamtest OTA(iOS fc736cc9·안드 871ceee0) — 88e66bb.

## 스캔 실기 반려 2건 (2026-08-10, P-149)
- [x] 주문 카드 전체 ScrollView(14항목 도달, Done=스크롤 끝)+확대 뷰 스크롤·명시 닫기. Photo 뷰 = 쌩 원본+핀치 줌만 — 캡슐·미니시트·범례·피크 철거(capsuleMarker/ScanMiniSheet/coverDisplay 삭제). 코치마크 리스트 마크 탭 재열람 복원.
- [x] tsc 0 · jest 94스위트 497/497 · teamtest OTA(iOS e4333297·안드 014b7dbd) — edeb1b9.

## P-148 회귀 교정 (2026-08-10, P-151 — 핀 카드 8pt 밀림)
- [x] natPin 프레임/색 분리(투명 보더 동폭 상시 + 선택 색만) — P-103 복원, 메트릭 동일 유닛 잠금.
- [x] tsc 0 · jest 497/497 · teamtest OTA(iOS 29129d9b·안드 5a22933e) — f2c08f1.

## 프로필·리뷰 실기 반려 5건 (2026-08-10, P-150)
- [x] IngredientTileSections 공용화(온보딩·프로필 회피 수정 공유)·리뷰 인풋 키보드 추종(인셋+스크롤 헬퍼)·posted 별 삭제·foodId 숫자→중립 라벨·프로필 맵기 섹션/공식 줄 제거·아바타 처짐=에셋 판별(재추출 요청).
- [x] tsc 0 · jest 96스위트 501/501 · i18n 1키 ×10 · teamtest OTA(iOS 2230328f·안드 1ad10812) — ff9fb48.

## iOS 테플 빌드15 (2026-08-10, P-152 — teamtest 베이스라인 갱신)
- [x] 게이트(tsc 0·jest 501/501·지문 7aa41957 무변) → teamtest 빌드15(ece85932, 407f0d1 기준) → TestFlight 제출 완료(Apple 처리 대기). BE = dev 게이트 준수.

## 스캔 v2 채택 (2026-08-11, P-153 — BE #141)
- [x] 채널 분기: dev 계열 = X-API-Version 2026.08.07 + imagePath만(ML Kit 스킵, photoOnly 파이프 수확) · production = v1 무변. client opts.headers 신설.
- [x] similarFood: 미등록 행 유사 제안 링크(주의 톤+상세 라우팅) — 행 판정 unable·주문 rawMenuName 잠금(헌법 III·P-045). 기존 스캔 스위트 v1 픽스처 고정.
- [x] tsc 0 · jest 96스위트 506/506 · i18n 1키 ×10 · teamtest OTA(iOS c7dfcec9·안드 b1943929) — 214b959.

## 실기 피드백 3건 (2026-08-11, P-154)
- [x] 국적 일반 행 = 핀 카드 동일 강조(natPinOn 공유·상시 투명 보더 — 프레임 불변·강조 1곳). 빈 상태 전수 조사(2:3) → "화면 소유 = 상하 센터" 채택, 커뮤니티·내 리뷰·검색 센터 정합. kidsBadge → Kid-friendly(ko 임시 — Codex).
- [x] tsc 0 · jest 96스위트 508/508 · teamtest OTA(iOS d9ef65b7·안드 2cdca37b) — 6fb2504.

## 스캔 v2 off + 리뷰 멀티 선택 (2026-08-11, P-155·156)
- [x] FLAGS.scanV2 킬스위치(BE 미완성 — 전 채널 v1 복귀, v2 코드 보존·유닛 강제 on 유지). 리뷰 픽커 멀티(남은 슬롯 limit·slice 방어+토스트·per-file HEIC), 커뮤니티는 기존 동일(확인).
- [x] tsc 0 · jest 97스위트 512/512 · i18n 1키 ×10 · teamtest OTA(iOS fadf7456·안드 89d883aa) — da590a0.

## 프로필 탭 2건 (2026-08-11, P-157)
- [x] My reviews = Saved와 같은 카드의 AcctRow(공용 재활용 — 구 헤더·See all·인라인 리스트 소멸). 저장 아이콘 별 전면 통일(노출처 전수 5곳 — 북마크 글리프 잔존 0, 정의 보존).
- [x] tsc 0 · jest 98스위트 514/514 · teamtest OTA(iOS 7fb202c3·안드 70b83a7d) — 9bc35ee.

## 리뷰 3건 (2026-08-11, P-158 — 커서 추종 재반려)
- [x] 커서 추종 접근 교체(키보드 실측 패딩+블록 하단 프록시 스크롤 — 구 인셋/리스폰더 폐기, 산식 유닛 고정). 뱃지 MedalEmblem 통일(3곳 전수·겹침 수정). 좋아요 캡션 삭제.
- [x] tsc 0 · jest 98스위트 516/516 · teamtest OTA(iOS 91499099·안드 efc6e35f) — 23e98b5.

## 저장 빈 상태 CTA 센터 (2026-08-11, P-159)
- [x] Btn sm alignSelf 함정 상쇄(저장 CTA 명시 센터) — 전수 3곳(교정 1·row 무해 2), Btn.tsx 함정 주석, P-150 낡은 주석 갱신.
- [x] tsc 0 · jest 98스위트 517/517 · teamtest OTA(iOS 03295268·안드 ad9ba147) — e6aedbe.

## 스캔 프로필 바 B안 + solid 칩 (2026-08-11, P-160)
- [x] ScanProfileBar(✓ 없는 대문자 캡션+칩 스트립, ScrollView 밖 스티키)·AvoidChip solid(#cf3a2c/#d28a12)·May contain 제거·정렬 무변.
- [x] tsc 0 · jest 98스위트 518/518 · teamtest OTA(iOS 7b99b2d2·안드 685f1259) — 9fc9782.

## 다시찍기 확인 모달 (2026-08-11, P-161)
- [x] ↻ = 확인 모달 선노출(이탈 모달 문법 재사용, 담은 개수 문구 반영) — 확인 시에만 리셋, 취소 보존. i18n 4키 ×10.
- [x] tsc 0 · jest 98스위트 519/519 · teamtest OTA(iOS 9f959f32·안드 8d27a5bf) — fea03fd.

## 주문 완료 모달·상세 CTA·저장 스낵바 (2026-08-11, P-162)
- [x] Done = 완료 확인 모달(공용 FlippedOrderCard, 체크 톤) → 확인 시 홈. i18n 3키 ×10(ko 임시).
- [x] 상세 하단 CTA = Ask the owner(라벨·목적지 재료 행과 통일, safe도 일반 질문으로 자연 커버) — order.cta 미사용화.
- [x] 저장 성공 스낵바 제거(실패 스낵바 유지) — saved.toast/view 미사용화.
- [x] tsc 0 · jest 92스위트 523/523 · teamtest OTA(iOS ffb790fc·안드 63f1abab) — c75bce1.

## 사장님 폴백 실나열·커서 추종 게이트 (2026-08-11, P-163)
- [x] 폴백 질문 = 회피 ko 라벨 전부 나열(+iGa, 미등재 제외·전부 미해석 강등) + 무단정 서브라인(K-큐 검수 요청). ingredient 경로 무변.
- [x] 커서 추종 = 끝-커서만(중간/상단 편집 무개입), onFocus → keyboardDidShow 게이트 이관.
- [x] tsc 0 · jest 93스위트 531/531 · teamtest OTA(iOS e48aafdb·안드 c92bcf75) — 31f03a5.

## 리뷰 버전리스 이관·목록 평점·통화 (2026-08-11, P-165)
- [x] 🚨 dev 리뷰 404 복구 — 전 경로 /api/reviews*(lang 필수), client '/api/' 절대 경로 규칙 1곳. food/author 중첩 매핑(구응답 폴백), 내 리뷰 서버 이름·썸네일 우선.
- [x] 목록 평점 실값(adaptMenuSummary 한 곳 — 목록·홈·검색 공용) · 통화 서버 정본 체인+프로필 통화 행/피커(20종+자동, ko 3키 임시).
- [x] tsc 0 · jest 94스위트 545/545 · teamtest OTA(iOS abd6ad54·안드 56f03a8e) — 8581184.

## Ask the owner 전 위험도 노출 (2026-08-11, P-167)
- [x] 상세 하단 CTA 위험도 분기 제거(잔재) — 전 위험도 노출, 게스트만 제외. danger = P-163 나열 질문 자연 조립 확인.
- [x] tsc 0 · jest 94스위트 545/545 · teamtest OTA(iOS a2f457d1·안드 3409d8ec) — 133fd13.

## 에러 상태 전수 감사 (2026-08-11, P-164)
- [x] 빈 화면 방치 8곳(리뷰 목록·디테일·내 리뷰·저장·랭킹·커뮤니티 피드/상세·차단) 공용 QueryErrorBlock 적용 — 리뷰 목록은 loaded 게이트 밖으로(원인 구조). 감사 표 REPORTS.
- [x] 전역 retry 한 곳 교정 — 4xx 무재시도(shouldRetry), 5xx·NETWORK만 1회.
- [x] tsc 0 · jest 95스위트 551/551 · teamtest OTA(iOS a59f50a5·안드 29ed30c0) — c58e9d0.

## 리뷰 제출 연타 봉쇄 외 3건 (2026-08-11, P-168)
- [x] 🚨 연타 = 업로드 선행 구간 미가드가 원인 — posting+동기 ref 가드+스피너(동일 메트릭), 삭제 가드 보강. 완료 = P-162 모달(풀화면 소멸), 헤더 Post 제거, 빈 별 = 옅은 주황(STAR_EMPTY 한 곳).
- [x] tsc 0 · jest 95스위트 555/555 · teamtest OTA(iOS 09a13665·안드 8362910b) — b75622f.

## 작성 카드 썸네일·마크 제거 (2026-08-11, P-170)
- [x] 썸네일 = useFoodDetail 캐시 photoUrl(A안 — 요청 0, 무사진 폴백) · 위험도 마크 소멸(오독) + personalRisk/useMe 의존 정리.
- [x] tsc 0 · jest 95스위트 558/558 · teamtest OTA(iOS ada12fc2·안드 c01aff07) — a6ea3b1.

## 리뷰 브리프 쿠팡 개편 (2026-08-11, P-169)
- [x] CTA 위계(솔리드=Ask the owner 1개, Write=고스트 소형) · 헤더 병기(같은 국적 보조 줄, 2열 카드 소멸) · 프리뷰 5(썸네일·날짜·Helpful·신고=ModerationFlow 재사용) · 전체보기 풀폭 고스트.
- [x] Helpful 텍스트 전수(목록·디테일 — IconHeart 리뷰 계열 0). reviews.helpful ×10(ko 임시).
- [x] tsc 0 · jest 95스위트 560/560 · teamtest OTA(iOS 3e19a4a4·안드 a5a7ebbf) — 5cdb69b.

## 스캔 칩 1줄·홈 회피 칸 (2026-08-11, P-171)
- [x] 칩 1줄 고정(danger 우선·onLayout 실측+fitAvoidChips 근사·"+n" 접기·nowrap+hidden 이중 방어), 탭=행 전체=상세.
- [x] 홈 You avoid 칸 = FLAGS.homeAvoidBanner(false) 보존형 숨김(복원 한 줄).
- [x] tsc 0 · jest 95스위트 563/563 · teamtest OTA(iOS 3493de12·안드 6f9fbd51) — 4d64627.

## 사장님 화면 스크롤 (2026-08-11, P-172)
- [x] 본문 ScrollView(flexGrow 센터 — 짧은 질문 무변)·X/Done 고정·상단 패딩으로 겹침 봉쇄. 40자 초과 = 34→27 축소(하한).
- [x] tsc 0 · jest 96스위트 566/566 · teamtest OTA(iOS d44dab96·안드 7bba71ef) — 65efbf9.

## 제출 연타 전수 가드 (2026-08-11, P-173)
- [x] useSubmitGuard 공용화(동기 ref+busy) + Btn busy(메트릭 불변 스피너). 적용: 탈퇴·revoke·로그아웃·온보딩·프로필/회피 저장·커뮤 글/댓글·신고/차단, 리뷰 작성 마이그레이션. 토글류(멱등)는 예외 명시.
- [x] tsc 0 · jest 97스위트 570/570 · teamtest OTA(iOS a50f68cb·안드 82f4737e) — 4864823.

## 재료 카탈로그 서버 스왑 (2026-08-11, P-174)
- [x] useIngredientCatalog(공개 /api/ingredients·lang·24h 캐시) — code 머지로 name·imageUrl 보강. 타일 3단 폴백(서버→조립→색), 표시명 서버 우선(타일 공용+요약 칩 3사이트). 사장님 카드 ko 조립 무변(소스 잠금).
- [x] tsc 0 · jest 98스위트 575/575 · teamtest OTA(iOS fd5f72f1·안드 9c584854) — 86f09ca.

## 주문 완료 폭죽 (2026-08-11, P-166 — OTA 실기 대기)
- [x] ConfettiBurst 48파티클(reanimated 커스텀·결정적 의사난수·1.8s 소멸) — 모달 동시 버스트, pointerEvents none, Reduce Motion 스킵, 위험도 4색 미사용.
- [x] tsc 0 · jest 99스위트 579/579 — ab7f601. ⚠️ OTA 미발행(P-065 — 예진 실기 확인 후).

## 확인 모달 destructive 보더 (2026-08-11, P-175)
- [x] Btn dangerGhost(ghost 프레임+destructive 색) + testID — 재스캔·커뮤 이탈 2곳 스왑(텍스트 행 소멸).
- [x] tsc 0 · jest 99스위트 581/581 · teamtest OTA(iOS 4480ea74·안드 0ba36299) — 370f5e2. ⚠️ P-166 폭죽 동승 발행(REPORTS 특이 참조).

## 프로필 회피 사진 타일 (2026-08-11, P-176)
- [x] 칩 → AvoidTile 4열(선택분·플랫·서버 이미지/번역명 승계), 탭=Edit 진입, 8개 초과 접기 토글(ko 2키 임시). dietChip 소멸.
- [x] tsc 0 · jest 100스위트 584/584 · teamtest OTA(iOS e1e07d34·안드 95b0e155) — 06905e8.

## 회피 수정 요약 카드 제거 (2026-08-11, P-177 — OTA 게이트 대기)
- [x] 요약 칩 카드 소멸 → 온보딩 카운트 줄 문법(n selected+Clear, 키 재사용). onClear 배선, 카드 전용 키 4종 미사용화.
- [x] tsc 0 · jest 100스위트 584/584 — 3f23478. ⚠️ OTA 미발행(불변 규칙 — P-166 게이트 동승, 지시 대기).

## 내 리뷰 카드 2건 (2026-08-11, P-178 — OTA 게이트 대기)
- [x] 디테일 = 서버 foodName/foodImageUrl(P-165 체계, id 숫자 0) · 뱃지 = 캐시 미스 미렌더(unable 오염 방지, BE riskStatus 스왑 주석).
- [x] tsc 0 · jest 101스위트 588/588 — 29bd85f. ⚠️ OTA 미발행(P-166 게이트 — P-177과 일괄 발행 대기).

## 커뮤니티 탭 → 리뷰 피드 (2026-08-11, P-179 — OTA 게이트 대기)
- [x] useGlobalReviews(foodId 생략 전역·게스트 호출 0) + ReviewFeed(P-169 문법·서버 food 카드·Helpful) + FAB=TagPickerSheet 재사용→작성. 글 기능 communityPostsEnabled(false) 보존 숨김, 분기는 coming-soon 가드 뒤(유닛이 순서 실버그 검출·교정).
- [x] tsc 0 · jest 102스위트 594/594 — 26d32b3. ⚠️ OTA 미발행(P-166 게이트 — 177·178과 일괄 대기).

## 스캔 체크 줄 Edit 제거 (2026-08-12, P-180 — OTA 게이트 대기)
- [x] ScanProfileBar Edit 소멸(회의 결정 6 주석 명기) — 수정 진입점 전수 확인(넛지 = 최초 설정 유도라 존치·질의).
- [x] tsc 0 · jest 102스위트 594/594 — 3cfcc34. ⚠️ OTA 미발행(P-166 게이트 — 4건 일괄 대기).

## 게이트 해소 일괄 발행 (2026-08-12)
- [x] Q-37① 폭죽 실기 통과 → P-166 ✅. P-177~180 일괄 teamtest OTA(iOS c92a465a·안드 3d05e468) → 전부 ✅.

## 실기 QA 소형 5건 (2026-08-12, P-181)
- [x] 홈 타이틀 Popular dishes(ko 초안)·프로필 Recently scanned(RecentRow 재사용)·벨 제거(피드 포함)·연필 박스 소멸·국가 필 국기+국가명·anonymized=authorWithdrawn 정본.
- [x] tsc 0 · jest 102스위트 601/601 · teamtest OTA(iOS c9feb8bc·안드 096d0b27) — c04995a. flags.ts 동승 0 확인.

## 리뷰 2depth 전환 (2026-08-12, P-182)
- [x] review/[id] 삭제 · 공용 셀 파츠(펼침·뷰어 신설·수정 시트) 4표면 적용 · 카드 탭 제거(요소별) · 본인 ⋯ 수정/삭제 · 0건 = Write CTA만. 신규 카피 3키 ×10(ko 초안).
- [x] tsc 0 · jest 101스위트 601/601 · teamtest OTA(iOS 2aa362d3·안드 5e9bcf7f) — 7eab57a.

## 상태 센터 구조·홈 부제 (2026-08-12, P-184+183)
- [x] QueryErrorBlock fill 자체 소유(+StateBlock fill prop) — 13표면 전수(수동 paddingTop 5 제거·래퍼 8 이관·제외 3 보고), 상세 실패 별 숨김.
- [x] 홈 hasScans 분기 제거(false-safe safeSub 소멸) — popularTitle "Popular dishes" 일원화 ×10.
- [x] tsc 0 · jest 101스위트 605/605 · teamtest OTA(iOS 73847f2b·안드 04da6635) — 6cba891.

## 환산가 ≈ 접두 (2026-08-12, P-185)
- [x] convertKrw ≈ 접두(포매터 한 곳 — 스캔 행·주문 카드 자동), 사장님 카드/ko 면 환산 0 잠금.
- [x] tsc 0 · jest 101스위트 607/607 · teamtest OTA(iOS 598181d2·안드 a795dbcc) — 3d938ae.

## 신고/차단·스캔 contain·타일 캐시 (2026-08-12, P-186~188)
- [x] P-188 AvoidTile expo-image(디스크 캐시)+스켈레톤/실패 분리 — de52e41. P-187 진행 화면 contain(결과 토글 cover는 P-079 의도 무변) — aa8a53c. P-186 ⋯ 타인 신고/차단(익명 제외·mine 실값 교정)+409 멱등+차단 클라 숨김+SEXUAL 라벨 정합 — 14c0c7b.
- [x] tsc 0 · jest 101스위트 612/612 · teamtest OTA(iOS 40f46733·안드 bc4177c0).

## 업로드 JPEG·원격 렌더 캐시 (2026-08-13, P-189)
- [x] UPLOAD_OK jpeg만(png → 재인코딩 경유, 관문 규칙 주석) · 원격 렌더 7파일 expo-image 스왑(로컬 표면 제외 보고).
- [x] tsc 0 · jest 101스위트 614/614 · teamtest OTA(iOS af38b340·안드 6cde3db3) — c0b466f.

## 신고/차단 무반응·갤러리 로딩 (2026-08-13, P-190+191)
- [x] P-190 ActionSheet keepOpen(페이즈 전환형만 자동 close 생략) — 재현 경로(아이템 탭 경유) 유닛 3 — 3310bed.
- [x] P-191 갤러리 원본 로드 오버레이(스캔)+프로필 busy 당김+리뷰 타일 스피너, scan.loadingPhoto ×10 — 6bbbc51.
- [x] tsc 0 · jest 102스위트 619/619 · teamtest OTA(iOS fb0b01f6·안드 88fc26a8).

## 내 리뷰 사진 스트립·뷰어 X (2026-08-13, P-193)
- [x] 내 리뷰 셀 ReviewPhotoStrip 장착(P-182 4표면 공백 보수) · 뷰어 X 아이콘만(배경·보더 소멸, hitSlop 14) — 5cd31d4.
- [x] tsc 0 · jest 102스위트 621/621 · teamtest OTA(iOS 69aedf86·안드 337f7529).

## 신고 시트 키보드·피드 새로고침 (2026-08-13, P-194)
- [x] 신고 시트 iOS 키보드 리프트(P-158 실측 문법, 안드 resize 자동) · 피드 RefreshControl+포커스 stale 재조회(KB-68 문법, 게스트 차단) — e012ade.
- [x] tsc 0 · jest 102스위트 625/625 · teamtest OTA(iOS c4fbaf8b·안드 c06ee27f).

## 푸시 알림 클라 선구현 (2026-08-13, P-192) ⚠️ OTA 미발행
- [x] expo-notifications+plugin(네이티브 — 다음 빌드), pushAdapter 지연 require 유일 관문(정적 import 0 잠금), 프라이머(온보딩·스캔 완료), 토큰 upsert 골격(BE 계약 대기), 로컬 리뷰 유도(1h 예약/작성 시 취소), 알림 설정 화면(넛지 동의 일시), 딥링크 어댑터, i18n 15키 ×10 — 239ab8c.
- [x] tsc 0 · jest 104스위트 639/639 · OTA 발행 금지 준수(커밋만).

## 목록 카드 평점 표기 개편 (2026-08-13, P-195) ⚠️ OTA 보류
- [x] RatingLine 공용 승격 — "★들 (n)"·0건 미노출, 홈 캐러셀 fixedSlot·목록 줄 제거 — 4bbd4d5.
- [x] tsc 0 · jest 105스위트 643/643 · OTA 보류(P-192 동승 판단 — 커맨드 센터 지시 대기).

## 실기 4건 — Helpful 단일화 외 (2026-08-13, P-196) ⚠️ OTA 보류
- [x] 피드 Helpful 캐시 보수(전역 피드 포함 낙관/next/롤백)+HelpfulButton 4표면 단일화(본인 카운트 전용) · 상태 블록 4탭 화면-정중앙(ScreenCenterFill) · X-브래킷 겹침 0(inset-aware) · " · " 전수 제거(i18n ×10+코드 10곳) — a3a60fd.
- [x] tsc 0 · jest 106스위트 653/653 · OTA 보류(P-192 동승 판단 대기 — P-195와 동일).

## P-195/196 OTA 도달 0 실측 (2026-08-13)
- [!] "발행 가" 회신로 teamtest 발행(ios e1d731a6·and b6c1ada3)했으나 P-192 fingerprint 회전으로 설치 빌드(7aa41957/2e6a56f4) 미매칭 — 수신 0대. 선택지 3안 보고·지시 대기(REPORTS 참조). 추가 OTA 발행 중지.

## Sentry 통합 + 빌드16 착수 (2026-08-13, P-197→198)
- [x] P-197 Sentry — expo plugin 수동·sentry.ts 관문(enabled !__DEV__·PII memberId만)·유닛 3 — ffd8229 (OTA 미발행).
- [~] P-198 빌드16 — grep 게이트 통과, teamtest 양 플랫폼 빌드 진행(ios c2720313·and 494969f0). SENTRY_AUTH_TOKEN은 소스맵 전용(빌드 무영향) — 예진 콘솔 몫.

## 빌드16 진행 (2026-08-13, P-198)
- [~] 1차 양 플랫폼 실패 — 안드: Sentry 업로드 토큰 하드 실패 → SENTRY_DISABLE_AUTO_UPLOAD(0c203ac) 재빌드 성공(3f1eb36a·vc11·rv ff05c134·APK 배포됨) / iOS: 프로필 push capability 부재 — 예진 인터랙티브 빌드 대기. P-197 plugin이 fingerprint 재회전 — P-195/196 OTA 그룹 사장(빌드 임베드로 도달 대체).

## 빌드16 완료 (2026-08-13, P-198)
- [x] iOS 982a8196(vc17, 예진 인터랙티브 — push capability·APNs) 테플 제출 완료 · 안드 3f1eb36a(vc11) APK 배포. fingerprint 로컬==빌드 일치(ios d6ddb65a·and ff05c134) — 이후 OTA 도달 기준 확립. pushEnabled off 유지.

## dev API 대개편 대응 (2026-08-13, P-199)
- [x] 버전리스 경로(dev)+헤더 3종(공용 클라 한 곳)+prod 채널 구계약 분기+app-version 게이트 실연결(aos 키)+CLAUDE.md fp 대조 승격 — ef38ae9.
- [x] tsc 0 · jest 108스위트 662/662 · teamtest OTA(ios d9bf6248·and 287a9ed5) — fp 게이트 첫 적용(로컬==빌드 일치 확인 후 발행).

## 리뷰 장소 태그 실연결 (2026-08-13, P-201)
- [x] places nearby/search 실호출(고정 좌표 상수 1곳)·PlacePickerSheet 파츠 승격(작성·수정 공용, MANUAL 직접 입력)·place 전송(생성+수정 유지/해제 시맨틱)·ReviewPlaceLine 4표면+3사 좌표 딥링크(placeMap 분리)·reviewPlaceEnabled dev 한정 — 8303e47.
- [x] tsc 0 · jest 109스위트 669/669 · teamtest OTA(ios 8cc14619·and fe8f05d0, fp 게이트 일치) · KB-249 검토 중 전환.

## 장소 실위치 + 빌드18 완료 (2026-08-14, P-200)
- [x] expo-location 실위치 스왑(권한 분기·강남 폴백·지연 require·60s 메모)+Sentry 노브 제거 — 5c6cbc8. 빌드18: iOS 6c19fda5(vc18, 테플 제출)·안드 bef9f1ee(vc12, APK). fp 로컬==빌드 일치(ios 57d46bc8·and 2c73e616 — CLAUDE.md 기준 갱신). 소스맵 업로드 정상.

## 리뷰 확장 별점 3축 선구현 (2026-08-14, P-202)
- [x] ExtrasRater 작성·수정 공용(찾아가기 = 장소 태그 연동·재탭 해제)+buildReviewExtras no-op 격리+로컬 프리뷰+셀 축약 4표면(IconZap·IconSmile 신설)+reviewExtrasEnabled dev 한정 — 5e21271.
- [x] tsc 0 · jest 111스위트 681/681 · teamtest OTA(ios 8a040b2f·and a548754a, fp 빌드18 일치).
