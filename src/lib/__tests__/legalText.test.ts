/**
 * P-080(KB-261) → KB-773(QA A1-5): 약관 전문 HTML → 구조 블록 잠금 — 태그·스크립트 제거, 엔티티 디코드,
 * **사이트 제목("kbap-legal" 홈 링크 h1) 제거**, **표 = 머리·행 구조 유지**(평문일 땐 칸마다 한 줄로 풀렸다).
 */
import { parseLegalHtml } from '../legalText';

// 실제 kbap-legal(Jekyll) 구조 축약 — 테마가 넣는 사이트 제목 h1 + 문서 h1 + 표
const FIXTURE = `<!DOCTYPE html>
<html><head><title>K-Bap Legal</title><style>.x{color:red}</style>
<script>var tracking = "no";</script></head>
<body><div class="container-lg px-3 my-5 markdown-body">
<h1><a href="https://team-skyjs.github.io/kbap-legal/">kbap-legal</a></h1>
<h1 id="x">K-Bap Privacy Policy / 개인정보 처리방침</h1>
<p>Welcome to K-Bap &amp; friends. You agree that 1 &lt; 2.</p>
<hr />
<h2>English</h2>
<h3>1. Data We Collect</h3>
<table><thead><tr><th>Category</th><th>Items</th><th>When</th></tr></thead>
<tbody>
<tr><td>Account</td><td>Social login identifier, email (optional)</td><td>Sign-in</td></tr>
<tr><td>Profile</td><td>Nickname, <strong>dietary restrictions</strong></td><td>Onboarding &amp; profile edit</td></tr>
</tbody></table>
<ul><li>First rule</li><li>Second&nbsp;rule</li></ul>
<p>It&#39;s &quot;final&quot;.</p>
</div></body></html>`;

it('사이트 제목(kbap-legal 홈 링크) 제거 · 문서 제목부터 · head·script·style 제거 · 태그 잔존 0', () => {
  const blocks = parseLegalHtml(FIXTURE);
  expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'K-Bap Privacy Policy / 개인정보 처리방침' });
  const all = JSON.stringify(blocks);
  expect(all).not.toContain('kbap-legal');
  expect(all).not.toContain('tracking');
  expect(all).not.toContain('color:red');
  expect(all).not.toContain('K-Bap Legal');
  expect(all).not.toMatch(/<[a-z/][^>]*>/i);
});

it('구조 — 제목 단계·문단·목록·엔티티 디코드', () => {
  const blocks = parseLegalHtml(FIXTURE);
  expect(blocks).toContainEqual({ type: 'paragraph', text: 'Welcome to K-Bap & friends. You agree that 1 < 2.' });
  expect(blocks).toContainEqual({ type: 'heading', level: 2, text: 'English' });
  expect(blocks).toContainEqual({ type: 'heading', level: 3, text: '1. Data We Collect' });
  expect(blocks).toContainEqual({ type: 'listItem', text: 'First rule' });
  expect(blocks).toContainEqual({ type: 'listItem', text: 'Second rule' });
  expect(blocks).toContainEqual({ type: 'paragraph', text: `It's "final".` });
});

it('표 = 머리 + 행(칸 단위) — 인라인 강조는 텍스트로', () => {
  const table = parseLegalHtml(FIXTURE).find((b) => b.type === 'table');
  expect(table).toEqual({
    type: 'table',
    head: ['Category', 'Items', 'When'],
    rows: [
      ['Account', 'Social login identifier, email (optional)', 'Sign-in'],
      ['Profile', 'Nickname, dietary restrictions', 'Onboarding & profile edit'],
    ],
  });
});

it('body 없는 조각 HTML도 통과 · 순서 보존', () => {
  expect(parseLegalHtml('<p>hi</p><h2>t</h2>')).toEqual([{ type: 'paragraph', text: 'hi' }, { type: 'heading', level: 2, text: 't' }]);
});
