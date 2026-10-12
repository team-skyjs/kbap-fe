/**
 * KB-739 — 단위 ID 채널 분기(production만 실값, 그 외 Google 데모) · 플랫폼별 · 3개마다 삽입 인덱스·key 안정 · 전면 세션 상한 ·
 * 보상 응답 분기(429 limit / 4xx rejected / 네트워크) · i18n ads.* 10로케일 + 이모지 0.
 */
import * as fs from 'fs';
import { Platform } from 'react-native';

let mockProd = false;
jest.mock('@/lib/flags', () => ({ ...jest.requireActual('@/lib/flags'), isProdChannel: () => mockProd }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { AD_FORMAT, DEMO_UNITS, PROD_UNITS, adUnitId, unitFor, type AdPlacement } from '@/lib/ads/units';
import { FEED_AD_EVERY, withFeedAds } from '@/lib/ads/feedSlots';
import { _resetAdsSessionForTest, canShowInterstitial, markInterstitialShown } from '@/lib/ads/adsSession';
import { classifyAdRewardError } from '@/lib/data/useAdReward';
import { ApiError } from '@/lib/api/client';
/* eslint-enable import/first */

const PLACEMENTS = Object.keys(AD_FORMAT) as AdPlacement[];

describe('단위 ID(채널)', () => {
  it('production이 아니면 전부 Google 데모(pub-3940256099942544) — teamtest·dev·preview·웹 포함 · 플랫폼별', () => {
    for (const p of PLACEMENTS) {
      expect(unitFor(p, false, 'ios')).toMatch(/^ca-app-pub-3940256099942544\//);
      expect(unitFor(p, false, 'android')).toMatch(/^ca-app-pub-3940256099942544\//);
      expect(unitFor(p, false, 'ios')).not.toBe(unitFor(p, false, 'android'));
      expect(unitFor(p, false, 'ios')).toBe(DEMO_UNITS[AD_FORMAT[p]].ios);
    }
    // 발주 (2) 고정값
    expect(unitFor('search_banner', false, 'android')).toBe('ca-app-pub-3940256099942544/6300978111');
    expect(unitFor('search_banner', false, 'ios')).toBe('ca-app-pub-3940256099942544/2934735716');
    expect(unitFor('order_done_interstitial', false, 'android')).toBe('ca-app-pub-3940256099942544/1033173712');
    expect(unitFor('scan_unlock_rewarded', false, 'ios')).toBe('ca-app-pub-3940256099942544/1712485313');
    expect(unitFor('feed_native', false, 'android')).toBe('ca-app-pub-3940256099942544/2247696110');
  });

  it('production = 콘솔 실 단위(pub-7408893286425419) 5자리 × 2플랫폼, 전부 서로 다름', () => {
    const all = new Set<string>();
    for (const p of PLACEMENTS) for (const os of ['ios', 'android'] as const) {
      const u = unitFor(p, true, os);
      expect(u).toBe(PROD_UNITS[p][os]);
      expect(u).toMatch(/^ca-app-pub-7408893286425419\/\d{10}$/);
      all.add(u);
    }
    expect(all.size).toBe(PLACEMENTS.length * 2);
    expect(PROD_UNITS.scan_unlock_rewarded).toEqual({ android: 'ca-app-pub-7408893286425419/4681648821', ios: 'ca-app-pub-7408893286425419/9167688747' }); // 서버 허용 목록과 일치(KB-740)
  });

  it('adUnitId = isProdChannel() 양성 판별 — 목으로 전환', () => {
    mockProd = false;
    expect(adUnitId('search_banner')).toBe(DEMO_UNITS.banner[Platform.OS === 'android' ? 'android' : 'ios']);
    mockProd = true;
    expect(adUnitId('search_banner')).toBe(PROD_UNITS.search_banner[Platform.OS === 'android' ? 'android' : 'ios']);
    mockProd = false;
  });
});

describe('피드 삽입(3개마다)', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}` }));
  it('3개마다 광고 행 1개 — 2개면 0, 3개면 뒤에 1, 7개면 3·6 뒤에 2 · 광고 key는 순번(ad-1, ad-2) 고정', () => {
    expect(FEED_AD_EVERY).toBe(3);
    expect(withFeedAds(items(2), (x) => x.id).map((r) => r.key)).toEqual(['r1', 'r2']);
    expect(withFeedAds(items(3), (x) => x.id).map((r) => r.key)).toEqual(['r1', 'r2', 'r3', 'ad-1']);
    expect(withFeedAds(items(7), (x) => x.id).map((r) => r.key)).toEqual(['r1', 'r2', 'r3', 'ad-1', 'r4', 'r5', 'r6', 'ad-2', 'r7']);
  });
  it('페이지가 늘어도 앞 광고 행 key·위치 불변(리스트 key 안정)', () => {
    const a = withFeedAds(items(4), (x) => x.id);
    const b = withFeedAds(items(9), (x) => x.id);
    expect(b.slice(0, a.length).map((r) => r.key)).toEqual(a.map((r) => r.key));
    expect(b.filter((r) => r.kind === 'ad')).toHaveLength(3);
  });
});

describe('전면 세션 상한', () => {
  beforeEach(() => _resetAdsSessionForTest());
  it('세션당 1회 — 표시 뒤엔 false, 리셋(새 실행) 전까지 유지', () => {
    expect(canShowInterstitial()).toBe(true);
    markInterstitialShown();
    expect(canShowInterstitial()).toBe(false);
    markInterstitialShown();
    expect(canShowInterstitial()).toBe(false);
    _resetAdsSessionForTest();
    expect(canShowInterstitial()).toBe(true);
  });
});

describe('보상 응답 분기', () => {
  it('429 MEMBER-014 = limit(오늘은 여기까지) · 400 COMMON-002 = rejected(재시도 없이 닫기) · 그 외 = network(재시도)', () => {
    expect(classifyAdRewardError(new ApiError('limit', 429, 'MEMBER-014'))).toBe('limit');
    expect(classifyAdRewardError(new ApiError('limit', 200, 'MEMBER-014'))).toBe('limit'); // 코드 우선
    expect(classifyAdRewardError(new ApiError('bad', 400, 'COMMON-002'))).toBe('rejected');
    expect(classifyAdRewardError(new ApiError('gone', 400, 'MEMBER-003'))).toBe('rejected');
    expect(classifyAdRewardError(new ApiError('down', 503))).toBe('network');
    expect(classifyAdRewardError(new TypeError('Network request failed'))).toBe('network');
  });
});

describe('/review 9·10·11 소스 잠금', () => {
  it('광고 신고 행 = 회원·게스트 분기 둘 다(Apple 2.5.18) · 문의 작성 프리필·이탈 확인은 프리필을 비어 있음으로', () => {
    const profile = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8');
    expect(profile.match(/testID="profile-menu-ad-report"/g)).toHaveLength(2);
    const compose = fs.readFileSync('src/app/profile/feedback/new.tsx', 'utf8');
    expect(compose).toContain("prefill === 'ad' ? t('ads.reportPrefill') : ''");
    expect(compose).toContain("useLeaveConfirm((body.trim().length > 0 && body.trim() !== initialBody.trim()) || photos.length > 0");
  });
  it('Android 알림 채널 sound 옵션 없음(생략 = 시스템 기본음) — expo-notifications 57은 sound를 커스텀 파일명으로 검증해 "default"에 경고·무음 위험', () => {
    const push = fs.readFileSync('src/lib/push/pushAdapter.ts', 'utf8');
    const channels = push.match(/setNotificationChannelAsync\([^)]*\)/g) ?? [];
    expect(channels.length).toBeGreaterThanOrEqual(2);
    for (const c of channels) expect(c).not.toMatch(/sound/);
  });
});

it('i18n: ads.* 7키 — 10로케일 동일 키 집합·빈 값 0·이모지 0 · watchToUnlock에 {{n}}/{{total}} · ko 해요체', () => {
  const locales = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
  const keys = ['sponsored', 'privacyOptions', 'report', 'reportPrefill', 'watchToUnlock', 'rewardLimit', 'rewardError'];
  for (const l of locales) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ads = (require(`@/lib/i18n/${l}.json`) as { ads: Record<string, string> }).ads;
    expect({ l, keys: Object.keys(ads).sort() }).toEqual({ l, keys: [...keys].sort() });
    for (const k of keys) expect(String(ads[k]).trim()).not.toBe('');
    expect(/\p{Extended_Pictographic}/u.test(JSON.stringify(ads))).toBe(false);
    expect(ads.watchToUnlock).toContain('{{n}}');
    expect(ads.watchToUnlock).toContain('{{total}}');
  }
  const ko = (require('@/lib/i18n/ko.json') as { ads: Record<string, string> }).ads;
  expect(ko.rewardLimit).toMatch(/요\.$/);
  expect(ko.rewardError).toMatch(/요\.$/);
});
