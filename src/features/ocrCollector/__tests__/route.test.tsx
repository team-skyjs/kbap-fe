import * as React from 'react';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import OcrCollectorRoute from '@/app/ocr-collector';
import * as Updates from 'expo-updates';
jest.mock('expo-router', () => ({ Redirect: 'Redirect' }));
jest.mock('expo-updates', () => ({ channel: 'production' }));
jest.mock('@/lib/data/config', () => ({ BE_BASE: 'https://dev.kbap.site' }));
it.each(['production', 'preview', 'unknown'])('direct route redirects %s before native screen mount', async channel => {
  Object.defineProperty(Updates, 'channel', { value: channel, configurable: true });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<OcrCollectorRoute />); });
  expect(tree.toJSON()).toMatchObject({ type: 'Redirect', props: { href: '/' } });
  await act(async () => { tree.unmount(); });
});
