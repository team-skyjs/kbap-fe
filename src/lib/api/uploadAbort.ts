/**
 * KB-711: 화면 이탈로 업로드를 취소함 — 실패 안내(토스트 등)를 띄우지 않는 신호. 상한 초과는 이게 아니라 일반 실패.
 * 네이티브 의존 없는 별도 모듈 — 화면이 scanImage(expo-file-system)를 끌어오지 않고 판별만 하게(테스트 목 경계도 단순).
 */
export class UploadAbortedError extends Error {
  constructor() {
    super('upload aborted');
    this.name = 'UploadAbortedError';
  }
}
export const isUploadAborted = (e: unknown): boolean => e instanceof UploadAbortedError;
