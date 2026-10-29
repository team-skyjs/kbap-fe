/**
 * KB-870 OTA2 — 승인한 3종 공개와 PF/리뷰 경계. expo-updates channel 목 → flags.ts·리뷰 헤더·회피 카탈로그 **모듈 실계산**(개별 플래그 목 0).
 * production(운영 서버) = 큐레이션·K-pop·회피6 ON, PF3종 OFF + 리뷰 조회 헤더 없음(기본 1.1) /
 * teamtest = 사용자 승인 prod 리허설, development = dev 기능 유지. 가공식품 리뷰 엔드포인트는 채널 무관 3.2.
 */
import * as fs from 'fs';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));

const GROUP = ['NUTS', 'CRUSTACEAN', 'MOLLUSK', 'MEAT', 'LAMB', 'MEAT_BROTH'];

function load(channel: string) {
  let out!: {
    flags: typeof import('@/lib/flags');
    reviews: typeof import('@/lib/data/useFoodReviews');
    ing: typeof import('@/lib/mocks/ingredients');
    presets: typeof import('@/lib/onboarding/dietPresets');
  };
  jest.isolateModules(() => {
    jest.doMock('expo-updates', () => ({ channel }));
    out = {
      flags: jest.requireActual('@/lib/flags'),
      reviews: jest.requireActual('@/lib/data/useFoodReviews'),
      ing: jest.requireActual('@/lib/mocks/ingredients'),
      presets: jest.requireActual('@/lib/onboarding/dietPresets'),
    };
  });
  return out;
}

describe('production 채널(운영 서버)', () => {
  const m = load('production');
  it('승인한 3종만 ON · PF3종 OFF · 공용 dev 서버 게이트 OFF', () => {
    const F = m.flags.FLAGS;
    expect([F.curationEnabled, F.processedFoodEnabled, F.idolPicksEnabled, F.avoidGroupCodesEnabled]).toEqual([true, false, true, true]);
    expect([F.packagedLabelScan, F.packagedReviewWrite]).toEqual([false, false]);
    expect(m.flags.isDevServerChannel()).toBe(false);
  });
  it('리뷰 조회 = 버전 헤더 없음(운영 기본 1.1 유지) · 가공식품 리뷰 엔드포인트는 3.2 고정', () => {
    expect(m.reviews.REVIEW_READ_HEADERS).toBeUndefined();
    expect(m.reviews.PROCESSED_REVIEW_HEADERS).toEqual({ headers: { 'X-API-Version': '3.2' } });
  });
  it('회피6 와이어·타일·레거시·프리셋 활성화 및 기존 1기반 배열 보존', () => {
    for (const c of GROUP) expect(m.ing.BE_CODES.has(c)).toBe(true);
    expect(m.ing.BE_CODES.size).toBe(87);
    expect(m.ing.INGREDIENT_SECTIONS.flatMap((s) => s.codes).filter((c) => GROUP.includes(c)).sort()).toEqual([...GROUP].sort());
    expect(m.ing.INGREDIENT_SECTIONS.flatMap((s) => s.codes)).toHaveLength(87);
    expect(m.ing.toBeCode('ing:lamb')).toBe('LAMB');
    expect(m.ing.toBeCode('NUTS')).toBe('NUTS');
    expect(m.ing.INGREDIENTS).toHaveLength(87); // 프리셋 1-기반 위치 참조 보존
    const vegan = m.presets.DIET_PRESETS.find((p) => p.id === 'VEGAN')!;
    const shell = m.presets.DIET_PRESETS.find((p) => p.id === 'SHELLFISH_ALLERGY')!;
    expect(m.presets.presetSubstanceCodes(vegan).filter((c) => GROUP.includes(c))).toEqual(['MEAT', 'LAMB']);
    expect(m.presets.presetSubstanceCodes(shell).filter((c) => GROUP.includes(c))).toEqual(['CRUSTACEAN', 'MOLLUSK']);
    const nuts = m.presets.DIET_PRESETS.find((p) => p.id === 'NUT_ALLERGY')!;
    expect(m.presets.presetSubstanceCodes(nuts)).not.toContain('NUTS');
    expect(m.presets.presetSubstanceCodes(vegan)).toContain('BEEF'); // 나머지는 그대로
  });
});

// P-524 후속(커맨드 10/22): 운영 서버를 쓰는 채널 전부 명시 — production만으론 preview·teamtest-prod가 같은 게이트인지 잠기지 않는다
describe.each(['preview', 'teamtest-prod'])('%s 채널(운영 서버) = production과 같은 선택 공개', (channel) => {
  const m = load(channel);
  it('3종 ON/PF3종 OFF · 리뷰1.1 · 묶음6 노출', () => {
    const F = m.flags.FLAGS;
    expect([F.curationEnabled, F.processedFoodEnabled, F.idolPicksEnabled, F.avoidGroupCodesEnabled]).toEqual([true, false, true, true]);
    expect(m.reviews.REVIEW_READ_HEADERS).toBeUndefined();
    expect([F.packagedLabelScan, F.packagedReviewWrite, m.flags.isDevServerChannel()]).toEqual([false, false, false]);
    for (const c of GROUP) expect(m.ing.BE_CODES.has(c)).toBe(true);
  });
});

