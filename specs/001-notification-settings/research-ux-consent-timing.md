# UX 리서치: 알림 동의 시점·표면 (KB-497 부속, 2026-09-11)

UX 리서처 에이전트 조사 결과. 검토 대상 = plan R3/R4의 현재안(온보딩 직후 홈 첫 진입에서 OS 권한 + 광고성 동의 2종을 한 모달, "나중에" = 영구 차단).

## 핵심 결론

1. **현재안(대안 A)은 권하지 않는다.** 2024~2025 벤치마크·플랫폼 가이드 모두 "첫 실행 직후 맥락 없는 요청"을 최저 동의율 패턴으로 지목. 한국 규제 관행은 광고성 동의를 다른 동의와 시각적으로 섞는 것을 위험 신호로 본다.
2. **활동 푸시(OS 권한)와 K-Bap 소식(법정 동의)은 표면·시점을 분리.** OS 권한은 첫 스캔 결과 직후(가치의 순간), 광고성 동의는 이후 세션·설정 화면에서 별도 시트.
3. **"나중에" = 영구 차단이 아니라 쿨다운**(14~30일, 기기당 최대 2~3회). 여행자 비중이 높은 앱에서 영구 차단은 회복 경로를 닫는다.
4. 스캔 후 프라이머(B)는 유지하되 **활동 푸시의 주 진입점으로 승격**, 온보딩 직후 프라이머(A)는 폐지(또는 OS 단독·한 문장 소프트 애스크로 축소).

## 벤치마크 (2024~2025)

| 지표 | 수치 | 출처 |
|---|---|---|
| iOS 옵트인 중위값 2023→2024 | 49.1% → 49.4% (상위 10% 74.1%) | Airship 2025 |
| Android 옵트인 중위값 2023→2024 | 71.3% → 59.5% (Android 13 런타임 권한 여파) | Airship 2025 |
| 전체 평균(타 벤더) | 61% (iOS 56% · Android 67%) | Batch 2025 |
| 온보딩 캠페인 운영 앱 | 카테고리 평균 대비 최대 +40% | Airship 2025 |
| 인앱 메시지로 거절자 재유도 | 옵트인 +14% (사례 +23%) | Airship 2025 |
| 첫 실행 즉시 vs 가치의 순간 소프트 애스크 | 30~40% vs 55~70% | SEM Nexus (**추정**) |
| 프리퍼미션 프라이머 효과 | 2~3배 (벤더 자료, **추정**) | Plotline·Pushwoosh |
| 옵트아웃 1·2위 이유 | "너무 잦다" · "관련 없다" | Airship 설문 |
| 동의 피로 | 세션당 다이얼로그 3개 초과 시 습관적 일괄 클릭 +62% (쿠키 동의 데이터) | Cookie-Script |

- Google 공식: 권한 요청 전 앱에 익숙해지게 하고, 알림이 필요한 행동 시점에 요청. iOS 시스템 프롬프트는 1회라 프라이머 통과 후에만 호출.
- Apple 4.5.4: 마케팅 푸시는 앱 UI에 표시된 동의 문구로 명시적 옵트인 + 앱 내 옵트아웃 수단 필요(OS 권한만으로 부족).
- 글로벌 사례: Headspace(목적별 카테고리·이점 설명 후 요청), Duolingo(첫 레슨 완료·목표 설정 후), Atoms("Maybe later" 부담 없음). 공통 = 사용자가 투자한 직후, 단일 이점 한 문장. Calm은 첫 실행 즉시 요청하는 반례.
- Batch 권고 4요소: 얻는 가치 · 실제 알림 예시 · 발송 빈도 · "나중에" 버튼.

## 한국 앱 사례·규제

| 앱 | 시점 | 번들/분리 | 패턴 |
|---|---|---|---|
| 쿠팡 | 가입 시 선택 동의 + 설정 > 푸시 설정 | 분리: 정보성 토글 ≠ "광고성 푸시 수신" | 08~21시 전송 명시, 야간 별도 |
| 토스 | 기능 사용 맥락("잔액 부족 알려드릴까요?") | 기능 동의에 마케팅 동의 끼워넣기 → 비판 | 다크패턴 리스크(2025 전자상거래법 다크패턴 규제) |
| 배민·당근 | 가입 약관 "[선택] 마케팅 수신 동의" + 설정 | 분리 (**추정**) | 홈 팝업 재유도 (**추정**) |
| 이마트·스타벅스 | 가입/멤버십 | 분리 + 쿠폰 인센티브 | 인센티브형 |

