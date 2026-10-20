/** KB-777 A2-13: 피드 정렬 "Most reviewed dishes"가 무엇을 정렬하는지 헷갈렸다 — "리뷰 많은 음식 먼저"로(인기 척도 'Popular' 금지). */
import * as fs from 'fs';

it('en·ko 확정 문구 · 10언어 존재 · Popular/인기 단어 0', () => {
  const get = (l: string) => (JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')) as { reviews: Record<string, string> }).reviews.sort_food_review_count;
  expect([get('en'), get('ko')]).toEqual(['Most-reviewed dishes first', '리뷰 많은 음식 순']);
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
    expect(get(l)).toBeTruthy();
    expect(get(l)).not.toMatch(/popular|인기|人気|热门|熱門|populares|populer|популяр|ยอดนิยม|phổ biến/i);
  }
});
