/** KB-914 1차(R-137·R-138·R-139) — 가공식품 화면을 메뉴판·음식 상세 부품으로 */
import * as fs from 'fs';

import { detectedCodes, tileRisk } from '../packagedVerdictLogic';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const base = { verdict: 'AVOID' as const, avoidMatches: [{ code: 'MILK', evidence: [] }], mayContainMatches: [{ code: 'PEANUT', evidence: [] }], unclearIngredients: [], detections: [{ code: 'WHEAT', evidence: '', fromLabel: true }, { code: 'MILK', evidence: '', fromLabel: true }] };

describe('R-137 감지 재료 타일 — 위험 마크(false-safe 0)', () => {
  it('타일 코드 = 회피 일치 → 혼입 일치 → 감지(중복 제거)', () => {
    expect(detectedCodes(base)).toEqual(['MILK', 'PEANUT', 'WHEAT']);
  });
  it('회원 판정 있음 = 회피 일치 danger · 혼입 일치 caution · 그 밖 감지 safe(내 회피 목록 밖)', () => {
    expect(tileRisk('MILK', base, true)).toBe('danger');
    expect(tileRisk('PEANUT', base, true)).toBe('caution');
    expect(tileRisk('WHEAT', base, true)).toBe('safe');
  });
  it('회피·혼입 둘 다 걸리면 더 보수적인 danger', () => {
    expect(tileRisk('MILK', { ...base, mayContainMatches: [{ code: 'MILK', evidence: [] }] }, true)).toBe('danger');
  });
  it('판정 없음(비회원·회피 0개·확인 못 함·판정 기준이 바뀐 결과) = 마크 0 — safe를 그리지 않는다', () => {
    expect(tileRisk('WHEAT', base, false)).toBeNull();
    expect(tileRisk('WHEAT', { ...base, verdict: null }, true)).toBeNull();
    expect(tileRisk('MILK', { ...base, verdict: null }, true)).toBeNull();
  });
});

describe('R-137 같은 부품', () => {
  it('판정 띠·재료 타일 = 음식 상세와 가공식품(상세·성분표 결과)이 같은 공용 부품', () => {
    const food = read('src/app/food/[id]/index.tsx');
    expect(food).toContain('<VerdictBand state={dishRisk}');
    expect(food).toContain('<IngredientTile key={ing.code}');
    const v = read('src/features/processedFood/PackagedVerdict.tsx');
    expect(v).toContain('return <VerdictBand state={state}');
    expect(v).toContain('<IngredientTile key={code}');
    const pf = read('src/app/processed-foods/[id].tsx');
    expect(pf).toContain('<PackagedVerdictBand d={{ ...d, verdict: d.verdict }}');
    expect(pf).toContain('<PackagedDetectedTiles d={d} personalized={hasVerdict}');
    expect(pf).not.toContain('<RiskBadge'); // 사진 위 작은 리본 소멸 — 판정은 띠
    expect(pf).toMatch(/testID="pf-write-review-bar"/); // 하단 고정 CTA
    const res = read('src/features/scan/PackagedScanScreens.tsx');
    expect(res).toContain('<PackagedVerdictBand d={{ ...result, verdict: result.verdict }}');
    expect(res).toContain('reason={avoid}'); // 결과 전용 문장 그대로(문구 무변)
  });
  it('원재료 한 체계 — 상세·결과 모두 IngredientsText(번역·원문 = 같은 위계 소제목)', () => {
    expect(read('src/app/processed-foods/[id].tsx')).toContain('<IngredientsText translated={d.ingredients.translated}');
    expect(read('src/features/scan/PackagedScanScreens.tsx')).toContain('<IngredientsText translated={translated}');
    expect(read('src/app/processed-foods/[id].tsx')).not.toContain('testID="pf-original"'); // 구 별도 Korean original 섹션
  });
});

describe('R-138 후보 줄', () => {
  it('메뉴판 결과 줄 치수·회피 칩 부품 재사용 · 칩 = 위험 판정 줄만 상세 프리페치 · 확정 버튼 0', () => {
    const s = read('src/features/scan/PackagedScanScreens.tsx');
    expect(s).toContain("import { richStyles, WarnChips } from './ScanRichList';");
    expect(s).toContain("useProcessedDetail(risk === 'danger' || risk === 'caution' ? item.id : undefined)");
    expect(s).toContain('<WarnChips warns={warns}');
    expect(s).not.toContain('testID="pscan-confirm"');
    // QA Q-369 a): 줄 치수 = 메뉴판 결과 줄 그대로(덧댄 보더·흰 썸네일 바탕 0)
    expect(s).toContain('style={richStyles.row}');
    expect(s).not.toMatch(/rowGap|rowThumb: \{[^}]*backgroundColor/);
    expect(read('src/features/scan/ScanRichList.tsx')).toContain('<WarnChips warns={warns} testID={`warn-${dish.itemId}`}');
  });
});

describe('R-139 어두운 안내·오류 화면', () => {
  it('메뉴판 오류 화면과 가공식품 안내 페이지 = 같은 ScanDarkMessage', () => {
    expect(read('src/app/scan.tsx')).toContain('<ScanDarkMessage');
    const s = read('src/features/scan/PackagedScanScreens.tsx');
    expect(s).toMatch(/<ScanDarkMessage\s+testID=\{testID\}/);
    expect(s).not.toContain('<SubHeader title={headerTitle}'); // 구 밝은 헤더 페이지
  });
});

