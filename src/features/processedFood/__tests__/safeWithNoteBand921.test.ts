/**
 * KB-921(R-147) — 가공식품 판정 4가지 → 띠 톤·제목 키 잠금. SAFE_WITH_NOTE("모름" 있음)는 초록이 아니라 주의 톤 + 일부 성분 확인 안 됨.
 */
import * as fs from 'fs';
import * as path from 'path';
import { VERDICT_RISK } from '@/lib/api/processedFoodAdapter';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../../..', p), 'utf8');
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];

describe('KB-921 판정 → 띠 톤·제목', () => {
  it('톤: AVOID = danger · CAUTION = caution · SAFE_WITH_NOTE = caution(초록 0) · SAFE = safe', () => {
    expect(VERDICT_RISK).toEqual({ AVOID: 'danger', CAUTION: 'caution', SAFE_WITH_NOTE: 'caution', SAFE: 'safe' });
  });

  it('제목 키: AVOID avoidMatchTitle · CAUTION crossContactTitle · SAFE_WITH_NOTE unverifiedTitle(부제 = 목록, 비면 생략) · SAFE noAvoidMatchTitle', () => {
    const v = read('src/features/processedFood/PackagedVerdict.tsx');
    expect(v).toMatch(/'AVOID' \? \[t\('packaged\.avoidMatchTitle'\)/);
    expect(v).toMatch(/'CAUTION' \? \[t\('packaged\.crossContactTitle'\)/);
    expect(v).toContain("'SAFE_WITH_NOTE' ? [t('packaged.unverifiedTitle'), d.unclearIngredients.join(', ') || null]");
    expect(v).toContain("[t('packaged.noAvoidMatchTitle'), safeReason]");
    // 성분표 결과도 같은 부제(구 "일치하는 재료는 없어요…" 문장 0)
    expect(read('src/features/scan/PackagedScanScreens.tsx')).toContain("avoid = result.unclearIngredients.join(', ') || null");
  });

  it('unverifiedTitle 10로케일(en 폴백 0) · ko = 일부 성분 확인 안 됨 · 옛 키 제거', () => {
    const en = JSON.parse(read('src/lib/i18n/en.json')).packaged.unverifiedTitle as string;
    expect(en).toBe("Some ingredients can't be verified");
    for (const l of LOCALES) {
      const d = JSON.parse(read(`src/lib/i18n/${l}.json`));
      const v = d.packaged.unverifiedTitle as string;
      expect({ l, ok: !!v && (l === 'en' || v !== en) }).toEqual({ l, ok: true });
      expect([d.packaged.unclearTitle, d.packaged.unclearBody, d.packagedScan.resultUnclear]).toEqual([undefined, undefined, undefined]);
    }
    expect(JSON.parse(read('src/lib/i18n/ko.json')).packaged.unverifiedTitle).toBe('일부 성분 확인 안 됨');
  });
});
