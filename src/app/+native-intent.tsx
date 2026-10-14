/**
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
