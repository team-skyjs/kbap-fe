/**
 * useIngredientCatalog (P-174/KB-305, BE #150) — GET /api/ingredients (공개·lang 필수).
 * 서버가 code·요청 언어 번역명(부재 시 ko)·이미지 공개 URL(미매칭 null)을 내려준다.
 *
 * 역할: **표시 보강만** — FE 카탈로그(INGREDIENTS — 카테고리 그룹·검색 구조·en 명)는
 * 유지하고 code 기준 머지로 name·imageUrl을 서버 우선 적용. 폴백 체인:
 *   이름: 서버 name → 기존 ingredientLabel(i18n)
 *   이미지: 서버 imageUrl → 클라 조립(P-145) → 색 타일(P-134) — 뒤 2단은 AvoidTile 몫.
 * ⚠️ 사장님 카드 ko 조립(ingredientLabelKo)은 이 카탈로그와 무관 — safety 잠금 영역 무변.
 *
 * 공개 API라 게스트/온보딩에서도 동작. 카탈로그는 사실상 정적 — staleTime 24h.
 */
import { useQuery } from '@tanstack/react-query';
import i18n from '../i18n';
import { api, apiLang } from '../api/client';
import { ingredientLabel } from '../mocks/ingredients';

export interface IngredientCatalogItem {
  code: string;
  name: string; // 요청 언어 번역(부재 시 ko)
  imageUrl?: string | null; // 미매칭 null
}

/** 훅 밖 분리 — 유닛 잠금용. */
export async function fetchIngredientCatalog(): Promise<Map<string, IngredientCatalogItem>> {
  const wire = await api.get<{ ingredients: IngredientCatalogItem[] }>(`/api/ingredients?lang=${apiLang()}`);
  return new Map((wire.ingredients ?? []).map((it) => [it.code, it]));
}

/** code 머지 헬퍼 — 서버 우선·누락 폴백 (순수, 유닛 잠금). */
export function catalogName(cat: Map<string, IngredientCatalogItem> | undefined, code: string): string {
  return cat?.get(code)?.name ?? ingredientLabel(code);
}
export function catalogImageUrl(cat: Map<string, IngredientCatalogItem> | undefined, code: string): string | null {
  return cat?.get(code)?.imageUrl ?? null;
}

export function useIngredientCatalog() {
  const q = useQuery({
    queryKey: ['ingredientCatalog', i18n.language],
    queryFn: fetchIngredientCatalog,
    staleTime: 24 * 3600_000,
  });
  return {
    name: (code: string) => catalogName(q.data, code),
    imageUrl: (code: string) => catalogImageUrl(q.data, code),
  };
}
