/** KB-903(T-033·T-057): 큰 글자에서 카드 제목이 단어 중간에서 꺾이거나("Jajangmyeo / n") 한 줄로 잘렸다("Seasoned Co…") — 두 줄 + 넘치면 줄이기 */
import * as fs from 'fs';
import { CARD_TITLE_FIT } from '../FoodCards';

it('공통 규칙 = 줄이기(최소 0.75) · 홈 카드 이름(2줄)·검색 Popular 카드 이름(1줄 → 2줄) 모두 같은 규칙', () => {
  expect(CARD_TITLE_FIT).toEqual({ adjustsFontSizeToFit: true, minimumFontScale: 0.75 });
  expect(fs.readFileSync('src/features/food/FoodCards.tsx', 'utf8')).toContain('<Text style={styles.gname} numberOfLines={2} {...CARD_TITLE_FIT}>');
  const search = fs.readFileSync('src/app/search.tsx', 'utf8');
  expect(search).toContain('<Text style={styles.popCardName} numberOfLines={2} {...CARD_TITLE_FIT}>{f.name}</Text>');
  expect(search).not.toContain('<Text style={styles.popCardName} numberOfLines={1}>');
});
