/**
 * useScriptFonts — ⑦(KB-137)에서 무력화. CJK/Thai/KR은 시스템 폰트로 렌더하므로
 * 스크립트별 폰트 로딩이 없다(종전 Noto 온디맨드 로딩 254MB 번들 제거).
 * LocaleProvider 표면(scriptReady) 유지를 위해 시그니처만 남긴다.
 */
import type { ScriptKey } from './fonts';

/** 시스템 폰트는 로딩이 없으므로 항상 ready. */
export function useScriptFonts(_script: ScriptKey): boolean {
  return true;
}
