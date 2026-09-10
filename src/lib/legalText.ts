/**
 * legalText.ts — 약관 전문 로딩 (P-080/KB-261 약관 동의 스텝).
 *
 * 전문 소스는 kbap-legal 정적 페이지(이용약관·개인정보) — 웹뷰 네이티브 의존성
 * 없이(JS-only, OTA 가능) 바텀시트에 띄우기 위해 HTML→플레인 텍스트로 변환한다.
 * 안전 고지는 i18n 텍스트 재사용이라 여기 없음.
 */
import { decInflight, incInflight } from '@/lib/net/inflight';
export const LEGAL_URLS = {
  terms: 'https://team-skyjs.github.io/kbap-legal/terms-of-service.html',
  privacy: 'https://team-skyjs.github.io/kbap-legal/privacy-policy.html',
  /** KB-497: 광고성 알림 동의 전문 2종 — 페이지 생성은 kbap-legal 레포(요청 중). */
  marketingPrivacy: 'https://team-skyjs.github.io/kbap-legal/marketing-privacy.html',
  marketingReceive: 'https://team-skyjs.github.io/kbap-legal/marketing-receive.html',
} as const;

/** 안전 고지(프로필 메뉴) — 같은 kbap-legal 정본. P-377: 리터럴 중복 2곳을 여기로. */
export const SAFETY_NOTICE_URL = 'https://team-skyjs.github.io/kbap-legal/safety.html';

export type LegalDoc = keyof typeof LEGAL_URLS;

/** Jekyll 정적 페이지 → 읽을 수 있는 플레인 텍스트 (순수 함수 — 유닛 잠금). */
export function htmlToPlainText(html: string): string {
  let s = html;
  const body = s.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body) s = body[1];
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<(h[1-6])[^>]*>/gi, '\n\n'); // 제목 앞 문단 분리
  s = s.replace(/<li[^>]*>/gi, '\n· ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(h[1-6]|p|ul|ol|div|table|tr|blockquote)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&middot;/g, '·');
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

export async function fetchLegalText(doc: LegalDoc): Promise<string> {
  incInflight(); // P-347: raw fetch도 OTA 정적 창 카운터에 포함
  try {
    const res = await fetch(LEGAL_URLS[doc]);
    if (!res.ok) throw new Error(`legal fetch ${res.status}`);
    return htmlToPlainText(await res.text());
  } finally {
    decInflight();
  }
}
