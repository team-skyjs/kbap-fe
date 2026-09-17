/**
 * KB-592 — iOS 권한 문구가 **실제 용도**와 맞는지 잠근다.
 *
 * 배경: `photosPermission`이 "scan a saved menu picture"뿐이었는데 사진첩은 5곳에서 쓰인다.
 * 카메라·위치도 같은 계열로 어긋나 있었다(Codex #170 5R에서 사진 건만 발견 → 전수 점검).
 * 여기에 더해 prebuild 실측으로 **Expo 기본 플레이스홀더 문구 4종이 그대로 출고**되고 있었다
 * (Always 위치 ×2 · 마이크 · 모션 · FaceID) — 쓰지도 않는 권한이라 Apple 심사 리스크.
 *
 * ⚠️ 네이티브(app.json 플러그인 설정) — 지문이 회전한다. 다음 네이티브 빌드에서 반영된다.
 */
import * as fs from 'fs';

const APP = JSON.parse(fs.readFileSync('app.json', 'utf8')) as {
  expo: { plugins: (string | [string, Record<string, unknown>])[] };
};
const opts = (name: string): Record<string, unknown> => {
  const p = APP.expo.plugins.find((x) => (Array.isArray(x) ? x[0] : x) === name);
  return Array.isArray(p) ? p[1] : {};
};

/** 권한 ↔ 실제 호출 지점. 화면이 늘면 여기와 문구를 같이 고친다. */
const USES = {
  camera: ['src/app/scan.tsx', 'src/app/food/[id]/review.tsx', 'src/lib/data/profileImage.ts'],
  photos: [
    'src/app/scan.tsx',
    'src/app/food/[id]/review.tsx',
    'src/app/community/compose.tsx',
    'src/lib/data/profileImage.ts',
    'src/app/profile/feedback/new.tsx', // KB-586 머지 후 합류 — 아직 develop에 없으면 건너뛴다
  ],
  location: ['src/lib/api/places.ts', 'src/lib/data/orders.ts'],
};

it('사진첩·카메라·위치 문구가 용도를 전부 포괄한다(스캔 전용 문구 소멸)', () => {
  const photos = String(opts('expo-image-picker').photosPermission);
  // 구 문구("scan a saved menu picture"만)로 되돌리면 실패
  for (const kw of ['scan', 'review', 'profile', 'inquiry']) expect(photos.toLowerCase()).toContain(kw);

  const camera = String(opts('expo-camera').cameraPermission);
  for (const kw of ['scan', 'review', 'profile']) expect(camera.toLowerCase()).toContain(kw);

  const loc = String(opts('expo-location').locationWhenInUsePermission);
  for (const kw of ['review', 'ate']) expect(loc.toLowerCase()).toContain(kw);
});

it('호출 지점 목록이 실제 소스와 일치한다(화면이 늘면 문구도 갱신하라는 신호)', () => {
  // 브랜치에 아직 없는 화면은 건너뛴다(KB-586이 머지되면 자동으로 검사 대상에 들어온다)
  const here = (list: string[]) => list.filter((f) => fs.existsSync(f));
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  const photos = here(USES.photos);
  expect(photos.length).toBeGreaterThanOrEqual(4);
  for (const f of photos) expect(read(f)).toContain('launchImageLibraryAsync');
  for (const f of here(USES.camera)) expect(read(f)).toMatch(/launchCameraAsync|CameraView/);
  for (const f of here(USES.location)) expect(read(f)).toContain('expo-location');
});

it('쓰지 않는 권한의 기본 플레이스홀더 문구는 출고되지 않는다', () => {
  // 전부 false = Info.plist에서 키 자체가 빠진다(prebuild 실측 확인)
  expect(opts('expo-camera').microphonePermission).toBe(false); // 오디오 녹음 0
  expect(opts('expo-location').locationAlwaysAndWhenInUsePermission).toBe(false); // 포그라운드만 요청
  expect(opts('expo-location').locationAlwaysPermission).toBe(false);
  expect(opts('expo-location').motionUsagePermission).toBe(false);
  expect(opts('expo-secure-store').faceIDPermission).toBe(false); // requireAuthentication 호출 0
});

it('생체 인증을 쓰기 시작하면 FaceID 문구를 되살려야 한다(없으면 호출 시 크래시)', () => {
  const src = ['src/lib/auth', 'src/lib'].flatMap((d) =>
    fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => fs.readFileSync(`${d}/${f}`, 'utf8')) : [],
  );
  expect(src.some((s) => s.includes('requireAuthentication'))).toBe(false);
});
