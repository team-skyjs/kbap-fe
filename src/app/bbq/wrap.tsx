/**
 * KB-1019 쌈 코칭(장면 2) — 시연 전용 경로. development·demo 채널 밖에서는 홈으로 돌린다.
 */
import { useState } from 'react';
import { Redirect } from 'expo-router';
import { isBbqProbeChannel } from '@/features/bbq/probeGate';

export default function BbqWrapRoute() {
  const [open] = useState(isBbqProbeChannel);
  if (!open) return <Redirect href="/" />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WrapScreen } = require('@/features/bbq/WrapScreen') as typeof import('@/features/bbq/WrapScreen');
  return <WrapScreen />;
}
