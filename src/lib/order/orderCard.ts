/**
 * orderCard — 주문+고지 원카드 문장 조립 (KB-205/P-030, 기획 정본:
 * spec/specs/001-personalized-menu-mvp/order-card-brief.md).
 *
 * 카드 본문은 place=한국어 고정 (헌법 I reader/place 2축 — 번역이 아니라 ko
 * 데이터): UI 언어와 무관하게 i18n.getFixedT('ko')로 ko 라벨을 뽑는다.
 * BE 호출 0 — 상세(koreanName)와 프로필(restrictions) 기존 데이터만 조합.
 */
import i18n from '@/lib/i18n';
import { INGREDIENTS } from '@/lib/mocks/ingredients';

const BY_CODE = new Map(INGREDIENTS.map((i) => [i.code, i]));

/**
 * 받침 조사(을/를): 마지막 글자가 한글 음절이면 종성 유무로 분기,
 * 비한글(라틴/숫자 등)은 판정 불가 → '을(를)' 병기 폴백.
 */
export function eulReul(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 > 0 ? '을' : '를';
  return '을(를)';
}

/** 재료 코드 → ko 라벨 (UI 언어 무관 — 사장님 카드는 항상 한국어). */
export function ingredientLabelKo(code: string): string {
  const e = BY_CODE.get(code);
  if (!e) return code;
  return e.i18nKey ? i18n.getFixedT('ko')(`ingredients.${e.i18nKey}`, { defaultValue: e.name }) : e.name;
}

/** 주요 노출 상한 — 초과분은 "외 n개" 접기 (기획 §2-2). */
export const MAX_AVOID_SHOWN = 6;

/** ① 주문 문장. 수량 단위는 MVP "1개" 통일 (분류 데이터 생기면 개선 — 백로그). */
export function orderSentenceKo(koreanName: string, qty: number): string {
  return `${koreanName} ${qty}개 주세요.`;
}

/** ② 기피 고지 문장 — 프로필 기피 전체. 재료 코드 0개면 null(순수 주문 카드). */
export function avoidSentenceKo(codes: string[]): string | null {
  const labels = codes.filter((c) => BY_CODE.has(c)).map(ingredientLabelKo);
  if (!labels.length) return null;
  const shown = labels.slice(0, MAX_AVOID_SHOWN);
  const rest = labels.length - shown.length;
  const list = rest > 0 ? `${shown.join(', ')} 외 ${rest}개` : shown.join(', ');
  const particleTarget = rest > 0 ? '개' : shown[shown.length - 1];
  return `저는 ${list}${eulReul(particleTarget)} 못 먹어요. 들어가면 알려주세요.`;
}

/**
 * ③ 종교·식이 한 줄 — 코드 보유 시에만. ⚠️ 현행 와이어(avoidanceSubstanceCodes)
 * 는 재료 81종만 왕복하므로 live 프로필에선 아직 도달 불가 — 서버가 종교·식이
 * 코드를 실어주면 자동 활성되는 확장 지점 (온보딩 수집 코드와 동일 체계).
 */
const LIFESTYLE_KO: Record<string, string> = {
  'religion:halal': '무슬림 식단입니다.',
  'religion:kosher': '코셔 식단입니다.',
  'religion:nopork': '돼지고기를 먹지 않습니다.',
  'religion:nobeef': '소고기를 먹지 않습니다.',
  'diet:vegetarian': '베지테리언입니다.',
  'diet:vegan': '비건입니다.',
  'diet:pescatarian': '페스코 베지테리언입니다.',
  'diet:glutenfree': '글루텐프리 식단입니다.',
  'diet:lowspice': '맵지 않게 해주세요.',
};

export function lifestyleLinesKo(codes: string[]): string[] {
  return codes.map((c) => LIFESTYLE_KO[c]).filter((s): s is string => !!s);
}
