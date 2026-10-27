/** KB-877 — 가공식품 1시간 무료 창 표시(서버 freeUntil만 — 앱 창 계산 0) */
import * as React from 'react';
import fs from 'fs';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { QueryClient } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
let mockUntil: string | null | undefined = null;
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '41', restrictions: [], packagedFreeUntil: mockUntil } }) }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { PackagedFreeLine, applyFreeUntil, freeMinutesLeft } from '../packagedFreeHour';
import { adaptLabelScan, adaptScanConfirm } from '@/lib/api/processedFoodAdapter';
/* eslint-enable import/first */

const T0 = Date.parse('2026-10-27T03:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const trees: ReactTestRenderer[] = [];
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const line = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'pscan-free-line' && typeof n.props.children === 'string')[0]?.props.children as string | undefined;
beforeEach(() => { jest.useFakeTimers({ now: T0 }); mockUntil = null; });
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.useRealTimers(); jest.restoreAllMocks(); });

describe('남은 분 계산(표시용) — 끝 시각은 서버 값 그대로', () => {
  it('없음·해석 불가·지남 = 0 · 남으면 분 올림', () => {
    expect(freeMinutesLeft(null, T0)).toBe(0);
    expect(freeMinutesLeft('nope', T0)).toBe(0);
    expect(freeMinutesLeft(iso(T0 - 1), T0)).toBe(0);
    expect(freeMinutesLeft(iso(T0), T0)).toBe(0);
    expect(freeMinutesLeft(iso(T0 + 90_000), T0)).toBe(2);
    expect(freeMinutesLeft(iso(T0 + 60 * 60_000), T0)).toBe(60);
  });
  it('어댑터: freeUntil = 서버 ISO 그대로 · 없음·빈 값·해석 불가 = null(창 없음)', () => {
    const base = { analysisId: 'A', state: 'CONFIRMED', charged: true, product: null };
    expect(adaptScanConfirm({ ...base, freeUntil: '2026-10-27T04:00:00Z' }).freeUntil).toBe('2026-10-27T04:00:00Z');
    expect(adaptScanConfirm({ ...base }).freeUntil).toBeNull();
    expect(adaptScanConfirm({ ...base, freeUntil: 'garbage' }).freeUntil).toBeNull();
    expect(adaptLabelScan({ analysisId: 'L', state: 'LABEL_RESULT', labelSource: 'NONE', charged: false, freeUntil: '' } as never).freeUntil).toBeNull();
  });
});

describe('PackagedFreeLine', () => {
  it('freeUntil 있음 = "N분 무료" · 분마다 줄어듦 · 끝나면 사라짐', () => {
    mockUntil = iso(T0 + 42 * 60_000);
    const t = render(<PackagedFreeLine />);
    expect(line(t)).toBe('packagedScan.freeFor:{"count":42}');
    act(() => { jest.advanceTimersByTime(60_000); });
    expect(line(t)).toBe('packagedScan.freeFor:{"count":41}');
    act(() => { jest.advanceTimersByTime(41 * 60_000 + 15_000); });
    expect(line(t)).toBeUndefined();
  });
  it('freeUntil 없음(null·부재) = 아무것도 안 그림', () => {
    mockUntil = null;
    expect(render(<PackagedFreeLine />).toJSON()).toBeNull();
    mockUntil = undefined;
    expect(render(<PackagedFreeLine />).toJSON()).toBeNull();
  });
  it('포그라운드 복귀 = 즉시 다시 셈(백그라운드 동안 타이머가 멈춰도 늦지 않음)', () => {
    const handlers: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, h: (s: string) => void) => { handlers.push(h); return { remove: () => {} }; }) as never);
    mockUntil = iso(T0 + 30 * 60_000);
    const t = render(<PackagedFreeLine />);
    expect(line(t)).toBe('packagedScan.freeFor:{"count":30}');
    jest.setSystemTime(T0 + 20 * 60_000); // 백그라운드 20분 — 타이머는 안 돌았다
    act(() => handlers.forEach((h) => h('active')));
    expect(line(t)).toBe('packagedScan.freeFor:{"count":10}');
  });
});

