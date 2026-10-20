# Quickstart — 010-home-idol-kfood-section

```bash
npx tsc --noEmit
npx jest --ci
npx jest src/features/home/__tests__/idolPick836.test.tsx src/app/__tests__/foodDetailV2.test.tsx
node ./scripts/lint-changed.mjs
```

수동(dev, BE 목록 API 배포 후): 홈 세 탭에서 인기 레일 아래 정적 배너 → 탭 → `/idol-picks` 그리드(게스트 배지 없음·회원 배지) → 카드 → 상세 헤더 아래 V1 카드 → 탭 → 인앱 브라우저 영상. 검색에서 같은 음식 상세 직진입(앱 재시작 후) → 카드 없음. 320pt 기기에서 축소 콜라주.
