/**
 * P-213(KB-316): 계측 공백 보완 — 신규 이벤트 2종 화이트리스트·유입 source 값
 * 배선(리뷰 퍼널 2곳·food_detail_view 4곳)·country 선심기·presets 스텝 계측.
 * 배선은 소스 잠금(계측 호출은 렌더 트리 밖 부수효과라 문자열 잠금이 실질).
 */
import { EVENTS, sanitize, sanitizeUserProps } from '../analytics';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('④ 신규 이벤트 2종 — 화이트리스트 통과(tab/trigger)·밖의 키 드롭', () => {
  expect(EVENTS.app_tab_view).toBe('app_tab_view'); // P-215: 도메인 접두
  expect(EVENTS.auth_gate_view).toBe('auth_gate_view');
  expect(sanitize(EVENTS.app_tab_view, { tab: 'community', nickname: 'x' })).toEqual({ tab: 'community' });
  expect(sanitize(EVENTS.auth_gate_view, { trigger: 'bookmark', email: 'x' })).toEqual({ trigger: 'bookmark' });
});

it('④ tab_view = 탭 레이아웃 한 곳(활성 탭 변화 시), auth_gate_view = 게이트 시트 한 곳', () => {
  const tabs = read('src/app/(tabs)/_layout.tsx');
  expect(tabs).toContain('track(EVENTS.app_tab_view, { tab: active })');
  expect(tabs).toContain('if (lastTab.current === active) return;'); // 같은 탭 재탭 무발화
  const gate = read('src/components/AuthGateSheet.tsx');
  expect(gate).toContain('if (open) track(EVENTS.auth_gate_view');
  // 커뮤니티 표면은 context로 구분 불가 — trigger 명시
  expect(read('src/features/community/ReviewFeed.tsx')).toContain('trigger="community"');
  expect(read('src/app/(tabs)/community.tsx')).toContain('trigger="community"');
  // 표면별 개별 계측 배선 금지(관문 단일화)
  expect(read('src/features/community/ReviewFeed.tsx')).not.toContain('EVENTS.auth_gate_view');
});

it('① 리뷰 퍼널 유입 — 홈·피드에서 review_write_tap 발화(source home|feed)', () => {
  expect(read('src/app/(tabs)/index.tsx')).toContain("track(EVENTS.review_write_tap, { source: 'home' })");
  expect(read('src/features/community/ReviewFeed.tsx')).toContain("track(EVENTS.review_write_tap, { source: 'feed' })");
});

it('② food_detail_view — 유입 4곳 src 부여 + 상세 화이트리스트 수용(other 누수 0)', () => {
  expect(read('src/app/profile/saved.tsx')).toContain('?src=saved');
  expect(read('src/app/profile/reviews.tsx')).toContain('?src=my_reviews');
  expect(read('src/features/community/ReviewFeed.tsx')).toContain('?src=feed');
  expect(read('src/features/community/tagSheets.tsx')).toContain('?src=tag_sheet');
  const detail = read('src/app/food/[id]/index.tsx');
  for (const v of ['saved', 'my_reviews', 'feed', 'tag_sheet']) {
    expect(detail).toContain(`'${v}'`); // 화이트리스트 미수용이면 other로 강등됨
  }
});

it('③ country — 첫 실행 로케일 선심기(허용 프로퍼티), 온보딩 제출 시 실제 국적 갱신', () => {
  expect(sanitizeUserProps({ user_info_country: 'KR' })).toEqual({ user_info_country: 'KR' }); // P-215 접두
  const layout = read('src/app/_layout.tsx');
  expect(layout).toContain('getLocales()[0]?.regionCode');
  expect(layout).toContain('...(region ? { user_info_country: region } : {})'); // region 없으면 미전송
  expect(read('src/app/onboarding/index.tsx')).toContain('user_info_country: nationality'); // 제출 시 덮어씀
});

it('⑤ presets 스텝 계측 개시 — STEP_WIRE null 해제', () => {
  expect(read('src/app/onboarding/index.tsx')).toContain("presets: 'presets'");
});
