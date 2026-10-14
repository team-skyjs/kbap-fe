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

/**
 * KB-771 후속(10/14 dev-sim 빌드 a7764557 링크 실패) — 소스 빌드로 돌린 모듈의 SPM 의존(SDWebImage 등)을 **다른 prebuilt 모듈이 번들**하면
 * 프리컴파일 파이프라인이 그 의존 pod을 헤더만 남긴 스텁으로 만들고(bundled_dependency?), 공유 xcframework는 prebuilt 소비자에만 연결된다
 * → 소스 빌드 모듈은 구현 없이 링크(Undefined symbols SDWebImage…). 실측: expo-image만 옵트인 = SDWebImage *.m Sources 0,
 * expo-image-manipulator까지 옵트인 = Sources 포함·"Bundled SPM frameworks: ZXingObjC"만.
 * 규칙: buildFromSource 모듈과 SPM 제품을 공유하는 prebuilds 동봉 모듈은 함께 buildFromSource.
 */
it('buildFromSource 모듈과 SPM 의존을 공유하는 prebuilt 모듈도 소스 빌드(공유 의존 스텁 → 링크 실패 방지)', () => {
  const spmProducts = (name: string): string[] => {
    const f = path.join('node_modules', name, 'spm.config.json');
    if (!fs.existsSync(f)) return [];
    const j = JSON.parse(fs.readFileSync(f, 'utf8')) as { products?: { spmPackages?: { productName?: string }[] }[] };
    return (j.products ?? []).flatMap((p) => (p.spmPackages ?? []).map((s) => s.productName ?? '')).filter(Boolean);
  };
  const candidates = fs
    .readdirSync('node_modules')
    .flatMap((d) => (d.startsWith('@') ? fs.readdirSync(path.join('node_modules', d)).map((x) => `${d}/${x}`) : [d]))
    .filter((n) => fs.existsSync(path.join('node_modules', n, 'prebuilds')) && fs.existsSync(path.join('node_modules', n, 'spm.config.json')));
  expect(candidates.length).toBeGreaterThan(0); // 순회 유효성
  const missing: string[] = [];
  for (const src of fromSource) {
    const shared = new Set(spmProducts(src));
    for (const other of candidates) {
      if (other === src || fromSource.includes(other)) continue;
      const overlap = spmProducts(other).filter((p) => shared.has(p));
      if (overlap.length) missing.push(`${other} (${overlap.join(',')})`);
    }
  }
  expect(missing).toEqual([]);
});
