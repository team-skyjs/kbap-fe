/** KB-901 — 번역 없음 판정(T-003·T-012) · 출처 두 줄 모두 라벨(T-053) · 근거 문구 10로케일 */
import * as fs from 'fs';
import { realTranslation } from '../processedFoodAdapter';

it('realTranslation: 원문과 같은 "번역"(서버가 원문을 채움) = null · 빈 값 = null · 진짜 번역은 그대로', () => {
  expect(realTranslation('밀,대두 함유', '밀,대두 함유')).toBeNull();
  expect(realTranslation('  밀,대두 함유 ', '밀,대두 함유')).toBeNull();
  expect(realTranslation('', '밀')).toBeNull();
  expect(realTranslation(null, '밀')).toBeNull();
  expect(realTranslation('Wheat, Soy contained', '밀,대두 함유')).toBe('Wheat, Soy contained');
  expect(realTranslation('Wheat', null)).toBe('Wheat');
});

it('T-053: 10로케일 sourceData2 = sourceData1과 같은 "자료:" 라벨로 시작 · matchEvidence = name·evidence 자리만', () => {
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
    const p = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).packaged;
    const label = /^(.*?[:：]\s*)/.exec(p.sourceData1)![1];
    expect({ l, ok: p.sourceData2.startsWith(label) && p.sourceData2.length > label.length }).toEqual({ l, ok: true });
    expect({ l, ev: p.matchEvidence.replace(/[:：]\s*/, '|') }).toEqual({ l, ev: '{{name}}|{{evidence}}' });
  }
});
