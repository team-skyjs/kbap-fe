/**
 * auth/freshInstall.ts — 신규 설치 시 Keychain 잔존 세션 정리.
 *
 * iOS는 앱을 삭제해도 Keychain(expo-secure-store, RNFB 세션)을 지우지 않는다.
 * 반면 AsyncStorage는 삭제 시 확실히 지워지므로, 센티널 키 부재 = 신규
 * 설치(또는 재설치) 신호로 쓰고 그때 1회 잔존 세션을 정리한다 (삭제 후
 * 재설치인데 "Browse first"로 들어와도 로그인 상태로 진입하던 실기기 버그).
 *
 * ⚠️ 기존 사용자가 업데이트로 이 빌드를 최초 실행할 때도 센티널이 없어
 * 한 번 로그아웃된다 — 출시 전(스토어 배포 이력 없음)이라 허용 (2026-07-15).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { clearTokens } from './beTokens';
import { endSessionBoundary } from './beAuth';
import { queryClient } from '@/lib/queryClient';
import { setSessionState } from './useSession';

const KEY = 'kbap.installed.v1';

/**
 * 부팅 게이트(루트 _layout)에서 세션 판정 전에 await할 것.
 * @returns **최초 실행(신규·재설치) 여부** — P-217: 인트로 플래그(introSeen)를
 *   없애고 이 센티널 하나로 "첫 화면 = 로그인" 분기까지 겸한다(부팅 경로 단순화).
 *   ⚠️ P-204 설치 ID는 이 정리 대상이 아니다(clearTokens = 액세스·리프레시만).
 */
export async function cleanupIfFreshInstall(): Promise<boolean> {
  try {
    if ((await AsyncStorage.getItem(KEY)) != null) return false; // 기설치 — 세션 유지
  } catch {
    return false; // 스토리지 불능: 기존 사용자 오탐 로그아웃보다 미정리가 낫다
  }
  endSessionBoundary(); // KB-421: 부트 중 겹친 refresh의 늦은 응답도 폐기 대상
  await clearTokens();
  // KB-421(P-205): 정리는 **인증 경계**를 온전히 타야 한다 — 토큰만 지우고 세션
  // 스토어를 안 건드리면, 모듈 스코프 부트 읽기(installBeAuth 시절)가 선고착시킨
  // 회원(true)이 남아 "회원 UI + 무토큰" 반쪽 상태가 된다(beAuth resetServerCache
  // 동일 의미 — beAuth import는 RNFB 무관이지만 순환 방지로 직접 조립).
  queryClient.clear();
  setSessionState(false);
  if (Platform.OS !== 'web') {
    try {
      // beAuth와 같은 이유로 RNFB는 지연 require — 웹 번들 안전.
      // KB-421: currentUser() 조건 제거 — RNFB 세션 복원이 비동기라 부트 초입엔
      // 널일 수 있고, 그러면 잔존 Firebase 세션이 signOut을 비켜간다. 무조건 시도
      // (미로그인 signOut은 무해·resolve).
      const session = require('./session') as typeof import('./session');
      await session.logOut();
    } catch {
      /* RNFB 미초기화 등 — BE 토큰은 이미 정리됨 */
    }
  }
  await AsyncStorage.setItem(KEY, '1').catch(() => {});
  return true;
}
