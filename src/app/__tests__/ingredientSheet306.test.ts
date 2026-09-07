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
  expect(detail).toContain("/owner?ingredient=${encodeURIComponent(code)}&reason=${avoid ? 'avoid' : 'neutral'}"); // Codex P1: 문맥 동봉
  expect(detail).toContain("!guest && ['danger', 'caution'].includes(personalRisk(ingSheet.risk"); // 회원+회피만 avoid
  const askBlock = detail.slice(detail.indexOf('const code = ingSheet.code'), detail.indexOf('ing-sheet-ask'));
  expect(askBlock.indexOf('setIngSheet(null)')).toBeLessThan(askBlock.indexOf('router.push')); // 모달 닫고 이동
});

it('ownerQuestionKo — 재료 1개 = "{음식}에 {재료}{이/가} 들어가나요?"(기존 규칙 재사용)', () => {
  expect(ownerQuestionKo('김치찌개', 'PORK')).toMatch(/^김치찌개에 .+ 들어가나요\?$/);
});

it('i18n — ingGuestBody 2키 10로케일 실번역(영어 복사 잔존 0 · ko 조사 자리표시 잔존 0)', () => {
  const en = JSON.parse(fs.readFileSync('src/lib/i18n/en.json', 'utf8')) as { detail: Record<string, string> };
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = JSON.parse(fs.readFileSync(`src/lib/i18n/${loc}.json`, 'utf8')) as { detail: Record<string, string> };
    expect(typeof j.detail.ingGuestBody).toBe('string');
    expect(typeof j.detail.ingGuestBodyNoPct).toBe('string');
    if (loc !== 'en') {
      expect(j.detail.ingGuestBody).not.toBe(en.detail.ingGuestBody); // Codex P2: en 복사 금지
      expect(j.detail.ingGuestBodyNoPct).not.toBe(en.detail.ingGuestBodyNoPct);
    }
  }
  const ko = JSON.parse(fs.readFileSync('src/lib/i18n/ko.json', 'utf8')) as { detail: Record<string, string> };
  expect(ko.detail.ingGuestBody).not.toContain('은(는)'); // Codex P2: 조사 자리표시 소멸(문장 재작성)
  expect(ko.detail.ingGuestBodyNoPct).not.toContain('은(는)');
});

describe('Codex #67 P1: 사장님 카드 설명 문맥(reason) — 게스트·safe = 무단정', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const owner = fs.readFileSync('src/app/food/[id]/owner.tsx', 'utf8');
  const hook = fs.readFileSync('src/lib/data/useOwnerConfirmation.ts', 'utf8');
  /* eslint-enable */
  it('owner 라우트 = reason 파라미터 수용·훅 관통, neutral = 알레르기 단정 없는 설명', () => {
    expect(owner).toContain("reason?: string");
    expect(owner).toContain("useOwnerConfirmation(id ?? '', ingredient, reason)");
    expect(hook).toContain("reason === 'neutral' ? EXPLANATION_NEUTRAL_KO");
    expect(hook).toContain("const EXPLANATION_NEUTRAL_KO = '이 재료가 들어가는지 확인하고 싶어요.';");
    // 기존 호출(파라미터 부재) = 현행 알레르기/회피 설명 유지(reason 미전달 = 무변)
    expect(hook).toContain('listing ? EXPLANATION_AVOID_KO : EXPLANATION_KO');
  });
});
