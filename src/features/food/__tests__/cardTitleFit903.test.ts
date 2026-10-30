/** KB-903(T-033·T-057) → KB-909(Q-367): 카드 제목 = 자동 축소 없음 · 2줄 + 말줄임(이웃 카드와 같은 글자 크기).
 *  구 KB-903 "넘치면 줄이기"는 2줄에 들어가면 축소가 안 걸려 "Jajangmyeo / n"을 못 막았고, 한 카드("Spicy Crab")만 작아지는 부작용이 있었다. */
import * as fs from 'fs';

it('공통 규칙 = 2줄 + 말줄임 · 자동 축소 0 · 홈 카드 이름·검색 Popular 카드 이름 같은 규칙', () => {
  const cards = fs.readFileSync('src/features/food/FoodCards.tsx', 'utf8');
  expect(cards).toContain("export const CARD_TITLE = { numberOfLines: 2, ellipsizeMode: 'tail' } as const;");
  expect(cards).toContain('<Text style={styles.gname} {...CARD_TITLE}>');
  expect(cards).not.toMatch(/adjustsFontSizeToFit|CARD_TITLE_FIT/);
  const search = fs.readFileSync('src/app/search.tsx', 'utf8');
  expect(search).toContain('<Text style={styles.popCardName} {...CARD_TITLE}>{f.name}</Text>');
  expect(search).not.toMatch(/CARD_TITLE_FIT|adjustsFontSizeToFit/);
});
