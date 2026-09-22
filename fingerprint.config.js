/**
 * KB-600(P-397 8) — runtime fingerprint 소스에서 package.json `scripts`를 뺀다.
 * scripts는 네이티브와 무관한데 지문 소스(packageJson:scripts)라, 개발용 스크립트 한 줄에
 * iOS·Android 지문이 둘 다 회전해 teamtest OTA가 3회 연속 도달 0으로 막혔다(9/21 KB-602).
 * 기본값(PackageJsonAndroidAndIosScriptsIfNotContainRun)보다 넓다 — scripts 전체.
 * ⚠️ 이 파일을 바꾸면 소스 집합이 바뀌어 지문이 회전한다 — 네이티브 빌드와 함께만.
 */
/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips: ['PackageJsonScriptsAll'],
};
