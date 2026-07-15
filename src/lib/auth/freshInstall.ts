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

const KEY = 'kbap.installed.v1';

/** 부팅 게이트(루트 _layout)에서 세션 판정 전에 await할 것. */
export async function cleanupIfFreshInstall(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(KEY)) != null) return; // 기설치 — 세션 유지
  } catch {
    return; // 스토리지 불능: 기존 사용자 오탐 로그아웃보다 미정리가 낫다
  }
  await clearTokens();
  if (Platform.OS !== 'web') {
    try {
      // beAuth와 같은 이유로 RNFB는 지연 require — 웹 번들 안전
      const session = require('./session') as typeof import('./session');
      if (session.currentUser()) await session.logOut();
    } catch {
      /* RNFB 미초기화 등 — BE 토큰은 이미 정리됨 */
    }
  }
  await AsyncStorage.setItem(KEY, '1').catch(() => {});
}
