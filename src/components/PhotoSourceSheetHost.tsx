/**
 * PhotoSourceSheetHost (P-123/KB-192) — **안드** 프로필 사진 소스 시트 = 커뮤니티
 * ActionSheet 재사용 (8/4 예진 확정 — 시스템 Alert 3버튼 폐기).
 *
 * 명령형 호출부(choosePhotoSource — Promise)와 선언형 ActionSheet의 브릿지:
 * 루트 _layout에 1회 마운트, requestPhotoSourceSheet()가 대기 요청을 모듈
 * 스토어에 올리면 호스트가 시트를 렌더하고 선택/닫기로 resolve.
 *
 * iOS는 네이티브 시트 유지(P-049 빨간 삭제 — 예진 기승인 흐름): 이 호스트는
 * 안드 전용 경로다(profileImage.choosePhotoSource의 플랫폼 분기가 결정).
 * 톤은 커뮤니티 것 그대로 — destructive 버건디(DESTRUCTIVE), 신규 디자인 없음.
 */
import * as React from 'react';
import { color as C } from '@/lib/theme';
import { ActionSheet, DESTRUCTIVE } from './ActionSheet';
import { IconCamera, IconGallery, IconTrash } from './icons';

export interface PhotoSheetLabels {
  title: string;
  camera: string;
  gallery: string;
  remove?: string; // 있으면 destructive 삭제 행 — 커스텀 사진 보유 시에만(호출측 판단)
  cancel: string;
}
export type PhotoSheetChoice = 'camera' | 'gallery' | 'remove' | null;

interface PendingRequest {
  labels: PhotoSheetLabels;
  resolve: (choice: PhotoSheetChoice) => void;
}

let pending: PendingRequest | null = null;
const subs = new Set<() => void>();

function notify() {
  subs.forEach((f) => f());
}

/** 선택 확정 — 대기 요청을 닫고 resolve. 이미 처리됐으면 no-op. */
function settle(req: PendingRequest, choice: PhotoSheetChoice) {
  if (pending !== req) return;
  pending = null;
  notify();
  req.resolve(choice);
}

/** 안드 사진 소스 시트 요청 — 호스트가 렌더·선택을 resolve. */
export function requestPhotoSourceSheet(labels: PhotoSheetLabels): Promise<PhotoSheetChoice> {
  return new Promise((resolve) => {
    pending?.resolve(null); // 중복 호출 방어 — 이전 요청은 취소 처리
    pending = { labels, resolve };
    notify();
  });
}

export function PhotoSourceSheetHost() {
  const req = React.useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => pending,
    () => null,
  );
  if (!req) return null;
  const L = req.labels;
  // ActionSheet 행 탭 = onClose() 후 onPress() 순서 — 취소 판정은 미뤄서(0 tick)
  // 행 선택이 먼저 settle하면 no-op이 되게 한다(스크림/X/백버튼만 null로 남음).
  const deferCancel = () => setTimeout(() => settle(req, null), 0);
  return (
    <ActionSheet
      open
      title={L.title}
      items={[
        { key: 'camera', label: L.camera, icon: <IconCamera size={17} color={C.ink2} />, onPress: () => settle(req, 'camera') },
        { key: 'gallery', label: L.gallery, icon: <IconGallery size={17} color={C.ink2} />, onPress: () => settle(req, 'gallery') },
        ...(L.remove
          ? [{ key: 'remove', label: L.remove, destructive: true, icon: <IconTrash size={17} color={DESTRUCTIVE} />, onPress: () => settle(req, 'remove') }]
          : []),
      ]}
      onClose={deferCancel}
    />
  );
}
