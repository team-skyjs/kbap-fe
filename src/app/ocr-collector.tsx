import * as React from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import * as Updates from 'expo-updates';
import { BE_BASE } from '@/lib/data/config';
import { allowed } from '@/features/ocrCollector/protocol';

// Evaluate before mounting the screen or loading native/file modules, including direct deep links.
const Collector = React.lazy(() => import('@/features/ocrCollector/CollectorScreen'));
export default function OcrCollectorRoute() {
  if (!allowed(Updates.channel, __DEV__, BE_BASE)) return <Redirect href="/" />;
  return <React.Suspense fallback={<ActivityIndicator />}><Collector /></React.Suspense>;
}
