/**
 * P-380 1단계(KB-518) — 공유 카드 네이티브 3종 + plist 잠금.
 * 모듈·권한 선언은 OTA로 못 나가므로(네이티브) 설정이 조용히 빠지면 다음 빌드에서
 * 기능이 통째로 죽는다. 설치 여부·문구·스킴·권한 범위를 소스에서 못박는다.
 */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const pkg = () => JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
const appJson = () => JSON.parse(read('app.json')) as {
  expo: {
    ios: { infoPlist: Record<string, unknown> };
    plugins: (string | [string, Record<string, unknown>])[];
  };
};
const pluginProps = (name: string) => {
  const hit = appJson().expo.plugins.find((p) => Array.isArray(p) && p[0] === name);
  return Array.isArray(hit) ? (hit[1] as Record<string, unknown>) : undefined;
};

it('① 모듈 3종 설치 — 뷰 캡처·사진첩 저장·스토리 공유', () => {
  const d = pkg().dependencies;
  expect(d['react-native-view-shot']).toBeTruthy();
  expect(d['expo-media-library']).toBeTruthy();
  expect(d['react-native-share']).toBeTruthy();
});

it('② iOS — 사진첩 저장 문구(추가 전용) + 인스타 스토리 스킴, 읽기 문구는 스캔용 현행 유지', () => {
  const props = pluginProps('expo-media-library');
  expect(props?.savePhotosPermission).toBe('Save your K-Bap story card to your photo library.');
  // photosPermission(읽기)은 넘기지 않는다 — expo-image-picker가 세운 문구를 보존
  expect(props?.photosPermission).toBeUndefined();
  const ip = appJson().expo.ios.infoPlist;
  expect(ip.LSApplicationQueriesSchemes).toEqual(['instagram-stories']);
});

it('③ Android — READ_MEDIA는 photo만(video·audio 선언 금지) · 인스타 패키지 가시성', () => {
  // 기본값은 photo/video/audio 3종을 다 선언한다 — 저장만 하는 앱이 오버리치가 된다
  expect(pluginProps('expo-media-library')?.granularPermissions).toEqual(['photo']);
  // Android 11+ 패키지 가시성 — 없으면 인스타 설치 판별·실행이 막힌다
  expect(pluginProps('react-native-share')?.android).toEqual(['com.instagram.android']);
});

it('④ react-native-share는 반드시 옵션 객체 — 문자열 등록은 prebuild를 죽인다', () => {
  const plugins = appJson().expo.plugins;
  expect(plugins).not.toContain('react-native-share'); // 문자열 형태 금지(실측 크래시)
  expect(plugins.some((p) => Array.isArray(p) && p[0] === 'react-native-share')).toBe(true);
});
