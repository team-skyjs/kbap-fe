/**
 * P-225(KB-307): 리뷰 표면 카피 정리 — 탭명 Reviews · optional 제거(온보딩 3키
 * 제외) · Tag a place → friendly · 리뷰 픽커 캡션 미렌더 분기 잠금.
 */
const fs = require('fs');
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id'];
const dict = (lang: string) => JSON.parse(fs.readFileSync(`src/lib/i18n/${lang}.json`, 'utf8'));

it('① 탭명 = Reviews 계열 ×10 — en 확정 "Reviews", 홈 섹션·피드 헤더도 같은 키 재사용', () => {
  expect(dict('en').tabs.community).toBe('Reviews');
  expect(dict('ko').tabs.community).toBe('리뷰');
  for (const lang of LOCALES) expect(dict(lang).tabs.community).not.toMatch(/community/i);
  // 같은 키 재사용 표면(함께 바뀌는 것이 맞다 — 발주 확인)
  expect(fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8')).toContain("t('tabs.community')"); // 홈 리뷰 섹션
  expect(fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8')).toContain("title={t('tabs.community')}"); // 피드 헤더
});

it('② optional 제거 — 대상 3곳 잔존 0, 온보딩 3키는 존치(스킵 가능 안내 = 안전 목적)', () => {
  for (const lang of LOCALES) {
    const d = dict(lang);
    expect(d.review.placeOptional).toBeUndefined(); // 키 자체 제거
    expect(d.review.extrasTitle).not.toMatch(/optional|選択|선택 사항|可选|不填/i);
    // 온보딩 3키 존치(제외 명시 — 멘토 지적 맥락과 다른 안전·UX 문구)
    for (const k of ['restrictionsSub', 'spiceSub', 'interestsSub']) {
      expect(typeof d.onboarding[k]).toBe('string');
    }
  }
  expect(dict('en').community.reasonOtherPlaceholder).toBe('Tell us more');
  const compose = fs.readFileSync('src/app/food/[id]/review.tsx', 'utf8');
  expect(compose).not.toContain('review.placeOptional');
});

it('③ Tag a place → friendly 톤 3키 ×10 (en "Where did you eat?")', () => {
  for (const key of ['tagPlaceTitle', 'tagPlace'] as const) {
    expect(dict('en').community[key]).toBe('Where did you eat?');
  }
  expect(dict('en').review.placeRow).toBe('Where did you eat?');
  expect(dict('ko').review.placeRow).toBe('어디서 드셨어요?');
  for (const lang of LOCALES) expect(dict(lang).review.placeRow).not.toMatch(/tag a place/i);
});

it('④ 픽커 캡션 = compose 전용 — 리뷰 픽커는 context="review"로 미렌더', () => {
  const compose = fs.readFileSync('src/app/community/compose.tsx', 'utf8');
  expect(compose).toContain("context = 'compose'"); // 기본값 = 글 작성(문구 존치 — 코드 보존)
  expect(compose).toContain("{context === 'compose' && (");
  expect(fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8')).toContain('context="review"');
  // compose 캡션 키 자체는 존치(글 기능 재오픈 미결)
  expect(typeof dict('en').community.foodSheetCaption).toBe('string');
  expect(typeof dict('en').community.placeSheetCaption).toBe('string');
});
