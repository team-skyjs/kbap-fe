/**
 * P-219(KB-29): 스캔 v2 — 회피 겹침(avoidances) 매핑·false-safe 강등,
 * 에러 분기(BE code 기반), OCR 미호출 경로 잠금. (similarFood는 P-241 철거)
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

describe('⑤ ⑦ 에러 분기 · OCR 미호출 — 소스 잠금', () => {
  const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

  it('BE code로 분기(HTTP 상태 아님) — SCAN-003/002/001 각각 다른 안내', () => {
    // P-220: 분류 로직은 순수 모듈로 이전(scanErrors.ts) — 화면은 경유만
    const errors = read('src/lib/scan/scanErrors.ts');
    expect(errors).toContain("case 'SCAN-003':");
    expect(errors).toContain("case 'SCAN-002':");
    expect(errors).toContain("case 'SCAN-001':");
    // 각 분기가 서로 다른 FE i18n 키(= 서로 다른 안내). BE message 노출 금지
    for (const k of ['scan.errNotMenu', 'scan.errBusy', 'scan.errUpload']) expect(errors).toContain(k);
    const scan = read('src/app/scan.tsx');
    expect(scan).toContain('stageForCode((e as { code?: string })?.code, msg)');
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


  it('P-223: 회피 표시는 칩 줄 1곳으로 통합 — 구 avoidances 전용 섹션 소멸', () => {
    const list = read('src/features/scan/ScanRichList.tsx');
    expect(list).not.toContain('styles.avoidRow'); // P-219 신설 섹션 제거(이중 표시 정정)
    expect(list).not.toContain('scan.avoidTitle');
    // 통합 줄이 v2 데이터를 우선 소비(없으면 v1 조인 폴백)
    expect(list).toContain('dish.avoidances?.length');
    expect(list).toContain("(food?.ingredients ?? [])");
    expect(list).toContain('{warns.length > 0 && ('); // 표시 조건 = 통합 줄 하나
  });
});
