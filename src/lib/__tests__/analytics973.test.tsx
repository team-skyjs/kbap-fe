/**
 * KB-973(P-584) 가공식품 출시 계측 보강 — 등록·속성(ALLOWED)·상세 출처 판정·세그먼트/리뷰 필터·편의점 카드 노출·이름 인식 실패.
 * 촬영 시작·확정 실패는 scanDesign(실제 스캔 화면)에서.
 */
import { EVENTS, packagedDetailSource } from '../analytics';

describe('등록', () => {
  it('새 이벤트 4종 = 도메인 접두(food·review) · 기존 이벤트 이름 그대로', () => {
    expect(EVENTS.food_packaged_scan_start).toBe('food_packaged_scan_start');
    expect(EVENTS.food_packaged_scan_fail).toBe('food_packaged_scan_fail');
    expect(EVENTS.food_segment_select).toBe('food_segment_select');
    expect(EVENTS.review_feed_target_select).toBe('review_feed_target_select');
    for (const kept of ['scan_start', 'food_packaged_scan_confirm', 'food_packaged_scan_name', 'food_packaged_detail_view', 'home_card_view'] as const) expect(EVENTS[kept]).toBe(kept);
  });
});

describe('상세 진입 출처', () => {
  it('앱 안 태그 4종 그대로 · 스캔 확정(scan=1) = scan · 태그 없음·모르는 값 = deeplink', () => {
    for (const s of ['search', 'home_cvs', 'list', 'review'] as const) expect(packagedDetailSource(s, undefined)).toBe(s);
    expect(packagedDetailSource(undefined, '1')).toBe('scan');
    expect(packagedDetailSource(undefined, undefined)).toBe('deeplink');
    expect(packagedDetailSource('evil<script>', undefined)).toBe('deeplink'); // 임의 문자열은 실리지 않는다
  });
});