describe('applyFreeUntil — 응답의 창을 프로필 캐시에 바로 반영', () => {
  it('프로필(["me", lang])만 갱신 · ["me","reviews"] 목록은 그대로 · 캐시 없으면 무변', () => {
    const qc = new QueryClient();
    qc.setQueryData(['me', 'en'], { id: '41', restrictions: [], packagedFreeUntil: null });
    qc.setQueryData(['me', 'reviews'], [{ id: 'r1' }]);
    applyFreeUntil(qc, '2026-10-27T04:00:00Z');
    expect(qc.getQueryData(['me', 'en'])).toMatchObject({ packagedFreeUntil: '2026-10-27T04:00:00Z' });
    expect(qc.getQueryData(['me', 'reviews'])).toEqual([{ id: 'r1' }]);
    applyFreeUntil(new QueryClient(), null);
  });
});

describe('문구 잠금(K112)', () => {
  const load = (l: string) => JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')) as Record<string, Record<string, unknown>>;
  const flat = (o: unknown, p = ''): [string, string][] =>
    o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => flat(v, `${p}${k}.`)) : [[p.slice(0, -1), String(o)]];
  it('가공식품 문구에 차감 표현 0(en·ko) — "스캔 1회 사용"·"uses 1 scan"류', () => {
    const en = [...flat(load('en').packagedScan, 'packagedScan.'), ...flat(load('en').packaged, 'packaged.')];
    const ko = [...flat(load('ko').packagedScan, 'packagedScan.'), ...flat(load('ko').packaged, 'packaged.')];
    // err.quota* = 소진 상태 안내(스캔마다의 차감 문구 아님 — 창 안에선 서버가 SCAN-004를 안 보낸다)는 대상 밖
    const scope = ([k]: [string, string]) => !/^packagedScan\.err\.quota/.test(k);
    expect(en.filter(scope).filter(([, v]) => /\b(uses?|used)\b[^.]*\bscans?\b|\bscans?\b[^.]*\b(used|charged?)\b|no extra scan/i.test(v))).toEqual([]);
    expect(ko.filter(scope).filter(([, v]) => /스캔\s*1회|차감|사용돼요|사용되지\s*않/.test(v))).toEqual([]);
  });
  it('Codex #349 P1: KB-877 신규 ko 문구 = 해요체(명사형 "남음" 금지) · 남은 시간 줄은 확정문 그대로(_one = _other)', () => {
    const ps = load('ko').packagedScan as Record<string, unknown>;
    expect(ps.freeFor_one).toBe('가공식품 무료 스캔 시간이 {{count}}분 남았어요');
    expect(ps.freeFor_other).toBe(ps.freeFor_one);
    for (const v of [ps.freeFor_one, ps.freeStarted, (ps.err as Record<string, unknown>).newAnalysisBody]) expect(String(v)).toMatch(/요\.?$/);
  });
  it('err.newAnalysisBody = 카피 검토 확정문(en·ko) · 10언어 전부 차감 표현 없는 새 문구', () => {
    expect(load('ko').packagedScan.err).toMatchObject({ newAnalysisBody: '이 분석에는 사진을 더 추가할 수 없어요. 새로 분석해 주세요.' });
    expect(load('en').packagedScan.err).toMatchObject({ newAnalysisBody: "You can't add more photos to this analysis. Please start a new one." });
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
      const d = load(l).packagedScan as Record<string, unknown>;
      expect({ l, has: typeof (d.err as Record<string, unknown>).newAnalysisBody === 'string' && typeof d.freeStarted === 'string' && typeof d.freeFor_one === 'string' && typeof d.freeFor_other === 'string' }).toEqual({ l, has: true });
      expect(JSON.stringify(d)).not.toContain('·');
    }
  });
});
