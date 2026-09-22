/**
 * P-399(KB-518 진단) — 공유 실패가 어디서 깨졌는지 보이게.
 *
 * 배경: b34에서 공유가 100% 실패하는데 두 흐름의 `catch { return 'error' }`가 에러를 통째로
 * 버려서 Console·Metro·Sentry 어디서도 원인을 볼 수 없었다. **반환값·분기는 무변**이고
 * 단계 태그 + Sentry 보고 + (비production 한정) 토스트 힌트만 추가된다.
 */
const mockChannel = { prod: false };
const mockReport = jest.fn();
// sentry.ts가 채널을 판정한다(KB-418 허용 목록 유지) — 목도 같은 계약으로
const mockSummary = jest.fn((e: unknown, step: string) =>
  mockChannel.prod ? null : `${step}: ${(e as Error)?.message}`,
);
jest.mock('@/lib/sentry', () => ({
  reportShareFailure: (...a: unknown[]) => mockReport(...a),
  shareFailureSummary: (e: unknown, s: string) => mockSummary(e, s),
}));


import {
  saveCardToPhotos,
  shareCardToStory,
  lastShareErrorHint,
  _resetShareErrorForTest,
  ShareStepError,
  type ShareDeps,
} from '../shareExport';

const ref = { current: null } as never;
const ok = (): ShareDeps => ({
  capture: jest.fn().mockResolvedValue('file:///tmp/card.png'),
  requestSavePermission: jest.fn().mockResolvedValue(true),
  saveToLibrary: jest.fn().mockResolvedValue(undefined),
  isInstagramInstalled: jest.fn().mockResolvedValue(true),
  shareToStory: jest.fn().mockResolvedValue(undefined),
  storyAvailable: jest.fn().mockReturnValue(true),
});
const deps = (over: Partial<ShareDeps>): ShareDeps => ({ ...ok(), ...over });
const boom = (msg: string) => jest.fn().mockRejectedValue(new Error(msg));
/** 보고된 step 태그 */
const reportedStep = () => (mockReport.mock.calls[0][1] as string);

beforeEach(() => {
  jest.clearAllMocks();
  mockChannel.prod = false;
  _resetShareErrorForTest();
});

/* ---- ① 단계 식별 ---- */

it('저장 흐름 — 각 단계 실패가 제 이름으로 보고된다', async () => {
  const cases: [Partial<ShareDeps>, string][] = [
    [{ requestSavePermission: boom('perm') }, 'permission'],
    [{ capture: boom('cap') }, 'capture'],
    [{ saveToLibrary: boom('save') }, 'save_library'],
  ];
  for (const [over, step] of cases) {
    jest.clearAllMocks();
    await expect(saveCardToPhotos(ref, deps(over))).resolves.toBe('error'); // 반환값 무변
    expect(reportedStep()).toBe(step);
  }
});

it('스토리 흐름 — 각 단계 실패가 제 이름으로 보고된다', async () => {
  const cases: [Partial<ShareDeps>, string][] = [
    [{ isInstagramInstalled: boom('ig') }, 'instagram_check'],
    [{ capture: boom('cap') }, 'capture'],
    [{ shareToStory: boom('story') }, 'share_story'],
  ];
  for (const [over, step] of cases) {
    jest.clearAllMocks();
    await expect(shareCardToStory(ref, deps(over))).resolves.toBe('error'); // 반환값 무변
    expect(reportedStep()).toBe(step);
  }
});

// 네이티브 미링크와 캡처 실패는 조치가 완전히 다르다 — 태그로 갈려야 한다.
it('모듈 로드 실패는 capture와 구분된다(capture_module)', async () => {
  const over = { capture: jest.fn().mockRejectedValue(new ShareStepError('capture_module', new Error('RNViewShot is undefined'))) };
  await expect(saveCardToPhotos(ref, deps(over))).resolves.toBe('error');
  expect(reportedStep()).toBe('capture_module');
});

