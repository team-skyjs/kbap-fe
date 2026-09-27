/**
 * KB-500 — 리뷰 리마인더 서버 전환 잠금.
 * 서버 배치가 주문 저장 60~65분 뒤 REVIEW_REMINDER{orderId}를 보내므로 앱의 로컬 예약 경로는 **존재하지 않아야** 한다
 * (남아 있으면 사용자가 1시간 뒤 같은 알림을 두 번 받는다). 복원 회귀를 소스 잠금으로 잡는다.
 */
// 어댑터가 AsyncStorage(프라이머 기록)를 정적 import — 순수 매핑만 쓰지만 로드 위해 jest 목
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import fs from 'fs';
import { routeForNotificationData } from '../pushAdapter';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];

it('어댑터에 로컬 예약 API·저장 키·대기 상수 0건', () => {
  const adapter = read('src/lib/push/pushAdapter.ts');
  for (const w of ['scheduleNotificationAsync', 'cancelScheduledNotificationAsync', 'kbap.push.reminders', 'REVIEW_REMINDER_SECONDS', 'scheduleReviewReminder', 'cancelReviewReminder']) {
    expect(adapter).not.toContain(w);
  }
});

it('호출부 0건 — 주문 완료 카드·리뷰 작성 화면', () => {
  expect(read('src/features/order/FlippedOrderCard.tsx')).not.toContain('scheduleReviewReminder');
  expect(read('src/app/food/[id]/review.tsx')).not.toContain('cancelReviewReminder');
});

it('10로케일 push.reviewReminderTitle/Body 부재(문구는 서버가 기기 언어로 발송)', () => {
  for (const l of LOCALES) {
    const push = (JSON.parse(read(`src/lib/i18n/${l}.json`)) as { push?: Record<string, unknown> }).push ?? {};
    expect(push).not.toHaveProperty('reviewReminderTitle');
    expect(push).not.toHaveProperty('reviewReminderBody');
  }
});

it('구 로컬 알림 잔존(foodId만) 탭 = 이동 없음 · orderId면 주문 상세', () => {
  expect(routeForNotificationData({ type: 'REVIEW_REMINDER', foodId: 7 })).toBeNull();
  expect(routeForNotificationData({ type: 'REVIEW_REMINDER', orderId: 12 })).toBe('/profile/order/12');
});
