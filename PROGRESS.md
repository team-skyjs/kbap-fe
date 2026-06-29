# kbap-fe Build Progress
> 규칙: 한 번에 1개. [ ]→[~]→[x]. 각 화면 완료 시 목업 대조 + 커밋.
> 목업 SSOT: Claude Design `43cc8ad0-38d8-4afa-a66f-a7412eae2a49` ("KLens Hi-Fi (Direction G)", hifi-*.jsx, hifi-g.css).
> 계약 SSOT: spec 레포 `specs/001-personalized-menu-mvp/contracts/openapi.yaml` (재조정 중 — 미확정 필드에 로직 강결합 금지).
> 브랜드: 목업 "KLens" → 표시명 **K-Bap** 치환.

## 기반
- [ ] Expo(TS+expo-router) 초기화 + 의존성
- [ ] lib/theme.ts (토큰/폰트)
- [ ] mock seam (types / mocks / useXxx, MOCK_MODE=true)
## 디자인시스템
- [ ] RiskMark + Icon* (SVG)
- [ ] Btn / StickyHeader(scroll-aware) / SubHeader / TabBar / TopBar / Stars / 상태 컴포넌트
## 앱 셸
- [ ] 5-탭 + Scan FAB + Community(잠김) + 검색/알림 패널
## 화면 (각: 목업 대조 후 [x])
- [ ] 온보딩(+스파이스)  - [ ] 홈  - [ ] 카메라/스캔(mock OCR)  - [ ] 음식 탐색
- [ ] 음식 디테일  - [ ] 사장님 확인  - [ ] 리뷰 작성  - [ ] 프로필  - [ ] 상태(빈/로딩/에러)

---

## 세션 로그
> 각 단위 시작 시 `[~]`+메모, 완료 시 `[x]`+결과 1줄.

### Session 1 — 범위: 기반 → 디자인시스템 → 앱 셸 (3단위 후 멈춤)

## ❓ 결정 필요 (사용자에게 질문)
> (없음 — 채워지면 사용자에게 보고)
