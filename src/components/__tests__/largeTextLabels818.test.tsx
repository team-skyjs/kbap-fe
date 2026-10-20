/** KB-818: 큰 글씨에서 잘리던 라벨 — 리뷰 탭 FAB·탭바 라벨 = 한 줄 + 들어가게 축소, 배율 상한은 Txt 공통(1.3). */
import * as fs from 'fs';
import { MAX_FONT_SCALE } from '@/components/Txt';

it('탭바 라벨(4탭 공통 Tab + 스캔 슬롯) 전부 한 줄 + 축소 · Txt 상한 1.3', () => {
  const src = fs.readFileSync('src/components/TabBar.tsx', 'utf8');
  const labelTags = src.match(/<Text style=\{\[styles\.tlbl[^>]*>/g) ?? [];
  expect(labelTags).toHaveLength(2); // Tab(홈·음식·리뷰·프로필) + 스캔 슬롯
  for (const tag of labelTags) expect(tag).toMatch(/numberOfLines=\{1\} adjustsFontSizeToFit/);
  expect(src).not.toMatch(/maxFontSizeMultiplier=\{(?!MAX_FONT_SCALE)/); // 라벨이 Txt 상한을 넓히지 않는다
  expect(MAX_FONT_SCALE).toBe(1.3);
});

it('리뷰 탭 FAB 라벨 = 한 줄 + 축소(Txt 상한 1.3 유지)', () => {
  const src = fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8');
  expect(src).toContain('<Text style={styles.fabLabel} numberOfLines={1} adjustsFontSizeToFit testID="feed-write-fab-label">');
});
