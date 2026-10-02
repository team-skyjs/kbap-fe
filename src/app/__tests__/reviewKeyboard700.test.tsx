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

// ── KB-700 범위 추가(QA: 프로필 편집도 같은 비침) — "입력창이 있는 화면은 iOS KAV(padding)" 를 **전수 스캔**으로 잠근다.
// 파일 목록이 아니라 src/app 전체를 매번 훑는다(열거형 잠금은 그 뒤 생긴 화면을 못 본다 — P-196). 예외는 사유와 함께 여기에만.
const NO_FIXED_BOTTOM_BAR: Record<string, string> = {
  'src/app/search.tsx': '하단 고정 바 없음(검색 입력이 상단)',
  'src/app/profile/feedback/new.tsx': '전송 버튼이 스크롤 본문 안(고정 바 아님 — 키보드가 덮어도 스크롤로 닿음)',
};
function screensWithInputs(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== '__tests__') screensWithInputs(p, out);
    } else if (/\.tsx$/.test(e.name) && /<(Input|TextInput)\b/.test(fs.readFileSync(p, 'utf8'))) out.push(p);
  }
  return out;
}

it('입력창이 있는 화면 전수 = iOS KeyboardAvoidingView(padding) — 예외는 사유가 적힌 것만', () => {
  const screens = screensWithInputs('src/app');
  expect(screens.length).toBeGreaterThanOrEqual(7); // 스캔이 비면(경로 바뀜 등) 통과가 아니라 실패
  const missing = screens.filter((f) => !NO_FIXED_BOTTOM_BAR[f] && !/<KeyboardAvoidingView[^>]*behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}/.test(fs.readFileSync(f, 'utf8')));
  expect(missing).toEqual([]);
  for (const f of Object.keys(NO_FIXED_BOTTOM_BAR)) expect(screens).toContain(f); // 예외 목록이 낡으면 알림
});

it('프로필 편집 — Save 바는 절대 위치가 아니라 KAV 안 ScrollView의 형제(키보드 위로 따라 올라옴), 본문 하단 보정 120 제거', () => {
  const ed = fs.readFileSync('src/app/profile/edit.tsx', 'utf8');
  expect(ed).toContain('testID="edit-kav"');
  expect(ed).toMatch(/savebar: \{ paddingHorizontal: 16,/);
  expect(ed).not.toMatch(/savebar: \{[^}]*position: 'absolute'/);
  expect(ed).not.toContain('paddingBottom: 120');
  const kavClose = ed.lastIndexOf('</KeyboardAvoidingView>');
  expect(ed.indexOf('testID="edit-bottom-bar"')).toBeLessThan(kavClose);
});
