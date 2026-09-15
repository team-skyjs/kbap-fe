/**
 * P-380 3단계(KB-518) — 공유 카드 데이터 결정 3건 + 시안 메트릭 잠금.
 * 레이아웃 변형·"외 N"·가게명 폴백은 순수 함수라 실기 없이 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/components/Skeleton', () => ({ Shimmer: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} }, // i18n 부트스트랩이 use()로 요구
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));

import { shareCells, shareMenuLine, sharePlaceName, SHARE_CARD_W, SHARE_GRID_H } from '../shareCard';
import { OrderShareCard, OrderShareSection } from '../OrderShareCard';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const more = (n: number) => `외 ${n}`;
const flat = (s: unknown) => (Array.isArray(s) ? Object.assign({}, ...s.flat(9)) : s) as Record<string, number | string>;

describe('① 사진 장수별 레이아웃 — 빈 칸·기본 이미지 금지', () => {
  it('1장 = 전체 210×210', () => {
    expect(shareCells(1)).toEqual([{ left: 0, top: 0, width: 210, height: 210 }]);
  });

  it('2장 = 좌우 각 105×210', () => {
    const c = shareCells(2);
    expect(c).toHaveLength(2);
    expect(c.every((x) => x.width === 105 && x.height === 210)).toBe(true);
    expect(c.map((x) => x.left)).toEqual([0, 105]);
  });

  it('3장 = 좌 105×210 + 우 위아래 105×105', () => {
    expect(shareCells(3)).toEqual([
      { left: 0, top: 0, width: 105, height: 210 },
      { left: 105, top: 0, width: 105, height: 105 },
      { left: 105, top: 105, width: 105, height: 105 },
    ]);
  });

  it('4장 = 2×2 · 5장 이상도 앞 4장만 · 0장 = 칸 0(그리드 미렌더)', () => {
    const four = shareCells(4);
    expect(four).toHaveLength(4);
    expect(four.every((x) => x.width === 105 && x.height === 105)).toBe(true);
    expect(shareCells(7)).toEqual(four);
    expect(shareCells(0)).toEqual([]);
  });

  it('칸 면적 합 = 그리드 전체(빈 칸 0) — 1~4장 전부', () => {
    for (const n of [1, 2, 3, 4]) {
      const area = shareCells(n).reduce((s, c) => s + c.width * c.height, 0);
      expect(area).toBe(SHARE_CARD_W * SHARE_GRID_H);
    }
  });
});

describe('② 메뉴줄 — 최대 3개 + "외 N"', () => {
  it('3개 이하 = 전부 나열(접미 없음) — 구분자는 쉼표(P-196 우선, 시안 가운뎃점 아님)', () => {
    expect(shareMenuLine(['A', 'B'], more)).toBe('A, B');
    expect(shareMenuLine(['A', 'B', 'C'], more)).toBe('A, B, C');
  });

  it('4개 이상 = 앞 3개 + 외 N', () => {
    expect(shareMenuLine(['A', 'B', 'C', 'D'], more)).toBe('A, B, C 외 1');
    expect(shareMenuLine(['A', 'B', 'C', 'D', 'E', 'F'], more)).toBe('A, B, C 외 3');
  });

  it('빈 이름은 세지 않는다 — 어댑터 폴백 \'\'·null·공백', () => {
    expect(shareMenuLine(['A', '', null, '  ', 'B'], more)).toBe('A, B');
    expect(shareMenuLine([null, undefined], more)).toBe('');
  });

  it('가운뎃점 구분자 0 — 어떤 개수에서도 나오지 않는다', () => {
    for (const n of [1, 2, 3, 4, 9]) {
      const names = Array.from({ length: n }, (_, i) => `M${i}`);
      expect(shareMenuLine(names, more)).not.toContain('·');
    }
  });
});

describe('③ 가게명 3단 폴백 — place.name → roadAddress → 숨김', () => {
  it('place.name 우선', () => {
    expect(sharePlaceName({ placeName: '할머니 순두부', roadAddress: '서울 강남구 …' })).toBe('할머니 순두부');
  });

  it('place 없으면 roadAddress — 기존 주문은 place가 영구 null이라 이 경로가 최종 사양', () => {
    expect(sharePlaceName({ placeName: null, roadAddress: '서울 강남구 …' })).toBe('서울 강남구 …');
    expect(sharePlaceName({ roadAddress: '서울 강남구 …' })).toBe('서울 강남구 …');
  });

  it('둘 다 없으면 null = 줄 숨김(빈 줄 금지)', () => {
    expect(sharePlaceName({ placeName: null, roadAddress: null })).toBeNull();
    expect(sharePlaceName({ placeName: '  ', roadAddress: '' })).toBeNull();
  });
});

describe('렌더 — 시안 메트릭·브랜드 배지', () => {
  const props = {
    photos: ['https://cdn/1.jpg', 'https://cdn/2.jpg'],
    placeName: '할머니 순두부',
    menuLine: 'A, B',
    metaCity: null as string | null,
    metaDate: 'Aug 14, 2026',
  };
  const render = (p = props): ReactTestRenderer => {
    let tree!: ReactTestRenderer;
    act(() => { tree = renderer.create(<OrderShareCard {...p} />); });
    return tree;
  };

  it('카드 = 폭 210 고정 · r20 · 그림자(시안)', () => {
    const card = render().root.findAll((n) => n.props?.testID === 'order-share-card')[0];
    const st = flat(card.props.style);
    expect(st.width).toBe(210);
    expect(st.borderRadius).toBe(20);
    expect(st.shadowOpacity).toBe(0.12);
    expect(st.shadowRadius).toBe(24);
  });

  it('가게명 null = 줄 자체 미렌더 · 메뉴줄 빈 문자열도 미렌더', () => {
    const t = render({ ...props, placeName: null, menuLine: '' });
    expect(t.root.findAll((n) => n.props?.testID === 'share-place-name')).toHaveLength(0);
    expect(t.root.findAll((n) => n.props?.testID === 'share-menu-line')).toHaveLength(0);
    // 메타줄은 남는다(날짜는 항상 있다)
    expect(t.root.findAll((n) => n.props?.testID === 'share-meta-left').length).toBeGreaterThanOrEqual(1);
  });

  it('메타줄 = 도시·날짜를 별도 텍스트로 gap 분리(문자 구분자 금지 — P-196)', () => {
    const withCity = render({ ...props, metaCity: 'Seoul' });
    const box = withCity.root.findAll((n) => n.props?.testID === 'share-meta-left' && typeof n.type === 'string')[0];
    const st = flat(box.props.style);
    expect(st.flexDirection).toBe('row');
    expect(st.gap).toBe(4);
    expect(withCity.root.findAll((n) => n.props?.testID === 'share-meta-city' && typeof n.type === 'string')).toHaveLength(1);
    // 도시 없음(place 미배포 현행) = 날짜만, 빈 텍스트 노드도 없다
    const dateOnly = render(props);
    expect(dateOnly.root.findAll((n) => n.props?.testID === 'share-meta-city')).toHaveLength(0);
    expect(dateOnly.root.findAll((n) => n.props?.testID === 'share-meta-date' && typeof n.type === 'string')).toHaveLength(1);
  });

  it('사진 0장 = 그리드 미렌더(빈 칸·기본 이미지 금지)', () => {
    const t = render({ ...props, photos: [] });
    expect(t.root.findAll((n) => n.props?.testID === 'share-photo-grid')).toHaveLength(0);
  });

  it('브랜드 = 마크 16 + 텍스트 11/600 #1C1E21, 주황 필 없음(9/14 예진 결정)', () => {
    const brand = render().root.findAll((n) => n.props?.testID === 'share-brand')[0];
    const st = flat(brand.props.style);
    expect(st.gap).toBe(4);
    expect(st.backgroundColor).toBeUndefined(); // 배경·보더·라운드 없음
    expect(st.borderRadius).toBeUndefined();
    const src = read('src/features/order/OrderShareCard.tsx');
    expect(src).toContain('assets/images/splash-mark-ios.png');
    expect(src).toContain('brandMark: { width: 16, height: 16 }');
    expect(src).toContain("brandText: { fontSize: 11, fontWeight: '600'");
    // 주석 제거 후 검사 — 헤더 주석은 필을 뺀 '이유'로 그 색을 인용한다
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toContain('#FF7134'); // 주황 필 잔재 0
    expect(code).not.toContain('kbap-wordmark'); // 폐기 에셋 미사용
  });
});

describe('섹션 — 미리보기 영역·버튼 2개 규격', () => {
  const render = (): ReactTestRenderer => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <OrderShareSection
          card={{ photos: [], placeName: null, menuLine: '', metaDate: 'x' }}
          caption="cap"
          downloadLabel={'Download\nimage'}
          instagramLabel={'Instagram\nStory'}
        />,
      );
    });
    return tree;
  };

  it('버튼 2개 = 각각 flex 1 · pad 12/8 · gap 5 · border #EAEBEE · r14', () => {
    const tree = render();
    // Pressable은 합성+호스트 양쪽에 testID가 잡힌다 — 호스트 노드만 센다
    const btns = tree.root.findAll(
      (n) => /^share-(download|instagram)$/.test(String(n.props?.testID)) && typeof n.type === 'string',
    );
    expect(btns).toHaveLength(2);
    for (const b of btns) {
      const st = flat(b.props.style);
      expect(st.flex).toBe(1);
      expect(st.paddingVertical).toBe(12);
      expect(st.paddingHorizontal).toBe(8);
      expect(st.gap).toBe(5);
      expect(st.borderColor).toBe('#EAEBEE');
      expect(st.borderRadius).toBe(14);
    }
  });

  it('라벨 = 두 줄 고정 문구 그대로(시안) · 미리보기 배경 #F7F8FA', () => {
    const tree = render();
    const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(texts).toContain('Download\nimage');
    expect(texts).toContain('Instagram\nStory');
    const src = read('src/features/order/OrderShareCard.tsx');
    expect(src).toContain("backgroundColor: '#F7F8FA'"); // preview-area = 내보내기 캔버스와 같은 값
  });
});

it('배선 — 주문 상세가 사진 있을 때만 섹션을 렌더 · i18n 키 10로케일', () => {
  const src = read('src/app/profile/order/[id].tsx');
  expect(src).toContain('q.data.thumbnails.length > 0 && (');
  expect(src).toContain('<OrderShareSection');
  expect(src).toContain('sharePlaceName({ roadAddress: q.data.roadAddress })');
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { myFoods: Record<string, string> };
    for (const k of ['shareMenuMore', 'sharePreviewCaption', 'shareDownload', 'shareInstagram']) {
      expect(j.myFoods[k]).toBeTruthy();
    }
    expect(j.myFoods.shareDownload).toContain('\n'); // 두 줄 고정
    expect(j.myFoods.shareInstagram).toContain('\n');
  }
});

it('P-196 — 공유 카드 3파일에 사용자 노출 가운뎃점 0(시안 보고 되돌리기 방지)', () => {
  for (const f of ['src/features/order/shareCard.ts', 'src/features/order/OrderShareCard.tsx', 'src/app/profile/order/[id].tsx']) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toContain(' · ');
    expect(code).not.toContain('·'); // 공백 없는 변형도 금지
  }
});
