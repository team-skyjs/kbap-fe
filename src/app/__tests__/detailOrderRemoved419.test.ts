/**
 * KB-419: 음식 상세 주문 고아 라우트 청산 잠금 — 주문은 메뉴판 스캔 → 주문
 * 카드에서만(예진 9/4). 인앱 진입은 P-162(c75bce1)에서 이미 소멸했고, 여기서
 * 라우트 파일까지 제거해 딥링크 도달(스캔 사진 없는 POST /api/orders — imagePath
 * 필수 400 유실 경로)을 차단한다. 상세 하단 = askOwner CTA(P-228)·본문 리뷰
 * 버튼 현행 유지.
 */
import * as fs from 'fs';
import * as path from 'path';

it('상세 주문 라우트 파일 부재 — 부활 금지', () => {
  expect(fs.existsSync('src/app/food/[id]/order.tsx')).toBe(false);
});

it('상세 화면 그룹에서 주문 라우트 내비게이션 0', () => {
  const dir = 'src/app/food/[id]';
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8') as string;
    expect(src).not.toMatch(/\/order['"`]/); // scan-order는 이 그룹 밖 — 무관
  }
});

it('FlippedOrderCard — 상세 전용 stepper 슬롯 소멸·스캔 주문 배선(fx·imagePath) 유지', () => {
  const card = fs.readFileSync('src/features/order/FlippedOrderCard.tsx', 'utf8') as string;
  expect(card).not.toContain('stepper');
  expect(card).toContain('orderImagePath'); // P-252 스캔 이력 식별자 — 유일 경로
  expect(fs.readFileSync('src/app/scan-order.tsx', 'utf8')).toContain('FlippedOrderCard');
});
