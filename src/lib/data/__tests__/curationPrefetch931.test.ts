/** KB-931 — 홈 큐레이션 섹션이 그려지면 모음 상세 첫 화면 사진(모음당 2장)을 미리 받는다 · 상세는 같은 캐시 키 · 실패는 조용히 */
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'en', ApiError: class extends Error {} }));
const mockPrefetch = jest.fn((_urls: string[]) => Promise.resolve(true));
jest.mock('expo-image', () => ({ Image: { prefetch: (urls: string[]) => mockPrefetch(urls) } }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { QueryClient } from '@tanstack/react-query';
import { PREFETCH_PER_COLLECTION, prefetchCurationCovers } from '@/lib/data/useCurations';

const item = (key: string, i: number) => ({ entryId: `${key}${i}`, position: i, name: `N${i}`, area: 'A', introduction: '', recommendationReason: '', imageUrl: i === 3 ? '' : `https://cdn/${key}/${i}.jpg`, externalUrl: '' });
const detail = (key: string) => ({ collectionKey: key, title: key, description: '', coverImageUrl: `https://cdn/${key}/cover.jpg`, fallbackUsed: false, items: [3, 1, 2].map((i) => item(key, i)) });

describe('prefetchCurationCovers', () => {
  beforeEach(() => { mockGet.mockReset(); mockPrefetch.mockClear(); });
  it('모음마다 상세 첫 화면(position 순) 앞 2장 = 최대 6장 · 한 번에 Image.prefetch · 상세는 화면과 같은 캐시 키(진입 = 재요청 0)', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve(detail(/seoul\/(\w+)/.exec(url)![1])));
    const qc = new QueryClient();
    const urls = await prefetchCurationCovers(qc, ['a', 'b', 'c'], 'en');
    expect(PREFETCH_PER_COLLECTION).toBe(2);
    expect(urls).toEqual(['a', 'b', 'c'].flatMap((k) => [`https://cdn/${k}/1.jpg`, `https://cdn/${k}/2.jpg`]));
    expect(mockPrefetch).toHaveBeenCalledTimes(1);
    expect(mockPrefetch.mock.calls[0][0]).toHaveLength(6);
    expect(qc.getQueryData(['curations', 'seoul', 'a', 'en'])).toBeTruthy();
    await prefetchCurationCovers(qc, ['a', 'b', 'c'], 'en');
    expect(mockGet).toHaveBeenCalledTimes(3); // 캐시(5분) 안 = 상세 재요청 0
  });
  it('Codex #376 P2: 카드와 같은 사진 — images[0] ≠ imageUrl이면 images[0]을 받는다 · images 없으면 imageUrl', async () => {
    mockGet.mockImplementation(() => Promise.resolve({ ...detail('a'), items: [
      { ...item('a', 1), images: [{ url: 'https://cdn/a/gallery-1.jpg' }, { url: 'https://cdn/a/gallery-1b.jpg' }] },
      item('a', 2),
    ] }));
    const urls = await prefetchCurationCovers(new QueryClient(), ['a'], 'en');
    expect(urls).toEqual(['https://cdn/a/gallery-1.jpg', 'https://cdn/a/2.jpg']);
    expect(urls).not.toContain('https://cdn/a/1.jpg');
  });
  it('한 모음 상세 실패 = 그 모음만 빠짐(조용히) · 전부 실패 = prefetch 호출 0', async () => {
    mockGet.mockImplementation((url: string) => (url.includes('/b?') ? Promise.reject(new Error('503')) : Promise.resolve(detail(/seoul\/(\w+)/.exec(url)![1]))));
    const urls = await prefetchCurationCovers(new QueryClient(), ['a', 'b'], 'en');
    expect(urls).toEqual(['https://cdn/a/1.jpg', 'https://cdn/a/2.jpg']);
    mockPrefetch.mockClear();
    mockGet.mockReset().mockRejectedValue(new Error('down'));
    expect(await prefetchCurationCovers(new QueryClient(), ['a'], 'en')).toEqual([]);
    expect(mockPrefetch).not.toHaveBeenCalled();
  });
});
