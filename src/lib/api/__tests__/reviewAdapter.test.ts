/**
 * P-085(KB-73): 리뷰 어댑터 잠금 —
 *  ① PATCH 풀 페이로드(buildReviewUpdate): 본문만 고쳐도 사진·별점 전량 유지
 *    ("생략=제거" 함정 — 이 발주의 최대 함정)
 *  ② author 방어 3케이스: null(탈퇴)·nickname null·countryCode null
 *  ③ 조회 URL → 전송 path 역변환
 */
import { adaptReview, adaptReviewPage, buildReviewUpdate, imageUrlToPath, type ReviewWire } from '../reviewAdapter';

const WIRE: ReviewWire = {
  reviewId: 42,
  foodId: 7,
  memberId: 9,
  rating: 4,
  content: '정말 맛있어요',
  imageUrls: ['https://cdn.kbap.site/review/9/a.jpg', 'https://cdn.kbap.site/review/9/b.jpg'],
  createdAt: '2026-07-30T09:00:00Z',
  author: { memberId: 9, nickname: '먹보', countryCode: 'VN', tier: 'GOURMET', level: 2, score: 15 },
};

describe('buildReviewUpdate — 풀 페이로드 (생략=제거 함정 봉쇄)', () => {
  const current = { rating: 4, body: '원본 본문', photos: WIRE.imageUrls };

  it('본문만 변경 → rating 유지 + imagePaths(URL→path) 전량 포함 — 사진 소실 0', () => {
    const body = buildReviewUpdate(current, { body: '고친 본문' });
    expect(body).toEqual({
      rating: 4,
      content: '고친 본문',
      imagePaths: ['review/9/a.jpg', 'review/9/b.jpg'],
    });
  });

  it('별점만 변경 → 본문·사진 전량 유지', () => {
    const body = buildReviewUpdate(current, { rating: 5 });
    expect(body.rating).toBe(5);
    expect(body.content).toBe('원본 본문');
    expect(body.imagePaths).toEqual(['review/9/a.jpg', 'review/9/b.jpg']);
  });

  it('본문 비움 = 의도된 제거 → content 생략, 사진은 유지', () => {
    const body = buildReviewUpdate(current, { body: '   ' });
    expect('content' in body).toBe(false);
    expect(body.imagePaths).toEqual(['review/9/a.jpg', 'review/9/b.jpg']);
  });

  it('사진 없던 리뷰 → imagePaths 빈 배열 명시 (생략과 결과 동일하나 명시가 안전)', () => {
    const body = buildReviewUpdate({ rating: 3, body: null, photos: [] }, { body: 'x' });
    expect(body.imagePaths).toEqual([]);
  });
});

describe('adaptReview — author 방어 3케이스 (크래시 없이 렌더 가능한 형태로)', () => {
  it('정상 author — 파생 필드 동기 (nationality·tier)', () => {
    const r = adaptReview(WIRE);
    expect(r.id).toBe('42');
    expect(r.foodId).toBe('7');
    expect(r.memberId).toBe('9');
    expect(r.author?.nickname).toBe('먹보');
    expect(r.authorNationality).toBe('VN');
    expect(r.authorRankTier).toBe('GOURMET');
    expect(r.anonymized).toBe(false);
    expect(r.photos).toEqual(WIRE.imageUrls);
  });

  it('author null(탈퇴 회원) → anonymized·파생 전부 null', () => {
    const r = adaptReview({ ...WIRE, author: null });
    expect(r.anonymized).toBe(true);
    expect(r.author).toBe(null);
    expect(r.authorNationality).toBe(null);
    expect(r.authorRankTier).toBe(null);
  });

  it('nickname null(미설정)·countryCode null(미보유) → null 보존 (화면 폴백 몫)', () => {
    const r = adaptReview({ ...WIRE, author: { memberId: 9, nickname: null, countryCode: null, tier: 'EXPLORER', level: 1, score: 3 } });
    expect(r.anonymized).toBe(false);
    expect(r.author?.nickname).toBe(null);
    expect(r.authorNationality).toBe(null);
    expect(r.authorRankTier).toBe('EXPLORER');
  });

  it('content 누락 → body null · 페이지 어댑트(커서 문자열화)', () => {
    const page = adaptReviewPage({ items: [{ ...WIRE, content: undefined }], hasNext: true, nextCursor: 42 });
    expect(page.items[0].body).toBe(null);
    expect(page.hasNext).toBe(true);
    expect(page.nextCursor).toBe('42');
    expect(adaptReviewPage({ items: [], hasNext: false }).nextCursor).toBe(null);
  });
});

describe('imageUrlToPath — 조회 URL → 전송 path', () => {
  it('CDN URL → 도메인 제거한 오브젝트 경로', () => {
    expect(imageUrlToPath('https://cdn.kbap.site/review/9/a.jpg')).toBe('review/9/a.jpg');
    expect(imageUrlToPath('http://host/x/y.png')).toBe('x/y.png');
  });
  it('이미 path면 그대로 (신규 업로드분)', () => {
    expect(imageUrlToPath('review/9/new.jpg')).toBe('review/9/new.jpg');
  });
});
