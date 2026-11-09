/**
 * KB-1019 고깃집 가이드(장면 1·3) — 시연 전용 경로. development·demo 채널 밖에서는 홈으로 돌린다.
 * 카메라·모델 네이티브 모듈은 게이트 통과 뒤에만 require(다른 화면·테스트에 실리지 않게).
 */
import { useState } from 'react';
import { Redirect } from 'expo-router';
import { isBbqProbeChannel } from '@/features/bbq/probeGate';

export default function BbqGuideRoute() {
  const [open] = useState(isBbqProbeChannel);
  if (!open) return <Redirect href="/" />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GuideScreen } = require('@/features/bbq/GuideScreen') as typeof import('@/features/bbq/GuideScreen');
  return <GuideScreen />;
}
