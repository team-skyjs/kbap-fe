/**
 * KB-709(P-449 ②): 개발 로거 비밀값 가림 — 요청 헤더(Authorization)만 가리고 요청·응답 **본문**의 토큰
 * (로그인·토큰 갱신의 accessToken·refreshToken 등)은 원문으로 찍혔다. 키 이름 기준(대소문자 무시·중첩·배열 포함).
 * 운영 번들은 로그 호출부가 `if (__DEV__)` 안이라 데드코드로 제거된다(이 함수도 dev에서만 불림).
 */
const SECRET_KEY = /token|secret|password|authorization|cookie/i;
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
    return text.replace(/("[^"]*(?:token|secret|password|authorization|cookie)[^"]*"\s*:\s*)"(?:[^"\\]|\\.)*"/gi, `$1"${MASK}"`);
  }
}
