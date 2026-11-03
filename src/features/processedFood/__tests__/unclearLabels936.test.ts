/**
 * KB-936 — SAFE_WITH_NOTE 부제 = 서버 unclearIngredientLabels(요청 언어) · 같은 label 중복 제거 · 구서버(필드 없음)·빈 배열 = 원문 폴백 · 둘 다 비면 생략.
 */
import { adaptLabelScan, adaptProcessedDetail, type DetailWire, type LabelScanWire } from '@/lib/api/processedFoodAdapter';
import { unclearSubtitle } from '../packagedVerdictLogic';

const detailWire = (extra: Partial<DetailWire>): DetailWire =>
  ({ id: 1, name: 'n', source: { provider: 'HACCP', attributionKey: 'k' }, labelSource: 'DECLARED', verdict: 'SAFE_WITH_NOTE', ...extra }) as unknown as DetailWire;
const labelWire = (extra: Partial<LabelScanWire>): LabelScanWire => ({ analysisId: 'a', state: 'DONE', labelSource: 'DECLARED', verdict: 'SAFE_WITH_NOTE', ...extra });

describe('KB-936 확인 안 된 원재료 부제', () => {
  it('라벨이 있으면 라벨(원문 0) · 같은 label 중복 제거 · 순서 유지', () => {
    const d = adaptProcessedDetail(detailWire({
      unclearIngredients: ['혼합제제', '시즈닝'],
      unclearIngredientLabels: [{ term: '혼합제제', label: 'Mixed preparation' }, { term: '시즈닝', label: 'Seasoning' }, { term: '복합시즈닝', label: 'Seasoning' }],
    }));
    expect(unclearSubtitle(d)).toBe('Mixed preparation, Seasoning');
  });

  it('필드 없음(구서버) → [] → 원문 폴백 · 빈 배열도 원문 · 둘 다 비면 null', () => {
    const old = adaptProcessedDetail(detailWire({ unclearIngredients: ['혼합제제'] }));
    expect(old.unclearIngredientLabels).toEqual([]);
    expect(unclearSubtitle(old)).toBe('혼합제제');
    expect(unclearSubtitle(adaptProcessedDetail(detailWire({ unclearIngredients: ['혼합제제'], unclearIngredientLabels: [] })))).toBe('혼합제제');
    expect(unclearSubtitle(adaptProcessedDetail(detailWire({ unclearIngredients: [], unclearIngredientLabels: [] })))).toBeNull();
  });

  it('빈 label 항목은 버림(전부 비면 원문 폴백)', () => {
    const d = adaptProcessedDetail(detailWire({ unclearIngredients: ['시즈닝'], unclearIngredientLabels: [{ term: '시즈닝', label: '  ' }] }));
    expect(unclearSubtitle(d)).toBe('시즈닝');
  });

  it('성분표 스캔 결과도 같은 파싱(이름 스캔 확정 상세는 adaptProcessedDetail 경유)', () => {
    const r = adaptLabelScan(labelWire({ unclearIngredients: ['시즈닝'], unclearIngredientLabels: [{ term: '시즈닝', label: 'シーズニング' }] }));
    expect(unclearSubtitle(r)).toBe('シーズニング');
    expect(unclearSubtitle(adaptLabelScan(labelWire({ unclearIngredients: ['시즈닝'] })))).toBe('시즈닝');
  });
});