it('보고 extra는 PII 0 — enum·boolean·숫자만', async () => {
  await saveCardToPhotos(ref, deps({ capture: boom('x') }));
  const [, , extra] = mockReport.mock.calls[0] as [unknown, string, Record<string, unknown>];
  expect(Object.keys(extra).sort()).toEqual(['export_h', 'export_w', 'flow', 'meta_app_id_present', 'os']);
  for (const v of Object.values(extra)) expect(['string', 'boolean', 'number']).toContain(typeof v);
});

/* ---- ② 성공·비오류 경로는 보고하지 않는다 ---- */

it('성공·권한 거부·미설치는 보고 0(노이즈 금지)', async () => {
  await expect(saveCardToPhotos(ref, ok())).resolves.toBe('success');
  await expect(saveCardToPhotos(ref, deps({ requestSavePermission: jest.fn().mockResolvedValue(false) }))).resolves.toBe('denied');
  await expect(shareCardToStory(ref, deps({ isInstagramInstalled: jest.fn().mockResolvedValue(false) }))).resolves.toBe('not_installed');
  await expect(shareCardToStory(ref, deps({ storyAvailable: jest.fn().mockReturnValue(false) }))).resolves.toBe('unavailable');
  expect(mockReport).not.toHaveBeenCalled();
});

/* ---- ③ 토스트 힌트 — production 금지 ---- */

it('teamtest/development는 힌트를 준다', async () => {
  await saveCardToPhotos(ref, deps({ capture: boom('findNodeHandle failed') }));
  expect(lastShareErrorHint()).toContain('capture');
  expect(lastShareErrorHint()).toContain('findNodeHandle failed');
});

it('production은 힌트 없음 — 사용자에게 내부 문구를 보이지 않는다', async () => {
  await saveCardToPhotos(ref, deps({ capture: boom('findNodeHandle failed') }));
  mockChannel.prod = true;
  expect(lastShareErrorHint()).toBeNull();
});

it('실패 이력이 없으면 힌트도 없다', () => {
  expect(lastShareErrorHint()).toBeNull();
});

/* ---- ④ 채널 허용 목록 — preview 누출 방지(Codex #176) ---- */

// `!isProdChannel()`로 negate하면 preview(production 백엔드를 쓰는 내부 배포)까지 포함돼
// 원시 네이티브 문구가 샌다. **부정이 아니라 명시 허용**이어야 한다.
it('진단 채널은 명시 허용 — preview·production은 제외, teamtest(-prod)·development·로컬만', () => {
  const flags = require('fs').readFileSync('src/lib/flags.ts', 'utf8') as string;
  // P-407: teamtest-prod(prod 백엔드 리허설 테플)도 내부 테스터 전용 — 동작 해석표는 channelResolution407
  expect(flags).toContain("ch === 'teamtest' || ch === 'teamtest-prod' || ch === 'development'");
  expect(flags).toContain('export function isDiagnosticChannel()');
  const sentry = require('fs').readFileSync('src/lib/sentry.ts', 'utf8') as string;
  // shareFailureSummary 본문만 본다 — tapSentrySelfcheck(P-114)의 isProdChannel은 별건이다
  const body = sentry.slice(sentry.indexOf('export function shareFailureSummary'));
  const fn = body.slice(0, body.indexOf('\n}'));
  expect(fn).toContain('if (!isDiagnosticChannel()) return null;');
  // 주석엔 "왜 negate가 아닌지" 설명이 있으므로 **코드 줄만** 본다
  const code = fn.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  expect(code).not.toContain('isProdChannel'); // 구 negate 잔존 0
});

/* ---- ⑤ 소스 잠금 — 에러를 다시 삼키지 못하게 ---- */

it('두 흐름의 catch가 에러를 버리지 않는다(빈 catch 재발 방지)', () => {
  const src = require('fs').readFileSync('src/features/order/shareExport.ts', 'utf8') as string;
  expect(src).not.toMatch(/catch\s*\{\s*return 'error';/); // 구 형태 잔존 0
  expect(src.match(/reportShareFailure\(/g)?.length).toBe(2); // 저장·스토리 각 1
});
