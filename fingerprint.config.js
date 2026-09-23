/**
 * KB-600(P-397 8) — runtime fingerprint 소스에서 package.json `scripts`를 뺀다.
 * scripts는 네이티브와 무관한데 지문 소스(packageJson:scripts)라, 개발용 스크립트 한 줄에
 * iOS·Android 지문이 둘 다 회전해 teamtest OTA가 3회 연속 도달 0으로 막혔다(9/21 KB-602).
 * 기본값(PackageJsonAndroidAndIosScriptsIfNotContainRun)보다 넓다 — scripts 전체.
 * ⚠️ 이 파일을 바꾸면 소스 집합이 바뀌어 지문이 회전한다 — 네이티브 빌드와 함께만.
 *
 * 공백과 그 대책(Codex #174 P2): scripts **전체**를 빼므로 `postinstall`(patch-package — 네이티브 소스
 * 패치 적용)이 지워지거나 바뀌어도 지문은 그대로다 → 네이티브가 달라졌는데 OTA가 호환으로 꽂힐 수 있다.
 * fingerprint엔 스크립트 개별 제외 옵션이 없고, 되돌리면 9/21 회전 문제가 돌아온다. 그래서:
 *  - 네이티브 생명주기 스크립트는 **CI 불변식**으로 잠근다(scripts/__tests__/lintChanged602 —
 *    `postinstall === "patch-package"` 정확 일치 + 그 외 설치·EAS 훅 스크립트 0).
 *  - 패치 **내용**은 여전히 지문 소스다(`patches/` — patchPackage 소스, `.fingerprintignore`에 없음).
 *    실제 네이티브 입력인 패치 파일 변경은 지문이 본다(9/22 --debug 소스 목록 실측).
 */
/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips: ['PackageJsonScriptsAll'],
};
