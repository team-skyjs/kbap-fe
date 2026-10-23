/**
 * KB-854 카메라 탭(dark) 가로 스크롤 — Codex #325: 줄이 화면보다 넓을 때(긴 번역·큰 글씨) 활성 탭이 잘리지 않게
 * 처음 그릴 때·값이 바뀔 때 활성 탭을 가운데 쪽으로 스크롤. 들어가는 줄(최대 오프셋 0)은 움직이지 않는다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ScanModeTabs, activeTabOffset, type ScanMode } from '../ScanModeTabs';
/* eslint-enable import/first */

const RN = jest.requireActual('react-native');
const scrollTo = jest.fn();
/** jest의 RN ScrollView 목은 자체 인스턴스(ref 대상)를 가진다 — 그 scrollTo를 기록 */
const render = (value: ScanMode) => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<ScanModeTabs value={value} onChange={jest.fn()} tone="dark" />); });
  const inst = t.root.findAll((n) => n.type === RN.ScrollView)[0].instance as { scrollTo: (o: unknown) => void };
  inst.scrollTo = scrollTo;
  return t;
};
const layout = (t: ReactTestRenderer, viewW: number, tabs: [ScanMode, number, number][]) => {
  const sv = t.root.findAll((n) => n.props?.testID === 'scan-mode-tabs-scroll' && n.type === RN.ScrollView)[0];
  act(() => sv.props.onLayout({ nativeEvent: { layout: { width: viewW } } }));
  const last = tabs[tabs.length - 1];
  act(() => sv.props.onContentSizeChange(last[1] + last[2], 40));
  for (const [m, x, width] of tabs) act(() => t.root.findAll((n) => n.props?.testID === `scan-mode-${m}` && typeof n.props?.onLayout === 'function')[0].props.onLayout({ nativeEvent: { layout: { x, width } } }));
};

beforeEach(() => scrollTo.mockClear());

it('activeTabOffset = 활성 탭 가운데를 화면 가운데로 · 0 ~ (줄 − 화면)으로 자름', () => {
  expect(activeTabOffset({ x: 300, w: 180 }, 375, 600)).toBe(203);
  expect(activeTabOffset({ x: 300, w: 180 }, 375, 480)).toBe(105); // 오른쪽 끝까지만
  expect(activeTabOffset({ x: 0, w: 125 }, 375, 480)).toBe(0);
  expect(activeTabOffset({ x: 250, w: 125 }, 375, 375)).toBe(0); // 들어가는 줄
});

it('긴 번역(줄 480 > 화면 375)으로 Packaged 진입 = 첫 그림에서 활성 탭으로 스크롤 · 값 바뀌면 다시', () => {
  const t = render('packaged');
  layout(t, 375, [['menu', 0, 125], ['food', 125, 175], ['packaged', 300, 180]]);
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 105, animated: false }); // 줄 480 − 화면 375 = 오른쪽 끝(활성 탭 전부 보임)
  act(() => t.update(<ScanModeTabs value="menu" onChange={jest.fn()} tone="dark" />));
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, animated: false });
});

it('들어가는 줄(세 칸 균등) = 스크롤 0 그대로', () => {
  const t = render('packaged');
  layout(t, 375, [['menu', 0, 125], ['food', 125, 125], ['packaged', 250, 125]]);
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, animated: false });
});
