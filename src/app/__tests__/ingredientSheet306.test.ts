/**
 * P-306(KB-462) — 재료 시트 개편 소스 잠금: 빈도 좌측 정렬 · 게스트 본문(빈도+편차 안내,
 * 회피 언급 0) · Close 제거 · Ask the owner(ingredient 파라미터·계측 source).
 * + ownerQuestionKo 재료 1개 질문 실측(기존 규칙 재사용 확인).
 */
import * as fs from 'fs';
import { ownerQuestionKo } from '@/lib/order/orderCard';

const detail = fs.readFileSync('src/app/food/[id]/index.tsx', 'utf8');

it('빈도 줄 = 시트 전용 좌측 스타일(타일 center 재사용 잔존 0)', () => {
  expect(detail).toContain("<Text style={styles.ingSheetSub}>{t('detail.ofShops'");
  expect(detail).toContain("ingSheetSub: { fontSize: 11, fontWeight: '400', color: '#5A636A' }");
  // 시트 블록 안에 ingTileSub 잔존 0(타일 그리드 쪽만 사용)
  const sheet = detail.slice(detail.indexOf('§1-6: 재료 상세 바텀시트'), detail.indexOf('</Modal>'));
  expect(sheet).not.toContain('styles.ingTileSub');
});

it('게스트 본문 = ingGuestBody(빈도)/ingGuestBodyNoPct 분기 — note·회피 언급 잔존 0', () => {
  expect(detail).toContain("ingSheet.percentage != null ? 'detail.ingGuestBody' : 'detail.ingGuestBodyNoPct'");
  const sheet = detail.slice(detail.indexOf('§1-6: 재료 상세 바텀시트'), detail.indexOf('</Modal>'));
  expect(sheet).not.toContain('guest ? (ingSheet.note'); // 구 게스트 note 본문 소멸
});

it('Close 제거 · Ask the owner = ingredient 파라미터 + source ingredient_sheet + 시트 닫기 선행', () => {
  expect(detail).not.toContain('ing-sheet-close');
  expect(detail).toContain('testID="ing-sheet-ask"');
  expect(detail).toContain("source: 'ingredient_sheet'");
  expect(detail).toContain('/owner?ingredient=${encodeURIComponent(code)}');
  const askBlock = detail.slice(detail.indexOf('const code = ingSheet.code'), detail.indexOf('ing-sheet-ask'));
  expect(askBlock.indexOf('setIngSheet(null)')).toBeLessThan(askBlock.indexOf('router.push')); // 모달 닫고 이동
});

it('ownerQuestionKo — 재료 1개 = "{음식}에 {재료}{이/가} 들어가나요?"(기존 규칙 재사용)', () => {
  expect(ownerQuestionKo('김치찌개', 'PORK')).toMatch(/^김치찌개에 .+ 들어가나요\?$/);
});

it('i18n — ingGuestBody 2키 10로케일 존재(ko = 초안, K-검수 등록)', () => {
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = JSON.parse(fs.readFileSync(`src/lib/i18n/${loc}.json`, 'utf8')) as { detail: Record<string, string> };
    expect(typeof j.detail.ingGuestBody).toBe('string');
    expect(typeof j.detail.ingGuestBodyNoPct).toBe('string');
  }
});
