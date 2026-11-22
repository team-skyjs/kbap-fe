// KB-1019 시연 브랜치 전용: 고깃집 탐지 모델(.pte)을 앱 자산으로 번들한다.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('pte');

module.exports = config;
