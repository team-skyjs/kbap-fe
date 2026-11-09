import { readFileSync } from 'fs';
import { ApiError } from '@/lib/api/client';
import { INGREDIENTS } from '@/lib/mocks/ingredients';
import { MEAT_CODES, SOY_WHEAT_CODES, avoidFrom, tagRisk, type AvoidState } from '../bbqAvoid';
import { LABELS, type Det } from '../bbqModel';
import { GRILL_ANSWERS, GRILL_ASK_KO } from '../grillAsk';
import { scene1Only } from '../useBbqDetection';

jest.mock('react-native-vision-camera', () => ({}));
jest.mock('react-native-vision-camera-resizer', () => ({}));
jest.mock('react-native-executorch', () => ({}));
jest.mock('react-native-executorch/cv', () => ({}));
jest.mock('react-native-worklets', () => ({}));
jest.mock('expo-asset', () => ({}));
jest.mock('../../../../assets/models/bbq_v2_coreml_o2o.pte', () => 1, { virtual: true });
jest.mock('../../../../assets/models/bbq_v2_xnnpack_e2e.pte', () => 2, { virtual: true });

const known = (...codes: string[]): AvoidState => ({ kind: 'known', codes: new Set(codes) });
const me = (...codes: string[]) => ({ restrictions: codes.map((code) => ({ code })) });
const SSAMJANG = 4;

describe('KB-1019 회피 코드 묶음 = BE 정본 코드', () => {
  it('묶음의 모든 코드가 정본 INGREDIENTS에 있음', () => {
    const all = new Set(INGREDIENTS.map((i) => i.code));
    for (const c of [...SOY_WHEAT_CODES, ...MEAT_CODES]) expect(all.has(c)).toBe(true);
    expect([...SOY_WHEAT_CODES]).toEqual(['SOY', 'WHEAT']);
    expect([...MEAT_CODES].sort()).toEqual(['BEEF', 'CHICKEN', 'LAMB', 'LARD', 'MEAT', 'PORK', 'POULTRY', 'TALLOW']);
  });
});

describe('KB-1019 이름표 위험 표시', () => {
  it('쌈장: 대두·밀 회피 = 주의, 다른 회피 = 없음', () => {
    expect(tagRisk(SSAMJANG, known('SOY'))).toEqual({ state: 'caution', reasonKey: 'bbqGuide.risk.ssamjang' });
    expect(tagRisk(SSAMJANG, known('EGG', 'WHEAT'))?.state).toBe('caution');
    expect(tagRisk(SSAMJANG, known('EGG', 'SESAME'))).toBeNull();
  });

  it('고기(날·익은): 육류 계열 회피 = 판정 불가, 아니면 없음', () => {
    for (const cls of [1, 2]) {
      for (const c of MEAT_CODES) expect(tagRisk(cls, known(c))).toEqual({ state: 'unable', reasonKey: 'bbqGuide.risk.meat' });
      expect(tagRisk(cls, known('SOY', 'BROTH', 'MEAT_BROTH'))).toBeNull();
    }
  });

  it('표에 없는 것(불판·잎·집게·가위)은 어떤 회피에도 표시 없음', () => {
    const everything = known(...INGREDIENTS.map((i) => i.code));
    for (const cls of [0, 3, 5, 6]) {
      expect(tagRisk(cls, everything)).toBeNull();
      expect(tagRisk(cls, { kind: 'unknown' })).toBeNull();
    }
  });

  it('거짓 안전 0: 어떤 클래스·회피 조합도 safe·danger를 내지 않음', () => {
    const states: AvoidState[] = [{ kind: 'none' }, { kind: 'unknown' }, known(), known('SOY'), known('PORK'), known(...INGREDIENTS.map((i) => i.code))];
    for (let cls = 0; cls < LABELS.length; cls++) {
      for (const a of states) expect(['caution', 'unable', undefined]).toContain(tagRisk(cls, a)?.state);
    }
  });

  it('회피 목록을 못 받았으면(unknown) 쌈장·고기 = 판정 불가', () => {
    expect(tagRisk(SSAMJANG, { kind: 'unknown' })).toEqual({ state: 'unable', reasonKey: 'bbqGuide.risk.unknown' });
    expect(tagRisk(1, { kind: 'unknown' })?.state).toBe('unable');
  });
});

