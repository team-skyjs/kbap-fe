# 멘토링 UI 수정 진행 메모 (2026-07-14) — 5건 전부 완료

> 재개 시(새 세션/컴팩션 후): 이 파일부터 읽고 이어서. 착수 직전·완료 직후 갱신 + 작업 커밋에 포함.
> Jira는 일절 건드리지 않음 — 기록은 이 파일에만.

| # | 항목 | 상태 | 커밋 | 메모 |
|---|---|---|---|---|
| ① | 홈 회피성분 X 아이콘 제거 | 완료 | 8adb1e6 | 칩 내 RiskDot(팔각형+✕)이 삭제 버튼으로 오독 → 텍스트만. 핸들러 원래 없음(칩 비인터랙티브). RiskDot import 정리 |
| ② | 프로필 로그아웃 좌측 화살표 교체 | 완료 | 4bdf30d | IconLogout 신설(문+화살표, icons.tsx 기존 Glyph 패턴 6줄) + 로그아웃 행 우측 chevron 제거 |
| ③ | 알림 버튼 게스트 게이트 — 전 탭 통일 | 완료 | ab85f09 | 종 동작을 StickyHeader 내장으로 통합(게스트=게이트 시트, 회원=패널). onBell prop 제거 |
| ④ | 스캔 결과 가격 표시(KRW만) | 완료 | ad946b7 | PRICE_BARE 정규식 + priceKrw 정수 보관 + ₩포맷 + 매칭 거리상한 0.35 |
| ⑤ | 앱 언어에 한국어(ko) 추가 | 완료 | 4d79455 | ko.json 469키 네이티브 + kr 스크립트 폰트 + 병기 중복 가드 8지점 |
| ⑦ | 게스트 홈 위험도 뱃지 미렌더 (KB-78 위반) | 완료 | dbd7909 | SafeCard/RecentRow guest prop 가드 + 섹션 헤더 중립 아이콘 |
| ⑧-a | 게스트 홈 popularSub 카피 교체 | 완료 | 78bb8d0 | home.popularSubGuest ×10 + isGuest 분기 |
| ⑧-b | 프로필 하위 3화면 딥링크 라우트 가드 | 완료 | 979f08d | /review/[id]·/profile/reviews·/profile/restrictions — 기존 가드 패턴 복제(context profile) |
| ⑨ | 게스트 리스트 뱃지 정책 — 회귀 테스트로 고정 | 완료 | | 카드 4종 ×(게스트 미렌더/회원 렌더) 8케이스, guestListBadges.test.tsx |

## 결정사항
- ② 아이콘: 기존 세트에 log-out/exit 계열이 없음(30종 전수 확인, IconArrowLeft는 꼬리 없는 chevron이라 회전해도 chevron과 동일). "새 에셋 금지"는 파일/라이브러리 추가로 해석 — icons.tsx의 기존 인라인 SVG 패턴 그대로 `IconLogout`(문+화살표) 6줄 추가가 최소·명확. 부적절하면 IconClose(✕) 대체로 1줄 revert 가능.
- ② chevron: 로그아웃은 내비게이션이 아닌 액션 → 해당 행만 우측 chevron 제거(AcctRow에 chevron prop, 기본 true라 다른 행 무변).

### ③ 알림 버튼 렌더 지점 전수 + 게이트 동작
| 지점 | 종전 | 수정 후 |
|---|---|---|
| 홈 `(tabs)/index.tsx` StickyHeader | onBell→NotificationsPanel(게스트=welcome 1건) | 헤더 내장 기본 동작 (자체 onBell/패널 제거) |
| 음식 탭 `(tabs)/food.tsx` StickyHeader | bell만, 핸들러 없음 → **무반응(버그)** | 헤더 내장 기본 동작 |
| 프로필 탭 `(tabs)/profile.tsx` StickyHeader | bell만, 핸들러 없음 → **무반응(버그)** | 헤더 내장 기본 동작 |
- 커스텀 헤더의 종 아이콘 없음(IconBell grep 전수 — 나머지는 프로필 계정 행 장식 아이콘뿐). 종은 전부 StickyHeader 경유 → 공유 지점 1곳 수정으로 전 탭 커버.
- 기본 동작: 게스트=AuthGateSheet(context `notifications` 신설, gate.notifTitle/Sub ×9 패리티 확인) / 회원=NotificationsPanel. onBell prop은 사용처가 없어져 제거(화면별 복붙 재발 방지).
- NotificationsPanel 내부의 게스트 welcome 분기는 이제 도달 불가지만 무해한 이중 방어로 유지.