describe('development 채널(dev 서버) — 동작 무변', () => {
  const m = load('development');
  it('플래그 4종 켜짐 · 리뷰 조회 3.2 · 묶음 6코드 노출(87)', () => {
    const F = m.flags.FLAGS;
    expect([F.curationEnabled, F.processedFoodEnabled, F.idolPicksEnabled, F.avoidGroupCodesEnabled]).toEqual([true, true, true, true]);
    expect(m.reviews.REVIEW_READ_HEADERS).toEqual({ headers: { 'X-API-Version': '3.2' } });
    for (const c of GROUP) expect(m.ing.BE_CODES.has(c)).toBe(true);
    expect(m.ing.INGREDIENT_SECTIONS.flatMap((s) => s.codes)).toHaveLength(87);
    expect(m.ing.toBeCode('ing:lamb')).toBe('LAMB');
    expect(m.presets.presetSubstanceCodes(m.presets.DIET_PRESETS.find((p) => p.id === 'VEGAN')!)).toEqual(expect.arrayContaining(['MEAT', 'LAMB']));
  });
});

describe('teamtest 채널 — KB-894: 기존 설치본 dev 서버(KB-870 prod 리허설을 되돌림)', () => {
  const current = load('teamtest'); const development = load('development');
  it('전체 제품 FLAGS가 development와 같고(dev 기능 ON) 진단 정책은 유지한다', () => {
    expect(current.flags.FLAGS).toEqual(development.flags.FLAGS);
    expect(current.flags.isDevServerChannel()).toBe(true);
    expect(current.flags.isDiagnosticChannel()).toBe(true);
    expect(current.flags.isProdChannel()).toBe(false);
    expect(current.reviews.REVIEW_READ_HEADERS).toEqual({ headers: { 'X-API-Version': '3.2' } });
    for (const code of GROUP) expect(current.ing.BE_CODES.has(code)).toBe(true);
  });
});

describe('표면 게이트(소스·라우트)', () => {
  it('직접 경로도 막힘: 큐레이션 상세·/idol-picks·가공식품 상세 = 플래그 꺼지면 홈으로', () => {
    for (const [file, flag] of [['src/app/curations/[key].tsx', 'curationEnabled'], ['src/app/idol-picks.tsx', 'idolPicksEnabled'], ['src/app/processed-foods/[id].tsx', 'processedFoodEnabled']] as const) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).toMatch(new RegExp(`export default FLAGS\\.${flag} \\? \\w+ : GoneHome;`));
      expect(src).toContain('const GoneHome = () => <Redirect href="/" />;');
    }
  });
  it('Codex #335: 가공식품 리뷰 작성 경로도 직접 링크 차단', () => {
    expect(fs.readFileSync('src/app/processed-foods/[id]/review.tsx', 'utf8')).toContain('if (!FLAGS.reviewsEnabled || !FLAGS.processedFoodEnabled) return <Redirect href="/" />;');
  });
  it('음식 탭 세그먼트·스캔 모드 탭 = processedFoodEnabled · 상세 K-pop 카드 = idolPicksEnabled · 홈 = 두 플래그', () => {
    const food = fs.readFileSync('src/app/(tabs)/food.tsx', 'utf8');
    expect(food).toContain('const segRow = FLAGS.processedFoodEnabled ? <FoodSegmentRow');
    expect(food).toContain("{segRow && foodSegment === 'packaged' ? (");
    const scan = fs.readFileSync('src/app/scan.tsx', 'utf8');
    expect(scan.match(/<ScanModeTabs /g)).toHaveLength(2);
    expect(scan.match(/\{FLAGS\.processedFoodEnabled && \(\s*<View style=\{\[styles\.camModeTabs/g)).toHaveLength(2);
    const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8');
    expect(home).toContain('{FLAGS.idolPicksEnabled && <IdolPickBanner />}{FLAGS.curationEnabled && <CurationSection />}');
    const idol = fs.readFileSync('src/lib/data/useIdolPicks.ts', 'utf8');
    expect(idol).toContain('if (!FLAGS.idolPicksEnabled) return null;');
    // 가공식품 리뷰 작성은 조회 헤더가 아니라 3.2 고정 상수
    const mut = fs.readFileSync('src/lib/data/useReviewMutations.ts', 'utf8');
    expect(mut).toContain('PROCESSED_REVIEW_HEADERS, //');
    expect(mut).not.toContain('REVIEW_READ_HEADERS');
  });
});
