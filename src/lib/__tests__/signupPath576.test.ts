/**
 * P-389(KB-576) — 가입 경로·user_type·콜드 스타트 배선 잠금.
 *
 * 렌더 대신 **소스 잠금 + 순수 함수**로 잠근다: 이 배선의 결함은 "값이 안 실림"이고,
 * 실림 여부는 호출 지점이 정본이다(로그인·탭·부트는 네이티브를 끌고 와 렌더가 비싸다).
 */
import { parseLoginEntry, LOGIN_ENTRIES } from '../auth/loginEntry';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

describe('entry 파생', () => {
  it('게이트 = gate_<trigger>(auth_gate_view와 같은 축) · 프로필 = profile · 직접 진입 = intro', () => {
    const gate = read('src/components/AuthGateSheet.tsx');
    expect(gate).toContain('const entry = `gate_${trigger ?? CONTEXT_TRIGGER[context]}`');
    expect(gate).toContain('&entry=${entry}');
    expect(read('src/app/(tabs)/profile.tsx')).toContain('entry=profile');
    expect(parseLoginEntry(undefined)).toBe('intro');
  });

  it('게이트 trigger 6종이 전부 CSV 값으로 파생된다(빠진 축 없음)', () => {
    for (const t of ['bookmark', 'review', 'scan', 'community', 'risk', 'profile']) {
      expect(LOGIN_ENTRIES).toContain(`gate_${t}`);
    }
  });

  it('로그인 화면이 쿼리를 파싱해 버튼으로 관통한다', () => {
    const login = read('src/app/login.tsx');
    expect(login).toContain('parseLoginEntry(entryParam)');
    expect(login).toContain('entry={entry}');
  });
});

describe('auth_login_success — is_new·entry', () => {
  it('두 provider 성공 지점 모두에 서버 newMember와 entry가 실린다', () => {
    const src = read('src/lib/auth/useSocialAuth.ts');
    expect(src).toContain("track(EVENTS.auth_login_success, { provider: 'GOOGLE', is_new: exch.newMember, entry })");
    expect(src).toContain("track(EVENTS.auth_login_success, { provider: 'APPLE', is_new: res.newMember, entry })");
    // is_new는 **서버 응답**이 정본 — 로컬 추정 금지(P-147)
    expect(src).not.toContain('is_new: true,');
  });

  it('취소·실패 경로는 여전히 미전송(전환율 분모 오염 금지)', () => {
    const src = read('src/lib/auth/useSocialAuth.ts');
    // cancelled 분기 **본문만** 잘라서 검사(분기 밖 성공 경로까지 긁으면 헛돈다)
    for (const marker of ['if (exch.cancelled) {', 'if (res.cancelled) {']) {
      const start = src.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      const body = src.slice(start, src.indexOf('return;', start) + 'return;'.length);
      expect(body).not.toContain('track('); // 조기 반환 — 계측 없음
      expect(body).toContain('setPhase(\'idle\')');
    }
  });
});

describe('app_tab_view — user_type', () => {
  it('탭 이벤트 한 곳에서 토큰 유무로 판정(화면별 배선 없음)', () => {
    const src = read('src/app/(tabs)/_layout.tsx');
    expect(src).toContain("user_type: tk ? 'registered' : 'guest'");
    expect(src).toContain('loadTokens()');
    // 이벤트는 4탭 공통 한 곳에서만 발화한다
    expect(src.match(/EVENTS\.app_tab_view/g)?.length).toBe(2); // 성공 경로 + 저장소 오류 폴백
  });

  it('저장소 오류여도 이벤트 자체는 보낸다(탭 분포가 통째로 비지 않게)', () => {
    const src = read('src/app/(tabs)/_layout.tsx');
    expect(src).toContain('.catch(() => track(EVENTS.app_tab_view, { tab: active }))');
  });
});

describe('콜드 스타트 Identify', () => {
  it('app_opened와 같은 effect에서 user_info_is_registered를 토큰 유무로 세팅', () => {
    const src = read('src/app/_layout.tsx');
    expect(src).toContain('setUserProps({ user_info_is_registered: !!tk })');
    const boot = src.slice(src.indexOf('track(EVENTS.app_opened)'), src.indexOf('AppState.addEventListener'));
    expect(boot).toContain('loadTokens()'); // 부트 블록 안
  });

  it('저장소 오류 시 기존 값을 false로 덮지 않는다', () => {
    const src = read('src/app/_layout.tsx');
    const line = src.slice(src.indexOf('user_info_is_registered: !!tk'));
    expect(line.slice(0, 200)).toContain('.catch(() => {})');
  });

  it('값 전환 지점(게스트 진입·로그인 성공)은 그대로 남아 있다', () => {
    expect(read('src/app/login.tsx')).toContain('setUserProps({ user_info_is_registered: false })');
    expect(read('src/lib/auth/useSocialAuth.ts')).toContain('setUserProps({ user_info_is_registered: true })');
  });
});
