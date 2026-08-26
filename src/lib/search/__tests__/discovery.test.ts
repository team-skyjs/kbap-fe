/**
 * P-143: 검색 유도 큐레이션 잠금 — placeholder 로테이션·인기 사진 정렬.
 */
import { placeholderKeyword, popularPhotoFoods, SEED_POOL_N } from '../discovery';
import type { FoodCard } from '@/lib/api/types';

const F = (id: string, rank: number | undefined, photo: string | null): FoodCard => ({
  foodId: id,
  name: `Name${id}`,
  nameKo: `한식${id}`,
  photoUrl: photo,
  risk: 'safe',
  overall: { average: null, count: 0 },
  sameNationality: { average: null, count: 0 },
  popularityRank: rank,
});

const CATALOG = [F('3', 3, null), F('1', 1, 'p1'), F('99', undefined, 'p99'), F('2', 2, 'p2')];

it('placeholder — 랭크 상위 풀에서 선택(rand 주입 결정적), 미로드 시 null', () => {
  expect(placeholderKeyword(undefined)).toBe(null);
  expect(placeholderKeyword([])).toBe(null);
  // rand=0 → 풀 첫 항목 = rank 1
  expect(placeholderKeyword(CATALOG, () => 0)).toBe('Name1');
  // rand 상한 근처 → 풀 마지막(랭크 무보유는 뒤) — 풀 크기 내 로테이션
  expect(placeholderKeyword(CATALOG, () => 0.999)).toBe('Name99');
  expect(SEED_POOL_N).toBeGreaterThanOrEqual(8);
  expect(SEED_POOL_N).toBeLessThanOrEqual(12);
});

it('인기 사진 — 랭크 정렬 + 사진 보유 우선(무사진은 뒤)', () => {
  const out = popularPhotoFoods(CATALOG, 4);
  expect(out.map((f) => f.foodId)).toEqual(['1', '2', '99', '3']); // 사진(1,2,99) 먼저, 무사진(3) 마지막
  expect(popularPhotoFoods(undefined)).toEqual([]);
});

describe('KB-310: 홈·검색 인기 섹션 = 라이브 카탈로그 배선(목 잔재 사진 미표시 수정)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');

  it('소스 잠금 — useFoods()(MOCK_MODE 목·photoUrl 전부 null) 소비 잔존 0', () => {
    const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
    expect(home).toContain('popularPhotoFoods(browse.data)'); // 라이브(useInfiniteFoods) 캐시 재사용
    expect(home).not.toMatch(/= useFoods\(\)/); // 실호출 잔존 0(주석 언급은 허용)
    const search = fs.readFileSync('src/app/search.tsx', 'utf8') as string;
    expect(search).toContain('const catalog = probe.data;'); // probe(라이브) 재사용 — 왕복 0 추가
    expect(search).not.toMatch(/= useFoods\(\)/);
    expect(search).not.toContain('mockCatalog');
  });

  it('실 데이터 형태 — useInfiniteFoods select = FoodCard 평탄 배열(무한 pages 구조 아님)', () => {
    // popularPhotoFoods는 배열 전제 — select가 pages를 평탄화해 주는 계약을 잠근다
    const hooks = fs.readFileSync('src/lib/data/useFoods.ts', 'utf8') as string;
    expect(hooks).toMatch(/useInfiniteFoods[\s\S]*?select: \(data\) => data\.pages\.flatMap/);
  });

  it('실 카탈로그(popularityRank 부재 — BE ⑥ 대기) = 999 폴백으로 서버 순서 유지 + 사진 우선', () => {
    const live = [
      { foodId: '1', name: 'A', nameKo: 'ㄱ', photoUrl: null, risk: 'safe', overall: { average: null, count: 0 } },
      { foodId: '2', name: 'B', nameKo: 'ㄴ', photoUrl: 'https://cdn/b.jpg', risk: 'safe', overall: { average: null, count: 0 } },
      { foodId: '3', name: 'C', nameKo: 'ㄷ', photoUrl: 'https://cdn/c.jpg', risk: 'safe', overall: { average: null, count: 0 } },
    ] as never[];
    const out = popularPhotoFoods(live, 3);
    expect(out.map((f) => f.foodId)).toEqual(['2', '3', '1']); // 사진 보유 우선·안정 정렬(서버 순서)
  });
});
