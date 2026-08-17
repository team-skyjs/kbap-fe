/**
 * P-226(KB-29·306): 주문하기 화면 개편 — 정렬(unable 최하단 잠금)·위계 반전·
 * 배지 제거·미등록 딥링크·무플립 소스 잠금.
 */
import { sortResultDishes } from '../resultSort';

const fs = require('fs');
const read = (p: string) => fs.readFileSync(p, 'utf8') as string;

const D = (id: number, risk: 'safe' | 'caution' | 'danger' | 'unable') => ({ id, risk });

describe('② 정렬 — unable은 어느 모드에서도 최하단(false-safe)', () => {
  const mixed = [D(0, 'danger'), D(1, 'unable'), D(2, 'safe'), D(3, 'caution'), D(4, 'unable'), D(5, 'safe')];

  it('menu(기본) = 메뉴판 순 유지 + unable만 최하단', () => {
    expect(sortResultDishes(mixed, 'menu').map((d) => d.id)).toEqual([0, 2, 3, 5, 1, 4]);
  });

  it('safety = safe → caution → danger → unable (위험도 오름차순·unable 최하단)', () => {
    expect(sortResultDishes(mixed, 'safety').map((d) => d.risk)).toEqual([
      'safe', 'safe', 'caution', 'danger', 'unable', 'unable',
    ]);
  });

  it('안정 정렬 — 같은 등급 안에서 메뉴판 순서 유지', () => {
    expect(sortResultDishes(mixed, 'safety').map((d) => d.id)).toEqual([2, 5, 3, 0, 1, 4]);
  });

  it('⚠️ unable이 danger 위로 오지 않는다 — 순서 잠금(불확실 = 안전 착시 금지)', () => {
    const sorted = sortResultDishes(mixed, 'safety');
    const firstUnable = sorted.findIndex((d) => d.risk === 'unable');
    const lastDanger = sorted.map((d) => d.risk).lastIndexOf('danger');
    expect(firstUnable).toBeGreaterThan(lastDanger);
  });
});

describe('①④⑤⑥⑦ 소스 잠금', () => {
  it('① 위계 반전 — 영문 타이틀 + 한글 서브(작게 회색), 리스트 행', () => {
    const list = read('src/features/scan/ScanRichList.tsx');
    expect(list).toContain('styles.nameTitle');
    expect(list).toContain('styles.nameSubKo');
    expect(list).toContain("dish.displayName || (dish.koreanName ?? dish.rawMenuName)"); // 번역 부재 폴백
    expect(list).not.toContain('styles.nameKo'); // 구 한글 타이틀 소멸
  });

  it('② 세그 배선 — 메뉴판 순 기본·안전한 순(safety 토글 통합 재량)', () => {
    const scan = read('src/app/scan.tsx');
    expect(scan).toContain("useState<ResultSortMode>('menu')"); // 기본 = 메뉴판 순
    expect(scan).toContain('sortResultDishes(allDishes, sortMode)');
    expect(scan).toContain('testID={`sort-${m}`}');
  });

  it('④ ko→en 배지 제거 — 카운트만', () => {
    const en = JSON.parse(read('src/lib/i18n/en.json')) as { scan: Record<string, string> };
    expect(en.scan.resultsSub).toBe('{{count}} dishes');
    expect(en.scan.resultsSub).not.toContain('KO');
  });

  it('⑤ 미등록 행 — 등록 예정 안내 + 구글/네이버 검색 딥링크(한글 키워드)', () => {
    const list = read('src/features/scan/ScanRichList.tsx');
    expect(list).toContain("t('scan.missNote')");
    expect(list).toContain('https://www.google.com/search?q=');
    expect(list).toContain('https://search.naver.com/search.naver?query=');
    expect(list).toContain('encodeURIComponent(dish.koreanName ?? dish.rawMenuName)');
  });

  it('⑥ 사장님 카드 무플립 — rotate 소멸·한국어 문구 조립(orderCard.ts) 무변', () => {
    const card = read('src/features/order/FlippedOrderCard.tsx');
    expect(card).not.toContain("rotate: '180deg'");
    expect(card).toContain('flipInner'); // 컨테이너 구조는 유지(연출만 제거)
    // 문구 조립 로직 파일은 이번 커밋에서 무변(Codex 금지 영역) — 참조 존치만 확인
    expect(card).toContain('orderCard');
  });

  it('⑦ 담기 버튼 — 터치 44pt+(hitSlop 12)·primary 톤, 크기 30 유지(프레임 불변)', () => {
    const list = read('src/features/scan/ScanRichList.tsx');
    expect(list).toContain('hitSlop={12} onPress={onAdd}');
    expect(list).toContain('<IconPlus size={15} color={C.primary} />');
    expect(list).toMatch(/addBtn: \{ width: ADD_SLOT_H, height: ADD_SLOT_H/); // 크기 불변
  });
});

describe('P-230: sortSafety false-safe 교정 · AvoidChip 삭제', () => {
  const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id'];

  it('전 로케일 = "위험도 낮은 순" 서술 — safest/안전 계열(보장 뉘앙스) 금지', () => {
    // 정렬 순서 서술이어야 한다 — 상단 항목의 안전을 보장하는 어휘 금지(K-31 파생)
    const BANNED = [/safest/i, /안전/, /安全/, /an toàn/i, /безопасн/i, /ปลอดภัย/, /segur/i, /\baman\b/i];
    for (const lang of LOCALES) {
      const v = (JSON.parse(read(`src/lib/i18n/${lang}.json`)) as { scan: Record<string, string> }).scan.sortSafety;
      for (const re of BANNED) expect(v).not.toMatch(re);
    }
    expect((JSON.parse(read('src/lib/i18n/en.json')) as { scan: Record<string, string> }).scan.sortSafety).toBe('Lowest risk first');
    expect((JSON.parse(read('src/lib/i18n/ko.json')) as { scan: Record<string, string> }).scan.sortSafety).toBe('위험도 낮은 순');
  });

  it('profile.dietTitle = 식단·종교·알레르기 의미 폭(en 기준) ×10', () => {
    expect((JSON.parse(read('src/lib/i18n/en.json')) as { profile: Record<string, string> }).profile.dietTitle).toBe('Diet, religion & allergies');
    expect((JSON.parse(read('src/lib/i18n/ko.json')) as { profile: Record<string, string> }).profile.dietTitle).toBe('식단·종교·알레르기'); // K-27 검수분 무변
  });

  it('AvoidChip 잔존 0 — 파일 삭제 + import 부재(커맨드 센터 승인)', () => {
    expect(fs.existsSync('src/components/AvoidChip.tsx')).toBe(false);
    const files = require('child_process').execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
      .split('\n').filter((f: string) => /\.tsx?$/.test(f));
    for (const f of files) {
      expect(read(f)).not.toMatch(/from '@\/components\/AvoidChip'/);
    }
  });
});
