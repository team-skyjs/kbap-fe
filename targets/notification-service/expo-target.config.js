/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'notification-service',
  // ponytail: 앞 '.' = 메인 번들 ID 뒤에 붙임 → com.rocher.kbap.NotificationService
  bundleIdentifier: '.NotificationService',
  // 플러그인 기본 18.0 이면 iOS 16.4~17 기기엔 확장이 안 붙는다. 앱 최소(16.4)와 맞춤
  deploymentTarget: '16.4',
});
