/**
 * KB-959(P-575, 예진 11/2): Safe 띠 부제 = 근거(제목 반복 0) · Ramen → Ramyeon(일본식 라멘 표기 금지) · 홈 섹션 See all = 진한 글자.
 * 카드 저장 버튼 소멸·성분표 결과 무료 배너 소멸은 기존 스위트(homeBookmarkedCard779·packagedUnify914·packagedLabel508 등)에서 잠금.
 */
import * as fs from 'fs';
import * as path from 'path';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }));

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../../..', p), 'utf8');
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
const load = (l: string) => JSON.parse(read(`src/lib/i18n/${l}.json`));

describe('KB-959 Safe 띠 부제', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { safeBasis } = require('../packagedVerdictLogic') as typeof import('../packagedVerdictLogic');
  const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k);
  it('회피 N개 = 근거 문장(count) · 0개(비회원·회피 0개 Safe) = 부제 없음(null — 제목 반복·설정 유도 0)', () => {
    expect(safeBasis(t, 3)).toBe('packaged.safeBasis:{"count":3}');
    expect(safeBasis(t, 0)).toBeNull();
  });
  it('제목과 다른 말 · 안전 단정 0 · 10로케일 복수형(en 폴백 0) · ko 해요체', () => {
    const en = load('en').packaged;
    expect(en.noAvoidMatches).toBeUndefined(); // 구 부제(제목 반복) 삭제
    expect(en.safeBasis_other).toBe('We checked the label against your {{count}} avoided ingredients.');
    for (const l of LOCALES) {
      const p = load(l).packaged;
      expect({ l, ok: typeof p.safeBasis_one === 'string' && typeof p.safeBasis_other === 'string' && p.safeBasis_other !== p.noAvoidMatchTitle && (l === 'en' || p.safeBasis_other !== en.safeBasis_other) }).toEqual({ l, ok: true });
    }
    expect(load('ko').packaged.safeBasis_other).toMatch(/요\.$/);
    expect(`${en.safeBasis_one} ${en.safeBasis_other}`).not.toMatch(/\bsafe\b/i);
  });
  it('배선: 상세 회원 = 회피 수 근거 · 상세 회피 미설정 Safe = null · 성분표 결과 = 회피 수(흐름이 넘김)', () => {
    const pf = read('src/app/processed-foods/[id].tsx');
    expect(pf).toContain('safeReason={safeBasis(t, me?.restrictions.length ?? 0)}');
    expect(pf).toContain('safeReason={null} style={s.band} testID="pf-verdict-safe-unset"');
    expect(read('src/features/scan/PackagedScanScreens.tsx')).toContain('safeReason={safeBasis(t, avoidCount)}');
    expect(read('src/features/scan/PackagedScanFlow.tsx')).toContain('avoidCount={me?.restrictions.length ?? 0}');
  });
});

describe('KB-959 Ramen → Ramyeon(예진 11/2 — ramen은 일본식 라멘)', () => {
  const JP_RAMEN = /\bramen\b|ラーメン|ราเมง|рамен/i;
  const shown = (l: string) => { const d = load(l); return [d.packaged.type.ramen, d.packaged.searchPlaceholder, d.spice?.example?.['3']].filter(Boolean) as string[]; };
  it('유형 탭·검색 힌트·맵기 예시 = 10로케일 전부 일본식 라멘 표기 0', () => {
    for (const l of LOCALES) for (const v of shown(l)) expect({ l, v, jp: JP_RAMEN.test(v) }).toEqual({ l, v, jp: false });
  });
  it('라틴 표기 = Ramyeon · 비라틴 = 한국 라면을 가리키는 표기 · ko = 라면', () => {
    const type = (l: string) => load(l).packaged.type.ramen;
    expect(['en', 'es', 'id'].map(type)).toEqual(['Ramyeon', 'Ramyeon', 'Ramyeon']);
    expect(type('vi')).toBe('Mì ramyeon');
    expect([type('ja'), type('zh-Hans'), type('zh-Hant'), type('th'), type('ru'), type('ko')]).toEqual(['ラミョン', '韩国拉面', '韓國泡麵', 'บะหมี่เกาหลี', 'Рамён', '라면']);
    expect(read('src/lib/api/processedFoodAdapter.ts')).toContain("'RAMEN'"); // 서버 계약 enum·계측 값은 그대로(표시 문구만)
  });
});

describe('KB-959 홈 섹션 헤더 See all = 진한 글자', () => {
  it('편의점 줄 See all 글자·화살표 = C.ink(구 primaryText 주황) · 음식 레일 끝 See all 카드는 무변(별도 발주)', () => {
    const rail = read('src/features/home/HomeCvsRail.tsx');
    expect(rail).toContain('seeAllText: { ...type.button, color: C.ink }');
    expect(rail).toContain('<IconChevron size={16} color={C.ink} />');
    expect(rail).not.toContain('C.primaryText');
    expect(read('src/features/food/FoodExplorer.tsx')).toContain("seeAllText: { fontSize: 16, fontWeight: '600', color: C.primaryText }");
  });
});
