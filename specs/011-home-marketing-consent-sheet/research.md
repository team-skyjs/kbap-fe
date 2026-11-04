# Research

- **전환 종료 신호**: RN 0.85.3 의 `InteractionManager.runAfterInteractions` 는 `setImmediate` 스텁 — native 전환을 기다리지 않는다. 알림함은 native-stack `transitionEnd {closing:false}`(push 진입·자식 pop 복귀 모두 onAppear 로 발화)를 쓴다.
- **덮개 대기**: `PackagedCoach.presentHomeCoach` 의 `waitUntil(isAdsSettled)` + `waitUntil(!isOccluded())` 를 그대로 쓴다 — `waitUntil` 을 `oneShotQueue.ts` 로 옮겨 export(새 구현 0).
- **판정 대기**: `waitStep(fetchQuery, signal, 8000)` — 블러 abort·상한·실패 = false(소모 0).
- **상호 배제**: `isPackagedCoachActive` 선례대로 모듈 플래그 `isMarketingConsentActive()`.
- **날짜 키**: `reviewPrompt.ts`(순수 판정) + 저장 분리 패턴. 로컬 `getFullYear/getMonth/getDate`.
