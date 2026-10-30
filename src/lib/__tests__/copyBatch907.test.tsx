/** KB-907 — 문구 일괄(T-007·T-030·T-034·T-035·T-036·T-037·T-103·T-104·T-106·T-107·T-109·T-110) */
import * as fs from 'fs';
import { localizeLegal, parseLegalHtml } from '@/lib/legalText';

const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
const load = (l: string) => JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')) as Record<string, unknown>;
const get = (l: string, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], load(l));
const flat = (o: unknown, p = ''): [string, string][] =>
  o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => flat(v, `${p}${k}.`)) : [[p.slice(0, -1), String(o)]];
const read = (f: string) => fs.readFileSync(f, 'utf8');
const HANGUL = /[가-힣]/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️]/u;

describe('새 키 = 10로케일 전부 · 이모지·가운데 점 0', () => {
  const NEW = ['ranking.vipEyebrow', 'detail.verdictMayContain', 'scan.viewOrderAction', 'scan.orderCount_one', 'scan.orderCount_other', 'scan.retakeBodyWithCart_one', 'scan.retakeBodyWithCart_other', 'packagedScan.freeExplain', 'reviews.countryOnlyHint'];
  it.each(LOCALES)('%s', (l) => {
    for (const k of NEW) {
      const v = get(l, k);
      expect({ l, k, type: typeof v }).toEqual({ l, k, type: 'string' });
      expect({ l, k, bad: EMOJI.test(String(v)) || String(v).includes('·') }).toEqual({ l, k, bad: false });
    }
  });
  it('영어 로케일 문구에 한글 0', () => {
    expect(flat(load('en')).filter(([, v]) => HANGUL.test(v))).toEqual([]);
  });
});

