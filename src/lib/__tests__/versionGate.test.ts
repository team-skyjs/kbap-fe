/**
 * P-111(KB-269): 버전 게이트 잠금 — semver 경계·판정 3모드·**페일 오픈**(조회
 * 실패·형식 불량·필드 누락 = 무조건 통과, 게이트로 인한 벽돌 금지).
 */
jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn() } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));

import { compareSemver, parseSemver } from '../semver';
import { adaptAppConfig, type AppConfig } from '../api/appConfigAdapter';
import { evaluateGate, getVersionGateState, refreshVersionGate, __resetVersionGate } from '../versionGate';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client');

const CFG: AppConfig = {
  minSupportedVersion: '1.0.0',
  latestVersion: '1.2.0',
  storeUrls: { ios: 'https://apps.apple.com/app/id6788635067', android: 'https://play.google.com/store/apps/details?id=com.rocher.kbap' },
};

describe('semver — 경계값', () => {
  it('같음 0 · 미만 음수 · 초과 양수 (자릿수 숫자 비교 — 1.0.10 > 1.0.9)', () => {
    expect(compareSemver('1.0.1', '1.0.1')).toBe(0);
    expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareSemver('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.10', '1.0.9')).toBeGreaterThan(0); // 문자열 비교였다면 틀리는 케이스
  });
  it('형식 불량 → null (페일 오픈 신호)', () => {
    expect(compareSemver('1.0', '1.0.1')).toBeNull();
    expect(compareSemver('1.0.1', 'v1.0.1')).toBeNull();
    expect(compareSemver('1.0.1-beta', '1.0.1')).toBeNull();
    expect(parseSemver(101)).toBeNull();
  });
});

describe('adaptAppConfig — 페일 오픈 방어', () => {
  it('정상 계약 수신', () => {
    expect(adaptAppConfig({ minSupportedVersion: '1.0.0', latestVersion: '1.2.0', storeUrls: { ios: 'https://a', android: 'https://b' } }))
      .toEqual({ minSupportedVersion: '1.0.0', latestVersion: '1.2.0', storeUrls: { ios: 'https://a', android: 'https://b' } });
  });
  it('min 누락/형식 불량/비객체 → null (게이트 성립 불가)', () => {
    expect(adaptAppConfig({ latestVersion: '1.2.0' })).toBeNull();
    expect(adaptAppConfig({ minSupportedVersion: 'oops' })).toBeNull();
    expect(adaptAppConfig(null)).toBeNull();
    expect(adaptAppConfig('1.0.0')).toBeNull();
  });
  it('latest 불량·storeUrls 누락은 부분 수용 (하드 게이트는 유지 가능해야)', () => {
    expect(adaptAppConfig({ minSupportedVersion: '1.0.0', latestVersion: 'bad' }))
      .toEqual({ minSupportedVersion: '1.0.0', latestVersion: null, storeUrls: { ios: null, android: null } });
  });
});

describe('evaluateGate — 3모드', () => {
  it('min 미만 → blocked (+플랫폼 스토어 URL)', () => {
    expect(evaluateGate(CFG, '0.9.9', 'android')).toEqual({ mode: 'blocked', storeUrl: CFG.storeUrls.android });
    expect(evaluateGate(CFG, '0.9.9', 'ios')).toEqual({ mode: 'blocked', storeUrl: CFG.storeUrls.ios });
  });
  it('min 이상 latest 미만 → nudge (min과 같아도 통과 쪽)', () => {
    expect(evaluateGate(CFG, '1.0.0', 'ios')).toMatchObject({ mode: 'nudge', latestVersion: '1.2.0' });
    expect(evaluateGate(CFG, '1.1.5', 'ios')).toMatchObject({ mode: 'nudge' });
  });
  it('latest 이상 → pass (같음·초과)', () => {
    expect(evaluateGate(CFG, '1.2.0', 'ios')).toEqual({ mode: 'pass' });
    expect(evaluateGate(CFG, '2.0.0', 'ios')).toEqual({ mode: 'pass' });
  });
  it('페일 오픈 — cfg null·현재 버전 부재·semver 불량 전부 pass', () => {
    expect(evaluateGate(null, '1.0.1', 'ios')).toEqual({ mode: 'pass' });
    expect(evaluateGate(CFG, undefined, 'ios')).toEqual({ mode: 'pass' });
    expect(evaluateGate(CFG, 'not-a-version', 'ios')).toEqual({ mode: 'pass' });
    expect(evaluateGate({ ...CFG, latestVersion: null }, '1.0.0', 'ios')).toEqual({ mode: 'pass' }); // latest 없음 = 넛지 미동작
  });
});

describe('refreshVersionGate — 조회 계층 페일 오픈', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetVersionGate();
  });

  it('404/네트워크 실패 → throw 없이 통과(pass) 유지', async () => {
    api.get.mockRejectedValueOnce(new Error('HTTP 404'));
    await expect(refreshVersionGate(true)).resolves.toBeUndefined();
    expect(getVersionGateState()).toEqual({ mode: 'pass' });
  });

  it('파싱 불가 페이로드 → 통과 (adapt null 경로)', async () => {
    api.get.mockResolvedValueOnce({ garbage: true });
    await refreshVersionGate(true);
    expect(getVersionGateState()).toEqual({ mode: 'pass' });
  });

  it('min 미만 응답 → blocked 상태 반영 (앱 1.0.1 목 vs min 2.0.0)', async () => {
    api.get.mockResolvedValueOnce({ minSupportedVersion: '2.0.0', latestVersion: '2.0.0', storeUrls: {} });
    await refreshVersionGate(true);
    expect(getVersionGateState()).toMatchObject({ mode: 'blocked' });
  });

  it('blocked 후 일시 오프라인 → blocked 유지 (오류로 게이트 해제 금지)', async () => {
    api.get.mockResolvedValueOnce({ minSupportedVersion: '2.0.0' });
    await refreshVersionGate(true);
    api.get.mockRejectedValueOnce(new Error('NETWORK'));
    await refreshVersionGate(true);
    expect(getVersionGateState()).toMatchObject({ mode: 'blocked' });
  });

  it('5분 내 재조회 스킵 · force는 통과', async () => {
    api.get.mockResolvedValue({ minSupportedVersion: '1.0.0' });
    await refreshVersionGate(true);
    await refreshVersionGate(); // 5분 내 — 스킵
    expect(api.get).toHaveBeenCalledTimes(1);
    await refreshVersionGate(true); // force
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
