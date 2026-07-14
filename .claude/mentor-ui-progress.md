# 멘토링 UI 수정 진행 메모 (2026-07-14)

> 재개 시(새 세션/컴팩션 후): 이 파일부터 읽고 이어서. 착수 직전·완료 직후 갱신 + 작업 커밋에 포함.
> Jira는 일절 건드리지 않음 — 기록은 이 파일에만.

| # | 항목 | 상태 | 커밋 | 메모 |
|---|---|---|---|---|
| ① | 홈 회피성분 X 아이콘 제거 | 완료(웹체크 대기) | 8adb1e6 | 칩 내 RiskDot(팔각형+✕)이 삭제 버튼으로 오독 → 텍스트만. 핸들러 원래 없음(칩 비인터랙티브). RiskDot import 정리 |
| ② | 프로필 로그아웃 좌측 화살표 교체 | 완료(웹체크 대기) | 4bdf30d | IconLogout 신설(문+화살표, icons.tsx 기존 Glyph 패턴 6줄) + 로그아웃 행 우측 chevron 제거 |
| ③ | 알림 버튼 게스트 게이트 — 전 탭 통일 | 완료(웹체크 대기) | ab85f09 | 종 동작을 StickyHeader 내장으로 통합(게스트=게이트 시트, 회원=패널). onBell prop 제거 |
| ④ | 스캔 결과 가격 표시(KRW만) | 완료(웹체크 대기) | | PRICE_BARE 정규식 + priceKrw 정수 보관 + ₩포맷 + 매칭 거리상한 0.35 |
| ⑤ | 앱 언어에 한국어(ko) 추가 | 진행전 | | |

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

## 질문/블로킹
