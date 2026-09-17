/**
 * P-390(KB-578) — 공용 ExpandToggle + 리뷰 셀 사진/본문 순서.
 *
 * 예진 실기 지적 2건을 잠근다: ① "See more"가 좌측·작아서 안 보였다(→ 우측·44px)
 * ② 리뷰 셀이 텍스트 위·사진 아래였다(→ 사진 위·본문 아래, 4표면 동일).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));

import { ExpandToggle, EXPAND_TOGGLE_MIN_H } from '../ExpandToggle';
import { IconChevronDown } from '../icons';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const flat = (s: unknown) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) as Record<string, unknown>;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree;
}

describe('ExpandToggle — 보이는 타깃', () => {
  it('우측 정렬 + 실제 높이 44 이상(hitSlop 아님 — 타깃이 눈에 보여야 한다)', () => {
    const tree = render(<ExpandToggle expanded={false} onPress={() => {}} testID="tg" />);
    // 호스트 노드 기준 — 합성 노드의 style은 StyleSheet 등록값(숫자)일 수 있다
    const host = tree.root.findAll((n) => typeof n.type === 'string' && n.props?.testID === 'tg')[0];
    const st = flat(host.props.style);
    expect(st.alignSelf).toBe('flex-end');
    expect(Number(st.minHeight)).toBeGreaterThanOrEqual(44);
    expect(EXPAND_TOGGLE_MIN_H).toBeGreaterThanOrEqual(44);
    expect(st.hitSlop).toBeUndefined();
  });

  it('접힘 = seeMore + chevron 아래 · 펼침 = seeLess + 180° 회전', () => {
    const collapsed = render(<ExpandToggle expanded={false} onPress={() => {}} testID="tg" />);
    expect(JSON.stringify(collapsed.toJSON())).toContain('reviews.seeMore');
    expect(collapsed.root.findAllByType(IconChevronDown)).toHaveLength(1);
    const rotated = (t: ReactTestRenderer) =>
      t.root.findAll((n) => {
        if (typeof n.type !== 'string') return false; // 호스트만(합성 중복 계수 방지)
        const st = flat(n.props?.style) as { transform?: { rotate?: string }[] };
        return Array.isArray(st.transform) && st.transform.some((x) => x.rotate === '180deg');
      }).length;
    expect(rotated(collapsed)).toBe(0);

    const expanded = render(<ExpandToggle expanded onPress={() => {}} testID="tg" />);
    expect(JSON.stringify(expanded.toJSON())).toContain('reviews.seeLess');
    expect(rotated(expanded)).toBe(1); // 같은 에셋 회전(Up 에셋 추가 없음)
  });

  it('라벨 주입 가능(표면 문구 유지) · 탭 = onPress', () => {
    const onPress = jest.fn();
    const tree = render(
      <ExpandToggle expanded={false} onPress={onPress} labelCollapsed="community.viewReplies" labelExpanded="community.hideReplies" testID="tg" />,
    );
    expect(JSON.stringify(tree.toJSON())).toContain('community.viewReplies');
    // 탭은 합성 Pressable 쪽 — 호스트 View엔 onPress가 없다(터치는 responder props)
    const pressable = tree.root.findAll((n) => n.props?.testID === 'tg' && typeof n.props?.onPress === 'function')[0];
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });

  it('새 스타일 상수 금지(9/18 예진) — 색·타입은 기존 토큰에서만 온다', () => {
    const src = read('src/components/ExpandToggle.tsx');
    expect(src).toContain('type as type_');
    expect(src).toContain('C.primaryText');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/); // 하드코딩 hex 0
    expect(src).not.toMatch(/fontSize:\s*\d/); // 자체 폰트 크기 0(타입 스케일 경유)
  });
});

describe('리뷰 셀 — 사진 위·본문 아래(4표면)', () => {
  it('FeedCard(홈 피드·상세 프리뷰·프로필 내 리뷰) = 사진 → 본문', () => {
    const src = read('src/features/review/FeedCard.tsx');
    expect(src.indexOf('<ReviewPhotoStrip')).toBeLessThan(src.indexOf('<ExpandableBody'));
  });

  it('음식 리뷰 목록 = 사진 → 본문', () => {
    const src = read('src/app/food/[id]/reviews.tsx');
    expect(src.indexOf('<ReviewPhotoStrip')).toBeLessThan(src.indexOf('<ExpandableBody'));
  });

  it('토글 렌더는 공용 컴포넌트 경유 — 표면이 seeMore를 직접 그리지 않는다', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); }
        else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
      }
      return out;
    };
    const hits = walk('src')
      .filter((f) => !f.endsWith('ExpandToggle.tsx'))
      .filter((f) => /t\('reviews\.see(More|Less)'\)/.test(fs.readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('구 좌측 텍스트 토글 스타일은 남기지 않는다(죽은 토큰 방지)', () => {
    expect(read('src/features/review/ReviewCellParts.tsx')).not.toContain('toggle: { fontFamily');
    expect(read('src/app/community/post/[id].tsx')).not.toContain('repliesToggleText:');
  });
});
