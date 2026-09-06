/**
 * P-294(KB-437) — 앱 아이콘 교체 구성 잠금(네이티브 — 다음 빌드 동승).
 * 시안 자산 = spec bridge/design/4th/logo/icon/(icon-1024·icon-android-fg),
 * 모노크롬 = 마크 실루엣 재생성(알림 상태바 아이콘 공용).
 */
import * as fs from 'fs';

it('app.json 아이콘 구성 — 경로·흰 배경·backgroundImage 소멸·모노크롬 공용', () => {
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8')) as {
    expo: {
      icon: string;
      android: { adaptiveIcon: Record<string, string> };
      plugins: (string | [string, Record<string, string>])[];
    };
  };
  expect(app.expo.icon).toBe('./assets/images/icon.png');
  const ai = app.expo.android.adaptiveIcon;
  expect(ai.foregroundImage).toBe('./assets/images/android-icon-foreground.png');
  expect(ai.backgroundColor).toBe('#FFFFFF'); // P-294: #E2580C(구 스플래시 주황) 폐기
  expect('backgroundImage' in ai).toBe(false); // 색 단독 — 구 배경 이미지 소멸
  expect(ai.monochromeImage).toBe('./assets/images/android-icon-monochrome.png');
  // 알림 상태바 아이콘 = 같은 모노크롬 실루엣(P-192 배선 무변)
  const notif = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-notifications') as [string, Record<string, string>];
  expect(notif[1].icon).toBe('./assets/images/android-icon-monochrome.png');
});

it('아이콘 에셋 — 존재·1024 규격(PNG IHDR)·구 배경 파일 소멸', () => {
  const size = (p: string) => {
    const b = fs.readFileSync(p);
    return [b.readUInt32BE(16), b.readUInt32BE(20)]; // PNG IHDR width/height
  };
  expect(size('assets/images/icon.png')).toEqual([1024, 1024]);
  expect(size('assets/images/android-icon-foreground.png')).toEqual([1024, 1024]);
  expect(size('assets/images/android-icon-monochrome.png')).toEqual([1024, 1024]);
  expect(fs.existsSync('assets/images/android-icon-background.png')).toBe(false);
});
