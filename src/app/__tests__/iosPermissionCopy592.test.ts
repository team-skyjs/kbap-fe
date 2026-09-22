/**
 * KB-592 — iOS 권한 문구가 **실제 용도**와 맞는지 잠근다.
 *
 * 배경: `photosPermission`이 "scan a saved menu picture"뿐이었는데 사진첩은 5곳에서 쓰인다.
 * 카메라·위치도 같은 계열로 어긋나 있었다(Codex #170 5R에서 사진 건만 발견 → 전수 점검).
 * 여기에 더해 prebuild 실측으로 **Expo 기본 플레이스홀더 문구 4종이 그대로 출고**되고 있었다
 * (Always 위치 ×2 · 마이크 · 모션 · FaceID) — 쓰지도 않는 권한이라 Apple 심사 리스크.
 *
 * ⚠️ 9/22 정정(P-407 b35 제출 거부 ITMS-90683): **모션은 쓰는 권한이었다** — scan.tsx가 expo-sensors
 * `DeviceMotion`(가로 힌트)을 쓴다. "미사용" 판단을 grep이 아니라 **플러그인 산출(introspect)**로
 * 하도록 맨 아래 검사를 둔다: 설치된 권한 모듈이 요구하는 Usage 키가 전부 실문구여야 한다.
 *
 * ⚠️ 네이티브(app.json 플러그인 설정) — 지문이 회전한다. 다음 네이티브 빌드에서 반영된다.
 */
import * as fs from 'fs';

const RAW = fs.readFileSync('app.json', 'utf8');
const APP = JSON.parse(RAW) as {
  expo: {
    plugins: (string | [string, Record<string, unknown>])[];
    android: { permissions: string[]; blockedPermissions: string[] };
    locales: Record<string, string>;
  };
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
  motion: ['src/app/scan.tsx'], // DeviceMotion — 가로 힌트(9/22 ITMS-90683으로 발견)
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
  for (const f of here(USES.motion)) expect(read(f)).toMatch(/DeviceMotion/);
});

it('모션 문구 — 두 플러그인이 같은 키를 쓰므로 **같은 실문구**(적용 순서와 무관하게 결과 고정)', () => {
  const m = String(opts('expo-sensors').motionPermission);
  expect(m.toLowerCase()).toContain('sideways');
  expect(opts('expo-location').motionUsagePermission).toBe(m); // false로 되돌리면 순서에 따라 키가 지워진다
});

it('쓰지 않는 권한의 기본 플레이스홀더 문구는 출고되지 않는다', () => {
  // 전부 false = Info.plist에서 키 자체가 빠진다(prebuild 실측 확인)
  expect(opts('expo-camera').microphonePermission).toBe(false); // 오디오 녹음 0
  expect(opts('expo-location').locationAlwaysAndWhenInUsePermission).toBe(false); // 포그라운드만 요청
  expect(opts('expo-location').locationAlwaysPermission).toBe(false);
  expect(opts('expo-secure-store').faceIDPermission).toBe(false); // requireAuthentication 호출 0
});

it('생체 인증을 쓰기 시작하면 FaceID 문구를 되살려야 한다(없으면 호출 시 크래시)', () => {
  const src = ['src/lib/auth', 'src/lib'].flatMap((d) =>
    fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => fs.readFileSync(`${d}/${f}`, 'utf8')) : [],
  );
  expect(src.some((s) => s.includes('requireAuthentication'))).toBe(false);
});

