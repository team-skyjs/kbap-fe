/**
 * KB-68 반려 회귀: 기피성분(restrictions) 변경 성공 시 개인화 쿼리(홈·음식
 * 목록·상세)가 전부 무효화되어야 한다 — ['me']만 무효화하면 홈이 stale한
 * 위험도를 계속 보여주는 false-safe(성분 추가했는데 여전히 safe) 버그.
 * 비개인화 필드(닉네임)는 기존 범위(['me'])만 — 반려 비범위 보호.
 *
 * 2차 반려: clear()는 캐시 제거만 하고 마운트된 옵저버(탭 화면)를 재조회시키지
 * 않는다 → invalidateQueries()로 교체. 그래서 단언도 "캐시 제거"가 아니라
 * "invalidated 마킹"(활성 쿼리는 즉시 재조회되는 상태)을 본다.
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn(), patch: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn().mockResolvedValue(true) }));
// KB-389 2차: 채널 목 — 기본 dev(1.1 헤더), prod 케이스만 플립(spice 송신은 채널 무관 문자열)
const CHANNEL = { prod: false };
jest.mock('@/lib/flags', () => ({ FLAGS: { avoidGroupCodesEnabled: true }, isProdChannel: () => CHANNEL.prod, isDevServerChannel: () => true })); // KB-870: dev 서버 채널(묶음 코드·리뷰 3.2)
jest.mock('@/lib/onboarding/submit', () => ({
  loadLocalSpice: jest.fn().mockResolvedValue(null),
  SPICE_KEY: 'kbap.profile.spice.v1', // useMe가 submit에서 import (P-010 중복 해소)
}));

import { useUpdateMe } from '../useMe';
import type { UserUpdate } from '@/lib/api/types';

/* eslint-disable @typescript-eslint/no-require-imports */
// 공식 jest mock은 CJS(module.exports) — interop에 따라 default 유무가 갈려 둘 다 수용
const asMod = require('@react-native-async-storage/async-storage');
const AsyncStorage = asMod.default ?? asMod;
const { api } = require('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */

function Harness({ patch, onSettled }: { patch: UserUpdate; onSettled: () => void }) {
  const update = useUpdateMe();
  React.useEffect(() => {
    update.mutate(patch, { onSettled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

async function runMutation(qc: QueryClient, patch: UserUpdate) {
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  // effect(→mutate)는 act 스코프가 닫힐 때 flush되므로, create와 대기를 같은
  // act에 두면 데드락 — 분리해서 두 번째 act에서 settle을 기다린다.
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Harness patch={patch} onSettled={settled} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await done;
    await new Promise((r) => setTimeout(r, 0)); // onSuccess 내부 async(hasBeSession) 해소
  });
}

function seededClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['home', 'en'], { recommended: [] });
  qc.setQueryData(['foods', 'list', 'en'], []);
  qc.setQueryData(['food', 'bibimbap', 'en'], { risk: 'safe' });
  return qc;
}

const isInvalidated = (qc: QueryClient, key: unknown[]) =>
  qc.getQueryCache().find({ queryKey: key })?.state.isInvalidated ?? false;

it('restrictions 변경 → KB-954: 위험도 쿼리(홈·목록·상세·북마크·가공식품)는 reset(옛 판정 데이터 0 — 재조회 동안 스켈레톤) · 나머지는 invalidated(데이터 유지)', async () => {
  const qc = seededClient();
  qc.setQueryData(['bookmarks'], []);
  qc.setQueryData(['processedFoods', 'search', '', null, 'en|member:', null], { pages: [] });
  qc.setQueryData(['curations', 'seoul', 'en'], { items: ['c1'] }); // 위험도 없는 키
  await runMutation(qc, { restrictions: [{ kind: 'allergy', code: 'PEANUT' }] });
  await new Promise((r) => setTimeout(r, 0));
  for (const key of [['home', 'en'], ['foods', 'list', 'en'], ['food', 'bibimbap', 'en'], ['bookmarks'], ['processedFoods', 'search', '', null, 'en|member:', null]]) {
    expect({ key, data: qc.getQueryData(key) }).toEqual({ key, data: undefined }); // reset = 옛 Safe를 보여 줄 데이터가 없다
  }
  expect(isInvalidated(qc, ['curations', 'seoul', 'en'])).toBe(true);
  expect(qc.getQueryData(['curations', 'seoul', 'en'])).toEqual({ items: ['c1'] });
});

it('닉네임만 변경 → 개인화 쿼리는 invalidate되지 않는다 (비범위 보호)', async () => {
  const qc = seededClient();
  await runMutation(qc, { nickname: 'Mina' });
  expect(isInvalidated(qc, ['home', 'en'])).toBe(false);
  expect(isInvalidated(qc, ['foods', 'list', 'en'])).toBe(false);
  expect(isInvalidated(qc, ['food', 'bibimbap', 'en'])).toBe(false);
});

// KB-150 → P-081 enum → P-084 스왑: 와이어 = enum 문자열 통과(spiceAdapter 격리).
// 해제(SKIP)도 문자열 'SKIP' 전송(서버 왕복 후에도 미설정 유지).
it('spice 패치(HOT) → 문자열 HOT 전송 + 로컬 fallback enum 보관 (P-084)', async () => {
  const qc = seededClient();
  qc.setQueryData(['me', 'en'], { nickname: 'A' });
  await runMutation(qc, { spiceTolerance: 'HOT' });
  expect(api.patch).toHaveBeenCalledWith('/members/me/profile', { spicinessPreference: 'HOT' }, { headers: { 'X-API-Version': '1.1' } });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('kbap.profile.spice.v1', 'HOT'); // 마이그레이션 fallback
  expect(isInvalidated(qc, ['me', 'en'])).toBe(true); // 재조회 → 서버 값 우선(adaptSpice)
});

it('prod 채널 목에서도 spice = enum 문자열 + 1.1 헤더 (KB-389 2차 + KB-418 P-209 분기 소멸)', async () => {
  CHANNEL.prod = true;
  try {
    const qc = seededClient();
    await runMutation(qc, { spiceTolerance: 'HOT' });
    // KB-418: PATCH 헤더 채널 분기 제거 — 전 채널 1.1(prod 서버 1.1+ 핸들러 실측)
    expect(api.patch).toHaveBeenCalledWith('/members/me/profile', { spicinessPreference: 'HOT' }, { headers: { 'X-API-Version': '1.1' } });
  } finally {
    CHANNEL.prod = false;
  }
});

it('spice SKIP(설정 해제) → 문자열 SKIP 전송 + 로컬 키 제거', async () => {
  const qc = seededClient();
  await runMutation(qc, { spiceTolerance: 'SKIP' });
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('kbap.profile.spice.v1');
  expect(api.patch).toHaveBeenCalledWith('/members/me/profile', { spicinessPreference: 'SKIP' }, { headers: { 'X-API-Version': '1.1' } });
});

it('spice NONE("맵지 않음")은 NONE 전송 — SKIP(미설정)과 구분 잠금', async () => {
  const qc = seededClient();
  await runMutation(qc, { spiceTolerance: 'NONE' });
  expect(api.patch).toHaveBeenCalledWith('/members/me/profile', { spicinessPreference: 'NONE' }, { headers: { 'X-API-Version': '1.1' } });
});

// P-016(KB-149 최종): 사진 삭제 = 기본 path 전송 (null 폐기 — 필드는 항상 값) —
// 생략=유지와 구분: undefined만 미전송
it('profileImageUrl 기본 path (삭제) → PATCH body 포함 + ["me"] invalidate', async () => {
  const qc = seededClient();
  qc.setQueryData(['me', 'en'], { nickname: 'A', profileImageUrl: 'https://cdn/p.jpg' });
  await runMutation(qc, { profileImageUrl: 'images/default/profile/profile-default-512.png' });
  expect(api.patch).toHaveBeenCalledWith('/members/me/profile', {
    profileImageUrl: 'images/default/profile/profile-default-512.png',
  }, { headers: { 'X-API-Version': '1.1' } });
  expect(isInvalidated(qc, ['me', 'en'])).toBe(true);
});

// P-006(KB-149 후속): 프로필 사진 — 업로드된 path(objectKey)가 PATCH body로 나간다
it('profileImageUrl 패치 → PATCH body에 path 포함 + ["me"] invalidate (서버 조합 URL 재조회)', async () => {
  const qc = seededClient();
  qc.setQueryData(['me', 'en'], { nickname: 'A' });
  await runMutation(qc, { profileImageUrl: 'profile/1/a.jpg' });
  expect(api.patch).toHaveBeenCalledWith('/members/me/profile', { profileImageUrl: 'profile/1/a.jpg' }, { headers: { 'X-API-Version': '1.1' } });
  expect(isInvalidated(qc, ['me', 'en'])).toBe(true);
});

// P-078(KB-192 일부, 7/29 정책): 국적 수정 불가 — PATCH body에 countryCode 부재 잠금
it('P-078: patch에 nationality류가 섞여도 PATCH body에 countryCode 없음', async () => {
  const qc = seededClient();
  qc.setQueryData(['me', 'en'], { nickname: 'A' });
  // UserUpdate에서 필드 자체가 제거됨 — 런타임 우회 주입도 매핑이 무시하는지 잠금
  await runMutation(qc, { nickname: 'B', nationality: 'KR' } as never);
  const body = (api.patch as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
  expect('countryCode' in body).toBe(false);
  expect(body.nickname).toBe('B');
});

it('P-243(BE #179): dietCategories 패치 → 풀 셋 전송 · 빈 배열(전부 해제)도 전송 · 회피와 한 요청', async () => {
  await runMutation(seededClient(), { dietCategories: ['VEGAN'] });
  expect(api.patch).toHaveBeenCalledWith('/members/me/profile', { dietCategories: ['VEGAN'] }, { headers: { 'X-API-Version': '1.1' } });
  await runMutation(seededClient(), { dietCategories: [] }); // 해제 실동작 — 빈 배열 = 전부 끔
  expect(api.patch).toHaveBeenLastCalledWith('/members/me/profile', { dietCategories: [] }, { headers: { 'X-API-Version': '1.1' } });
  // 식이 페이지 저장 = 두 필드 한 요청(P-243 ②)
  await runMutation(seededClient(), { dietCategories: ['VEGAN'], restrictions: [{ kind: 'allergy', code: 'EGG' }] });
  const body = (api.patch as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
  expect(body.dietCategories).toEqual(['VEGAN']);
  expect(body.avoidanceSubstanceCodes).toEqual(['EGG']);
});

it('KB-843(서버 백필 #448 짝): 서버 프로필에 있던 앱이 모르는 코드(FUTURE_X) = 보존해 다시 보낸다 · 서버에 없던 미지 값·레거시 잔재 = 드롭', async () => {
  const qc = seededClient();
  const lang = (jest.requireActual('@/lib/i18n') as { default: { language: string } }).default.language;
  qc.setQueryData(['me', lang], { restrictions: [{ kind: 'allergy', code: 'EGG' }, { kind: 'allergy', code: 'FUTURE_X' }] });
  await runMutation(qc, { restrictions: [{ kind: 'allergy', code: 'EGG' }, { kind: 'allergy', code: 'FUTURE_X' }, { kind: 'allergy', code: 'BOGUS_Y' }, { kind: 'allergy', code: 'ing:unknown-thing' }, { kind: 'allergy', code: 'ing:cheese' }] });
  const body = (api.patch as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
  expect(body.avoidanceSubstanceCodes).toEqual(['EGG', 'FUTURE_X', 'CHEESE']);
});

it('P-165(#145): currency 패치 → PATCH body 포함 · null(해제)도 전송(국적 폴백 복귀)', async () => {
  await runMutation(seededClient(), { currency: 'THB' });
  expect(api.patch).toHaveBeenCalledWith('/members/me/profile', { currency: 'THB' }, { headers: { 'X-API-Version': '1.1' } });
  await runMutation(seededClient(), { currency: null });
  expect(api.patch).toHaveBeenLastCalledWith('/members/me/profile', { currency: null }, { headers: { 'X-API-Version': '1.1' } });
});

describe('Codex #388 P1: 프로필 재조회가 바뀐 회피를 발견하면 위험도 캐시 reset(다른 기기 변경 → 당김·재탭·앱 복귀)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fetchMe, noteAppliedRestrictions, resetAppliedRestrictionsForTest } = require('../useMe') as typeof import('../useMe');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { queryClient } = require('@/lib/queryClient') as typeof import('@/lib/queryClient');
  const wire = (codes: string[]) => ({ memberId: 41, nickname: 'A', countryCode: 'US', avoidanceSubstanceCodes: codes, ranking: null });
  const seed = () => {
    queryClient.setQueryData(['home', 'en'], { recommended: [] });
    queryClient.setQueryData(['foods', 'list', 'en'], []);
    queryClient.setQueryData(['curations', 'seoul', 'en'], { items: ['c1'] });
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  beforeEach(() => { resetAppliedRestrictionsForTest(); queryClient.clear(); });

  it('첫 프로필 = 기준만(reset 0) · 같은 집합(순서만 다름) = reset 0 · 다른 집합 = 위험도 키만 reset(나머지·me 재조회 0)', async () => {
    seed();
    api.get.mockResolvedValueOnce(wire(['PEANUT', 'MILK']));
    await fetchMe(); await tick();
    expect(queryClient.getQueryData(['home', 'en'])).toEqual({ recommended: [] }); // 첫 프로필 = 기준만
    api.get.mockResolvedValueOnce(wire(['MILK', 'PEANUT']));
    await fetchMe(); await tick();
    expect(queryClient.getQueryData(['home', 'en'])).toEqual({ recommended: [] }); // 같은 집합
    api.get.mockResolvedValueOnce(wire(['MILK', 'PEANUT', 'SHRIMP'])); // 다른 기기에서 SHRIMP 추가
    await fetchMe(); await tick();
    expect(queryClient.getQueryData(['home', 'en'])).toBeUndefined(); // reset = 옛 판정 데이터 0
    expect(queryClient.getQueryData(['foods', 'list', 'en'])).toBeUndefined();
    expect(queryClient.getQueryData(['curations', 'seoul', 'en'])).toEqual({ items: ['c1'] }); // 위험도 아닌 키 무변
    expect(queryClient.getQueryState(['curations', 'seoul', 'en'])?.isInvalidated).toBe(false); // riskOnly — 루프 0
  });
  it('이 기기의 회피 저장 = 새 기준을 먼저 적어 둠 → 뒤따르는 프로필 재조회는 reset 0(중복 reset 0)', async () => {
    api.get.mockResolvedValueOnce(wire(['MILK']));
    await fetchMe(); await tick();
    noteAppliedRestrictions(['SHRIMP', 'MILK']); // useUpdateMe onSuccess가 하는 일
    seed();
    api.get.mockResolvedValueOnce(wire(['MILK', 'SHRIMP']));
    await fetchMe(); await tick();
    expect(queryClient.getQueryData(['home', 'en'])).toEqual({ recommended: [] });
    expect(fs.readFileSync('src/lib/data/useMe.ts', 'utf8')).toMatch(/noteAppliedRestrictions\(patch\.restrictions[\s\S]{0,140}void resetPersonalizedQueries\(qc\);/);
  });
});
