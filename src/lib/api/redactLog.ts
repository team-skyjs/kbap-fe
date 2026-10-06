/**
 * KB-709(P-449 ②): 개발 로거 비밀값 가림 — 요청 헤더(Authorization)만 가리고 요청·응답 **본문**의 토큰
 * (로그인·토큰 갱신의 accessToken·refreshToken 등)은 원문으로 찍혔다. 키 이름 기준(대소문자 무시·중첩·배열 포함).
 * 운영 번들은 로그 호출부가 `if (__DEV__)` 안이라 데드코드로 제거된다(이 함수도 dev에서만 불림).
 */
/** 키 이름에 **포함**되면 비밀(accessToken·clientSecret·…) */
const SECRET_WORDS = 'token|secret|password|authorization|cookie';
/** 키 이름이 **정확히** 이것일 때만 비밀 — KB-722: 스캔 티켓 JWT(/scans/tickets 응답 `ticket`, 요청 헤더 `X-Scan-Ticket`).
 *  부분 일치로 두면 ticketId·scanTicket까지 가려져 P-255 선발급 티켓 재사용 디버깅이 불가능해진다. */
const SECRET_EXACT = 'ticket|x-scan-ticket';
const SECRET_KEY = new RegExp(`${SECRET_WORDS}|^(?:${SECRET_EXACT})$`, 'i');
/** 잘린(비 JSON) 본문용 — 같은 목록으로 조립(목록 하나) */
const SECRET_PAIR = new RegExp(`("(?:[^"]*(?:${SECRET_WORDS})[^"]*|${SECRET_EXACT})"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'gi');
const MASK = '***';

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      // 비밀 패턴 키는 값이 객체·배열이어도 통째로 가림({"tokens":{"access":"…"}} — 안쪽 키가 비밀 패턴이 아니어도 새지 않게)
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) && v != null ? MASK : redactSecrets(v)]),
    );
  }
  return value;
}

/** 응답 본문 텍스트 — JSON이면 파싱해 가리고, 아니면(잘린 본문 등) `"…token…": "값"` 쌍을 정규식으로 가린다 */
export function redactText(text: string): string {
  try {
    return JSON.stringify(redactSecrets(JSON.parse(text)));
  } catch {
    return text.replace(SECRET_PAIR, `$1"${MASK}"`);
  }
}