규제 체크리스트(KISA 안내서·시행령 62조의2·3): 미체크 기본값 · "광고성 정보 수신 동의" 문구 명시("혜택 알림"만으론 무효) · 개인정보 마케팅 이용 동의와 별항 · 21~08시 전송은 별도 동의 · 동의/철회 처리 결과(발신자·일시·결과) 즉시 팝업 또는 14일 내 통지 · **2년 주기 재확인**(1년은 법정 요건 아님) · 동의 일시·버전·단계 기록 · 발송 시 "(광고)" 접두, 수신거부 방법.

## 대안 비교

| | A 현재안: 첫 홈 진입, OS+동의 2종 한 모달, 영구 차단 | **B 추천**: 첫 스캔 후 OS → 후속 세션 광고성 시트 | C: 온보딩 끝 OS 단독 → 광고성 후속 |
|---|---|---|---|
| iOS 1회 프롬프트 소진 시점 | 가치 경험 전(최저 구간) | 첫 스캔 결과 직후(가치의 순간) | 온보딩 끝(중간) |
| 규제·심사 인상 | 번들 인상, 다크패턴 논란 소지 | 별항·별표면, 가장 안전 | 안전 |
| 여행자 회복 경로 | 영구 차단 → 없음 | 쿨다운 재노출 + 설정 | 동일 |
| 구현 비용 | 모달 1개 | 시트 2개 + 인라인 카드 + 쿨다운 상태 | 시트 2개 |
| 광고성 동의 도달 | 초기 높음, 질 낮음(추정) | 늦지만 유지율 높음(추정) | 중간 |

A의 추가 단점: 10개 언어에서 법정 문구가 길어 모달 밀도 과다. C는 절충이지만 스캔 전 사용자에게 "리뷰 알림"은 추상적이라 B 우세.

## K-Bap 권고 (대안 B 상세)

**1단계 · 활동 푸시(OS 권한)**: 첫 스캔 결과 화면 하단 시트(현행 스캔 프라이머 승격, 회원만). 문구 = 이점 1개 + 빈도 + "나중에". 예: "주문하신 메뉴, 1시간 뒤 리뷰 남기라고 알려드릴게요. 리뷰에 '도움됨'이 달리면 알려드려요." 승낙 시에만 OS 프롬프트. 온보딩 직후 프라이머 폐지, 홈 첫 진입엔 아무것도 띄우지 않음. (검토: iOS provisional 권한을 활동 푸시 1차 경로로 — **추정**, 미검증.)

**2단계 · K-Bap 소식(광고성 동의)**: 별도 바텀 시트, 체크박스 2개(모두 미체크, 각 전문 링크), 상단에 "광고성 정보 수신 동의" 명시. 트리거(OR): (a) 활동 푸시 허용 후 두 번째 세션 홈 상단 인라인 카드 → 탭 시 시트 (b) 첫 리뷰/북마크 완료 직후 (c) 설정 화면. **OS 권한 없는 기기엔 노출하지 않음**(동의만 받고 발송 불가 상태 방지). 식사 시간 넛지는 시트 안 서브토글, 기본 OFF, 광고성으로 보수 분류. 동의·철회 즉시 처리 결과 토스트, 서버 기록(버전·시각·기기), 2년 재확인. 21~08시 발송 안 함으로 정책 고정 → 야간 동의 항목 제거.

**"나중에" 정책**: 기기당 쿨다운 14~30일, 최대 2회 재노출(OS 권한은 iOS 1회 제약상 프라이머만 재노출), 이후 설정 화면만.

**설정 화면**: 정본. 활동 / K-Bap 소식(동의 2종) / 식사 시간 + 동의 일시 표시 + OS 권한 꺼짐 시 시스템 설정 안내. 새 기기 로그인 시 서버 동의 부재 → 2단계 카드 자연 재노출.

