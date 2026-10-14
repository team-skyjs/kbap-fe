/**
 * KB-771(#276 Codex P1) — patch-package로 고친 **iOS 네이티브 소스**가 실제 앱에 들어가는지 잠금.
 *
 * SDK 57 iOS는 Expo 모듈을 미리 컴파일된 XCFramework(`node_modules/<pkg>/prebuilds`)로 링크한다(Podfile 기본 EXPO_USE_PRECOMPILED_MODULES=1).
 * 그러면 patch-package가 디스크의 Swift를 고쳐도 빌드엔 안 들어간다 — 10/14 실측: 옵트인 없이 pod install하면 Pods 프로젝트가
 * ExpoImage.xcframework를 링크(참조 8, xcframeworks.sh), 옵트인(`expo.autolinking.ios.buildFromSource: ["expo-image"]`)하면
 * xcframework 참조 0 · ImageView.swift 컴파일(참조 8).
 * 규칙(글롭): patches/ 아래 패치가 **ios/** 파일을 고치고 그 패키지가 prebuilds를 싣고 있으면 buildFromSource에 있어야 한다.
 */
import * as fs from 'fs';
import * as path from 'path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const fromSource: string[] = pkg.expo?.autolinking?.ios?.buildFromSource ?? [];
const patchFiles = fs.readdirSync('patches').filter((f) => f.endsWith('.patch'));
/** `expo-image+57.0.5.patch` → expo-image · `@scope+name+1.0.0.patch` → @scope/name */
const pkgOf = (f: string) => {
  const parts = f.replace(/\.patch$/, '').split('+');
  parts.pop(); // version
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
};

it('순회 자체가 유효하다 — patches/에 패치가 있다', () => {
  expect(patchFiles.length).toBeGreaterThan(0);
});

it.each(patchFiles)('%s — iOS 소스 패치 + prebuilds 동봉 패키지면 buildFromSource 옵트인', (f) => {
  const name = pkgOf(f);
  const body = fs.readFileSync(path.join('patches', f), 'utf8');
  const touchesIos = /^diff --git a\/node_modules\/[^\s]+\/ios\//m.test(body);
  const shipsPrebuilds = fs.existsSync(path.join('node_modules', name, 'prebuilds'));
  const needs = touchesIos && shipsPrebuilds;
  expect({ name, touchesIos, shipsPrebuilds, optedIn: fromSource.includes(name) }).toEqual({ name, touchesIos, shipsPrebuilds, optedIn: needs ? true : fromSource.includes(name) });
});

it('expo-image 패치(KB-771) = 옵트인됨', () => {
  expect(patchFiles.some((f) => f.startsWith('expo-image+'))).toBe(true);
  expect(fromSource).toContain('expo-image');
});
