/** KB-909 Q-367 — 글자 상향 뒤 XXL: ① 홈 칩 줄 두 줄 넘김 ② Food 탭 칩이 정렬 버튼 폭만큼 좁아져 잘려 보임 */
import * as fs from 'fs';

const src = fs.readFileSync('src/features/food/FoodExplorer.tsx', 'utf8');

it('① 칩 줄 = 홈·Food 탭 모두 한 줄 가로 스크롤(줄바꿈 칩 그룹 0)', () => {
  expect(src).not.toMatch(/chipGroup|flexWrap: 'wrap', gap: 6 \}/);
  expect(src.match(/<ScrollView\s+ref=\{chipScrollRef\}\s+horizontal/g)).toHaveLength(1); // 두 변형이 같은 스크롤 하나
  expect(src).toContain("<View style={variant === 'screen' ? styles.chipRowScreen : styles.chipRowHome}>");
  expect(src).toContain("{variant === 'screen' && <Chip label={t('saved.title')}"); // Saved 칩은 Food 탭만(홈 무변)
});

it('② 큰 글씨(fontScale > 1) = 정렬 버튼 자기 줄(칩 줄 전폭) · 기본 = 한 줄', () => {
  expect(src).toContain('export const sortOnOwnRow = (fontScale: number): boolean => fontScale > 1;'); // 기본(1) = 한 줄 · iOS XXL(1.235) = 자기 줄
  expect(src).toContain("<View style={variant === 'screen' && !sortOwnRow ? styles.chipLineWrap : styles.chipLineFull}>");
  expect(src).toMatch(/chipRowScreen: \{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end'/); // 자기 줄로 내려가면 오른쪽 정렬
});
