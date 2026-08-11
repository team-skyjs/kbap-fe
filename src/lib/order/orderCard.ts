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

/** 받침 조사(이/가) — eulReul과 동일 산술, 주격용 (P-045 사장님 질문). */
export function iGa(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 > 0 ? '이' : '가';
  return '이(가)';
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

// P-033(KB-205 정정): 종교·식이 한 줄(③)은 제거 — 회피 모델은 평면 81종 재료로
// 통일(religion:/diet: 코드 폐기 확정). 종교·식이 제약은 해당 재료가 기피 목록에
// 포함되는 것으로 ②가 이미 커버한다.

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * P-052(KB-215 반려): 재료 식별자 → ko 라벨 **실해석**. 상세 API의
 * IngredientResponse엔 81종 코드가 없고 name(요청 언어)뿐이라, 어댑터의 합성
 * 라우트 키(`ing:{i}:{name}`)가 여기로 온다 — name을 추출해 81종의
 * en 카탈로그명·현재 언어 라벨·ko 라벨 역인덱스에서 찾는다(정규화 비교).
 * 실패 = null — 호출측이 일반 질문으로 강등(내부 식별자 노출 0).
 */
export function resolveIngredientKo(codeOrKey: string): string | null {
  if (BY_CODE.has(codeOrKey)) return ingredientLabelKo(codeOrKey); // 직접 81종 코드
  const m = /^ing:\d+:(.+)$/.exec(codeOrKey);
  if (!m) return null; // 미지 형식 — 원문 통과 금지
  const q = norm(m[1]);
  const tko = i18n.getFixedT('ko');
  for (const ing of INGREDIENTS) {
    const cands = [ing.name];
    if (ing.i18nKey) {
      cands.push(String(i18n.t(`ingredients.${ing.i18nKey}`, { defaultValue: '' }))); // 요청(현재) 언어
      cands.push(String(tko(`ingredients.${ing.i18nKey}`, { defaultValue: '' }))); // ko
    }
    if (cands.some((c) => c && norm(c) === q)) return ingredientLabelKo(ing.code);
  }
  // P-109(KB-281): 역인덱스 실패라도 **순한글 실명칭은 그대로 채용** — reader=ko일 때
  // BE 성분 사전의 ko 동의어(실례: BE '계란' vs FE '달걀' → 계란만 일반 폴백 버그)는
  // 그 자체가 사장님에게 보여줄 한국어다. P-052(원문/식별자 노출 봉쇄)는 비한글
  // 대상 — 한글 아닌 문자가 섞이면 종전대로 일반 질문 강등.
  const raw = m[1].trim();
  if (/^[가-힣\s]+$/.test(raw)) return raw;
  return null; // 비한글 서버 번역이 FE 라벨과 상이 — 원문보단 덜 구체적인 일반 질문이 낫다
}

/**
 * P-045(KB-215): 사장님 확인 질문 실데이터 조립 — mock PHRASES 사전 폐기.
 * menuNameKo는 상세 캐시의 실명(스캔 미등록 흐름도 decode된 실명), 재료는
 * 실해석(resolveIngredientKo) 성공 시에만 구체 질문 — 실패·부재는 일반 질문
 * (P-052: 내부 식별자/원문이 사장님 화면에 뜨는 경로 원천 봉쇄).
 */
/** P-163: 폴백 질문에 나열할 회피 ko 라벨 — 81종 미등재 코드는 제외(식별자 노출 봉쇄, P-052 계열). */
export function avoidLabelsKo(codes: string[]): string[] {
  return codes.filter((c) => BY_CODE.has(c)).map(ingredientLabelKo);
}

export function ownerQuestionKo(menuNameKo: string, ingredientCode?: string, avoidCodes?: string[]): string {
  const label = ingredientCode ? resolveIngredientKo(ingredientCode) : null;
  if (label) return `${menuNameKo}에 ${label}${iGa(label)} 들어가나요?`;
  // P-163: 폴백도 뭉뚱그리지 않는다 — 프로필 회피 재료 전부 나열(사장님이 봐야 할
  // 정보라 생략·상한 없음), 조사는 마지막 항목 받침 기준(iGa 기존 로직).
  const labels = avoidLabelsKo(avoidCodes ?? []);
  if (labels.length) return `${menuNameKo}에 ${labels.join(', ')}${iGa(labels[labels.length - 1])} 들어가나요?`;
  return `${menuNameKo}에 제가 못 먹는 재료가 들어가나요?`;
}
