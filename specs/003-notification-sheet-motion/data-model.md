# Data Model: 알림 시트 모션 (KB-553)

서버 데이터·영속 저장 변경 없음. 클라이언트 UI 상태와 문구 키만 정리한다.

## 1. NotificationSheet 상태

| 필드 | 소유 | 타입 | 비고 |
|------|------|------|------|
| `open` | 호출부(prop) | boolean | `Modal visible`. false→true 전환 시 훅이 translateY 0 리셋, 시트가 pending 체크 폐기 |
| `variant` | prop | `'primer' \| 'consent'` | 무변 |
| `checks` | 시트 로컬 | `{ privacy: boolean; receive: boolean }` | consent만. 닫힘 시 폐기(기존 §2) |
| `busy` | `useSubmitGuard` | boolean | 확인 진행 중. 무변 |
| `ty` | 훅 내부 shared value | number(pt) | 드래그 translateY(≥0). 시트 transform·딤 opacity의 유일한 소스 |
| `closingRef` | 훅 내부 | boolean | 임계 통과 후 단일 발사 가드 |
| `sheetH` | 훅 내부 | number | onLayout 실높이. 퇴장 목표(측정 전 = 화면 높이) |

## 2. 상태 전이(모션)

```
closed ──open=true──▶ visible=true · Modal fade-in(딤) · entering(ty: winH → 0, withTiming 240ms ease-out) ──▶ open
open ──pan onUpdate──▶ dragging(ty 추종, 딤 비례 페이드)
dragging ──onFinalize(success, dy≥80 ∨ vy≥500)──▶ exiting(withTiming ty→sheetH 180ms) ──finished──▶ onClose() ──호출부 open=false──▶ dismiss(cb): 이미 내려감 → 즉시 visible=false ──▶ Modal fade-out ──▶ closed
dragging ──onFinalize(미만 ∨ success=false)──▶ open(withSpring ty→0, spring.sheet)
open ──scrim 탭 / 「나중에」 / 확인 완료 / 안드 백버튼──▶ onClose()/onConfirm ──호출부 open=false──▶ dismiss(cb): exiting 180ms ──finished──▶ visible=false ──▶ Modal fade-out ──▶ closed
exiting ──재드래그·재판정──▶ (무시, closingRef)
```

| 필드(추가) | 소유 | 타입 | 비고 |
|------|------|------|------|
| `visible` | 시트 로컬 | boolean | `Modal visible`. open=true 즉시 true, open=false는 퇴장 애니메이션 완료 후 false |

불변식:
- `ty ≥ 0` (위로 끌기 무시).
- `onClose`는 한 번의 닫힘 사이클에 정확히 1회.
- 시트 레이아웃 메트릭(padding·radius·gap·handle 36×4·checkbox 20×20·border 1.5)은 모든 상태에서 동일 — 상태 간 차이는 `transform`·`opacity`·색만(P-151).

## 3. 제스처 영역 계약

| 영역 | GestureDetector 안? | 탭 동작 |
|------|--------------------|---------|
| 그랩 핸들 | 예 | 없음(끌기만) |
| 제목 | 예 | 없음 |
| 본문 | 아니오 | 없음 |
| 체크 행 2 · 전문 링크 2 | 아니오 | 토글 / 인앱 브라우저 |
| 확인 · 「나중에」 | 아니오 | 제출 가드 / onClose |
| 스크림(시트 위 빈 영역) | 아니오 | onClose |

## 4. 문구 키(변경 대상)

| 키 | ko 현행 → 변경 | ja | zh-Hans / zh-Hant | 기타 6로케일 |
|----|----------------|----|--------------------|--------------|
| `notif.activitySub` | 리뷰 반응·식사 후 리뷰 작성 → 리뷰 반응/식사 후 리뷰 작성 | `・`→`/` | `·`→`/` | 무변 |
| `notif.newsSub` | 이벤트·새 기능 소식 (광고성) → 이벤트/새 기능 소식 (광고성) | `・`→`/` | 무변(중간점 없음) | 무변 |
| `notif.mealTimeSub` | 점심·저녁 메뉴 스캔 알림 (광고성) → 점심/저녁 … | `・`→`/` | 무변 | 무변 |
| `push.consentSheetBody` | 이벤트·새 기능 소식을 … → 이벤트/새 기능 소식을 … | 무변(중간점 없음) | 무변 | 무변 |
| `push.privacyConsent` | 마케팅 목적 개인정보 수집·이용 동의 (선택) → 수집/이용 | `・`→`/` | 무변 | 무변 |

검증 규칙: 5키 × 10로케일 값에 `[·・]` 0개. 키 집합은 ko와 일치(기존 패리티). `notif.*`·`push.*` 외 네임스페이스는 검사·변경 대상 아님(spec FR-011).
