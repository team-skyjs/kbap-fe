/**
 * P-339(KB-494) 실기 피드백 8건 잠금 — 소스 계약 중심(각 항목 1블록).
 */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('① 홈 레일 See all = 텍스트+chevron(점선 카드 소멸)', () => {
  const fx = read('src/features/food/FoodExplorer.tsx');
  expect(fx).not.toContain("borderStyle: 'dashed'");
  expect(fx).toMatch(/seeAllCard: \{ aspectRatio: 174 \/ 203, flexDirection: 'row'[^}]*gap: 2, paddingHorizontal: 12/);
  expect(fx).toMatch(/seeAllText[^}]*\}>\{t\('home\.seeAll'\)\}<\/Text>\s*<IconChevron size=\{16\}/);
});

it('② ⋯ 전 카드 — 탈퇴 리뷰 포함(FeedCard anon 게이트 소멸)·홈 = 신고만·차단은 익명/reportOnly 미노출', () => {
  const fc = read('src/features/review/FeedCard.tsx');
  expect(fc).not.toContain('!anon && showMore');
  const home = read('src/app/(tabs)/index.tsx');
  expect(home).not.toContain('showMore={false}');
  expect(home).toContain('reportOnly: true');
  expect(home).toContain('<ModerationFlow');
  const mod = read('src/features/community/moderation.tsx');
  expect(mod).toContain('!isGuest && !target.anonymized && !target.reportOnly');
  const rf = read('src/features/community/ReviewFeed.tsx');
  expect(rf).toContain('anonymized: item.anonymized === true');
  // Codex #100 P2 ①: 상세 프리뷰 showMore 게이트 잔존 제거 — showMore prop 소비처 0(기본 true)
  const fd = read('src/app/food/[id]/index.tsx');
  expect(fd).not.toContain('showMore={');
  expect(fd).toContain('anonymized: r.anonymized === true');
});

it('③ Helpful 폭 고정 — 고스트(99+) 예약 + tabular-nums + 실라벨 absolute 중앙 + ≥100 컴팩트', () => {
  const rc = read('src/features/review/ReviewCellParts.tsx');
  expect(rc).toContain("count: '99+' as unknown as number"); // 고스트 = 최대 표기 예약
  expect(rc).toContain("(review.likes ?? 0) > 99 ? '99+'"); // Codex #100 P2: 컴팩트 표기
  expect(rc).toContain("helpfulGhost: { opacity: 0, fontVariant: ['tabular-nums'] }");
  expect(rc).toContain("helpfulReal: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontVariant: ['tabular-nums'] }");
});

it('④ 지도 로고 공식 CI — 네이버 N(#03C75A 바탕 흰 N)·카카오 #FEE500 위 검정', () => {
  const pm = read('src/features/community/placeMap.tsx');
  expect(pm).toContain("bg: '#03C75A'");
  expect(pm).toContain("bg: '#FEE500', text: '#000000'");
  const da = read('src/components/design4Assets.tsx');
  expect(da).toMatch(/BrandNaver = \(\{ height = 24, color = '#FFFFFF' \}/);
  expect(da).toContain('fill="#000000" transform="matrix(1,0,0,1,7,8)"');
});

it('⑤ 북마크 상단 토스트 — 공용 호스트(루트 1개) + 토글 뮤테이션 한 곳 발화(기존 키 재사용)', () => {
  const layout = read('src/app/_layout.tsx');
  expect(layout).toContain('<TopToastHost />');
  const bm = read('src/lib/data/bookmarks.ts');
  expect(bm).toContain("showTopToast(i18n.t(add ? 'saved.toast' : 'saved.removed'))");
  expect(bm).toContain("showTopToast(i18n.t('saved.error'))");
  const tt = read('src/components/TopToast.tsx');
  expect(tt).toContain("top: insets.top + 56 + 8"); // 헤더 아래 고정
});

it('⑤-b 토스트 호스트 동작 — showTopToast → 렌더, 1.5s 후 소멸', () => {
  jest.useFakeTimers();
  const React = require('react') as typeof import('react');
  const renderer = require('react-test-renderer') as typeof import('react-test-renderer');
  const { act } = renderer;
  jest.doMock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
  const { TopToastHost, showTopToast } = require('@/components/TopToast');
  let tree!: import('react-test-renderer').ReactTestRenderer;
  act(() => { tree = renderer.create(React.createElement(TopToastHost)); });
  act(() => { showTopToast('저장됨'); });
  expect(tree.root.findAll((n) => n.props?.testID === 'top-toast').length).toBeGreaterThanOrEqual(1);
  act(() => { jest.advanceTimersByTime(1600); });
  expect(tree.root.findAll((n) => n.props?.testID === 'top-toast')).toHaveLength(0);
  jest.useRealTimers();
});

it('⑥ 로그인 버튼 radius 통일 — Apple cornerRadius 4(=Google r4)', () => {
  const sb = read('src/components/SocialAuthButtons.tsx');
  expect(sb).toContain('cornerRadius={4}');
  expect(sb).not.toContain('cornerRadius={14}');
});

it('⑧ Edit restrictions 프리셋 채우기 소멸 — applyRow·시트·키 0(온보딩 프리셋 단계 무변)', () => {
  const rs = read('src/app/profile/restrictions.tsx');
  expect(rs).not.toContain('preset-open');
  expect(rs).not.toContain('presetSel');
  expect(rs).not.toContain('applyRow');
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    expect(read(`src/lib/i18n/${loc}.json`)).not.toContain('applyRow');
  }
  // 온보딩 프리셋 단계는 무접촉
  expect(read('src/app/onboarding/index.tsx')).toContain('PresetsStep');
});
