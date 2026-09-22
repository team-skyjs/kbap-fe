/* eslint-disable import/first --
   jest 구조상 불가피: 대상(`placeMap`)의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅).
   레포 관례와 동일(subHeaderTitleCenter403.test.tsx). */
/**
 * P-409(KB-636) — 장소 태그 시트의 로컬 셸을 `components/SheetShell`로 **공용화**했다(새 컴포넌트 아님).
 * ① 장소 태그 시트 렌더가 **무변**인지(모달 속성 · 스크림 · 시트 치수 · X 없음)를 실제 렌더로 잠근다.
 * ② 주문 상세 공유 시트가 **같은 셸**을 쓰는지 잠근다(커맨드 센터 결정 — 장소 태그 시트와 같은 골격).
 */
import * as React from 'react';
import * as fs from 'fs';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }) }));

import { PlaceTagSheet } from '@/features/community/placeMap';
import { SheetShell } from '@/components/SheetShell';
import { Dimensions, View } from 'react-native';

const flat = (s: unknown) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) as Record<string, unknown>;

it('① 장소 태그 시트 — 공용 셸로 옮긴 뒤에도 렌더 무변(모달 fade·투명 · 스크림 0.4 · 흰 시트 r16 · 20/39 · gap 24 · X 없음)', () => {
  let r!: ReactTestRenderer;
  act(() => { r = renderer.create(<PlaceTagSheet place={{ name: 'Gwangjang Market', roadAddress: 'Seoul' }} onClose={() => {}} />); });
  const modal = r.root.findAll((n) => typeof n.props?.onRequestClose === 'function')[0];
  expect(modal.props.transparent).toBe(true);
  expect(modal.props.animationType).toBe('fade');
  const hosts = r.root.findAll((n) => typeof n.type === 'string');
  const backdrop = hosts.find((n) => flat(n.props.style).backgroundColor === 'rgba(0,0,0,0.4)');
  expect(backdrop).toBeTruthy();
  expect(flat(backdrop!.props.style).justifyContent).toBe('flex-end');
  const sheet = hosts.find((n) => flat(n.props.style).borderTopLeftRadius === 16)!;
  expect(flat(sheet.props.style)).toMatchObject({
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingTop: 39, paddingBottom: 39, gap: 24,
  });
  expect(r.root.findAll((n) => n.props?.testID === 'map-google').length).toBeGreaterThan(0); // 대조: 내용 렌더
  expect(r.root.findAll((n) => /close/i.test(String(n.props?.testID ?? '')))).toHaveLength(0); // X 없음(P-310)
});

it('② 셸은 한 곳 — 장소 태그 시트·주문 공유 시트가 같은 components/SheetShell을 쓴다(로컬 복사본 재발 0)', () => {
  const place = fs.readFileSync('src/features/community/placeMap.tsx', 'utf8');
  const order = fs.readFileSync('src/app/profile/order/[id].tsx', 'utf8');
  for (const src of [place, order]) expect(src).toContain("import { SheetShell } from '@/components/SheetShell'");
  expect(place).not.toMatch(/function SheetShell\(/);
  expect(order).toContain('onClose={() => { if (!shareBusy.current) setShareOpen(false); }}');
  expect(order).toContain('overlay={<TopToastHost />}');
});

/* Codex #193 P2: 내용이 창보다 크면(큰 글자·작은 기기·긴 장소명) 하단 정렬 시트의 **상단이 잘려** 닿을 수 없다.
   최대 높이 = 창 높이 − 상단 안전영역, 내용은 ScrollView(flexGrow 0 — 들어맞으면 hug 그대로). */
it('③ 넘침 — 시트 최대 높이 = 창 − 상단 안전영역 · 내용은 hug 스크롤 뷰 안(큰 내용도 전부 닿는다)', () => {
  let r!: ReactTestRenderer;
  act(() => {
    r = renderer.create(
      <SheetShell onClose={() => {}}>
        <View testID="huge" style={{ height: 5000 }} />
      </SheetShell>,
    );
  });
  const host = (id: string) => r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id)[0];
  const sheet = flat(host('sheet-shell').props.style);
  expect(sheet.maxHeight).toBe(Dimensions.get('window').height - 47);
  const scroll = r.root.findAll((n) => n.props?.testID === 'sheet-shell-scroll' && n.props?.contentContainerStyle)[0];
  expect(flat(scroll.props.style).flexGrow).toBe(0); // hug — 들어맞으면 스크롤 영역이 내용 크기
  expect(flat(scroll.props.contentContainerStyle).gap).toBe(24); // 자식 간격 무변
  expect(scroll.findAll((n) => n.props?.testID === 'huge').length).toBeGreaterThan(0); // 내용이 스크롤 뷰 안
});

it('③ 장소 태그 시트도 같은 셸 — 내용이 스크롤 뷰 안에 들어가도 치수·순서 무변', () => {
  let r!: ReactTestRenderer;
  act(() => { r = renderer.create(<PlaceTagSheet place={{ name: 'Gwangjang Market', roadAddress: 'Seoul' }} onClose={() => {}} />); });
  const scroll = r.root.findAll((n) => n.props?.testID === 'sheet-shell-scroll' && n.props?.contentContainerStyle)[0];
  expect(scroll.findAll((n) => n.props?.testID === 'map-google').length).toBeGreaterThan(0);
});
