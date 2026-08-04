/**
 * P-123(KB-192): 안드 사진 시트 = 커뮤니티 ActionSheet 재사용 잠금 —
 * 항목 구성(사진 유/무 시 삭제 노출)·destructive 버건디·선택/취소 resolve·
 * choosePhotoSource 플랫폼 분기(iOS 네이티브 무변·안드 호스트 경유).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ActionSheetIOS, Platform, StyleSheet } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { PhotoSourceSheetHost, requestPhotoSourceSheet } from '../PhotoSourceSheetHost';
import { DESTRUCTIVE } from '../ActionSheet';
import { choosePhotoSource } from '@/lib/data/profileImage';

const LABELS = { title: 'photo.sheetTitle', camera: 'photo.take', gallery: 'photo.gallery', cancel: 'common.cancel' };

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<PhotoSourceSheetHost />);
  });
  return tree;
}

// 백드롭/시트 래퍼도 onPress 보유 — findAll 순서상 최내곽(실제 행)이 마지막
const rowByLabel = (tree: ReactTestRenderer, label: string) => {
  const all = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.type === 'Text' && c.props.children === label).length > 0);
  return all.length ? [all[all.length - 1]] : [];
};

afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = 'ios';
});

it('삭제 라벨 없음 → 촬영·갤러리 2행(삭제 행 부재), 선택 시 resolve', async () => {
  const tree = render();
  let result: unknown;
  await act(async () => {
    void requestPhotoSourceSheet(LABELS).then((r) => (result = r));
  });
  expect(rowByLabel(tree, 'editProfile.removePhoto')).toHaveLength(0);
  const cam = rowByLabel(tree, 'photo.take');
  expect(cam.length).toBeGreaterThanOrEqual(1);
  await act(async () => cam[0].props.onPress());
  expect(result).toBe('camera');
});

it('삭제 라벨 있음(커스텀 사진) → destructive 버건디 행 노출, 탭 = remove resolve', async () => {
  const tree = render();
  let result: unknown;
  await act(async () => {
    void requestPhotoSourceSheet({ ...LABELS, remove: 'editProfile.removePhoto' }).then((r) => (result = r));
  });
  const removeTexts = tree.root.findAll((n) => n.type === 'Text' && n.props.children === 'editProfile.removePhoto');
  expect(removeTexts.length).toBeGreaterThanOrEqual(1);
  expect(StyleSheet.flatten(removeTexts[0].props.style).color).toBe(DESTRUCTIVE); // 위험도 4색과 구분되는 버건디
  const removeRow = rowByLabel(tree, 'editProfile.removePhoto');
  await act(async () => removeRow[0].props.onPress());
  expect(result).toBe('remove');
});

it('스크림/X 닫기 = null resolve (행 선택이 먼저면 취소 no-op — 지연 판정)', async () => {
  const tree = render();
  let result: unknown = 'unset';
  await act(async () => {
    void requestPhotoSourceSheet(LABELS).then((r) => (result = r));
  });
  const closeBtn = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props?.hitSlop === 10)[0];
  await act(async () => {
    closeBtn.props.onPress();
    await new Promise((r) => setTimeout(r, 1));
  });
  expect(result).toBe(null);
});

it('choosePhotoSource 분기 — 안드=호스트 경유(시트 요청 발생) · iOS=네이티브 시트 무변', async () => {
  Platform.OS = 'android';
  const tree = render();
  let result: unknown;
  await act(async () => {
    void choosePhotoSource(LABELS).then((r) => (result = r));
  });
  const gal = rowByLabel(tree, 'photo.gallery');
  expect(gal.length).toBeGreaterThanOrEqual(1); // 호스트가 렌더 = 안드 경로
  await act(async () => gal[0].props.onPress());
  expect(result).toBe('gallery');

  Platform.OS = 'ios';
  const native = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0));
  await expect(choosePhotoSource(LABELS)).resolves.toBe('camera');
  expect(native).toHaveBeenCalled(); // iOS = 기존 네이티브 시트 그대로
});
