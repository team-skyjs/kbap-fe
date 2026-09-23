/** KB-600(P-408): Android 사진 권한 제거 후 권한 요청 분기 — 순수 함수 + 소비처 배선 잠금. */
import * as fs from 'fs';
import { needsPhotoLibraryPermission, needsSavePermission } from '../mediaPermissions';

it('앨범 선택 권한 — iOS만 요청(Android = 시스템 Photo Picker)', () => {
  expect(needsPhotoLibraryPermission('ios')).toBe(true);
  expect(needsPhotoLibraryPermission('android')).toBe(false);
  expect(needsPhotoLibraryPermission('web')).toBe(false);
});

it('저장 권한 — iOS·Android 10(API 29) 이하만 요청, Android 11+는 요청 0(네이티브 SDK_INT < R 검사와 같은 경계 — Codex #201 P1)', () => {
  expect(needsSavePermission('ios', 17)).toBe(true);
  expect(needsSavePermission('android', 28)).toBe(true); // WRITE_EXTERNAL_STORAGE(maxSdk 32)
  expect(needsSavePermission('android', 29)).toBe(true); // Android 10: expo-media-library가 아직 WRITE를 검사한다
  expect(needsSavePermission('android', 30)).toBe(false);
  expect(needsSavePermission('android', 34)).toBe(false);
});

it('배선 — 문의 앨범 선택·스토리 카드 저장이 헬퍼를 탄다 · Android 무조건 요청 경로 0', () => {
  const feedback = fs.readFileSync('src/app/profile/feedback/new.tsx', 'utf8');
  expect(feedback).toMatch(/if \(needsPhotoLibraryPermission\(\)\)/);
  const share = fs.readFileSync('src/features/order/shareExport.ts', 'utf8');
  expect(share).toContain('if (!needsSavePermission()) return true;');
  // 다른 앨범 선택 5곳(스캔·리뷰·게시글·주문 항목·프로필)은 원래 권한 요청 없이 launch — 새로 생기면 안 된다
  for (const f of ['src/app/scan.tsx', 'src/app/food/[id]/review.tsx', 'src/app/community/compose.tsx', 'src/app/profile/order/[id].tsx', 'src/lib/data/profileImage.ts']) {
    expect(fs.readFileSync(f, 'utf8')).not.toContain('requestMediaLibraryPermissionsAsync');
  }
});
