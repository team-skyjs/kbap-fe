/** KB-926 — ① 리본 그림자 = 리본 실루엣 경로(직사각형 View 그림자 0) ② 검색 스캔 버튼 = 둥근 사각(md) ③ 정렬 알약 좌우 = 필터 칩 14 */
import * as fs from 'fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('KB-926', () => {
  it('① 리본 그림자: 컨테이너 View 그림자 0(shadow·elevation) · 같은 RIBBON 경로를 뒤 Svg에 · flat이면 그림자 없음', () => {
    const rb = read('src/components/RiskBadge.tsx');
    expect(rb).not.toMatch(/shadow\.sh|elevation|shadowOpacity/);
    expect(rb).toMatch(/\{!flat && \([\s\S]*testID="risk-badge-shadow"[\s\S]*<Path d=\{RIBBON\} fill="#000000"/);
    expect(read('src/lib/theme.ts')).not.toContain('shBadge');
  });
  it('② SearchScanButton = radius.md(KB-909 직전 8 → 토큰), 원형 0', () => {
    expect(read('src/features/food/FoodExplorer.tsx')).toMatch(/scanBtn: \{ width: 48, height: 48, borderRadius: radius\.md,/);
  });
  it.each(['src/app/scan.tsx', 'src/app/food/[id]/reviews.tsx', 'src/features/food/FoodExplorer.tsx', 'src/features/community/ReviewFeed.tsx'])(
    '③ 정렬 알약 좌우 14 = Chip paddingHorizontal: %s',
    (p) => {
      const chipPad = Number(/chip: \{[^}]*paddingHorizontal: (\d+)/.exec(read('src/components/Chip.tsx'))![1]);
      const line = read(p).split('\n').find((l) => l.startsWith('  sortBtn:'))!;
      expect(Number(/paddingHorizontal: (\d+)/.exec(line)![1])).toBe(chipPad);
    },
  );
});
