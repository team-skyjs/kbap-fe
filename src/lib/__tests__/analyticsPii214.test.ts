/**
 * P-214(KB-316): 계측 2차 확장 — 🔒 검색어 PII 교정(카탈로그 매칭 시에만 전송)·
 * 신규 이벤트 화이트리스트·금지 키 드롭·공용 지점 단일 배선 소스 잠금.
 */
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));

import { EVENTS, sanitize } from '../analytics';
import { searchKeywordProps } from '../search/keywordPrivacy';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

describe('① 🔒 검색어 PII 교정', () => {
  it('자유 텍스트(미매칭) = keyword 자체 미생성 + matched:false·길이 버킷만', () => {
    const p = searchKeywordProps('내 여자친구 땅콩 알러지 있는데 뭐 먹지', []);
    expect(p.matched).toBe(false);
    expect('keyword' in p).toBe(false); // 생략 ≠ 빈 문자열
    expect(p.len_bucket).toBe('11+');
    // 어댑터 통과 후에도 자유 텍스트 없음
    expect(sanitize(EVENTS.search_query, { ...p })).toEqual({ matched: false, len_bucket: '11+', result_count: 0 });
  });

  it('카탈로그 매칭 = 매칭된 카탈로그 값 전송(사용자 원문 아님 — 오타·문장 유출 0)', () => {
    const exact = searchKeywordProps('  Peanut  ', []);
    expect(exact).toMatchObject({ matched: true, keyword: 'peanut' });
    // 결과 음식명 매칭(서버 카탈로그 값)
    const food = searchKeywordProps('kimchi', ['Kimchi Stew', '김치찌개']);
    expect(food.matched).toBe(true);
    expect(food.keyword).toBe('kimchi stew'); // 접두 매칭 시 전송값 = 카탈로그 항목
  });

  it('길이 버킷 경계 + 1글자 입력은 접두 매칭 금지(과도 매칭 방지)', () => {
    expect(searchKeywordProps('abc', []).len_bucket).toBe('1-3');
    expect(searchKeywordProps('abcd', []).len_bucket).toBe('4-10');
    expect(searchKeywordProps('p', []).matched).toBe(false); // 1글자 = 미매칭 유지
  });

  it('배선 — 검색 화면이 원문 대신 searchKeywordProps 경유', () => {
    const src = read('src/app/search.tsx');
    expect(src).toContain('searchKeywordProps(submitted');
    expect(src).not.toContain('keyword: submitted.toLowerCase()'); // 구 자유 텍스트 전송 소멸
  });
});

describe('④·⑦ 화이트리스트 = PII 방어선', () => {
  it('신규 14종 등재 + 허용 키만 통과', () => {
    expect(sanitize(EVENTS.scan_item_add, { risk: 'danger', name: '김치' })).toEqual({ risk: 'danger' });
    expect(sanitize(EVENTS.order_done, { item_count: 3 })).toEqual({ item_count: 3 });
    expect(sanitize(EVENTS.owner_ask_open, { source: 'cta', food_id: '7' })).toEqual({ source: 'cta', food_id: '7' });
    expect(sanitize(EVENTS.scan_permission, { state: 'deny' })).toEqual({ state: 'deny' });
    expect(sanitize(EVENTS.error_state_view, { screen: 'food/[id]', kind: 'offline', action: 'view' })).toEqual({
      screen: 'food/[id]', kind: 'offline', action: 'view',
    });
    expect(sanitize(EVENTS.push_primer_response, { action: 'accept', surface: 'scan' })).toEqual({ action: 'accept', surface: 'scan' });
    expect(sanitize(EVENTS.push_pref_toggle, { key: 'nudge', on: true })).toEqual({ key: 'nudge', on: true });
    expect(sanitize(EVENTS.auth_account_delete, { reason: '너무 비싸요' })).toEqual({}); // props 없는 이벤트
  });

  it('⛔ 전송 금지 키 드롭 — 장소명·주소·좌표·note·대상 memberId·본문·사진 URI·프리셋 항목명', () => {
    expect(
      sanitize(EVENTS.community_post_submit, {
        photo_count: 2, food_tag_count: 1, has_place: true,
        place_name: '히뎅', address: '서울시…', latitude: 37.5, longitude: 127.0,
        body: '본문', photos: ['file://a.jpg'],
      }),
    ).toEqual({ photo_count: 2, food_tag_count: 1, has_place: true });
    expect(sanitize(EVENTS.community_comment_submit, { is_reply: true, body: '내용', target_member_id: '42', nickname: 'x' })).toEqual({
      is_reply: true,
    });
    // 프리셋 항목명(종교·신념 추론) — 개수만 통과
    expect(sanitize(EVENTS.profile_avoid_update, { count: 5, delta: 2, via: 'preset', presets: ['MUSLIM'], codes: ['PORK'] })).toEqual({
      count: 5, delta: 2, via: 'preset',
    });
  });
});