describe('KB-1019 프로필 → 회피 상태(계정 생애주기)', () => {
  it('게스트·부팅 미확정 = 표시 없음(게스트 useMe 목업 무시)', () => {
    expect(avoidFrom(false, me('SOY'), null)).toEqual({ kind: 'none' });
    expect(avoidFrom(null, me('SOY'), null)).toEqual({ kind: 'none' });
  });

  it('로그아웃(세션 false) 뒤 남은 캐시 프로필은 쓰지 않음', () => {
    expect(avoidFrom(true, me('PORK'), null).kind).toBe('known');
    expect(avoidFrom(false, me('PORK'), null)).toEqual({ kind: 'none' });
  });

  it('회원 회피 미설정 = 표시 없음, 설정 = known', () => {
    expect(avoidFrom(true, me(), null)).toEqual({ kind: 'none' });
    const a = avoidFrom(true, me('SOY', 'PORK'), null);
    expect(a.kind === 'known' && [...a.codes]).toEqual(['SOY', 'PORK']);
  });

  it('비행기 모드(네트워크 오류)·5xx는 캐시 유지', () => {
    expect(avoidFrom(true, me('SOY'), new TypeError('Network request failed')).kind).toBe('known');
    expect(avoidFrom(true, me('SOY'), new ApiError('down', 503)).kind).toBe('known');
  });

  it('서버 거부(4xx)는 캐시를 이김 → unknown(판정 불가)', () => {
    expect(avoidFrom(true, me('SOY'), new ApiError('no', 403))).toEqual({ kind: 'unknown' });
    expect(avoidFrom(true, me(), new ApiError('no', 404))).toEqual({ kind: 'unknown' });
  });

  it('캐시 없이 오류 = unknown, 로딩 중 = none', () => {
    expect(avoidFrom(true, undefined, new TypeError('offline'))).toEqual({ kind: 'unknown' });
    expect(avoidFrom(true, undefined, null)).toEqual({ kind: 'none' });
  });
});

describe('KB-1019 장면 1 대상·문구', () => {
  it('손 관련 7~9는 이름표·불판 조건에서 제외', () => {
    const d = (cls: number): Det => ({ cls, score: 0.9, x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(scene1Only([0, 3, 6, 7, 8, 9].map(d)).map((x) => x.cls)).toEqual([0, 3, 6]);
  });

  const en = JSON.parse(readFileSync('src/lib/i18n/en.json', 'utf8'));
  const g = en.bbqGuide;

  it('7종 설명 en, 쌈장 = 발주 예시 문구', () => {
    expect(Object.keys(g.desc)).toEqual(LABELS.slice(0, 7));
    expect(g.desc.ssamjang).toBe('Ssamjang: a savory dip. Contains soy and wheat.');
    expect(g.risk.meat).toBe("Can't tell the meat type. Ask staff.");
    expect(g.grillBand).toBe('Grill spotted. Not sure who cooks?');
  });

  it('한국어 카드 = 예진 확정 문구 그대로', () => {
    expect(GRILL_ASK_KO).toBe('고기를 직접 구워야 하나요, 구워 주시나요?');
    expect(GRILL_ANSWERS.map((a) => a.ko)).toEqual(['직접 구우세요', '구워 드려요']);
    expect(Object.keys(g.result)).toEqual(GRILL_ANSWERS.map((a) => a.key));
  });

  it('가운뎃점·이모지 0', () => {
    const text = JSON.stringify(g) + GRILL_ASK_KO + GRILL_ANSWERS.map((a) => a.ko).join('');
    expect(text).not.toContain('·');
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('가이드 화면은 safe 상태를 그리지 않음(소스 잠금)', () => {
    const src = readFileSync('src/features/bbq/GuideScreen.tsx', 'utf8');
    expect(src).not.toMatch(/['"]safe['"]/);
    expect(src).toContain('tagRisk(');
  });

  it('P-637: 모델이 로드됐는데 추론이 안 나오면(stuck) 실패 문구 + 다시 시도', () => {
    const src = readFileSync('src/features/bbq/GuideScreen.tsx', 'utf8');
    expect(src).toContain("det.error || det.stuck ?");
    expect(src).toContain("t(det.stuck ? 'bbqGuide.stuck' : 'bbqGuide.loadFail')");
    const hook = readFileSync('src/features/bbq/useBbqDetection.ts', 'utf8');
    expect(hook).toContain('stuck: loaded && ticks === 0 && (stalled || lastError != null)');
    expect(hook).toContain("return { error: msg };");
    expect(hook).toContain("if (msg.includes('has been disposed')) return null;"); // P-639: 전환 경합만 버림
    expect(g.stuck).toBe('The table guide stopped responding.');
  });

  it('P-634: 가이드 화면에 측정 화면(/dev/bbq-probe) 진입 링크', () => {
    const src = readFileSync('src/features/bbq/GuideScreen.tsx', 'utf8');
    expect(src).toMatch(/testID="bbq-guide-measure" onPress=\{\(\) => router\.push\('\/dev\/bbq-probe' as Href\)\}/);
    expect(g.measure).toBe('Measure');
  });
});
