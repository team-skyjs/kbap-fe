/**
 * P-023(KB-199): /home 요청에 lang 파라미터가 실리는지 잠근다.
 * BE가 lang을 필수로 승격(7/20 밤) — 미전송 시 홈 400. /foods와 동일 패턴.
 */
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'ko' } }));
jest.mock('@/lib/api/client', () => ({
  api: { get: jest.fn().mockResolvedValue({ authenticated: true, avoidedSubstances: [], popularFoods: [], recentScans: [] }) },
  apiLang: () => 'ko',
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { api } = require('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */

import { fetchHome } from '../useHome';

it('fetchHome은 /home?lang= 로 요청한다 (lang 필수 승격 — 400 해소)', async () => {
  await fetchHome();
  expect(api.get).toHaveBeenCalledWith('/home?lang=ko');
});
