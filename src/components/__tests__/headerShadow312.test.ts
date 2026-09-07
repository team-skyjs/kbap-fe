/**
 * P-312(KB-479) — 공용 헤더: 그림자 제거·헤어라인 스크롤 시에만·소비처 atTop 배선.
 */
import * as fs from 'fs';

const header = fs.readFileSync('src/components/StickyHeader.tsx', 'utf8');

it('그림자 제거 — shadow.sh1 잔존 0(스타일·임포트)', () => {
  expect(header).not.toContain('shadow.sh1');
  expect(header).not.toContain(", shadow }");
});

it('헤어라인 = 스크롤 시에만 — atTop 공유값·opacity 분기·미전달 = 상시(호환)', () => {
  expect(header).toContain('atTop.value = y <= 0 ? 1 : 0;');
  expect(header).toContain('opacity: atTop ? 1 - atTop.value : 1');
  expect(header).toContain('return { onScroll, hidden, atTop };');
});

it('소비처 전수 — StickyHeader 렌더 수 = atTop 전달 수(경로별 누락 0 — Codex #74 P2)', () => {
  for (const p of ['src/app/(tabs)/index.tsx', 'src/app/(tabs)/food.tsx', 'src/app/(tabs)/profile.tsx', 'src/app/food/[id]/reviews.tsx', 'src/features/community/ReviewFeed.tsx']) {
    const s = fs.readFileSync(p, 'utf8');
    expect(s).toContain('atTop } = useStickyScroll()');
    const headers = (s.match(/<StickyHeader/g) ?? []).length;
    const atTops = (s.match(/atTop=\{atTop\}/g) ?? []).length;
    expect(atTops).toBe(headers); // 정상·로딩·에러 경로 전부
  }
  // SubHeader(비스크롤 모달 화면) = atTop 미전달 상시 헤어라인 — 의도된 예외
});

it('프로필 헤더~아바타 간격 — 시안 실측 정합(아바타 행 = 헤더 바닥 동일선, paddingTop 0)', () => {
  expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).toContain('body: { paddingTop: 0, gap: 20 }');
});
