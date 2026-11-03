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
  /** KB-910: 안전 고지도 약관·개인정보와 같은 앱 안 렌더(구 인앱 브라우저로 kbap-legal 페이지 노출) */
  safety: 'https://team-skyjs.github.io/kbap-legal/safety.html',
} as const;


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

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu;
const noEmoji = (s: string) => s.replace(EMOJI, '').replace(/ {2,}/g, ' ').trim();
const pick = (s: string, ko: boolean) => {
  const parts = s.split(' / ');
  return parts.length === 2 ? parts[ko ? 1 : 0] : s;
};

/** KB-907(T-109·T-110): kbap-legal 원문은 한 문서에 "English" 절과 "한국어" 절을 이어 붙이고 제목·시행일도 "영문 / 한글" 병기 —
 *  앱 언어 한 벌만 보여 준다(ko = 한국어 절, 그 외 = English 절). 절 구분(h2 English·한국어)을 못 찾으면 원문 전체 그대로(내용 숨김 0).
 *  제목의 경고 이모지(⚠️)는 언어와 무관하게 뺀다. 원문 수정은 kbap-legal 레포 몫(앱은 렌더 필터만) */
/** KB-910: 원문 판정명 → 앱 판정명(헌법: 4상태 용어 = 앱과 동일). 원문(kbap-legal)은 "Danger"·"위험"인데 앱은 "Avoid"·"회피".
 *  한국어는 판정명 목록(안전/주의/위험/…)과 따옴표 판정명만 바꾼다 — "위험도 표시"처럼 판정명이 아닌 "위험"은 그대로. 원문 수정은 kbap-legal 레포 몫 */
export const appRiskTerms = (s: string): string =>
  s.replace(/\bDanger\b/g, 'Avoid').replace(/주의\/위험\//g, '주의/회피/').replace(/“위험”/g, '“회피”');

export function localizeLegal(blocks: LegalBlock[], lang: string): LegalBlock[] {
  const ko = lang.startsWith('ko');
  const isSec = (b: LegalBlock, label: string) => b.type === 'heading' && b.level === 2 && b.text.trim() === label;
  const en = blocks.findIndex((b) => isSec(b, 'English'));
  const kr = blocks.findIndex((b) => isSec(b, '한국어'));
  let out = blocks;
  if (en >= 0 && kr > en) {
    const head = blocks.slice(0, en).map((b): LegalBlock => {
      if (b.type === 'heading') return { ...b, text: pick(b.text, ko) };
      if (b.type === 'paragraph') {
        const m = b.text.match(/^([^:]+ \/ [^:]+):(.*)$/); // "Effective date / 시행일: 2026-07-16 ..."
        return m ? { ...b, text: `${pick(m[1], ko)}:${m[2]}` } : b;
      }
      return b;
    });
    out = [...head, ...(ko ? blocks.slice(kr + 1) : blocks.slice(en + 1, kr))];
  }
  return out.map((b) => (b.type === 'heading' || b.type === 'paragraph' || b.type === 'listItem' ? { ...b, text: appRiskTerms(noEmoji(b.text)) } : b));
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
