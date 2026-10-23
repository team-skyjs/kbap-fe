/**
 * 가공식품 리뷰 작성·수정 (KB-812 2차, P-507) — `/processed-foods/[id]/review[?reviewId=]`.
 * 음식 리뷰 작성 화면을 그대로 쓴다(대상 = 제품, 식당 전용 입력 숨김) — ReviewComposeScreen packaged.
 * 경로 끝 `/review` = OTA 적용 보류·해금 연출 대기 대상(otaPolicy·UnlockCelebrationHost 정규식)이 음식 작성과 같다.
 */
import { Redirect } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { ReviewComposeScreen } from '@/app/food/[id]/review';

export default function PackagedReviewCompose() {
  // 가드는 훅 없는 바깥 컴포넌트에(KB-620 — rules-of-hooks). 쓰기 버튼 플래그(packagedReviewWrite)는 진입 버튼 쪽 — 기존 리뷰 수정은 이 경로로 늘 연다
  // KB-870(Codex #335): 운영 채널 = 가공식품 API 없음 — 직접 링크로 와도 작성 화면 0
  if (!FLAGS.reviewsEnabled || !FLAGS.processedFoodEnabled) return <Redirect href="/" />;
  return <ReviewComposeScreen packaged />;
}
