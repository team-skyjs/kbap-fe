/**
 * mediaPermissions (KB-600 / P-408 vc24 거부 — Play 사진·동영상 권한 정책, 9/24 예진 결정)
 *
 * Android에서 READ_MEDIA_IMAGES·READ_MEDIA_VISUAL_USER_SELECTED·READ_EXTERNAL_STORAGE를 **제거**했다
 * (app.json blockedPermissions). 그래서 Android에선 사진 권한을 **요청하면 안 된다** — 선언되지 않은 권한 요청은
 * 즉시 denied라 앨범 선택·저장이 막힌다.
 * - 앨범 선택: Android = 시스템 Photo Picker(권한 불필요) · iOS = 사진첩 권한
 * - 저장(스토리 카드): Android 11+(API 30) = 권한 불필요(expo-media-library 네이티브 `SDK_INT < R`이면 WRITE 검사 —
 *   Codex #201 P1) · Android 10 이하 = WRITE_EXTERNAL_STORAGE(maxSdk 32로 선언 유지) · iOS = 추가 전용 권한
 * 순수 함수 — 인자로 플랫폼을 갈아끼워 테스트한다(shareExport와 같은 문법).
 */
function platform(): { os: string; api: number } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as typeof import('react-native');
    return { os: Platform.OS as string, api: Number(Platform.Version) || 0 };
  } catch {
    return { os: 'ios', api: 0 };
  }
}

/** 앨범 선택 전 사진첩 권한 요청이 필요한가 — iOS만. */
export function needsPhotoLibraryPermission(os: string = platform().os): boolean {
  return os === 'ios';
}

/** 사진첩 저장 전 권한 요청이 필요한가 — iOS · Android 10(API 29) 이하만(네이티브 기준 R=30 미만). */
export function needsSavePermission(os: string = platform().os, api: number = platform().api): boolean {
  if (os !== 'android') return true;
  return api < 30;
}
