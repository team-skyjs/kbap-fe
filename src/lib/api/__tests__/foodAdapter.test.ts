/**
 * foodAdapter — 상세 bookmarked 매핑 (KB-142 후속, 계약 갭 해소 2026-07-15).
 * 서버 필드가 저장 버튼의 진실이 됐으므로 true/false/누락(방어) 매핑을 잠근다.
 */
import { adaptFoodDetail } from '../foodAdapter';
import type { FoodDetailWire } from '../foodDetailTypes';

const WIRE: FoodDetailWire = {
  name: 'Bibimbap',
  koreanName: '비빔밥',
  imageRef: null,
  description: 'rice bowl',
  spiciness: 2,
  bookmarked: false,
  overallRiskStatus: 'SAFE',
  ingredients: [],
};

it('bookmarked true/false가 그대로 매핑된다', () => {
  expect(adaptFoodDetail({ ...WIRE, bookmarked: true }, '7').bookmarked).toBe(true);
  expect(adaptFoodDetail({ ...WIRE, bookmarked: false }, '7').bookmarked).toBe(false);
});

it('bookmarked 누락/비불리언은 false로 방어 (비회원 조회 = 항상 false 계약)', () => {
  const noField = { ...WIRE } as Partial<FoodDetailWire>;
  delete noField.bookmarked;
  expect(adaptFoodDetail(noField as FoodDetailWire, '7').bookmarked).toBe(false);
});
