# Quickstart — 010-home-idol-kfood-section

```bash
npx tsc --noEmit
npx jest --ci
npx jest src/features/home/__tests__/idolPick836.test.tsx src/lib/data/__tests__
node ./scripts/lint-changed.mjs
```

수동(dev, BE 1.4 배포 후): 홈 세 탭에서 인기 레일 아래 배너(사진 3장·물음표) → 탭 → `/idol-picks` 그리드(게스트 배지 없음·회원 배지) → 카드 → 상세 헤더 아래 V1 카드 → 탭 → 인앱 브라우저 영상. 320pt 기기에서 축소 콜라주. 매핑 없는 음식 상세엔 카드 없음.
