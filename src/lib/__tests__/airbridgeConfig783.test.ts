/**
 * KB-783 — 네이티브 설정 잠금: 앱 토큰은 **config에 없다**(지문 소스 — 토큰 유무로 로컬·EAS 지문이 갈라지면 OTA 도달 0)
 * · 래퍼 플러그인 = appName만 · 딥링크 도메인(iOS associatedDomains·Android intentFilters 4개 autoVerify) · airbridge.json = ATT 대기 키만.
 */
import * as fs from 'fs';

const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;

it('플러그인 등록 = 래퍼(./plugins/withAirbridge)에 appName만 · 공식 플러그인 직접 등록 0 · 레포 평문 토큰 0', () => {
  const entries = app.plugins.filter((p: unknown) => JSON.stringify(p).includes('irbridge'));
  expect(entries).toEqual([['./plugins/withAirbridge', { appName: 'kbap' }]]);
  expect(JSON.stringify(app)).not.toMatch(/appToken/i);
});

it('래퍼 평가 = config에 토큰 없음(환경변수가 있어도) · 토큰은 mod 실행 시점에만 읽는다', () => {
  const prev = process.env.AIRBRIDGE_APP_TOKEN;
  process.env.AIRBRIDGE_APP_TOKEN = 'SECRET_SHOULD_NOT_LEAK';
  try {
    const withAirbridge = jest.requireActual('../../../plugins/withAirbridge') as (c: object, p: object) => object;
    const out = withAirbridge({ name: 'kbap', slug: 'kbap', plugins: [] }, { appName: 'kbap' });
    expect(JSON.stringify(out)).not.toContain('SECRET_SHOULD_NOT_LEAK');
    const src = fs.readFileSync('plugins/withAirbridge.js', 'utf8');
    expect(src).toContain("process.env.EAS_BUILD === 'true'"); // EAS에서 토큰 없으면 prebuild 실패
    expect(src).toContain('get appToken()');
  } finally {
    if (prev === undefined) delete process.env.AIRBRIDGE_APP_TOKEN;
    else process.env.AIRBRIDGE_APP_TOKEN = prev;
  }
});

it('딥링크 도메인 — iOS applinks 2 · Android https/http × 2호스트 autoVerify · 스킴 kbap 유지', () => {
  expect(app.scheme).toBe('kbap');
  expect(app.ios.associatedDomains).toEqual(expect.arrayContaining(['applinks:kbap.airbridge.io', 'applinks:kbap.abr.ge']));
  const filters = app.android.intentFilters as { action: string; autoVerify: boolean; data: { scheme: string; host: string }[]; category: string[] }[];
  const pairs = filters.flatMap((f) => f.data.map((d) => `${d.scheme}://${d.host}`)).sort();
  expect(pairs).toEqual(['http://kbap.abr.ge', 'http://kbap.airbridge.io', 'https://kbap.abr.ge', 'https://kbap.airbridge.io']);
  for (const f of filters) {
    expect(f.action).toBe('VIEW');
    expect(f.autoVerify).toBe(true);
    expect([...f.category].sort()).toEqual(['BROWSABLE', 'DEFAULT']);
  }
});

it('airbridge.json = ATT 응답 대기만(새 ATT 창 없음 — 기존 AdMob/UMP 요청 1회를 기다린다)', () => {
  expect(JSON.parse(fs.readFileSync('airbridge.json', 'utf8'))).toEqual({ autoDetermineTrackingAuthorizationTimeoutInSecond: 120 });
});

it('SDK 버전 정확 고정(네이티브 모듈 — patch 범위가 core를 앞질러 EAS에서만 깨진 전례)', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  expect(pkg.dependencies['airbridge-react-native-sdk']).toBe('4.11.0');
  expect(pkg.dependencies['airbridge-expo-sdk']).toBe('4.11.0');
});
