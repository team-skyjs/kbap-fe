/** KB-814 F3 — 가공식품 리뷰 사진 동의 저장(기기·1회) · 사진 삭제 요청 링크 · 문구 10로케일 */
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
/* eslint-disable import/first -- jest.mock 뒤 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { grantPackagedPhotoConsent, hasPackagedPhotoConsent, PACKAGED_PHOTO_CONSENT_KEY, resetPackagedPhotoConsentForTest } from '../packagedPhotoConsent';
import { photoRemovalHref } from '../reviewTarget';
/* eslint-enable import/first */

beforeEach(async () => {
  resetPackagedPhotoConsentForTest();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

it('동의 전 = false · 동의 = 기기 저장(v1 키) · 재실행(메모리 초기화)에도 기억', async () => {
  expect(await hasPackagedPhotoConsent()).toBe(false);
  await grantPackagedPhotoConsent();
  expect(await AsyncStorage.getItem(PACKAGED_PHOTO_CONSENT_KEY)).toBe('1');
  resetPackagedPhotoConsentForTest();
  expect(await hasPackagedPhotoConsent()).toBe(true);
});

it('저장 실패 = 이번 세션만 기억 · 읽기 실패 = 미동의(다시 묻는다)', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
  await grantPackagedPhotoConsent();
  expect(await hasPackagedPhotoConsent()).toBe(true);
  resetPackagedPhotoConsentForTest();
  expect(await hasPackagedPhotoConsent()).toBe(false); // 디스크엔 없다
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  expect(await hasPackagedPhotoConsent()).toBe(false);
});

it('사진 삭제 요청 링크 = 가공식품 리뷰만 · 제품명·리뷰 id 인코딩 · 음식 리뷰 = null', () => {
  expect(photoRemovalHref({ id: '77', target: 'packaged', foodName: 'Milk & Co' })).toBe('/profile/feedback/new?prefill=photoRemoval&reviewId=77&product=Milk%20%26%20Co');
  expect(photoRemovalHref({ id: '77', target: 'packaged', foodName: null })).toBe('/profile/feedback/new?prefill=photoRemoval&reviewId=77');
  expect(photoRemovalHref({ id: '77', target: 'food', foodName: 'Bibimbap' })).toBeNull();
});

it('문구: ugc 6키 + gate 2키 — 10로케일 빈 값 0 · 이모지 0 · 가운데 점·굽은 따옴표 0 · 프리필 자리표시자', () => {
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const j = require(`@/lib/i18n/${l}.json`) as { ugc: Record<string, string>; gate: Record<string, string> };
    expect({ l, keys: Object.keys(j.ugc).sort() }).toEqual({ l, keys: ['consentAgree', 'consentNoStock', 'consentRemoval', 'consentTitle', 'photoRemovalPrefill', 'photoRemovalRequest'] });
    const all = [...Object.values(j.ugc), j.gate.photoRemovalTitle, j.gate.photoRemovalSub];
    for (const v of all) expect(String(v).trim()).not.toBe('');
    expect(/\p{Extended_Pictographic}|[·‘’“”]/u.test(all.join(' '))).toBe(false);
    expect(j.ugc.photoRemovalPrefill).toContain('{{product}}');
    expect(j.ugc.photoRemovalPrefill).toContain('{{reviewId}}');
  }
});
