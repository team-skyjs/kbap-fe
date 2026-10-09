/** SheetShell dismissable=false: 스크림 탭·안드 백 무시(onClose 0) · 기본(true)은 기존 닫힘 무변. ProgressDots: 접두 testID·활성 1개. */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { View } from 'react-native';
import { SheetShell } from '../SheetShell';
import { ProgressDots } from '../ProgressDots';
/* eslint-enable import/first */

it('dismissable=false — 스크림 onPress 없음 · onRequestClose는 onClose를 부르지 않는다 / 기본은 둘 다 닫는다', () => {
  const onClose = jest.fn();
  let r!: renderer.ReactTestRenderer;
  act(() => { r = renderer.create(<SheetShell onClose={onClose} dismissable={false}><View /></SheetShell>); });
  const modal = r.root.findAll((n) => typeof n.props?.onRequestClose === 'function')[0];
  act(() => { modal.props.onRequestClose(); });
  const backdrop = r.root.findAll((n) => n.props?.testID === 'sheet-shell-backdrop' && typeof n.type === 'string')[0];
  expect(backdrop.props.onPress).toBeUndefined();
  expect(onClose).not.toHaveBeenCalled();

  act(() => { r.update(<SheetShell onClose={onClose}><View /></SheetShell>); });
  act(() => { r.root.findAll((n) => typeof n.props?.onRequestClose === 'function')[0].props.onRequestClose(); });
  act(() => { r.root.findAll((n) => n.props?.testID === 'sheet-shell-backdrop' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
  expect(onClose).toHaveBeenCalledTimes(2);
});

it('ProgressDots — count개 · 활성 1개 · 접두 testID(온보딩 ob-dot 기본 / 호출측 접두)', () => {
  let r!: renderer.ReactTestRenderer;
  act(() => { r = renderer.create(<ProgressDots count={3} active={1} />); });
  const ids = r.root.findAll((n) => typeof n.type === 'string' && /^ob-dot-/.test(String(n.props?.testID))).map((n) => n.props.testID);
  expect(ids).toEqual(['ob-dot-0-off', 'ob-dot-1-on', 'ob-dot-2-off']);
  act(() => { r.update(<ProgressDots count={2} active={0} testID="x-dots" dotTestIDPrefix="x-dot" />); });
  expect(r.root.findAll((n) => n.props?.testID === 'x-dot-0-on' && typeof n.type === 'string')).toHaveLength(1);
  expect(r.root.findAll((n) => n.props?.testID === 'x-dots' && typeof n.type === 'string')).toHaveLength(1);
});
