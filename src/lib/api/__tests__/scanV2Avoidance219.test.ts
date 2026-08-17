/**
 * P-219(KB-29): 스캔 v2 — 회피 겹침(avoidances) 매핑·false-safe 강등,
 * 에러 3분기(BE code 기반), similarFood 정책, OCR 미호출 경로 잠금.
 */
jest.mock('@/lib/flags', () => ({ FLAGS: { scanV2: true }, isProdChannel: () => false }));

import { mergeResults, photoOnlyResults } from '../scanAdapter';
import type { ScanResultWire } from '../scanTypes';

const box = { x: 0, y: 0, width: 1, height: 1 };
const item = { itemId: 0, rawMenuName: '김치찌개', box };
const base: ScanResultWire = { idx: 0, matched: true, foodId: 7, riskLevel: 'CAUTION', name: 'Kimchi Stew' };
const one = (over: Partial<ScanResultWire>) => mergeResults([item], [{ ...base, ...over }])[0];

describe('⑥ avoidances — 겹친 것만·null/빈 배열 구분', () => {
  it('overlapped=true만 담는다(전체 목록 나열 금지 — 81종 방어)', () => {
    const d = one({
      avoidances: [
        { code: 'PORK', name: '돼지고기', overlapped: true, riskLevel: 'DANGER' },
        { code: 'MILK', name: '우유', overlapped: false, riskLevel: 'SAFE' },
      ],
    });
    expect(d.avoidances.map((a) => a.code)).toEqual(['PORK']);
    expect(d.avoidances[0]).toEqual({ code: 'PORK', name: '돼지고기', risk: 'danger' });
  });

  it('null(온보딩 미완료)·[](미등록/matched=false)·필드 부재 = 셋 다 빈 배열 → 섹션 미렌더', () => {
    expect(one({ avoidances: null }).avoidances).toEqual([]);
    expect(one({ avoidances: [] }).avoidances).toEqual([]);
    expect(one({}).avoidances).toEqual([]);
  });

  it('⚠️ false-safe: overlapped=true인데 riskLevel 결측·미지 = CAUTION 강등(SAFE 승격 금지)', () => {
    const d = one({
      avoidances: [
        { code: 'A', name: 'A', overlapped: true, riskLevel: null },
        { code: 'B', name: 'B', overlapped: true },
        { code: 'C', name: 'C', overlapped: true, riskLevel: 'UNKNOWN' },
        { code: 'D', name: 'D', overlapped: true, riskLevel: 'SAFE' },
        { code: 'E', name: 'E', overlapped: true, riskLevel: 'DANGER' },
      ],
    });
    expect(d.avoidances.map((a) => a.risk)).toEqual(['caution', 'caution', 'caution', 'caution', 'danger']);
  });

  it('성분명은 서버 번역값 그대로 — 부재 시에만 코드 폴백(클라 재번역 0)', () => {
    const d = one({ avoidances: [{ code: 'PEANUT', name: 'Cacahuete', overlapped: true, riskLevel: 'DANGER' }] });
    expect(d.avoidances[0].name).toBe('Cacahuete');
    const f = one({ avoidances: [{ code: 'PEANUT', overlapped: true, riskLevel: 'DANGER' }] });
    expect(f.avoidances[0].name).toBe('PEANUT');
  });

  it('사진 전용 항목(idx=null)도 같은 규칙', () => {
    const [p] = photoOnlyResults([
      { ...base, idx: null, avoidances: [{ code: 'EGG', name: '계란', overlapped: true, riskLevel: 'CAUTION' }] },
    ]);
    expect(p.avoidances).toEqual([{ code: 'EGG', name: '계란', risk: 'caution' }]);
  });
});

describe('⑤ ⑦ 에러 3분기 · similarFood · OCR 미호출 — 소스 잠금', () => {
  const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

  it('BE code로 분기(HTTP 상태 아님) — SCAN-003/002/001 각각 다른 안내', () => {
    const scan = read('src/app/scan.tsx');
    expect(scan).toContain("case 'SCAN-003':");
    expect(scan).toContain("case 'SCAN-002':");
    expect(scan).toContain("case 'SCAN-001':");
    expect(scan).toContain('stageForCode((e as { code?: string })?.code, msg)');
    // 각 분기가 서로 다른 FE i18n 키(= 서로 다른 안내). BE message 노출 금지
    for (const k of ['scan.errNotMenu', 'scan.errBusy', 'scan.errUpload']) expect(scan).toContain(k);
    // 메뉴판 아님 = 재촬영 / 인식 실패·업로드 = 재시도
    expect(scan).toContain("stage === 'busy' || stage === 'upload'");
    // 클라가 code를 받을 수 있어야 한다(래퍼 전파)
    expect(read('src/lib/api/client.ts')).toContain('readonly code?: string;');
  });

  it('v2 = 온디바이스 OCR 호출 0(경로 분기 — 코드는 보존, 킬스위치로 즉시 복귀)', () => {
    const scan = read('src/app/scan.tsx');
    expect(scan).toContain('if (scanV2Enabled()) {');
    expect(scan).toContain('v2 — on-device OCR skipped');
    expect(scan).toContain('recognizeMenuLines'); // v1 경로 보존 확인(삭제 아님)
    expect(read('src/lib/flags.ts')).toContain('scanV2: true');
  });

  it('similarFood = matched=false일 때만 링크로 노출(행 판정엔 미이식 — 유사 ≠ 동일)', () => {
    expect(one({ matched: true, similarFood: { foodId: 9, name: 'Other' } }).similar).toBeNull();
    const un = one({ matched: false, riskLevel: 'UNKNOWN', similarFood: { foodId: 9, name: 'Other' } });
    expect(un.similar).toEqual({ foodId: '9', name: 'Other', koreanName: null });
    expect(un.risk).toBe('unable'); // 유사 제안이 있어도 판정은 unable 유지
    expect(read('src/features/scan/ScanRichList.tsx')).toContain('{!dish.matched && dish.similar && (');
  });

  it('빈 회피 배열 = 컨테이너·제목 자체 미렌더(P-210 원칙)', () => {
    expect(read('src/features/scan/ScanRichList.tsx')).toContain('{!!dish.avoidances?.length && (');
  });
});
