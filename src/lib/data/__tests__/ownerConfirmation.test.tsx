/**
 * P-163: 사장님 카드 폴백 — 회피 실나열 + 서브라인 무단정(회피≠알레르기).
 * ingredient 파라미터 경로·회피 0·전부 미해석은 현행(일반 질문+기존 서브라인) 유지.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => ({ data: { nameKo: '김치찌개' } }) }));
const mockMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockMe() }));

import { useOwnerConfirmation } from '../useOwnerConfirmation';

let out: ReturnType<typeof useOwnerConfirmation>;
function Probe({ ing }: { ing?: string }) {
  out = useOwnerConfirmation('7', ing);
  return null;
}
const render = (ing?: string) => {
  act(() => {
    renderer.create(<Probe ing={ing} />);
  });
};
const ME = (codes: string[]) => ({ data: { restrictions: codes.map((code) => ({ kind: 'allergy', code })) } });

it('회피 보유 폴백: 재료 나열 질문 + 무단정 서브라인', () => {
  mockMe.mockReturnValue(ME(['SHRIMP', 'EGG']));
  render();
  expect(out.data?.questionKo).toBe('김치찌개에 새우, 달걀이 들어가나요?');
  expect(out.data?.explanationKo).toBe('저는 이 재료들을 먹지 못해요. 확인 부탁드려요.');
  expect(out.data?.explanationKo).not.toContain('알레르기');
});

it('회피 0: 현행 일반 질문 + 기존 서브라인 유지', () => {
  mockMe.mockReturnValue(ME([]));
  render();
  expect(out.data?.questionKo).toBe('김치찌개에 제가 못 먹는 재료가 들어가나요?');
  expect(out.data?.explanationKo).toBe('저는 음식 알레르기가 있어서 확인이 필요해요.');
});

it('회피가 전부 미해석 코드: 나열 불성립 — 일반 질문 + 기존 서브라인(문구-질문 불일치 방지)', () => {
  mockMe.mockReturnValue(ME(['UNKNOWN_X']));
  render();
  expect(out.data?.questionKo).toBe('김치찌개에 제가 못 먹는 재료가 들어가나요?');
  expect(out.data?.explanationKo).toBe('저는 음식 알레르기가 있어서 확인이 필요해요.');
});

it('ingredient 파라미터 경로 무변: 특정 재료 질문 + 기존 서브라인', () => {
  mockMe.mockReturnValue(ME(['SHRIMP', 'EGG']));
  render('SHRIMP');
  expect(out.data?.questionKo).toBe('김치찌개에 새우가 들어가나요?');
  expect(out.data?.explanationKo).toBe('저는 음식 알레르기가 있어서 확인이 필요해요.');
});
