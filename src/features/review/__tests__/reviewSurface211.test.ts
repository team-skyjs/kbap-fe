/**
 * P-211: 리뷰 작성·피드 실기 4건 — 소스 잠금.
 * ① 완료 모달 = "Done" 단일 문구(전 로케일 키 존재·구 backToDish 소멸)
 * ② 장소 줄 = 커뮤니티 TagChip(배경 칩) 경유 — 회색 텍스트 직렌더 금지
 * ③ 작성/수정/삭제 무효화 = 전역 피드 포함(useInvalidateReviews 한 곳)
 * ④ 커뮤니티 탭(ReviewFeed) 헤더 = 공용 StickyHeader(스크롤 반응) — 자체 헤더 소멸
 */
import * as fs from 'fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

it('① 완료 모달 — review.done 단일 문구, 구 backToDish 키 전 로케일 소멸', () => {
  const compose = read('src/app/food/[id]/review.tsx');
  expect(compose).toContain("t('review.done')");
  expect(compose).not.toContain('backToDish');
  for (const lang of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id']) {
    const dict = JSON.parse(read(`src/lib/i18n/${lang}.json`));
    expect(typeof dict.review.done).toBe('string');
    expect(dict.review.backToDish).toBeUndefined();
  }
});

it('② 장소 줄 — TagChip(kind="place") 경유(배경 칩), 구 회색 텍스트 스타일 소멸', () => {
  const parts = read('src/features/review/ReviewCellParts.tsx');
  expect(parts).toContain("import { TagChip } from '@/features/community/parts';");
  expect(parts).toContain('<TagChip kind="place" label={place.name}');
  expect(parts).not.toContain('placeLineText');
});

it('③ 무효화 — 전역 피드(["reviews","global"]) 포함, 생성/수정/삭제 공용 경유', () => {
  const src = read('src/lib/data/useReviewMutations.ts');
  expect(src).toContain("void qc.invalidateQueries({ queryKey: ['reviews', 'global'] });");
  // 세 뮤테이션 전부 공용 invalidate 경유(개별 무효화 재발 방지)
  expect(src.match(/useInvalidateReviews\(\)/g)?.length).toBe(4); // 선언 1 + 소비 3
});

it('④ 커뮤니티 탭 헤더 — 공용 StickyHeader + useStickyScroll, 자체 헤더 스타일 소멸', () => {
  const feed = read('src/features/community/ReviewFeed.tsx');
  expect(feed).toContain('useStickyScroll()');
  // KB-430: 로고 AppBar(홈 공용) — 센터 타이틀 소멸, 벨 동승
  expect(feed).toContain('mode="brand"');
  expect(feed).toContain('bell={FLAGS.notificationCenter}');
  expect(feed).toContain('paddingTop: headerH');
  expect(feed).not.toMatch(/StickyHeader[^>]*title=/s); // AppBar 타이틀 슬롯 소멸(ActionSheet title은 별개)
});