describe('T-036 My Ranking', () => {
  it('한국어 병기 키·렌더 소멸 · 제목에 VIP·MEMBERSHIP 0 · 배지 바닥 정렬', () => {
    for (const l of LOCALES) {
      for (const k of ['headerTitleKo', 'ptsToKo', 'tierKo', 'breakdownSub', 'ladderSub', 'reviewsLabelKo', 'diversityLabelKo', 'scansLabelKo']) expect({ l, k, v: get(l, `ranking.${k}`) }).toEqual({ l, k, v: undefined });
      expect(String(get(l, 'ranking.vipEyebrow'))).not.toMatch(/VIP|MEMBERSHIP/i);
    }
    const src = read('src/app/profile/ranking.tsx');
    expect(src).not.toMatch(/tierKo|LabelKo|breakdownSub|ladderSub|labelKo/);
    expect(src).toMatch(/gainPill: \{ marginTop: 'auto'/);
  });
});

describe('T-007 상세 띠 부제', () => {
  it('Caution + 걸린 재료 전부 caution = May contain · danger 재료가 하나라도 있으면 Contains(false-safe 0)', () => {
    const src = read('src/app/food/[id]/index.tsx');
    expect(src).toContain("t(dishRisk === 'caution' && flagged.every((i) => i.risk === 'caution') ? 'detail.verdictMayContain' : 'detail.verdictContains'");
    expect(get('en', 'detail.verdictMayContain')).toBe('May contain {{list}} from your avoid list');
  });
});

describe('T-030·T-035·T-037 문구', () => {
  it('오프라인 = 갈 길 없는 "저장된 스캔" 문장 0', () => {
    for (const l of LOCALES) expect(String(get(l, 'states.offlineBody'))).not.toMatch(/saved scans|저장된 스캔|保存済み|已保存|已儲存|đã lưu|tersimpan|ที่บันทึก|Сохранённые|guardados/);
  });
  it('차단 = 실제 화면 이름(Profile, Blocked users) · Settings·posts·comments 0', () => {
    expect(get('en', 'community.blockConfirmBody')).toBe('You won’t see their reviews anymore. You can unblock them anytime in Profile, under Blocked users.');
    for (const k of ['community.blockConfirmBody', 'community.blockedNote']) expect(String(get('en', k))).not.toMatch(/Settings|posts|comments/);
    for (const l of LOCALES) expect(String(get(l, 'community.blockConfirmBody'))).toContain(String(get(l, 'community.blockedTitle')).replace(/\s+/g, ' '));
  });
  it('Saved 빈 상태 = 별(아이콘과 일치)', () => {
    expect(get('en', 'saved.emptyBody')).toBe('Tap the star on any dish to keep it here.');
    expect(get('ko', 'saved.emptyBody')).toBe('음식의 별을 누르면 여기에 모여요.'); // Codex #366 → KB-924 둘째 문장 삭제 P1: 완결 문장(대시·명사 조각 끝 0)
    for (const l of LOCALES) expect(String(get(l, 'saved.emptyBody'))).not.toMatch(/bookmark|북마크|ブックマーク|收藏图标|收藏圖示|dấu trang|penanda|บุ๊กมาร์ก|закладк|marcador/i);
  });
});

describe('T-103 주문 pill', () => {
  it('개수와 동작 = 두 덩어리(쉼표 연결 0) · 1개/2개 복수형', () => {
    const src = read('src/features/scan/ScanRichList.tsx');
    expect(src).toMatch(/<View style=\{styles\.pillRow\}>\s*<Text style=\{styles\.pillCount\}>\{t\('scan\.orderCount', \{ count \}\)\}<\/Text>\s*<Text style=\{styles\.pillText\}>\{t\('scan\.viewOrderAction'\)\}<\/Text>/);
    expect(src).not.toContain("t('scan.viewOrder', { count })");
    expect([get('en', 'scan.orderCount_one'), get('en', 'scan.orderCount_other')]).toEqual(['{{count}} item', '{{count}} items']);
    for (const l of LOCALES) expect(get(l, 'scan.viewOrder_one')).toBeUndefined();
    expect(get('en', 'scan.retakeBodyWithCart_one')).toBe('Your results and {{count}} added item will be discarded.');
    expect(flat(load('en').scan)).not.toContainEqual(expect.arrayContaining([expect.stringMatching(/\(s\)/)]));
  });
});

describe('T-104·T-106·T-034 배선', () => {
  it('무료 창 뜻 한 줄 = 결과 배너·시작 안내 · 카메라 위 짧은 안내는 제외', () => {
    expect(read('src/features/scan/PackagedScanFlow.tsx').match(/<PackagedFreeLine style=\{st\.camFree\} explain=\{false\} \/>/g)).toHaveLength(2);
    expect(read('src/features/scan/PackagedScanScreens.tsx')).toContain('<PackagedFreeExplain />');
    expect(read('src/app/processed-foods/[id].tsx')).not.toContain('PackagedFreeExplain'); // KB-914(R-141): 상세 무료 문장 0 — 배지(+뜻 한 줄)는 카메라·후보·결과만
  });
  it('"{국가} only" 토글 세 곳 모두 설명 한 줄(나라 이름)', () => {
    for (const f of ['src/app/food/[id]/index.tsx', 'src/app/food/[id]/reviews.tsx', 'src/features/community/ReviewFeed.tsx']) expect(read(f)).toMatch(/<CountryOnlyHint code=\{/);
    expect(read('src/features/review/CountryOnlyHint.tsx')).toContain('countryDisplayName(code, appLang)');
    expect(get('en', 'reviews.countryOnlyHint')).toBe('Turn on to see reviews only from people from {{country}}.');
  });
  it('사장님 카드 한국어 = 어절 단위 줄바꿈(문구 무변)', () => {
    expect(read('src/app/food/[id]/owner.tsx').match(/lineBreakStrategyIOS="hangul-word"/g)).toHaveLength(2);
  });
});

describe('T-107 세로 막대 구분자 0', () => {
  it('리뷰 작성 부제·가공식품 메타 = 간격(gap) · 구분자 키 0', () => {
    for (const l of LOCALES) expect(get(l, 'review.foodSubtitle')).toBeUndefined();
    expect(read('src/app/processed-foods/[id].tsx')).not.toContain(".join(' | ')");
    expect(read('src/app/processed-foods/[id].tsx')).toMatch(/metaRow: \{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 \}/);
  });
});

describe('T-109·T-110 약관·개인정보 앱 렌더', () => {
  const HTML = `<body><h1><a href="https://x/kbap-legal/">kbap-legal</a></h1>
<h1 id="t">K-Bap Terms of Service / 이용약관</h1><p>Effective date / 시행일: 2026-07-16 · Version 1.0</p><hr />
<h2 id="english">English</h2><h3>1. The Service</h3><p>Hello.</p><h3>2. ⚠️ Health &amp; Safety Disclaimer — Please Read</h3><li>Item</li><hr />
<h2 id="한국어">한국어</h2><h3>1. 서비스의 내용</h3><p>안녕.</p><h3>2. ⚠️ 건강 안전 고지</h3></body>`;
  const blocks = parseLegalHtml(HTML);
  it('en = English 절만 · 제목·시행일 영문 쪽 · 한글 0 · 이모지 0', () => {
    const out = localizeLegal(blocks, 'en');
    expect(out.map((b) => ('text' in b ? b.text : ''))).toEqual(['K-Bap Terms of Service', 'Effective date: 2026-07-16 · Version 1.0', '1. The Service', 'Hello.', '2. Health & Safety Disclaimer — Please Read', 'Item']);
  });
  it('ko = 한국어 절만 · 제목·시행일 한글 쪽', () => {
    const out = localizeLegal(blocks, 'ko');
    expect(out.map((b) => ('text' in b ? b.text : ''))).toEqual(['이용약관', '시행일: 2026-07-16 · Version 1.0', '1. 서비스의 내용', '안녕.', '2. 건강 안전 고지']);
  });
  it('절 구분을 못 찾으면 원문 전체(숨김 0) — 이모지만 제거', () => {
    const plain = parseLegalHtml('<body><h2>Intro</h2><p>⚠️ Read this</p><p>둘째</p></body>');
    expect(localizeLegal(plain, 'en').map((b) => ('text' in b ? b.text : ''))).toEqual(['Intro', 'Read this', '둘째']);
  });
  it('본문 화면 = 앱 언어로 거른 블록', () => {
    expect(read('src/components/LegalDocBody.tsx')).toContain('localizeLegal(remote.blocks, appLang)');
  });
});
