/**
 * P-310(KB-477) — 바텀시트 우상단 X 전수 제거 잠금: 시트 3종(AuthGateSheet·
 * ActionSheet·PlaceTagSheet) X 잔존 0 + 배경 탭 닫힘 유지. 화면 헤더 X(스캔 등)는 유지.
 */
import * as fs from 'fs';

it('시트 3종 — IconClose 잔존 0 + 배경 탭(backdrop onPress=onClose) 유지', () => {
  for (const p of ['src/components/AuthGateSheet.tsx', 'src/components/ActionSheet.tsx', 'src/features/community/placeMap.tsx']) {
    const s = fs.readFileSync(p, 'utf8');
    expect(s).not.toContain('IconClose');
    expect(s).toMatch(/backdrop\} onPress=\{onClose\}|styles\.backdrop\} onPress=\{onClose\}/);
  }
});

it('화면 헤더·뷰어·입력 클리어 X = 유지(제거 아님) — 스캔 카메라·owner·사진 뷰어', () => {
  expect(fs.readFileSync('src/app/scan.tsx', 'utf8')).toContain('IconClose size={22}'); // 카메라 헤더
  expect(fs.readFileSync('src/app/food/[id]/owner.tsx', 'utf8')).toContain('IconClose'); // 풀스크린 카드
  expect(fs.readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8')).toContain('viewer-close'); // 사진 뷰어
});
