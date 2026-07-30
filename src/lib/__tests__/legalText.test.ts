/**
 * P-080(KB-261): 약관 전문 HTML→플레인 텍스트 변환 잠금 — 태그·스크립트 제거,
 * 제목/리스트 구조 보존, 엔티티 디코드.
 */
import { htmlToPlainText } from '../legalText';

const FIXTURE = `<!DOCTYPE html>
<html><head><title>K-Bap Legal</title><style>.x{color:red}</style>
<script>var tracking = "no";</script></head>
<body><div class="markdown-body">
<h1>Terms of Service</h1>
<p>Welcome to K-Bap &amp; friends. You agree that 1 &lt; 2.</p>
<ul><li>First rule</li><li>Second&nbsp;rule</li></ul>
<h2>Section 2</h2>
<p>It&#39;s &quot;final&quot;.</p>
</div></body></html>`;

it('태그·head·script·style 제거, 본문 텍스트만 남는다', () => {
  const out = htmlToPlainText(FIXTURE);
  expect(out).not.toMatch(/<[a-z/][^>]*>/i); // 태그 잔존 0 (디코드된 '<' 문자는 허용)
  expect(out).not.toContain('tracking');
  expect(out).not.toContain('color:red');
  expect(out).not.toContain('K-Bap Legal'); // <title>은 head — 본문 아님
});

it('구조 보존 — 제목 문단 분리 + 리스트 불릿 + 엔티티 디코드', () => {
  const out = htmlToPlainText(FIXTURE);
  expect(out.startsWith('Terms of Service')).toBe(true);
  expect(out).toContain('K-Bap & friends');
  expect(out).toContain('· First rule');
  expect(out).toContain('· Second rule');
  expect(out).toContain(`It's "final"`);
  expect(out).toContain('\n\nSection 2'); // 제목 앞 빈 줄
  expect(out).not.toMatch(/\n{3,}/); // 과잉 공백 없음
});

it('body 없는 조각 HTML도 통과', () => {
  expect(htmlToPlainText('<p>hi</p>')).toBe('hi');
});
