/**
 * ingredientImages (P-145) — 회피 재료 타일 실사진 URL 조립.
 *
 * 경로 규칙(정본: 2026-08-07 회피재료 81종 이미지 목록): BE avoidance_substance
 * code 1:1 — `images/webp/ingredients/{code 소문자}.webp` (예: PINE_NUT →
 * pine_nut.webp). 81종 전수 CloudFront 200 실측(커맨드 센터 8/10).
 * ⚠️ S3 직링크 403 — 반드시 CloudFront 경유(P-140 방침).
 *
 * 후속 스왑 지점(회의 안건 A-3): BE 카탈로그 API에 imageRef가 붙으면 이 조립을
 * **서버값 우선**으로 전환한다 — 호출처는 이 함수만 쓰므로 여기 한 곳 교체.
 */
const CDN_BASE = 'https://d29c1cr2ng7w0.cloudfront.net/';

export function ingredientImageUrl(code: string): string {
  return `${CDN_BASE}images/webp/ingredients/${code.toLowerCase()}.webp`;
}

/** P-341(KB-502): 배경 제거본(알파 webp 512², 81/81 CDN 200) — 체인 선두.
 *  404/실패 시 기존 체인(원본 → 조립 → 색)으로 자연 폴백. BE image_path가
 *  ingredients-cut로 마이그레이션되면(종한 릴리스) 이 선두는 제거 가능(TODO). */
export function ingredientCutoutUrl(code: string): string {
  return `${CDN_BASE}images/webp/ingredients-cut/${code.toLowerCase()}.webp`;
}
