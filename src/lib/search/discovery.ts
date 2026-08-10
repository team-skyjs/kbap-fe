/**
 * search/discovery.ts (P-143, 멘토 #13·14·17) — 검색 유도 큐레이션의 격리 지점.
 *
 * 시드 선정 기준(보고 명기): 음식 DB 실존 항목 중 **popularityRank 상위**
 * (KB-71 에디토리얼 랭크 — DB 실존·사진 보유 보장)에서 상위 N을 취한다.
 * 키워드는 리더 언어 번역명(FoodCard.name — 서버가 lang으로 번역해 준 값).
 *
 * ⚠️ BE ⑥(실시간 인기 집계 API) 배포 시 **이 모듈만** 실 API 데이터로 스왑 —
 * 화면(search.tsx)은 placeholderKeyword·popularPhotoFoods 시그니처 유지.
 */
import type { FoodCard } from '@/lib/api/types';

/** placeholder 로테이션 풀 크기 — 대표 한식 8~12종(발주 범위 내). */
export const SEED_POOL_N = 12;
/** 인기 사진 섹션 노출 수. */
export const POPULAR_PHOTO_N = 8;

/** 랭크 정렬 상위 풀 — rank 무보유(999)는 뒤로. */
function rankSorted(catalog: FoodCard[]): FoodCard[] {
  return [...catalog].sort((a, b) => (a.popularityRank ?? 999) - (b.popularityRank ?? 999));
}

/**
 * placeholder 키워드 — 상위 풀에서 1개(호출마다 랜덤 = 검색 진입마다 로테이션,
 * FE 재량 보고). 카탈로그 미로드 시 null → 화면은 기본 placeholder 유지.
 */
export function placeholderKeyword(catalog: FoodCard[] | undefined, rand: () => number = Math.random): string | null {
  if (!catalog?.length) return null;
  const pool = rankSorted(catalog).slice(0, SEED_POOL_N);
  return pool[Math.floor(rand() * pool.length)]?.name ?? null;
}

/** 인기 사진 섹션 — 랭크 상위 중 **사진 보유 우선** N개 (사진 없는 항목은 뒤로). */
export function popularPhotoFoods(catalog: FoodCard[] | undefined, n: number = POPULAR_PHOTO_N): FoodCard[] {
  if (!catalog?.length) return [];
  const ranked = rankSorted(catalog);
  return [...ranked.filter((f) => !!f.photoUrl), ...ranked.filter((f) => !f.photoUrl)].slice(0, n);
}