**여행자·회원 전용 특성**: 단기 체류자에게 마케팅 푸시 가치는 낮고 식사 시간 넛지만 유효할 수 있음. KPI를 "동의율"보다 "동의자 유지율"로 두고 첫 세션에 억지로 받지 않는 것이 옵트아웃·삭제 방지에 유리(**추정**).

## 추정 표시 정리
- 30~40% vs 55~70%: 벤더 관측치, 통제 실험 아님.
- 프라이머 2~3배: 벤더 마케팅 자료.
- OS 권한 + 법정 동의 2종 한 표면의 이탈률: 공개 실험 없음, 쿠키 동의 피로 데이터에서 유추.
- 배민·당근·야놀자·카카오맵 동의 화면 세부: 공개 문서 미확인.
- provisional 권한 안: 리뷰 리마인더 조용 배달 효과 미검증.

## 출처
- Airship 2025 Push Benchmarks (PDF): https://growth.airship.com/rs/313-QPJ-195/images/Airship-2025-Push-Notification-Benchmarks-EN.pdf
- Airship 2026 가이드: https://www.airship.com/blog/your-guide-to-airships-mobile-app-push-notification-benchmarks-for-2026/
- Batch Benchmark 2025: https://batch.com/ressources/etudes/benchmark-notifications-push-crm-mobile
- Batch, improve opt-in: https://doc.batch.com/guides-and-best-practices/orchestration/how-to-improve-the-push-opt-in-rate
- Pushwoosh benchmarks: https://www.pushwoosh.com/blog/push-notification-benchmarks/
- SEM Nexus timing data: https://semnexus.com/push-notification-timing-data-opt-in-rates
- Plotline opt-in: https://www.plotline.so/blog/how-to-improve-push-notification-opt-in-rates
- OneSignal prompt guide: https://documentation.onesignal.com/docs/en/prompt-for-push-permissions
- Google notification permission: https://developer.android.com/develop/ui/views/notifications/notification-permission
- Apple Review Guidelines 4.5.4: https://developer.apple.com/app-store/review/guidelines/
- Apple asking permission: https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications
- Onboard Me (Headspace·Duolingo·Atoms·Calm): https://onboardme.substack.com/p/why-most-users-reject-your-app-notification-lessons-from-headspace-duoling-atoms-and-calm
- Lenny's Newsletter, Duolingo: https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth
- Cookie-Script consent fatigue: https://cookie-script.com/blog/consent-fatigue
- 정보통신망법 제50조: https://www.law.go.kr/LSW//lsLinkCommonInfo.do?lsJoLnkSeq=1025057211&chrClsCd=010202&ancYnChk=
- KISA 불법스팸 방지 안내서: https://www.kisa.or.kr/2060301/form?postSeq=19&page=1
- ZDNet Korea KISA 개정본(2024.3): https://zdnet.co.kr/view/?no=20240328093711
- 캐치시큐 앱 푸시 수신동의: https://www.catchsecu.com/archives/13742 · https://www.catchsecu.com/archives/12054
- 핑거푸시 광고성 전송 가이드: https://developers.fingerpush.com/app-push/guide/ads
- 비즈고 수신동의 무효 사례: https://blog.bizgo.io/trend/marketing-consent-advertising-message-guide/
- 오픈애즈 앱 푸시 수신동의: https://openads.co.kr/content/contentDetail?contsId=8549
- 뷰저블 푸시 동의 UI/UX: https://www.beusable.net/blog/?p=3078
- 솔라피 마케팅 수신 동의율 전략: https://solapi.com/blog/baedalyi-minjog-keolriga-sseomeogneun-sms-jeonryag/
- 쿠팡 알림 설정 분리: https://bullroit.net/%EC%BF%A0%ED%8C%A1-%EC%95%8C%EB%A6%BC-%EC%B0%A8%EB%8B%A8-%EB%81%84%EA%B8%B0-%EB%93%B1-%ED%91%B8%EC%8B%9C-%EC%84%A4%EC%A0%95%ED%95%98%EA%B8%B0/
- 한국일보 토스뱅크 마케팅 동의 강제 수정: https://www.hankookilbo.com/News/Read/A2022031523220004326
- GeekNews 토스 "잔액 부족 알림" 동의 논란 (URL 원문 잘림)