describe('2차 R-140 이름 한 부품', () => {
  it('후보·이름 찾기(CandidateRow)·탭 카드·상세 제목·리뷰 칩 = 모두 ProductName(영어 굵게 + 한국어 작게, 같으면 한 줄)', () => {
    const pn = read('src/features/processedFood/ProductName.tsx');
    expect(pn).toContain('const ko = nameKo && nameKo !== name ? nameKo : null;');
    expect(read('src/features/scan/PackagedScanScreens.tsx')).toContain('<ProductName name={item.name} nameKo={item.nameKo} />');
    expect(read('src/features/processedFood/PackagedExplorer.tsx')).toContain('<ProductName name={item.name} nameKo={item.nameKo}');
    expect(read('src/app/processed-foods/[id].tsx')).toContain('<ProductName name={d.name} nameKo={d.nameKo} size="title"');
    expect(read('src/app/food/[id]/review.tsx')).toContain('<ProductName name={targetName} nameKo={product?.nameKo ?? null} size="chip"');
    // 상세 메타 줄에 한국어명이 다시 나오지 않는다(이름 부품이 맡음)
    expect(read('src/app/processed-foods/[id].tsx')).not.toContain('[d.nameKo, d.type');
  });
});

describe('2차 R-141 무료 배지 = 카메라·후보·결과 3곳만', () => {
  it('배지 부품 하나(FreeBadge) · 흐름의 무료 줄 = 후보·카메라 2·결과 · 면 검토·이름 찾기·상세 0', () => {
    const flow = read('src/features/scan/PackagedScanFlow.tsx');
    expect(flow.match(/<PackagedFreeLine/g)).toHaveLength(4); // 후보 배너 · 앞면·성분표 카메라 · 결과 배너
    expect(flow.match(/<PackagedFreeLine style=\{st\.camFree\} explain=\{false\} \/>/g)).toHaveLength(2);
    const names = [...flow.matchAll(/<(\w+Screen)[\s\S]{0,400}?banner=\{<PackagedFreeLine \/>\}/g)].map((m) => m[1]);
    expect(names).toEqual(['CandidateScreen', 'LabelResultScreen']);
    expect(read('src/app/processed-foods/[id].tsx')).not.toMatch(/PackagedFreeExplain|freeStarted/);
    expect(read('src/features/scan/packagedFreeHour.tsx')).toContain('const line = <FreeBadge');
    expect(read('src/features/scan/PackagedScanScreens.tsx')).toContain('<FreeBadge text={t(\'packagedScan.freeStarted\')}');
  });
});

describe('2차 R-142 Packaged 탭 상단', () => {
  it('Dishes와 같은 검색 행(검색칸 + 주황 스캔 버튼 = 가공식품 모드) · 둘째 줄 = 유형 칩 · 판정 칩 0(서버 verdict 필터 대기 — 클라 필터 금지)', () => {
    const ex = read('src/features/processedFood/PackagedExplorer.tsx');
    expect(ex).toContain("<SearchScanButton onPress={() => router.navigate(`/scan?mode=packaged&t=${Date.now()}` as Href)} testID=\"packaged-scan\" />");
    expect(read('src/features/food/FoodExplorer.tsx')).toContain('<SearchScanButton onPress={() => router.navigate(\'/scan\')} testID="home-scan" />');
    expect(ex.indexOf('testID="packaged-scan"')).toBeLessThan(ex.indexOf('testID="packaged-types"'));
    expect(ex).not.toMatch(/verdict=|packaged-verdict-chip|\.filter\(\(it\) => it\.verdict/);
  });
});

describe('Codex #369 P2 · R-139 어두운 페이지 상태바', () => {
  it('안내·못 읽음·일반 오류 = 포커스일 때 light 상태바(떠나면 빠져 기본 복원) · 일반 오류도 어두운 화면', () => {
    const dm = read('src/features/scan/ScanDarkMessage.tsx');
    expect(dm).toContain('{lightStatusBar && <StatusBar style="light" />}');
    expect(read('src/features/scan/PackagedScanScreens.tsx')).toContain('lightStatusBar={focused}');
    const flow = read('src/features/scan/PackagedScanFlow.tsx');
    expect(flow.match(/<MessagePage\s+focused=\{focused\}/g)).toHaveLength(3); // another · frontUnreadable · 성분표 못 읽음
    expect(flow).toMatch(/<ScanDarkMessage\s+testID=\{`pscan-error-\$\{f\}`\}\s+lightStatusBar=\{focused\}/);
  });
});

describe('Codex #369 2R P1 — 가공 판정 띠 제목 = 매칭 범위(보장 표현 0)', () => {
  it('가공 띠 제목 = 가공 전용 키만(음식 상세 detail.verdict* 0) · SAFE = noAvoidMatchTitle 10로케일 · ko = "확인한 성분 중 피하는 재료 없음"(KB-924 승인)', () => {
    const v = read('src/features/processedFood/PackagedVerdict.tsx');
    expect(v).not.toMatch(/VERDICT_TITLE|detail\.verdict/);
    expect(v).toContain("t('packaged.noAvoidMatchTitle')");
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']) {
      const pk = (JSON.parse(read(`src/lib/i18n/${l}.json`)) as { packaged: Record<string, string> }).packaged;
      expect({ l, ok: typeof pk.noAvoidMatchTitle === 'string' && pk.noAvoidMatchTitle.length > 0 }).toEqual({ l, ok: true });
    }
    const ko = (JSON.parse(read('src/lib/i18n/ko.json')) as { packaged: Record<string, string> }).packaged;
    expect(ko.noAvoidMatchTitle).toBe('확인한 성분 중 피하는 재료 없음'); // KB-924 예진 승인
    expect(ko.noAvoidMatchTitle).not.toMatch(/안전|안심|드세요/);
  });
});
