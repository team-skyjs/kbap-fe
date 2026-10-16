import responses from './fixtures/homeProd412.json';
import { fetchHome } from '../useHome';
import { selectedHomeOptions } from '../useSelectedHomeFoods';
import { HOME_SELECTION } from '@/features/home/selectedFoods';
/** Captured public guest responses: server #412, 2026-10-16. Replay is not native QA. */
jest.mock('@/lib/data/config', () => ({ BE_BASE: 'https://prod.kbap.site' }));
jest.mock('@/lib/installationId', () => ({ getInstallationId: async () => 'test-install' }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false }));

it('loads both required home sources through the real client using prod 1.1 DTOs and guest headers', async () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn(async (url: string) => ({
    ok: true, status: 200,
    text: async () => JSON.stringify(url.includes('/foods/selected?') ? responses.selected : responses.home),
  } as Response));
  global.fetch = fetchMock as unknown as typeof fetch;
  try {
    const [home, selected] = await Promise.all([fetchHome(), selectedHomeOptions('en', false).queryFn()]);
    expect(home.authenticated).toBe(false);
    expect(home.avoided).toEqual(responses.home.payload.avoidedSubstances);
    expect(home.recommended.map((f) => f.foodId)).toEqual(responses.home.payload.popularFoods.map((f) => String(f.foodId)));
    expect(home.mostReviewed?.map((f) => f.foodId)).toEqual(responses.home.payload.mostReviewedFoods.map((f) => String(f.foodId)));
    expect(home.recent).toEqual([]);
    expect(selected.items.map((f) => f.foodId)).toEqual(HOME_SELECTION.orderedFoodIds.map(String));
    expect(selected.items.every((f) => Boolean(f.photoUrl) && !f.bookmarked)).toBe(true);
    expect(selected.unavailableFoodIds).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as unknown as [string, {headers: Record<string,string>}][];
    expect(calls.map(([url]) => url).sort()).toEqual([
      'https://prod.kbap.site/api/home?lang=en',
      'https://prod.kbap.site/api/foods/selected?ids=743,444,432,325,300,629,435,248,414,445&lang=en',
    ].sort());
    for (const [, init] of calls) {
      expect(init.headers['X-API-Version']).toBe('1.1');
      expect(init.headers['Accept-Language']).toBe('en');
      expect(init.headers.Authorization).toBeUndefined();
    }
  } finally { global.fetch = originalFetch; }
});
