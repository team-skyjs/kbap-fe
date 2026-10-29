/** KB-910 — 안전 고지 = 약관·개인정보와 같은 앱 안 렌더(LegalDocBody) + 원문 판정명 → 앱 판정명(Danger → Avoid · 위험 → 회피) */
import * as fs from 'fs';
import { appRiskTerms, LEGAL_URLS, localizeLegal, parseLegalHtml } from '@/lib/legalText';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const en = JSON.parse(read('src/lib/i18n/en.json')) as { risk: Record<string, string> };
const ko = JSON.parse(read('src/lib/i18n/ko.json')) as { risk: Record<string, string> };

describe('판정명 = 앱 용어', () => {
  it('영어 Danger → 앱 risk.danger(Avoid) · 한국어 판정명 목록·따옴표 판정명만 위험 → 회피 · "위험도 표시"는 그대로', () => {
    expect(en.risk.danger).toBe('Avoid');
    expect(ko.risk.danger).toBe('회피');
    expect(appRiskTerms('Risk labels (Safe / Caution / Danger / Unable to assess) are estimates')).toBe('Risk labels (Safe / Caution / Avoid / Unable to assess) are estimates');
    expect(appRiskTerms('위험도 표시(안전/주의/위험/판정 불가)는 추정치입니다. “위험” 표시는')).toBe('위험도 표시(안전/주의/회피/판정 불가)는 추정치입니다. “회피” 표시는');
    expect(appRiskTerms('Dangerous goods')).toBe('Dangerous goods'); // 낱말 경계 — 다른 단어 0
  });
  it('원문 구조(제목 병기 + English·한국어 절) → en = Danger 0 · ko = 회피 · 이모지 0', () => {
    const html = `<body><h1>K-Bap Safety Notice / 안전 고지</h1><p>Effective date / 시행일: 2026-07-23 · Version 1.0</p>
<h2>English</h2><h3>What K-Bap tells you</h3><li>Risk labels (Safe / Caution / Danger / Unable to assess) are estimates.</li>
<h2>한국어</h2><h3>K-Bap이 알려주는 것</h3><li>위험도 표시(안전/주의/위험/판정 불가)는 추정치입니다.</li></body>`;
    const text = (lang: string) => localizeLegal(parseLegalHtml(html), lang).map((b) => ('text' in b ? b.text : '')).join('\n');
    expect(text('en')).toContain('K-Bap Safety Notice');
    expect(text('en')).not.toMatch(/Danger|안전 고지/);
    expect(text('en')).toContain('Safe / Caution / Avoid / Unable to assess');
    expect(text('ko')).toContain('안전 고지');
    expect(text('ko')).toContain('위험도 표시(안전/주의/회피/판정 불가)');
  });
});

describe('배선', () => {
  it('URL = LEGAL_URLS.safety 한 곳 · 프로필 두 분기 = 앱 안 법적 문서 화면 · 인앱 브라우저 0', () => {
    expect(LEGAL_URLS.safety).toBe('https://team-skyjs.github.io/kbap-legal/safety.html');
    const profile = read('src/app/(tabs)/profile.tsx');
    expect(profile.match(/router\.push\('\/profile\/legal\?doc=safety' as Href\)/g)).toHaveLength(2);
    expect(profile).not.toMatch(/openWebPage|SAFETY_NOTICE_URL/);
    const screen = read('src/app/profile/legal.tsx');
    expect(screen).toContain("raw === 'safety' ? 'safety'");
    expect(screen).toContain("doc === 'safety' ? 'profile.safetyNotice'");
  });
  it('온보딩 동의 시트의 안전 고지도 같은 본문(LegalDocBody) — 구 consent 요약 문구 0', () => {
    const ob = read('src/app/onboarding/index.tsx');
    expect(ob).toContain('{doc != null && <LegalDocBody doc={doc as LegalDoc} />}');
    expect(ob).not.toContain('safetyText');
  });
  it('본문 로딩 = 스켈레톤(스피너 0) · 제목·본문 어절 줄바꿈', () => {
    const body = read('src/components/LegalDocBody.tsx');
    expect(body).not.toContain('ActivityIndicator');
    expect(body).toMatch(/testID="legal-loading">\s*\{SKELETON_WIDTHS\.map/);
    expect(body.match(/lineBreakStrategyIOS="hangul-word"/g)).toHaveLength(3); // 제목·문단·목록
    expect(body).not.toMatch(/(fontSize|borderRadius): *[0-9]+[^.\d]*\/\/ KB-910/); // 새 리터럴 0(#367 토큰 규칙)
  });
});
