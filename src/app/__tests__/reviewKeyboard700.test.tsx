/**
 * KB-700(P-439) — 리뷰 작성 화면: 키보드가 "Post review" 하단 바를 덮음 · 별점 testID.
 * iOS = 화면 전체 KeyboardAvoidingView(padding)로 하단 바가 키보드 위로 따라 올라온다(글쓰기 compose와 같은 패턴).
 * Android = adjustResize(창이 줄어듦) — KAV behavior 없음(compose와 동일), 커서 추종 계산 무변.
 */
import * as fs from 'fs';

const src = fs.readFileSync('src/app/food/[id]/review.tsx', 'utf8');

it('하단 Post 바가 KAV **안**(키보드 위로 따라 올라옴) · ScrollView와 형제 · 시스템 인셋 없음', () => {
  const kav = src.indexOf("<KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID=\"review-kav\">");
  const bar = src.indexOf('testID="review-bottom-bar"');
  const close = src.indexOf('</KeyboardAvoidingView>');
  expect(kav).toBeGreaterThan(-1);
  expect(bar).toBeGreaterThan(kav);
  expect(close).toBeGreaterThan(bar);
  expect(src).not.toContain('automaticallyAdjustKeyboardInsets={');
});

it('커서 추종 가시 높이 — iOS는 KAV로 줄어든 뷰포트 그대로(키보드 이중 차감 0) · Android는 기존(키보드 차감)', () => {
  expect(src).toContain("const visible = svH.current - (Platform.OS === 'ios' ? 0 : kbHRef.current);");
});

it('메인 별점 5개 testID = review-star-{1..5} · 세부(Taste/Speed/Service)는 기존 extras-{axis}-{n} 유지', () => {
  expect(src).toContain('testID={`review-star-${i}`}');
  expect(fs.readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8')).toContain('testID={`extras-${key}-${n}`}');
});
