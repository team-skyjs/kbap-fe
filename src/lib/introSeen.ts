/**
 * 첫 실행 인트로 1회성 플래그 (KB-76 gating, 게이팅 실기기 반려분).
 * 인트로에서 어느 CTA로든 빠져나가면 본 것으로 기록 — 이후 실행은 바로 홈.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kbap.introSeen.v1';

export async function hasSeenIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) != null;
  } catch {
    return true; // 스토리지 불능 시 인트로 강제하지 않음 (홈이 안전한 기본)
  }
}

export function markIntroSeen(): void {
  void AsyncStorage.setItem(KEY, '1').catch(() => {});
}
