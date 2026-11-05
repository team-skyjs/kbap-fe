/**
 * 앱이 전경(AppState 'active')일 때만 true. 화면 포커스(useFocusEffect)는 앱을 내려도 그대로라 "사용자가 지금 보고 있나"엔 이걸 함께 본다.
 * KB-1008(Codex #441 P2): 채팅 읽음 처리 · KB-1005(P-617) 스캔 사진 폴링과 같은 규칙.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useAppActive(): boolean {
  const [on, setOn] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setOn(st === 'active'));
    return () => sub?.remove?.();
  }, []);
  return on;
}
