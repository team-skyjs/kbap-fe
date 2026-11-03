/**
 * KB-877 가공식품 1시간 무료 창 → KB-963(예진 11/2): 가공식품 스캔은 차감 없음(서버 S-937 — charged 늘 false · freeUntil 늘 null).
 * 무료 창 표시(카메라 배지·남은 분·시작 안내)와 그 모듈(packagedFreeHour) 소멸 — 서버가 charged·freeUntil을 보내도 앱은 표시하지 않는다.
 * 남은 것: 가공식품 문구에 차감 표현 0 잠금 · 새 분석 안내 문구 잠금.
 */
import fs from 'fs';

const load = (l: string) => JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')) as Record<string, Record<string, unknown>>;
const read = (p: string) => fs.readFileSync(p, 'utf8');
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi'];

describe('KB-963 무료 창·차감 표시 0', () => {
  it('무료 창 모듈·배지·응답 반영 0 — 흐름이 freeUntil을 쓰지 않는다(카메라 앞면·성분표 배지 소멸)', () => {
    expect(fs.existsSync('src/features/scan/packagedFreeHour.tsx')).toBe(false);
    const flow = read('src/features/scan/PackagedScanFlow.tsx');
    expect(flow).not.toMatch(/PackagedFreeLine|applyFreeUntil|FreeBadge|r\.freeUntil|&free=1/);
    expect(read('src/features/scan/PackagedScanScreens.tsx')).not.toMatch(/PackagedFreeLine|FreeBadge|PackagedFreeExplain/);
  });
  it('무료 창 문구 키 10로케일 삭제(freeFor·freeExplain·freeStarted)', () => {
    for (const l of LOCALES) {
      const d = load(l).packagedScan as Record<string, unknown>;
      expect({ l, left: Object.keys(d).filter((k) => /^free(For|Explain|Started)/.test(k)) }).toEqual({ l, left: [] });
    }
  });
});

describe('문구 잠금(K112)', () => {
  const flat = (o: unknown, p = ''): [string, string][] =>
    o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => flat(v, `${p}${k}.`)) : [[p.slice(0, -1), String(o)]];
  it('가공식품 문구에 차감 표현 0(en·ko) — "스캔 1회 사용"·"uses 1 scan"류', () => {
    const en = [...flat(load('en').packagedScan, 'packagedScan.'), ...flat(load('en').packaged, 'packaged.')];
    const ko = [...flat(load('ko').packagedScan, 'packagedScan.'), ...flat(load('ko').packaged, 'packaged.')];
    // err.quota* = 서버가 SCAN-004로 거절할 때만(구 서버 대비 폴백 — S-937 이후 가공식품엔 안 온다)
    const scope = ([k]: [string, string]) => !/^packagedScan\.err\.quota/.test(k);
    expect(en.filter(scope).filter(([, v]) => /\b(uses?|used)\b[^.]*\bscans?\b|\bscans?\b[^.]*\b(used|charged?)\b|no extra scan|\bfree\b/i.test(v))).toEqual([]);
    expect(ko.filter(scope).filter(([, v]) => /스캔\s*1회|차감|사용돼요|사용되지\s*않|무료/.test(v))).toEqual([]);
  });
  it('err.newAnalysisBody = 카피 검토 확정문(en·ko) · 10언어 전부 · 가운데점 0', () => {
    expect(load('ko').packagedScan.err).toMatchObject({ newAnalysisBody: '이 분석에는 사진을 더 추가할 수 없어요. 새로 분석해 주세요.' });
    expect(load('en').packagedScan.err).toMatchObject({ newAnalysisBody: "You can't add more photos to this analysis. Please start a new one." });
    expect(String((load('ko').packagedScan.err as Record<string, unknown>).newAnalysisBody)).toMatch(/요\.$/);
    for (const l of LOCALES) {
      const d = load(l).packagedScan as Record<string, unknown>;
      expect({ l, has: typeof (d.err as Record<string, unknown>).newAnalysisBody === 'string' }).toEqual({ l, has: true });
      expect(JSON.stringify(d)).not.toContain('·');
    }
  });
});
