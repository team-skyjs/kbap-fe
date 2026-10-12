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
// 파일 목록이 아니라 매번 훑는다(열거형 잠금은 그 뒤 생긴 화면을 못 본다 — P-196). 화면 = src/app 파일 중 입력을 **직접** 그리거나
// **입력을 품은 컴포넌트**(components·features에서 본문에 Input/TextInput이 있는 export — #228 공부: IngredientFilter를 통한
// profile/restrictions를 옛 스캔이 못 봤다)를 그리는 것. 예외는 사유와 함께 여기에만.
const NO_FIXED_BAR_INPUT: Record<string, string> = {
  'src/app/search.tsx': '하단 고정 바 없음(검색 입력이 상단)',
  'src/app/(tabs)/index.tsx': '입력은 신고 시트(ModerationFlow — 모달) 안 — 시트 자체 키보드 처리',
  'src/app/(tabs)/community.tsx': '입력은 신고 시트(ModerationFlow — 모달) 안',
  'src/app/food/[id]/index.tsx': '입력은 신고 시트(ModerationFlow — 모달) 안',
  'src/app/food/[id]/reviews.tsx': '입력은 신고 시트(ModerationFlow — 모달) 안',
  'src/app/profile/order/[id].tsx': '입력은 장소 선택 시트(PlacePickerSheet — 모달) 안',
};
const INPUT_TAG = /<(Input|TextInput)\b/;
function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== '__tests__') tsxFiles(p, out);
    } else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}
/** components·features의 export 컴포넌트 중 **자기 본문**에 입력이 있는 것(export 경계로 잘라 본다) */
function inputComponents(): string[] {
  const names = new Set<string>();
  for (const f of [...tsxFiles('src/components'), ...tsxFiles('src/features')]) {
    for (const chunk of fs.readFileSync(f, 'utf8').split(/^(?=export (?:default )?function |export const [A-Z]\w* = )/m)) {
      const m = /^export (?:default )?(?:function|const) ([A-Z]\w*)/.exec(chunk);
      if (m && INPUT_TAG.test(chunk)) names.add(m[1]);
    }
  }
  return [...names];
}
function screensWithInputs(): string[] {
  const comps = inputComponents();
  return tsxFiles('src/app').filter((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return INPUT_TAG.test(s) || comps.some((n) => new RegExp(`<${n}\\b`).test(s));
  });
}

it('입력창이 있는 화면 전수(직접 + 입력 품은 컴포넌트 경유) = iOS KeyboardAvoidingView(padding) — 예외는 사유가 적힌 것만', () => {
  expect(inputComponents()).toEqual(expect.arrayContaining(['IngredientFilter', 'PlacePickerSheet', 'ModerationFlow']));
  const screens = screensWithInputs();
  // 고정값 — 화면이 늘거나 줄면 한 번 멈춰 서서 KAV/예외 판단을 하게(스캔이 비어도 실패)
  expect(screens).toHaveLength(13);
  expect(screens).toContain('src/app/profile/restrictions.tsx');
  const missing = screens.filter((f) => !NO_FIXED_BAR_INPUT[f] && !/<KeyboardAvoidingView[^>]*behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}/.test(fs.readFileSync(f, 'utf8')));
  expect(missing).toEqual([]);
  for (const f of Object.keys(NO_FIXED_BAR_INPUT)) expect(screens).toContain(f); // 예외 목록이 낡으면 알림
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

// KB-710(4): 문의 작성은 "Send가 스크롤 본문 안이라 스크롤로 닿는다"는 사유로 예외였지만 그 전제가 틀렸다 — 회피 없이는 키보드가 떠도
// ScrollView가 줄지 않아 스크롤 범위 0(SE에서 Send 위 19pt만 보이고 닿지도 못함). 예외에서 빼고 KAV — 위 전수 스캔이 이제 이 화면도 잡는다
it('KB-710 문의 작성 = iOS KAV(padding) · Send는 KAV 안 ScrollView 본문(키보드 위 영역에서 스크롤로 닿음) · 예외 목록에 없음', () => {
  const src = fs.readFileSync('src/app/profile/feedback/new.tsx', 'utf8');
  const kav = src.indexOf(`<KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="feedback-kav">`);
  const send = src.indexOf('testID="feedback-send"');
  const close = src.lastIndexOf('</KeyboardAvoidingView>');
  expect(kav).toBeGreaterThan(-1);
  expect(send).toBeGreaterThan(kav);
  expect(close).toBeGreaterThan(send);
  expect(Object.keys(NO_FIXED_BAR_INPUT)).not.toContain('src/app/profile/feedback/new.tsx');
});