### ④ 가격 표시 설계/한계
- 기존 인프라 재사용: segmentMenu가 이미 radial nearest-neighbor로 가격 라인을 메뉴에 부착 중이었고 결과 행에 원문 표시도 있었음 → 실제 작업 = 파싱 확장 + 정규화.
- 파싱: `PRICE_BARE` — 라인 전체가 가격일 때만 (`12,000` / `12000`(3~6자리) / `12,000원` / `₩12,000`). 부분 매치 금지(요리명 속 숫자 오인 방지). 부수 효과: "12,000원" 라인이 종전엔 dishName으로 오분류되던 것도 수정됨.
- 상태: `MenuDish.price(string)` → `priceKrw(number|null)` 교체 — 환율 변환은 이 정수 기준으로 후일 부착. 표시는 `formatKrw()` = `₩12,000` 통일(Intl 미의존).
- 미표시 원칙: nearest에 거리 상한 0.35(정규화 좌표) — 가격 없는 메뉴에 화면 반대편 가격이 붙는 것 차단. 실패=빈 자리.
- **한계(휴리스틱)**: 기울어진 사진(행 y축 어긋남), 가격 열이 메뉴명과 멀리 분리된 표 레이아웃, 한 라인에 이름+가격이 병합된 OCR 결과(가격 라인이 아예 안 생김)는 미표시로 떨어짐. 고정 반경 0.35는 보수적 선택 — 실메뉴판 리포트 쌓이면 조정.
- 회귀: 실 OCR 픽스처 스냅샷 무변(기존 분류 회귀 없음), 테스트 45→49건.

### ⑤ 한국어(ko) 설계/검증
- BE 확인: Swagger(v3/api-docs) appLanguage = enum 없는 plain string → "ko" 전송이 스키마에서 안 막힘(KB-104 "10개국어" 전제 부합). 와이어는 BCP-47 그대로 전송이라 매핑 변경 없음. 서버측 enum 거부 여부만 실호출로 최종 확인.
- ko.json 469키 전체 네이티브 번역(_meta.status=native). 키 패리티 10/10 + **placeholder 패리티 검사 신규 도입** — ko ptsTo에서 en에 없는 {{points}}를 넣은 버그를 이 검사+웹 체크로 잡음(en은 숫자를 JSX에서 별도 렌더). 다른 8개 카탈로그는 placeholder 이상 없음.
- 랭킹 화면 한/영 병기 키(headerTitleKo, tierKo.*, *LabelKo, breakdownSub, ladderSub, ptsToKo): ko에서는 메인이 한국어가 되므로 병기 키에 **영어 원문**을 배치(2개 국어 병기 디자인 유지, 중복/깨진 구분자 방지 — 빈 문자열은 "· " 구분자가 깨짐).
- 폰트: ScriptKey 'kr' 추가, FONT_SETS.kr=NotoSansKR(600/800만 추가 등록 — 400/700은 useAppFonts가 place=ko용으로 기등록). 새 의존성 없음(패키지 기설치).
- 병기 중복 가드: 어댑터 계약상 "지역화 이름이 이미 한국어면 BE가 koreanName=null → FE nameKo=name" → `nameKo !== name` 렌더 가드 8지점(홈 카드×2·음식탭·검색×2·상세×2·리뷰목록 서브·작성 칩·리뷰상세×2). 스캔 결과는 기존 가드 있음. nameKo의 기능적 사용(검색 쿼리)은 유지.

### 웹 셀프 체크 (2026-07-14)
- ① 회원 홈(MOCK_HOME 임시 플립): 회피 칩 텍스트만 — X 배지 없음 ✅ (섹션 헤더의 위험 표식은 유지, 항목 X만 제거)
- ② 프로필 로그아웃 행: 좌측 문+화살표 IconLogout, 우측 chevron 없음, 다른 행 chevron 유지 ✅
- ③ 게스트 3탭(홈·음식·프로필) 종 → notifications 카피 게이트 시트 ✅ (음식·프로필은 종전 무반응이던 곳)
- ④ 웹은 BE /scan CORS로 결과 리스트 도달 불가 → 파싱/포맷/거리상한은 유닛테스트 4건+실OCR 스냅샷으로 검증. **실기기 확인 필요**: 실메뉴판 스캔 시 ₩가격 표시/미표시
- ⑤ 피커에 한국어 항목, 선택 시 전 UI 한국어 전환(탭바·계정·스캔 에러 카피), 랭킹 병기 자연스러움 ✅. LIVE ko에서 nameKo 중복 생략은 실기기+실API 확인 필요
- 검증용 임시 플립(flags.guestMode=false, MOCK_MODE_HOME=true)은 전부 원복 확인. dist/스크린샷 정리 완료.

