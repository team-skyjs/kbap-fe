/**
 * KB-988 — 메뉴 스캔 스위트용 PackagedScanFlow 목. 옛 모드 탭·메뉴 카메라가 사라져 스캔 화면 카메라는 늘 가공식품 흐름(KB-969 비전)이다.
 * 이 목은 실제 카메라 UI(scan.tsx cameraUi — 셔터·갤러리·권한)를 그리고, 찍은 사진을 "비전이 메뉴판으로 판별"한 것으로 넘긴다(onMenuPhoto).
 * 메뉴 경로(쿼터·티켓·v1 ML Kit·v2 결과)는 scan.tsx 그대로 탄다 — 비전 분기 자체는 visionScan969·scanVisionMenu969.
 * 사용: `jest.mock('@/features/scan/PackagedScanFlow', () => jest.requireActual('@/__tests__/helpers/visionMenuFlowMock'));`
 */
import * as React from 'react';

const actual = jest.requireActual('@/features/scan/PackagedScanFlow') as typeof import('@/features/scan/PackagedScanFlow');

/** 비전 업로드가 돌려준 것으로 치는 경로(메뉴 v2 uploadedPath) */
export const MENU_VISION_PATH = 'images/packaged-scans/menu.jpg';

export const { CameraSlot, confidenceBand, visionReasonKey, visionBodyKey } = actual;

type FlowProps = React.ComponentProps<typeof actual.PackagedScanFlow>;
/** 마지막 렌더의 props — 흐름 안 사건(확정 한도 onQuota 등)을 스캔 화면 쪽에서 몰 때 */
export const flowProps: { last: FlowProps | null } = { last: null };
/** real = 실제 흐름(가공식품 단계·디버그 주입까지 보는 테스트) — beforeEach에서 false로 되돌린다 */
export const flowMode = { real: false };

export function PackagedScanFlow(p: FlowProps) {
  React.useEffect(() => { flowProps.last = p; }); // 렌더 중 모듈 값 변이 금지(react-hooks) — 커밋 뒤 기록
  if (flowMode.real) return <actual.PackagedScanFlow {...p} />;
  const { renderCamera, onMenuPhoto } = p;
  return <CameraSlot render={renderCamera} o={{ onShot: (photo) => onMenuPhoto?.(photo, MENU_VISION_PATH) }} />;
}
