# Quickstart — 008-home-top-rated-foods

```bash
npx tsc --noEmit
npx jest --ci
npx jest src/app/__tests__/homeTopRated800.test.tsx src/lib/data/__tests__/homeTopRatedAdapter800.test.ts src/features/home
node ./scripts/lint-changed.mjs
```

수동(dev, BE 1.3 배포 후): 홈 하단 섹션 행·"—"·탭 → 상세 / CTA → 스캔 / 네트워크에 `/reviews` 요청 없음 / 리뷰 탭 피드 정상.