// 오디오 녹음 코드가 0인데 RECORD_AUDIO가 선언돼 Play 스토어에 '오디오 녹음'으로 노출됐다.
// ⚠️ app.json의 permissions 배열에서 빼는 것만으로는 **안 사라진다** — 라이브러리
// AndroidManifest가 직접 선언하므로(prebuild 실측) blockedPermissions로 병합 단계에서
// tools:node="remove"를 걸어야 한다. 두 경로를 다 잠근다.
it('Android RECORD_AUDIO — 선언·플러그인·병합 3경로 모두 차단', () => {
  const and = APP.expo.android;
  expect(and.permissions).not.toContain('android.permission.RECORD_AUDIO');
  expect(and.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
  expect(opts('expo-camera').recordAudioAndroid).toBe(false);
  expect(and.permissions).toContain('android.permission.CAMERA'); // 카메라는 유지
  // 기존 차단분(ACTIVITY_RECOGNITION)을 덮어쓰지 않았는지 — 중복 키로 날린 적 있다
  expect(and.blockedPermissions).toContain('android.permission.ACTIVITY_RECOGNITION');
  expect(RAW.match(/"blockedPermissions"/g)).toHaveLength(1); // JSON 중복 키 방지
});

/* ---- 로케일화 (Codex #173 P1 · KB-592 DoD ③) ----
 * Expo 내장 `locales` 맵이 <lang>.lproj/InfoPlist.strings를 생성한다.
 * 플러그인 옵션의 영어 문구는 **폴백이라 지우면 안 된다** — 여기 없는 로케일이 그걸 쓴다. */

const LANGS = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id'];
const PLIST_KEYS = [
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSPhotoLibraryAddUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSMotionUsageDescription', // 9/22 — scan.tsx DeviceMotion
];

it('권한 문구 10로케일 — locales 맵·파일·키 전수', () => {
  const locales = APP.expo.locales;
  expect(Object.keys(locales).sort()).toEqual([...LANGS].sort());
  for (const lang of LANGS) {
    const path = locales[lang].replace(/^\.\//, '');
    expect(fs.existsSync(path)).toBe(true);
    const d = JSON.parse(fs.readFileSync(path, 'utf8')) as Record<string, string>;
    // 실제로 쓰는 5종만 — 안 쓰는 키를 넣으면 그 권한 다이얼로그가 되살아난다
    expect(Object.keys(d).sort()).toEqual([...PLIST_KEYS].sort());
    for (const k of PLIST_KEYS) expect(d[k].length).toBeGreaterThan(10);
  }
});

it('영어 폴백은 플러그인 옵션에 그대로 남는다(locales에 없는 로케일용)', () => {
  expect(String(opts('expo-camera').cameraPermission).length).toBeGreaterThan(10);
  expect(String(opts('expo-image-picker').photosPermission).length).toBeGreaterThan(10);
  expect(String(opts('expo-location').locationWhenInUsePermission).length).toBeGreaterThan(10);
  expect(String(opts('expo-media-library').savePhotosPermission).length).toBeGreaterThan(10);
  expect(String(opts('expo-sensors').motionPermission).length).toBeGreaterThan(10);
});

it('ko 권한 문구 — 대시(—) 부연 없이(AGENTS.md 신규 한국어 카피 기준)', () => {
  const ko = JSON.parse(fs.readFileSync('locales/ko.json', 'utf8')) as Record<string, string>;
  for (const [k, v] of Object.entries(ko)) expect(`${k}:${v}`).not.toContain('—');
});

/* ---- 설치된 권한 모듈 ↔ Info.plist 키 (P-407 b35 ITMS-90683 재발 방지) ----
 * ASC는 **바이너리가 참조하는 API**로 문구를 요구한다 — JS에서 안 불러도, 모듈이 링크돼 있으면 필요하다.
 * 그래서 "쓰나 안 쓰나"를 grep으로 판단하지 않고, **설치된 모듈 → 요구 키**를 표로 두고 **플러그인이
 * 실제로 만든 Info.plist(introspect)**에서 전부 실문구인지 본다. 모듈을 새로 깔면 이 표에 행을 추가한다. */
const REQUIRED_BY_MODULE: Record<string, string[]> = {
  'expo-camera': ['NSCameraUsageDescription'],
  'expo-image-picker': ['NSPhotoLibraryUsageDescription', 'NSCameraUsageDescription'],
  'expo-media-library': ['NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription'],
  'expo-location': ['NSLocationWhenInUseUsageDescription'],
  'expo-sensors': ['NSMotionUsageDescription'], // CoreMotion — b35가 이 키 누락으로 업로드 거부
};

describe('설치된 권한 모듈이 요구하는 Usage 키 ⊆ 실제 Info.plist(introspect) — 값이 비거나 없는 키 0', () => {
  let infoPlist: Record<string, unknown>;
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require('child_process') as typeof import('child_process');
    const out = execFileSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
    infoPlist = JSON.parse(out)._internal.modResults.ios.infoPlist as Record<string, unknown>;
  }, 180_000);

  it('표의 모듈은 실제로 설치돼 있다(표가 허공을 검사하지 않게)', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    for (const m of Object.keys(REQUIRED_BY_MODULE)) expect(pkg.dependencies[m]).toBeTruthy();
  });

  it('요구 키 전부 = 실문구(비어 있지 않음 · Expo 기본 플레이스홀더 아님)', () => {
    const missing: string[] = [];
    for (const [mod, keys] of Object.entries(REQUIRED_BY_MODULE)) {
      for (const k of keys) {
        const v = infoPlist[k];
        if (typeof v !== 'string' || v.trim().length < 10 || v.includes('$(PRODUCT_NAME)') || /^Allow /.test(v)) {
          missing.push(`${mod} → ${k}: ${JSON.stringify(v)}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('추적(ATT) 문구는 여전히 없다(9/21 예진 D2 — 요구 키 검사가 이걸 끌어들이지 않게)', () => {
    expect('NSUserTrackingUsageDescription' in infoPlist).toBe(false);
  });
});