describe('② ③ ④ 배선 소스 잠금 — 공용 1곳 원칙', () => {
  it('② 저장 목록 스와이프 해제·되돌리기 = 기존 bookmark_toggle 재사용', () => {
    const src = read('src/app/profile/saved.tsx');
    expect(src).toContain('track(EVENTS.food_bookmark_toggle, { on: false })');
    expect(src).toContain('track(EVENTS.food_bookmark_toggle, { on: true })');
  });

  it('③ 스캔 퍼널 — 담기/빼기·Done 확정·사장님 확인 3진입·권한 4상태', () => {
    const scan = read('src/app/scan.tsx');
    expect(scan).toContain('EVENTS.scan_item_add');
    expect(scan).toContain('EVENTS.scan_item_remove');
    // 4상태 — grant/deny는 요청 결과 삼항에서 나온다
    expect(scan).toContain("state: 'view'");
    expect(scan).toContain("r?.granted ? 'grant' : 'deny'");
    expect(scan).toContain("state: 'settings_open'");
    expect(read('src/features/order/FlippedOrderCard.tsx')).toContain('EVENTS.order_done');
    const detail = read('src/app/food/[id]/index.tsx');
    for (const s of ['cta', 'ingredient', 'unregistered']) expect(detail).toContain(`source: '${s}'`);
  });

  it('④ 공용 지점 = 컴포넌트/훅 한 곳(표면별 중복 배선 금지)', () => {
    const sb = read('src/components/StateBlock.tsx');
    expect(sb).toContain('EVENTS.error_state_view');
    expect(sb).toContain('useSegments'); // 화면 식별 = 라우트 패턴(실 id 미포함)
    const parts = read('src/features/review/ReviewCellParts.tsx');
    expect(parts).toContain('EVENTS.review_helpful_toggle');
    expect(read('src/lib/data/useReviewTranslation.ts')).toContain('EVENTS.review_translate_toggle');
    // 소비 표면은 자체 배선 금지
    expect(read('src/features/community/ReviewFeed.tsx')).not.toContain('review_helpful_toggle');
    expect(read('src/app/food/[id]/reviews.tsx')).not.toContain('translate_toggle');
  });

  it('⑤ ⑥ 푸시 표면 구분·알림 토글 단일 경유·공급측 3종', () => {
    expect(read('src/features/push/PushPrimerModal.tsx')).toContain('EVENTS.push_primer_response');
    expect(read('src/app/onboarding/index.tsx')).toContain('surface="onboarding"');
    expect(read('src/app/scan.tsx')).toContain('surface="scan"');
    expect(read('src/app/profile/notifications.tsx')).toContain('EVENTS.push_pref_toggle');
    expect(read('src/app/profile/restrictions.tsx')).toContain('EVENTS.profile_avoid_update');
    expect(read('src/app/community/compose.tsx')).toContain('EVENTS.community_post_submit');
    expect(read('src/app/delete-account.tsx')).toContain('EVENTS.auth_account_delete');
  });
});
