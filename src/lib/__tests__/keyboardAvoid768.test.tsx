/* eslint-disable import/first -- jest.mock 뒤 */
/**
 * KB-768(QA B2-1) — Expo 57 Android edge-to-edge에선 adjustResize가 창을 줄이지 않는다.
 * ① 소스 잠금: 모든 KeyboardAvoidingView가 단일 규칙 KAV_BEHAVIOR('padding', 두 플랫폼)를 쓴다 — "안드 undefined" 전제 재발 0,
 *   리뷰 작성 커서 추종이 안드에서 키보드를 또 빼지 않는다(이중 차감).
 * ② useKeyboardLift: 창 아래 → 키보드 위 거리 — 안드 = RN 높이(IME − 시스템 바) + 내비 바 인셋, iOS = 높이, 숨김 = 0.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Keyboard, Platform } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));

import { DISMISS_BAR_H, KAV_BEHAVIOR, useKeyboardLift } from '../keyboardAvoid';

const SRC = path.join(__dirname, '..', '..');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : walk(p);
  return /\.(tsx|ts)$/.test(e.name) ? [p] : [];
});

describe('① 소스 잠금 — 키보드 회피 단일 규칙', () => {
  const files = walk(SRC).map((p) => ({ p: path.relative(SRC, p), s: fs.readFileSync(p, 'utf8') }));
  it('KAV_BEHAVIOR = padding(두 플랫폼)', () => {
    expect(KAV_BEHAVIOR).toBe('padding');
  });
  it('KeyboardAvoidingView 전부 behavior={KAV_BEHAVIOR} — 안드 undefined 전제(edge-to-edge로 깨짐) 0', () => {
    const tags = files.flatMap(({ p, s }) => (s.match(/<KeyboardAvoidingView[^>]*>/g) ?? []).map((tag) => ({ p, tag })));
    expect(tags.length).toBeGreaterThanOrEqual(7); // 리뷰·글쓰기·문의·프로필 편집·제한·글 상세·온보딩
    expect(tags.filter(({ tag }) => !tag.includes('behavior={KAV_BEHAVIOR}'))).toEqual([]);
    expect(files.filter(({ s }) => /behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}/.test(s)).map(({ p }) => p)).toEqual([]);
  });
  it('리뷰 작성 커서 추종 = 뷰포트(svH)만 — 안드에서 키보드 높이를 또 빼지 않는다(KAV가 이미 줄였다)', () => {
    const review = fs.readFileSync(path.join(SRC, 'app', 'food', '[id]', 'review.tsx'), 'utf8');
    expect(review).not.toMatch(/svH\.current - \(Platform\.OS/);
    expect((review.match(/const visible = svH\.current;/g) ?? []).length).toBe(2); // KB-903: 바가 흐름 안 — 뷰포트 그대로(키보드·바 0)
  });
  it('신고 시트·내리기 바·장소 시트 2곳 = useKeyboardLift(안드도 리프트 — Modal 창도 edge-to-edge)', () => {
    const read = (...seg: string[]) => fs.readFileSync(path.join(SRC, ...seg), 'utf8');
    expect(read('features', 'community', 'moderation.tsx')).toContain('const kbH = useKeyboardLift({ dismissBar: true });');
    expect(read('features', 'community', 'moderation.tsx')).not.toContain("if (Platform.OS !== 'ios') return;");
    expect(read('components', 'KeyboardDismissBar.tsx')).toContain('bottom: lift');
    expect(read('features', 'review', 'ReviewCellParts.tsx')).toContain("Platform.OS === 'android' && kbLift > 0 && { paddingBottom: kbLift }");
    expect(read('app', 'community', 'compose.tsx')).toContain("Platform.OS === 'android' && kbLift > 0 && { paddingBottom: kbLift }");
  });
});

describe('② useKeyboardLift', () => {
  type L = (e: { endCoordinates: { height: number } }) => void;
  let handlers: Record<string, L>;
  let spy: jest.SpyInstance;
  beforeEach(() => {
    handlers = {};
    spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, fn: L) => { handlers[ev] = fn; return { remove: () => {} }; }) as never);
  });
  afterEach(() => spy.mockRestore());
  const mount = (opts?: { dismissBar?: boolean }) => {
    const out = { v: -1 };
    const Probe = () => { out.v = useKeyboardLift(opts); return null; };
    act(() => { renderer.create(<Probe />); });
    return out;
  };
  it.each([
    ['android', 300, 324], // 높이 300(내비 바 제외) + 내비 바 24
    ['ios', 300, 300],
  ])('%s: 표시 높이 %s → 리프트 %s · 숨김 → 0 · 처음 0', (os, kb, want) => {
    const prev = Platform.OS;
    Platform.OS = os as typeof Platform.OS;
    try {
      const r = mount();
      expect(r.v).toBe(0);
      act(() => handlers.keyboardDidShow({ endCoordinates: { height: kb } }));
      expect(r.v).toBe(want);
      act(() => handlers.keyboardDidHide({ endCoordinates: { height: 0 } }));
      expect(r.v).toBe(0);
    } finally { Platform.OS = prev; }
  });
});

describe('③ KB-768 후속 — 내리기 바를 띄우는 Modal 시트', () => {
  it('바 높이 상수 = 40 · 시트 3곳(신고·리뷰 장소·글쓰기 장소)이 dismissBar 옵션 · 바 스타일이 그 높이로 고정', () => {
    expect(DISMISS_BAR_H).toBe(40);
    const read = (...seg: string[]) => fs.readFileSync(path.join(SRC, ...seg), 'utf8');
    expect(read('features', 'community', 'moderation.tsx')).toContain('useKeyboardLift({ dismissBar: true })');
    expect(read('features', 'review', 'ReviewCellParts.tsx')).toContain('useKeyboardLift({ dismissBar: true })');
    expect(read('app', 'community', 'compose.tsx')).toContain('useKeyboardLift({ dismissBar: true })');
    expect(read('components', 'KeyboardDismissBar.tsx')).toMatch(/height: DISMISS_BAR_H/);
  });
});

describe('③ useKeyboardLift({ dismissBar })', () => {
  type L = (e: { endCoordinates: { height: number } }) => void;
  let handlers: Record<string, L>;
  let spy: jest.SpyInstance;
  beforeEach(() => {
    handlers = {};
    spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, fn: L) => { handlers[ev] = fn; return { remove: () => {} }; }) as never);
  });
  afterEach(() => spy.mockRestore());
  it.each([
    ['android', 300 + 24 + 40], // 높이 + 내비 바 + 내리기 바
    ['ios', 300], // iOS 액세서리 바는 키보드 프레임 안
  ])('%s → %s · 키보드 없으면 0(바 높이만 더하지 않음)', (os, want) => {
    const prev = Platform.OS;
    Platform.OS = os as typeof Platform.OS;
    try {
      const out = { v: -1 };
      const Probe = () => { out.v = useKeyboardLift({ dismissBar: true }); return null; };
      act(() => { renderer.create(<Probe />); });
      expect(out.v).toBe(0);
      act(() => handlers.keyboardDidShow({ endCoordinates: { height: 300 } }));
      expect(out.v).toBe(want);
    } finally { Platform.OS = prev; }
  });
});
