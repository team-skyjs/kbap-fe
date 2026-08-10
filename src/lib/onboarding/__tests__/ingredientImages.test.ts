/**
 * P-145: 회피 타일 실사진 URL 조립 잠금 — 소문자 변환·언더스코어 코드·CloudFront 경유.
 */
import { ingredientImageUrl } from '../ingredientImages';
import { INGREDIENT_SECTIONS } from '@/lib/mocks/ingredients';

it('URL 조립 — code 소문자 + webp, CloudFront 경유(S3 직링크 금지)', () => {
  expect(ingredientImageUrl('PINE_NUT')).toBe('https://d29c1cr2ng7w0.cloudfront.net/images/webp/ingredients/pine_nut.webp');
  expect(ingredientImageUrl('EGG')).toBe('https://d29c1cr2ng7w0.cloudfront.net/images/webp/ingredients/egg.webp');
});

it('전 카탈로그 코드가 유효한 URL 형식으로 조립된다 (81종)', () => {
  const codes = INGREDIENT_SECTIONS.flatMap((s) => s.codes);
  expect(codes.length).toBeGreaterThanOrEqual(80);
  for (const c of codes) {
    expect(ingredientImageUrl(c)).toMatch(/^https:\/\/d29c1cr2ng7w0\.cloudfront\.net\/images\/webp\/ingredients\/[a-z0-9_]+\.webp$/);
  }
});
