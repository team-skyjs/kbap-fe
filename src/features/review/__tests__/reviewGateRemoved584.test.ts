/**
 * P-392(KB-584) — 리뷰 자격 게이트 제거. 회원이면 스캔 여부와 무관하게 리뷰 작성.
 *
 * BE #274: `reviewEligible`은 **항상 true**(구 앱 호환 필드)이고 `REVIEW-004`는 더 오지 않는다.
 * 여기서 잠그는 것 = 자격 분기·안내가 **한 군데도 남지 않았다** + 게스트 게이트는 그대로.
 */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

const GATE_SURFACES = [
  'src/app/food/[id]/index.tsx', // 상세 — 하단 바 + Registered 내부 2곳
  'src/app/food/[id]/reviews.tsx', // 리뷰 목록(발주에 없던 3번째 지점)
  'src/app/food/[id]/review.tsx', // 작성 화면 — 403 REVIEW-004 매핑
  'src/app/community/compose.tsx', // 픽커 — 스캔분 외 비활성
];

describe('자격 분기 잔재 0', () => {
  it.each(GATE_SURFACES)('%s — reviewEligible 분기·EligibilityGate 없음', (f) => {
    const src = read(f);
    expect(src).not.toContain('reviewEligible === false');
    expect(src).not.toContain('EligibilityGate');
  });

  it('REVIEW-004 매핑 제거 — 서버가 더 던지지 않는다(오면 일반 실패로 표면화)', () => {
    expect(read('src/app/food/[id]/review.tsx')).not.toContain('REVIEW-004');
  });

  it('자격 안내 시트 컴포넌트 자체가 삭제됐다', () => {
    const fs = require('fs') as typeof import('fs');
    expect(fs.existsSync('src/features/review/EligibilityGate.tsx')).toBe(false);
  });

  it('미사용이 된 자격 문구 2키를 10로케일에서 제거', () => {
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { community: Record<string, string> };
      expect(j.community.reviewEligibleNote).toBeUndefined();
      expect(j.community.goScanCta).toBeUndefined();
    }
  });
});

describe('유지되는 것', () => {
  it('게스트 게이트는 그대로 — 가입 유도가 자격 게이트와 함께 사라지면 안 된다', () => {
    // 작성 화면 진입 = 게스트면 가입 게이트(자격 게이트와 별개 축 — 그대로 남아야 한다)
    expect(read('src/app/food/[id]/review.tsx')).toContain('context="writeReview"');
    expect(read('src/app/food/[id]/index.tsx')).toContain('AuthGateSheet'); // 상세의 다른 게스트 게이트도 유지
  });

  it('와이어 타입은 남긴다(구 서버 응답 방어) — 소비처만 0', () => {
    expect(read('src/lib/api/foodDetailTypes.ts')).toContain('reviewEligible');
    expect(read('src/lib/api/types.ts')).toContain('reviewEligible');
    // 어댑터는 값을 통과시키되 화면이 읽지 않는다
    expect(read('src/lib/api/foodAdapter.ts')).toContain('reviewEligible');
  });

  it('픽커: 스캔 목록은 빠른 선택으로 유지 · 검색은 전체 범위', () => {
    const cp = read('src/app/community/compose.tsx');
    expect(cp).toContain('sectionRecentlyScanned'); // 스캔분 구역 유지
    expect(cp).toContain("const searchScope = useScanScope && !searchAll && !isReview ? ('scanned' as const) : undefined;");
    expect(cp).not.toContain('flashNotice'); // 비활성 탭 강조 로직 소멸
  });
});
