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
    expect(parseLoginEntry(undefined)).toBe('other'); // 부재 = 인트로 아님
  });

  it('Codex #165 P2: /login 호출처가 **전부** entry를 명시한다(부재가 intro로 접히던 오염 차단)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p2 = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(p2, out); }
        else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p2);
      }
      return out;
    };
    const hits: string[] = [];
    for (const f of walk('src')) {
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        // 라우팅 호출만(문서 주석·경로 비교 제외)
        if (/(push|replace|Redirect href=)[^\n]*['\`]\/login/.test(line) && !line.includes('entry=')) hits.push(`${f}: ${line.trim().slice(0, 90)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('인트로(첫 진입)만 intro — 세션 만료·로그아웃·탈퇴·홈 CTA는 other', () => {
    const boot = read('src/app/_layout.tsx');
    expect(boot).toContain("router.replace('/login?entry=intro' as Href)"); // 첫 진입
    expect(boot).toContain("'/login?entry=other'"); // 세션 만료
    expect(read('src/app/delete-account.tsx')).toContain('entry=other');
    expect(read('src/app/(tabs)/profile.tsx')).toContain("'/login?entry=other'"); // 로그아웃
    const home = read('src/app/(tabs)/index.tsx');
    expect(home).toContain('/login?entry=other'); // 게스트 CTA
    expect(home).toContain('/login?entry=gate_review'); // Helpful = 게이트와 같은 축
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
  it('탭 이벤트 한 곳에서 3값 판정 사용(화면별 배선 없음)', () => {
    const src = read('src/app/(tabs)/_layout.tsx');
    expect(src).toContain('isRegisteredForAnalytics()');
    expect(src).toContain("user_type: reg ? 'registered' : 'guest'");
    expect(src).not.toContain('loadTokens()'); // 2값 판정 회귀 금지(오류를 게스트로 찍는다)
    expect(src.match(/EVENTS\.app_tab_view/g)?.length).toBe(2); // 성공 경로 + 폴백
  });

  it('Codex #165 P2: 모름(저장소 오류)이면 user_type을 **빼고** 보낸다', () => {
    const src = read('src/app/(tabs)/_layout.tsx');
    expect(src).toContain('reg === null ? {} :'); // 값 생략
    expect(src).toContain('.catch(() => track(EVENTS.app_tab_view, { tab: active }))'); // 이벤트 자체는 발화
  });
});

describe('콜드 스타트 Identify', () => {
  it('app_opened와 같은 effect에서 3값 판정으로 세팅', () => {
    const src = read('src/app/_layout.tsx');
    expect(src).toContain('setUserProps({ user_info_is_registered: reg })');
    const boot = src.slice(src.indexOf('track(EVENTS.app_opened)'), src.indexOf('AppState.addEventListener'));
    expect(boot).toContain('isRegisteredForAnalytics()'); // 부트 블록 안
  });

  it('Codex #165 P2: 모름이면 세팅 자체를 건너뛴다(잘못된 false로 회원을 뒤집지 않는다)', () => {
    const src = read('src/app/_layout.tsx');
    expect(src).toContain('if (reg !== null) setUserProps(');
    expect(src).not.toContain('user_info_is_registered: !!tk'); // 2값 회귀 금지
  });

  it('값 전환 지점(게스트 진입·로그인 성공)은 그대로 남아 있다', () => {
    expect(read('src/app/login.tsx')).toContain('setUserProps({ user_info_is_registered: false })');
    expect(read('src/lib/auth/useSocialAuth.ts')).toContain('setUserProps({ user_info_is_registered: true })');
  });
});
