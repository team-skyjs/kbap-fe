/**
 * null 반환 = "라우터 이동 없음"(#278 Codex 4R 검토): expo-router 57.0.25 타입이 `Promise<string | null> | string | null`이고,
 * 소비처 두 곳 모두 null을 건너뛴다 — 콜드 스타트(getLinkingConfig: initialUrl null = 기본 루트), 웜(link/linking subscribe:
 * `if (href) listener(href)`). 현재 경로 문자열을 돌려주면 같은 화면으로 한 번 더 이동한다. 업그레이드로 이 계약이 바뀌면
 * nativeIntentNullContract783 유닛이 깨진다.
 *
 * KB-783: OS가 연 URL → expo-router 자동 이동 **대신** lib/deeplink 한 곳으로(에어브릿지 콜백과 같은 처리기 — 중복 이동·게이트 우회 방지).
 * 맡지 않는 URL(개발 클라이언트 등)은 그대로 돌려 기존 동작 유지. 맡은 URL은 null = 라우터 이동 없음(콜드 스타트는 기본 루트).
 */
import { handleDeeplink, isOwnedSystemUrl } from '@/lib/deeplink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    if (!isOwnedSystemUrl(path)) return path;
    handleDeeplink(path);
    return null;
  } catch {
    return null; // 처리 실패여도 미지 경로로 라우팅(+not-found)하지 않는다
  }
}
