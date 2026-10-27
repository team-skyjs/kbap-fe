/** KB-873 lifecycle ②a — 가림 상태(중첩 카운터 + AppState)와 덮개 래퍼. 체류 송신은 OFF(②b가 읽는다) */
import * as React from 'react';
import fs from 'fs';
import path from 'path';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Alert as RNAlert, AppState } from 'react-native';

const mockLaunchLibrary = jest.fn();
const mockLaunchCamera = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunchLibrary(...a),
  launchCameraAsync: (...a: unknown[]) => mockLaunchCamera(...a),
}));

/* eslint-disable import/first -- jest.mock 뒤 */
import { _resetOcclusionForTest, isOccluded, pushOcclusion, subscribeOcclusion, useOcclusion, withOcclusion } from '../occlusion';
import { Alert, Modal } from '../occlusionSurfaces';
import { launchCameraAsync, launchImageLibraryAsync } from '../occlusionPickers';
/* eslint-enable import/first */

const trees: ReactTestRenderer[] = [];
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const setAppState = (s: string) => { Object.defineProperty(AppState, 'currentState', { value: s, configurable: true }); };
beforeEach(() => { _resetOcclusionForTest(); setAppState('active'); jest.clearAllMocks(); });
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); });

describe('가림 상태', () => {
  it('중첩 카운터 — 모두 해제돼야 보임 · release 두 번째부터 무시(언마운트·닫힘 이중 호출 안전)', () => {
    expect(isOccluded()).toBe(false);
    const a = pushOcclusion();
    const b = pushOcclusion();
    a();
    a();
    expect(isOccluded()).toBe(true);
    b();
    expect(isOccluded()).toBe(false);
  });
  it('AppState ≠ active = 가림(외부 브라우저·설정·권한·ATT·Instagram 공유처럼 앱을 떠나는 표면)', () => {
    setAppState('background');
    expect(isOccluded()).toBe(true);
    setAppState('inactive');
    expect(isOccluded()).toBe(true);
    setAppState('active');
    expect(isOccluded()).toBe(false);
  });
  it('withOcclusion = 대기 동안 가림 · 성공·실패 모두 해제', async () => {
    let release!: () => void;
    const p = withOcclusion(() => new Promise<void>((r) => (release = r)));
    expect(isOccluded()).toBe(true);
    release();
    await p;
    expect(isOccluded()).toBe(false);
    await expect(withOcclusion(async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(isOccluded()).toBe(false);
  });
  it('useOcclusion = true 동안 가림 · false·언마운트 = 해제 · StrictMode 이중 effect에도 누수 0', () => {
    const Probe = ({ on }: { on: boolean }) => { useOcclusion(on); return null; };
    const t = render(<React.StrictMode><Probe on /></React.StrictMode>);
    expect(isOccluded()).toBe(true);
    act(() => t.update(<React.StrictMode><Probe on={false} /></React.StrictMode>));
    expect(isOccluded()).toBe(false);
    act(() => t.update(<React.StrictMode><Probe on /></React.StrictMode>));
    act(() => t.unmount());
    trees.pop();
    expect(isOccluded()).toBe(false);
  });
  it('subscribeOcclusion = 덮개 변화마다 알림 · 해제 뒤 0', () => {
    const fn = jest.fn();
    const off = subscribeOcclusion(fn);
    const r = pushOcclusion();
    r();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    pushOcclusion()();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('덮개 래퍼', () => {
  it('Modal = visible 동안만 가림(visible 생략 = RN처럼 보임) · 모달 위 모달 = 둘 다 닫혀야 보임', () => {
    const t = render(<Modal visible={false} />);
    expect(isOccluded()).toBe(false);
    act(() => t.update(<Modal visible />));
    expect(isOccluded()).toBe(true);
    const inner = render(<Modal />);
    act(() => t.update(<Modal visible={false} />));
    expect(isOccluded()).toBe(true);
    act(() => inner.unmount());
    trees.splice(trees.indexOf(inner), 1);
    expect(isOccluded()).toBe(false);
  });
  it('Alert = 떠 있는 동안 가림 · 버튼 누름 = 해제 후 원래 동작 · Android 바깥 닫힘(onDismiss) = 해제', () => {
    const spy = jest.spyOn(RNAlert, 'alert').mockImplementation(() => {});
    const onYes = jest.fn(() => expect(isOccluded()).toBe(false));
    Alert.alert('t', 'm', [{ text: 'No', style: 'cancel' }, { text: 'Yes', onPress: onYes }]);
    expect(isOccluded()).toBe(true);
    const [, , buttons] = spy.mock.calls[0] as [string, string, { text: string; onPress: () => void }[]];
    expect(buttons.map((b) => b.text)).toEqual(['No', 'Yes']);
    buttons[1].onPress();
    expect(onYes).toHaveBeenCalled();
    expect(isOccluded()).toBe(false);
    Alert.alert('t', 'm', [{ text: 'OK' }], { cancelable: true });
    const opts = spy.mock.calls[1][3] as { onDismiss: () => void; cancelable: boolean };
    expect(opts.cancelable).toBe(true);
    opts.onDismiss();
    expect(isOccluded()).toBe(false);
    spy.mockRestore();
  });
  it('Codex #348: 버튼 1개 이상 필수(비지 않은 튜플 타입) · 하드코딩 "OK" 대체 버튼 0 — 버튼 없는 Alert는 번역 밖 문구·해제 지점 없음', () => {
    // 테스트 파일은 tsconfig exclude라 @ts-expect-error로는 못 잠근다 → 래퍼 소스를 직접 잠금
    const src = fs.readFileSync(path.join('src', 'lib', 'engagement', 'occlusionSurfaces.tsx'), 'utf8');
    expect(src).toContain('buttons: [AlertButton, ...AlertButton[]]');
    expect(src).not.toMatch(/text:\s*['"]OK['"]/);
  });
  it('사진 선택기·카메라 = 시스템 화면이 떠 있는 동안 가림 · 취소·결과 뒤 해제 · 옵션 그대로 전달', async () => {
    let done!: (v: unknown) => void;
    mockLaunchLibrary.mockReturnValueOnce(new Promise((r) => (done = r)));
    const p = launchImageLibraryAsync({ quality: 0.8 });
    expect(mockLaunchLibrary).toHaveBeenCalledWith({ quality: 0.8 });
    expect(isOccluded()).toBe(true);
    done({ canceled: true, assets: null });
    await expect(p).resolves.toEqual({ canceled: true, assets: null });
    expect(isOccluded()).toBe(false);
    mockLaunchCamera.mockRejectedValueOnce(new Error('denied'));
    await expect(launchCameraAsync()).rejects.toThrow('denied');
    expect(isOccluded()).toBe(false);
  });
});

/** 열거형 목록 대신 src 전수 — 나중에 생긴 화면도 잡는다(enumerated-lock 사각 방지) */
describe('잠금: 덮개는 래퍼로만', () => {
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : files(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  const WRAPPERS = [path.join('src', 'lib', 'engagement', 'occlusionSurfaces.tsx'), path.join('src', 'lib', 'engagement', 'occlusionPickers.ts')];
  const offenders = (re: RegExp) => files('src').filter((f) => !WRAPPERS.includes(f) && re.test(fs.readFileSync(f, 'utf8')));

  it("react-native의 Modal·Alert 직접 import 0", () => {
    expect(offenders(/import\s*\{[^}]*\b(Modal|Alert)\b[^}]*\}\s*from\s*'react-native'/)).toEqual([]);
  });
  it('expo-image-picker launch* 직접 호출 0 · Modal 래퍼는 사진 선택기 네이티브 모듈을 끌어오지 않음', () => {
    expect(fs.readFileSync(WRAPPERS[0], 'utf8')).not.toContain('expo-image-picker');
    expect(offenders(/ImagePicker\.launch(ImageLibrary|Camera)Async\(|import\s*\{[^}]*\blaunch(ImageLibrary|Camera)Async\b[^}]*\}\s*from\s*'expo-image-picker'/)).toEqual([]);
  });
  it('전면 광고 훅을 쓰는 파일 = useOcclusion도 · 동의 폼 호출 = withOcclusion 안', () => {
    const ads = files('src').filter((f) => /\.use(Rewarded|Interstitial)Ad\(/.test(fs.readFileSync(f, 'utf8')));
    expect(ads.length).toBeGreaterThan(0);
    expect(ads.filter((f) => !/useOcclusion\(status === 'showing'\)/.test(fs.readFileSync(f, 'utf8')))).toEqual([]);
    const consent = files('src').flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i, l })))
      .filter(({ l }) => /\b(loadAndShowConsentFormIfRequired|gatherConsent|showPrivacyOptionsForm)\(\)/.test(l) && !/^\s*(\*|\/\/)/.test(l));
    expect(consent.length).toBeGreaterThan(0);
    expect(consent.filter(({ l }) => !l.includes('withOcclusion(')).map(({ f, i }) => `${f}:${i + 1}`)).toEqual([]);
  });
});
