/**
 * P-258: 게스트 Helpful 게이트 카피 — 읽기 차단 시절 'reviews' 유물 제거,
 * 트리거별 컨텍스트 분리(Helpful = 'helpful' 신카피 · FAB = 'writeReview' 재사용).
 * food/[id]/reviews.tsx의 게이트는 실개방 setter 부재(P-235 흔적) 확인 후 제거.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync } = require('child_process');

it("Helpful = 'helpful' 신카피 · FAB = 'writeReview' — 트리거별 분리 배선", () => {
  const feed = readFileSync('src/features/community/ReviewFeed.tsx', 'utf8') as string;
  expect(feed).toContain("onGuestHelpful={() => setGateOpen('helpful')}");
  expect(feed).toContain("setGateOpen('writeReview')");
  expect(feed).toContain("context={gateOpen ?? 'helpful'}");
  const sheet = readFileSync('src/components/AuthGateSheet.tsx', 'utf8') as string;
  expect(sheet).toContain("helpful: { title: 'gate.helpfulTitle', sub: 'gate.helpfulSub' }");
});

it("'reviews' 컨텍스트·gate.reviews 키 잔존 0 — 전 소스·전 로케일", () => {
  const sheet = readFileSync('src/components/AuthGateSheet.tsx', 'utf8') as string;
  expect(sheet).not.toContain("'risk' | 'reviews'"); // 타입에서 소멸
  expect(sheet).not.toContain('gate.reviewsTitle');
  // 전 소스: AuthGateSheet context="reviews" 잔존 0
  const files = (execFileSync('git', ['ls-files', '*.tsx'], { encoding: 'utf8' }) as string)
    .split('\n')
    .filter((f: string) => f && !f.includes('__tests__'));
  const offenders = files.filter((f: string) => {
    const src = readFileSync(f, 'utf8') as string;
    return src.includes('context="reviews"') || src.includes("context={gateOpen ?? 'reviews'}");
  });
  expect(offenders).toEqual([]);
  // 전 로케일: 구 키 삭제 + 신 키 존재 ("read full reviews" 유물 문구 잔존 0)
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
    const dict = JSON.parse(readFileSync(`src/lib/i18n/${l}.json`, 'utf8'));
    expect(dict.gate.reviewsTitle).toBeUndefined();
    expect(dict.gate.reviewsSub).toBeUndefined();
    expect(typeof dict.gate.helpfulTitle).toBe('string');
    expect(typeof dict.gate.helpfulSub).toBe('string');
  }
  expect(JSON.parse(readFileSync('src/lib/i18n/en.json', 'utf8')).gate.helpfulTitle).toBe('Help great reviews stand out');
});

it('food/[id]/reviews.tsx — 사어 게이트 제거(실개방 setter 부재 실측 — P-235 흔적)', () => {
  const list = readFileSync('src/app/food/[id]/reviews.tsx', 'utf8') as string;
  expect(list).not.toContain('AuthGateSheet');
  expect(list).not.toContain('gateOpen');
});