### ⑦ 게스트 홈 뱃지 (관찰 → 버그 확정, 2026-07-14)
- 수정: SafeCard(photoBadge)·RecentRow(recBadge)에 음식 탭 BrowseCard와 동일한 `guest` prop + `{!guest && 뱃지}` 패턴. RecentRow는 게스트 도달 불가 분기(가입 유도 카드)지만 카드 자체에서도 방어(이중 방어).
- 섹션 헤더(168행) 판단: 게스트에겐 RiskMark safe가 "안전 주장"으로 읽힘 → **아이콘 생략 대신 중립 IconFood(주황)로 교체** — 섹션 헤더 레이아웃(아이콘+제목)을 유지하면서 위험도 함의만 제거. popularSub 카피("Already tagged with your risk profile")도 게스트에겐 개인화 주장이라 어색하나 뱃지가 아니라 지시 범위 외 — 아래 관찰사항에.
- **정책 확정(7/14 예진): 리스트류 전면 미표시, 테스트로 고정(⑨)** — 홈·음식탭·검색·앞으로 생길 목록 전부; 상세는 락카드 기처리.
- RiskMark 렌더 지점 전수 grep (게스트 관점):
  | 지점 | 게스트 도달 | 판정 |
  |---|---|---|
  | 홈 SafeCard/RecentRow(294/331) | 도달 | **수정** (guest 가드) |
  | 홈 섹션 헤더(169) | 도달 | **수정** (중립 아이콘) |
  | 홈 diet 배너(107) | 미도달(avoided=[]→섹션 숨김) | OK |
  | 홈/상세/제한편집/온보딩 disclaimer caution·intro 슬라이드 아이콘 | 도달 | OK — 안전고지/일러스트 장식, 위험도 주장 아님 |
  | 음식 탭 BrowseCard(138) | 도달 | OK — 기존 가드 |
  | 상세 unable 3곳·RiskPill 경유 | 도달 | OK — KB-78에서 락카드/중립 재료행 처리 |
  | 스캔 결과(scan.tsx 330, ScanResultOverlay 79) | 미도달(라우트 가드) | OK |
  | 작성 화면 칩(food/[id]/review.tsx 100) | 미도달(라우트 가드 선행) | OK |
  | 프로필 MyReview(242)·delete-account·IngredientFilter·온보딩 | 미도달(회원 플로우/게이트) | OK |
  | 내리뷰 상세(review/[id] 110/119)·프로필 reviews(118)·restrictions(56) | **딥링크 시 도달 가능성** | 아래 관찰사항 |
- 웹 셀프 체크: 게스트 홈 카드 뱃지 없음(자리 비움)+헤더 중립 아이콘 / 회원(MOCK_HOME 임시 플립) 뱃지 복귀(SafeCard ✅·RecentRow ⚠·헤더 safe) — 둘 다 확인, 플립 원복 완료.

### ⑧ (⑦ 관찰 2건 승인 → 수정, 2026-07-14)
- ⑧-a: `home.popularSubGuest` 신설 ×10개 언어 (en "Popular Korean dishes to explore" 방향, 각 언어 자연스럽게). 홈 sub 삼항에 isGuest 분기. 키+placeholder 패리티 9/9 통과.
- ⑧-b: 내리뷰 상세(/review/[id])·프로필 reviews·restrictions에 scan/review.tsx와 동일한 라우트 자체 가드 복제 — 모든 훅 뒤 `if (isGuest) return <SubHeader + AuthGateSheet context="profile" open onClose={back}>`. 콘텐츠(mock 포함) 미마운트. review/[id]는 `!review` not-found 분기보다 가드가 먼저(게스트에겐 존재 여부도 미노출).
- 웹 셀프 체크: 게스트 홈 sub="Popular Korean dishes to explore"(risk profile 문구 없음) / 게스트 딥링크 3화면 전부 시트+빈 배경(미마운트) / 회원 홈 sub 기존 경로(safeSub 확인, popularSub 분기는 코드 삼항 유지) / 회원 3화면 정상 마운트(리뷰 통계·카드, 성분 필터+저장바). 임시 플립 원복 완료.

### ⑨ 게스트 리스트 뱃지 회귀 테스트 (2026-07-14)
- `src/app/__tests__/guestListBadges.test.tsx` — 리스트 카드 4종(홈 SafeCard/RecentRow·음식탭 BrowseCard·검색 ResultCard) × (게스트=RiskMark 0개 / 회원=1개 이상) 8케이스. 회원 케이스는 가드가 뱃지를 통째로 죽이는 오버슈트 방지용. 검색 카드는 RiskPill 경유지만 내부가 RiskMark라 `findAllByType(RiskMark)` 하나로 균일 검증.
- 구현: 카드 4종에 `export`만 추가(로직 무변), react-test-renderer(기설치 19.2.3) 카드 단위 렌더 — 새 의존성 없음. jest testMatch에 `.test.tsx` 추가. reanimated 공식 mock이 worklets 초기화를 끌고 와 jest에서 죽어서 인라인 표면 mock 사용(카드는 reanimated 미사용).
- 공통 지점 일원화 검토(⑨-2): RiskMark를 리스트 문맥에서 감싸는 공통 컴포넌트 **없음** — 4개 카드가 3파일에 각자 인라인 렌더. 지시대로 신설하지 않음(추상화 1겹 < 테스트 8케이스). 새 리스트 카드가 생기면 테스트 파일의 CARDS 배열에 한 줄 추가하는 규약을 파일 헤더에 명시.
- 테스트 45→57 (⑨에서 +8).

### 관찰사항 (이번 스코프 외 — 예진 판단)
- 프로필 제한 칩이 "FISH_SAUCE" 등 코드 그대로 표시 — 기지 이슈(KB-125 신규 성분 번역 목록)와 동일 계열.

## 질문/블로킹
- ⑤ BE appLanguage: 스키마는 plain string이라 "ko" 통과하지만 서버측 enum 검증이 있으면 온보딩/프로필 PATCH에서 거부될 수 있음 — 실기기에서 ko 선택 후 제출 1회 확인 필요.
