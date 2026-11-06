/**
 * KB-1013(예진 11/6) 문구: '가공식품' → '편의점 음식'(ko 전수) · 스캔 부제 신설 · chooseTitle·matchTitle 개정 — 10로케일 키 일치.
 */
import * as fs from 'fs';
import { execFileSync } from 'child_process';

const LOCALES = ['ko', 'en', 'es', 'ja', 'ru', 'id', 'vi', 'zh-Hant', 'zh-Hans', 'th'];
const load = (l: string) => JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8'));
const runtimeSrc: string[] = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
  .split('\n')
  .filter((f: string) => /\.tsx?$/.test(f) && !f.includes('__tests__'));

it('ko: 가공식품 0 → 편의점 음식 (값 전수) · 런타임 한글 리터럴에도 0(주석 제외)', () => {
  const raw = fs.readFileSync('src/lib/i18n/ko.json', 'utf8');
  expect(raw).not.toContain('가공식품');
  const ko = load('ko');
  expect([ko.packaged.segmentPackaged, ko.packaged.guideTitle, ko.scanMode.packaged]).toEqual(['편의점 음식', '편의점 음식 검색', '편의점 음식']);
  const hits: string[] = [];
  for (const f of runtimeSrc) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (/^\s*\*/.test(line)) return; // 블록 주석 줄
      if (/['"`>][^'"`<]*가공식품/.test(code)) hits.push(`${f}:${i + 1}`);
    });
  }
  expect(hits).toEqual([]);
});

it('ko 확정 문구 그대로', () => {
  const ko = load('ko');
  expect(ko.scanCamera.subtitle).toBe('메뉴판이나 편의점 음식을 찍어보세요');
  expect(ko.packagedScan.chooseTitle).toBe('스캔 결과');
  expect(ko.packagedScan.matchTitle).toBe('내가 스캔한 식품을 찾아 선택해주세요');
  const en = load('en');
  expect([en.scanCamera.subtitle, en.packagedScan.chooseTitle, en.packagedScan.matchTitle]).toEqual(['Snap a menu or a convenience-store item', 'Scan results', 'Find and select the item you scanned']);
});

it('10로케일 키 일치 · 빈 값 0 · 가운데 점·이모지 0', () => {
  for (const l of LOCALES) {
    const d = load(l);
    for (const v of [d.scanCamera.subtitle, d.packagedScan.chooseTitle, d.packagedScan.matchTitle]) {
      expect({ l, ok: typeof v === 'string' && v.trim().length > 0 }).toEqual({ l, ok: true });
      expect(v).not.toMatch(/·|\p{Extended_Pictographic}/u);
    }
  }
  // 옛 의미(제품 선택·이름과 맛)가 남은 로케일 0 — en 대표
  expect(load('en').packagedScan.chooseTitle).not.toBe('Choose your product');
});

it('스캔 부제 = 카메라 첫 화면 타이틀 바로 아래 · 모드 탭이 있거나 흐름 안 단계면 생략', () => {
  const src = fs.readFileSync('src/app/scan.tsx', 'utf8');
  expect(src).toMatch(/\{t\('scanCamera\.title'\)\}<\/Text>\s*\{\/\*[^]*?\*\/\}\s*\{!o\.onClose && !\(FLAGS\.processedFoodEnabled && !FLAGS\.packagedVisionScan\) && \(\s*<Text style=\{styles\.camSubtitle\}[^>]*testID="scan-cam-subtitle">\{t\('scanCamera\.subtitle'\)\}/);
});
