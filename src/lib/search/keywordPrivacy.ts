/**
 * P-214 🔒 (KB-316): 검색어 계측 PII 경계.
 *
 * 검색어 자유 텍스트는 알레르기·종교 회피 맥락에서 사실상 건강·신념 데이터라
 * **그대로 전송 금지**. 카탈로그(재료 81종 · 이번 검색 결과 음식명)에 매칭될
 * 때만 **매칭된 카탈로그 값**을 보내고(사용자 원문 아님 — 오타·문장 유출 차단),
 * 미매칭이면 keyword를 아예 생략하고 matched:false + 길이 버킷만 남긴다.
 * 인기 검색어 분석 가치는 유지, 자유 텍스트는 소멸.
 *
 * 불확실하면 **미전송**(false-safe 원칙과 같은 방향) — 부분 일치·유사도 판정 없음.
 */
import { INGREDIENTS } from '@/lib/mocks/ingredients';

export type SearchKeywordProps = {
  keyword?: string;
  matched: boolean;
  len_bucket: '1-3' | '4-10' | '11+';
  result_count: number;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function lenBucket(term: string): SearchKeywordProps['len_bucket'] {
  const n = term.trim().length;
  return n <= 3 ? '1-3' : n <= 10 ? '4-10' : '11+';
}

/**
 * @param raw 사용자 입력 원문(전송되지 않는다 — 판정에만 사용)
 * @param resultNames 이번 검색 결과의 음식명(name·nameKo 등) — 서버 카탈로그 값
 */
export function searchKeywordProps(raw: string, resultNames: readonly string[]): SearchKeywordProps {
  const term = norm(raw);
  const base = { matched: false as boolean, len_bucket: lenBucket(raw), result_count: resultNames.length };
  if (!term) return base;

  // 카탈로그 = 재료 81종(코드·영문명) + 이번 결과 음식명. 정확 일치 또는
  // 카탈로그 항목의 접두(사용자가 줄여 친 경우) — 전송값은 **카탈로그 항목**.
  const catalog: string[] = [
    ...INGREDIENTS.flatMap((i) => [norm(i.name), norm(i.code.replace(/_/g, ' '))]),
    ...resultNames.map(norm),
  ].filter(Boolean);

  const exact = catalog.find((c) => c === term);
  if (exact) return { ...base, matched: true, keyword: exact };
  const prefixed = catalog.find((c) => c.startsWith(term) && term.length >= 2);
  if (prefixed) return { ...base, matched: true, keyword: prefixed };
  return base; // 미매칭 = keyword 자체를 만들지 않는다(생략 ≠ 빈 문자열)
}
