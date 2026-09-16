/**
 * shareExport (P-380/KB-518 4단계) — 공유 카드의 **캡처·저장·공유**를 순수 흐름으로 분리.
 *
 * 네이티브 3종(view-shot·media-library·share)은 **주입**으로 받는다 — jest에서 네이티브
 * 없이 분기를 전부 잠그기 위함(실기 확인은 예진 로컬 네이티브 빌드 1회).
 * 기본 구현은 지연 require(P-192 관례) — 구 런타임 번들 동승 시 크래시 0.
 *
 * 내보내기 규격(9/14 예진 확정): 1080×1920 캔버스(`#F7F8FA`)에 카드를 **캔버스 폭 75%**로
 * 중앙 배치. 카드 자체 비율(210×hug)은 건드리지 않는다.
 */
import type * as React from 'react';
import type { View } from 'react-native';
import { SHARE_CARD_W } from './shareCard';

/** 내보내기 픽셀 규격 — 인스타 스토리 기준. */
export const EXPORT_W = 1080;
export const EXPORT_H = 1920;
/** 캔버스 폭 대비 카드 폭(9/14 예진). 810px = 1080×0.75. */
export const EXPORT_CARD_RATIO = 0.75;
/** 캔버스 배경 = 시안 preview-area와 같은 값(내보내기 전용 시안은 없다 — REPORTS 명시). */
export const EXPORT_BG = '#F7F8FA';

/** 화면 밖 캔버스의 dp 크기. 9:16 유지 — 캡처 시 width/height로 픽셀을 올린다. */
export const CANVAS_W = EXPORT_W / 4;
export const CANVAS_H = EXPORT_H / 4;
/** 카드 확대 배율 = (캔버스 폭 × 75%) / 카드 폭. */
export const CARD_SCALE = (CANVAS_W * EXPORT_CARD_RATIO) / SHARE_CARD_W;

export type SaveResult = 'success' | 'denied' | 'error';
export type StoryResult = 'success' | 'not_installed' | 'error';

export interface ShareDeps {
  capture: (ref: React.RefObject<View | null>) => Promise<string>;
  requestSavePermission: () => Promise<boolean>;
  saveToLibrary: (uri: string) => Promise<void>;
  isInstagramInstalled: () => Promise<boolean>;
  shareToStory: (uri: string) => Promise<void>;
}

/* ---- 기본 구현(지연 require — 모듈 부재·구 번들에서도 import 시점에 죽지 않는다) ---- */

export const defaultDeps: ShareDeps = {
  capture: async (ref) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
    // width/height = 결과 픽셀 — dp 캔버스를 그대로 찍고 늘리면 뭉개진다(발주 명시)
    return captureRef(ref, { format: 'png', quality: 1, width: EXPORT_W, height: EXPORT_H, result: 'tmpfile' });
  },
  requestSavePermission: async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
    // writeOnly = 저장 전용 권한(읽기 요구 금지 — granularPermissions photo와 같은 이유)
    const cur = await MediaLibrary.getPermissionsAsync(true);
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false; // 기거부 = 재요청 금지(P-302 문법), 화면이 설정 안내
    return (await MediaLibrary.requestPermissionsAsync(true)).granted;
  },
  saveToLibrary: async (uri) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
    await MediaLibrary.saveToLibraryAsync(uri);
  },
  isInstagramInstalled: async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform, Linking } = require('react-native') as typeof import('react-native');
    if (Platform.OS === 'android') {
      // Android 11+ 가시성 — app.json <queries>(com.instagram.android)가 있어야 참이 된다
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Share = (require('react-native-share') as { default: { isPackageInstalled: (p: string) => Promise<{ isInstalled: boolean }> } }).default;
      try {
        return (await Share.isPackageInstalled('com.instagram.android')).isInstalled;
      } catch {
        return false;
      }
    }
    // iOS — LSApplicationQueriesSchemes에 instagram-stories 등재됨(1단계)
    return Linking.canOpenURL('instagram-stories://share');
  },
  shareToStory: async (uri) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ShareMod = require('react-native-share') as { default: { shareSingle: (o: Record<string, unknown>) => Promise<unknown>; Social: Record<string, string> } };
    const Share = ShareMod.default;
    await Share.shareSingle({
      social: Share.Social.INSTAGRAM_STORIES,
      appId: INSTAGRAM_APP_ID,
      backgroundImage: uri,
      // 스토리 편집기가 열리면 사용자가 스티커·텍스트를 얹는다 — 우리가 링크를 붙이지 않는다
    });
  },
};

/**
 * iOS 스토리 공유는 Meta appId를 요구한다(react-native-share 계약). 아직 앱 등록 전이라
 * 빈 값이면 iOS에서 실패 분기로 떨어진다 — **안드로이드 경로는 영향 없다**.
 * 실기 확인 후 값이 필요하면 커맨드 센터에 Meta 앱 등록을 요청한다(REPORTS 기재).
 */
export const INSTAGRAM_APP_ID = '';

/** 저장 흐름 — 권한 거부·실패를 결과값으로만 돌려준다(화면이 안내·계측을 판단). */
export async function saveCardToPhotos(
  ref: React.RefObject<View | null>,
  deps: ShareDeps = defaultDeps,
): Promise<SaveResult> {
  try {
    if (!(await deps.requestSavePermission())) return 'denied';
    const uri = await deps.capture(ref);
    await deps.saveToLibrary(uri);
    return 'success';
  } catch {
    return 'error';
  }
}

/** 스토리 공유 흐름 — 미설치는 실패가 아니라 별도 결과(앱스토어로 보내지 않는다). */
export async function shareCardToStory(
  ref: React.RefObject<View | null>,
  deps: ShareDeps = defaultDeps,
): Promise<StoryResult> {
  try {
    if (!(await deps.isInstagramInstalled())) return 'not_installed';
    const uri = await deps.capture(ref);
    await deps.shareToStory(uri);
    return 'success';
  } catch {
    return 'error';
  }
}
