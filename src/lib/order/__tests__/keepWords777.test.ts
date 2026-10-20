/** KB-777 B1-10: 사장님 카드 한국어 = 어절 안 줄바꿈 금지(U+2060), 공백만 줄바꿈 기회 · 문구 자체는 불변. */
import * as fs from 'fs';
import { keepWordsKo } from '../keepWords';
import { avoidNoticeKo, orderClosingKo, orderSentenceKo } from '../orderCard';

const WJ = '⁠';
it('어절 안 글자 사이에만 결합자 · 공백 보존 · 걷어 내면 원문과 같다(orderCard.ts 문구 불변)', () => {
  const s = '들어간 메뉴가 있으면 알려주세요.';
  const out = keepWordsKo(s);
  expect(out.split(' ')).toEqual(['들⁠어⁠간', '메⁠뉴⁠가', '있⁠으⁠면', '알⁠려⁠주⁠세⁠요⁠.']);
  for (const src of [orderSentenceKo('된장찌개', 2), orderClosingKo(3), avoidNoticeKo(['EGG'])?.sentence ?? '']) {
    expect(keepWordsKo(src).split(WJ).join('')).toBe(src);
  }
  expect(keepWordsKo('김밥')).toBe(`김${WJ}밥`);
  expect(keepWordsKo('')).toBe('');
});
it('카드 한국어 4종(품목 줄·맺음·기피 문장·기피 나열)이 전부 keepWordsKo를 거친다(소스 잠금)', () => {
  const src = fs.readFileSync('src/features/order/FlippedOrderCard.tsx', 'utf8');
  for (const e of ['{keepWordsKo(l)}', '{keepWordsKo(closing)}', '{keepWordsKo(avoid.sentence)}', '{keepWordsKo(avoid.list)}']) expect(src).toContain(e);
});
