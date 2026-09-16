/**
 * KB-499 — 상대 시각 4단계 규칙 잠금(FR-004, SC-002 경계 9종). 알림함이 커뮤니티 공용 timeAgo를 재사용한다.
 * 실 로케일 리소스(ko·en·zh-Hans)로 문구까지 확인 — ko "방금 전"·zh 일 단위 공백 0.
 */
import * as fs from 'fs';
import * as path from 'path';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0, inOut: () => () => 0, cubic: () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));

import { timeAgo } from '@/features/community/parts';

const dir = path.join(__dirname, '..', '..', '..', 'lib', 'i18n');
const load = (l: string) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')) as Record<string, Record<string, string>>;
const tFor = (l: string) => {
  const d = load(l);
  return ((k: string, o?: { count?: number }) => {
    const [ns, key] = k.split('.');
    const v = d[ns][key];
    return o?.count != null ? v.replace('{{count}}', String(o.count)) : v;
  }) as unknown as Parameters<typeof timeAgo>[1];
};

const T0 = Date.parse('2026-09-16T12:00:00Z');
const S = 1000, M = 60 * S, H = 60 * M;
const iso = (deltaMs: number) => new Date(T0 - deltaMs).toISOString();

beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(T0));
afterEach(() => jest.restoreAllMocks());

it('ko 경계 9종 — 방금 전 / N분 전 / N시간 전 / N일 전 (내림, 미래 = 방금 전)', () => {
  const t = tFor('ko');
  const cases: [number, string][] = [
    [59 * S, '방금 전'],
    [60 * S, '1분 전'],
    [59 * M, '59분 전'],
    [60 * M, '1시간 전'],
    [23 * H, '23시간 전'],
    [24 * H, '1일 전'],
    [47 * H, '1일 전'],
    [48 * H, '2일 전'],
    [-5 * M, '방금 전'], // 기기 시계 오차로 미래
  ];
  for (const [delta, expected] of cases) expect({ delta, v: timeAgo(iso(delta), t) }).toEqual({ delta, v: expected });
});

it('en·zh-Hans — 같은 규칙, 로케일 문구(zh 일 단위 공백 없음)', () => {
  expect(timeAgo(iso(60 * S), tFor('en'))).toBe('1m ago');
  expect(timeAgo(iso(30 * S), tFor('en'))).toBe('Just now');
  expect(timeAgo(iso(48 * H), tFor('zh-Hans'))).toBe('2天前');
  expect(timeAgo(iso(48 * H), tFor('zh-Hant'))).toBe('2天前');
});
