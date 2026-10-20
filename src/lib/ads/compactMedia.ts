/** Compact B: retain source aspect ratio; cap the longer edge at 256 layout units. */
export function compactMediaSize(availableWidth: number, ratio: number | undefined, video: boolean, density: number) {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return null;
  const knownRatio = typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0;
  // Unknown image ratio is safely letterboxed by contain. A video needs a verified ratio.
  if (video && !knownRatio) return null;
  const aspect = knownRatio ? ratio : 16 / 9;
  if (video && ![4 / 3, 16 / 9, 1, 3 / 4, 9 / 16].some((r) => Math.abs(r - aspect) < 0.01)) return null;
  const width = Math.min(availableWidth, 256, 256 * aspect);
  const height = width / aspect;
  // Reject unusably thin image layouts rather than distort/crop extreme creatives.
  if (Math.min(width, height) < 32) return null;
  if (video && (Math.min(width, height) < 120 || Math.max(width, height) * density < 256)) return null;
  return { width, height };
}
