/**
 * legalText.ts — 약관 전문 로딩 (P-080/KB-261 약관 동의 스텝).
 *
 * 전문 소스는 kbap-legal 정적 페이지(이용약관·개인정보) — 웹뷰 네이티브 의존성
 * 없이(JS-only, OTA 가능) 바텀시트에 띄우기 위해 HTML→구조 블록으로 변환한다(KB-773 — 제목·문단·목록·표).
 * 안전 고지는 i18n 텍스트 재사용이라 여기 없음.
 */
import { decInflight, incInflight } from '@/lib/net/inflight';
export const LEGAL_URLS = {
  terms: 'https://team-skyjs.github.io/kbap-legal/terms-of-service.html',
  privacy: 'https://team-skyjs.github.io/kbap-legal/privacy-policy.html',
  /** KB-497: 광고성 알림 동의 전문 2종 — 페이지 생성은 kbap-legal 레포(요청 중). */
  marketingPrivacy: 'https://team-skyjs.github.io/kbap-legal/marketing-privacy-consent.html',
  marketingReceive: 'https://team-skyjs.github.io/kbap-legal/advertising-receipt-consent.html',
} as const;

/** 안전 고지(프로필 메뉴) — 같은 kbap-legal 정본. P-377: 리터럴 중복 2곳을 여기로. */
export const SAFETY_NOTICE_URL = 'https://team-skyjs.github.io/kbap-legal/safety.html';

export type LegalDoc = keyof typeof LEGAL_URLS;

/** KB-773(QA A1-5): 약관 전문 = 구조 블록 — 평문으로 풀면 표가 칸마다 한 줄로 흩어지고 사이트 제목("kbap-legal")이 남았다.
 *  네이티브 의존성 없이(JS-only, OTA 가능) 블록으로 나눠 RN 뷰로 그린다(onboarding LegalSheet). */
export type LegalBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'listItem'; text: string }
  | { type: 'table'; head: string[]; rows: string[][] };

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&');
}
/** 인라인 태그(strong·a·em…) 제거 + 공백 정리 */
function inline(html: string): string {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t\r\n]+/g, ' ').trim();
}
const cells = (rowHtml: string, tag: 'th' | 'td'): string[] =>
  Array.from(rowHtml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))).map((m) => inline(m[1]));

/** Jekyll 정적 페이지 → 블록(순수 함수 — 유닛 잠금). 사이트 제목(테마가 넣는 kbap-legal 홈 링크 h1)은 뺀다. */
export function parseLegalHtml(html: string): LegalBlock[] {
  let s = html;
  const body = s.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body) s = body[1];
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const out: LegalBlock[] = [];
  const re = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>|<p[^>]*>([\s\S]*?)<\/p>|<li[^>]*>([\s\S]*?)<\/li>|<table[^>]*>([\s\S]*?)<\/table>/gi;
  for (const m of s.matchAll(re)) {
    if (m[1]) {
      const inner = m[2];
      if (/href="[^"]*kbap-legal\/?"/i.test(inner)) continue; // 사이트 제목(홈 링크) — 문서 내용 아님
      const text = inline(inner);
      if (text) out.push({ type: 'heading', level: Math.min(3, Number(m[1][1])) as 1 | 2 | 3, text });
    } else if (m[3] != null) {
      const text = inline(m[3]);
      if (text) out.push({ type: 'paragraph', text });
    } else if (m[4] != null) {
      const text = inline(m[4]);
      if (text) out.push({ type: 'listItem', text });
    } else if (m[5] != null) {
      const rowsHtml = Array.from(m[5].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((r) => r[1]);
      const headRow = rowsHtml.find((r) => /<th[\s>]/i.test(r));
      const head = headRow ? cells(headRow, 'th') : [];
      const rows = rowsHtml.filter((r) => r !== headRow).map((r) => cells(r, 'td')).filter((r) => r.length > 0);
      if (rows.length) out.push({ type: 'table', head, rows });
    }
  }
  return out;
}

export async function fetchLegalBlocks(doc: LegalDoc): Promise<LegalBlock[]> {
  incInflight(); // P-347: raw fetch도 OTA 정적 창 카운터에 포함
  try {
    const res = await fetch(LEGAL_URLS[doc]);
    if (!res.ok) throw new Error(`legal fetch ${res.status}`);
    const blocks = parseLegalHtml(await res.text());
    if (!blocks.length) throw new Error('legal empty'); // 빈 화면 대신 오류·재시도
    return blocks;
  } finally {
    decInflight();
  }
}
