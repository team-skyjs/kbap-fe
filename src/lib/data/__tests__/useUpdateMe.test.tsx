/**
 * KB-68 반려 회귀: 기피성분(restrictions) 변경 성공 시 개인화 쿼리(홈·음식
 * 목록·상세)가 전부 무효화되어야 한다 — ['me']만 무효화하면 홈이 stale한
 * 위험도를 계속 보여주는 false-safe(성분 추가했는데 여전히 safe) 버그.
 * 비개인화 필드(닉네임)는 기존 범위(['me'])만 — 반려 비범위 보호.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn(), patch: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/onboarding/submit', () => ({ loadLocalSpice: jest.fn().mockResolvedValue(null) }));

import { useUpdateMe } from '../useMe';
import type { UserUpdate } from '@/lib/api/types';

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

it('restrictions 변경 → 개인화 쿼리(홈·목록·상세) 캐시가 비워진다', async () => {
  const qc = seededClient();
  await runMutation(qc, { restrictions: [{ kind: 'allergy', code: 'PEANUT' }] });
  expect(qc.getQueryData(['home', 'en'])).toBeUndefined();
  expect(qc.getQueryData(['foods', 'list', 'en'])).toBeUndefined();
  expect(qc.getQueryData(['food', 'bibimbap', 'en'])).toBeUndefined();
});

it('닉네임만 변경 → 개인화 쿼리는 유지 (비범위 보호)', async () => {
  const qc = seededClient();
  await runMutation(qc, { nickname: 'Mina' });
  expect(qc.getQueryData(['home', 'en'])).toBeDefined();
  expect(qc.getQueryData(['foods', 'list', 'en'])).toBeDefined();
  expect(qc.getQueryData(['food', 'bibimbap', 'en'])).toBeDefined();
});
