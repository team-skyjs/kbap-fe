/**
 * ocr.ts — on-device OCR wrapper over @react-native-ml-kit/text-recognition.
 * Native module → only runs in a dev build (NOT Expo Go / web). Importing is
 * safe; calling recognize() throws a LINKING_ERROR if the native side is absent,
 * which we surface so the screen can show a clear OCR-specific error.
 *
 * Returns line-level text + boxes normalized to 0..1.
 *
 * NORMALIZATION (critical): ML Kit `frame` coords are in IMAGE PIXELS. The
 * denominator MUST be the image's real PIXEL size — not the camera's reported
 * width/height, which on some devices are POINTS (logical), making boxes
 * overshoot by devicePixelRatio (~3× on @3x iPhones → BE 400, out-of-range).
 * We measure the actual pixels with Image.getSize(uri) — the same file ML Kit
 * decodes — instead of trusting the camera dims (passed only as a fallback).
 *
 * iOS note: the native side loads the image via [NSURL URLWithString:url] +
 * dataWithContentsOfURL, which REQUIRES a scheme (file://). expo-camera /
 * expo-image-picker return file:// URIs; we defensively re-add it.
 *
 * Step-by-step console logs (prefix "[ocr]") are intentional for the spike.
 */
import { Image } from 'react-native';
import TextRecognition, {
  TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';
import type { BoundingBox } from '@/lib/api/scanTypes';

export interface OcrLine {
  text: string;
  box: BoundingBox; // normalized 0..1
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Divide pixel-space frame by PIXEL dimensions, then clamp (epsilon safety). */
function normalize(
  frame: { left: number; top: number; width: number; height: number },
  pxW: number,
  pxH: number,
): BoundingBox {
  return {
    x: clamp01(pxW ? frame.left / pxW : 0),
    y: clamp01(pxH ? frame.top / pxH : 0),
    width: clamp01(pxW ? frame.width / pxW : 0),
    height: clamp01(pxH ? frame.height / pxH : 0),
  };
}

/** Ensure a file path carries a scheme ML Kit's NSURL can resolve. */
function ensureScheme(uri: string): string {
  if (/^(file|content|https?|ph|asset):/i.test(uri)) return uri;
  return `file://${uri}`;
}

/** Real decoded pixel size of the image file (ground truth for ML Kit frames). */
function getPixelSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

/**
 * Recognize menu lines in a captured image.
 * @param uri        image file URI (camera / gallery)
 * @param fallbackW  camera-reported width (may be POINTS) — used only if measure fails
 * @param fallbackH  camera-reported height (may be POINTS)
 */
export async function recognizeMenuLines(
  uri: string,
  fallbackW: number,
  fallbackH: number,
): Promise<OcrLine[]> {
  const safeUri = ensureScheme(uri);

  // Measure the TRUE pixel size (denominator). Fall back to reported dims.
  const measured = await getPixelSize(safeUri);
  const pxW = measured?.width || fallbackW;
  const pxH = measured?.height || fallbackH;
  console.log(
    '[ocr] dims reported(point?) =',
    JSON.stringify({ fallbackW, fallbackH }),
    '| measured(pixel) =',
    JSON.stringify(measured),
    '| using =',
    JSON.stringify({ pxW, pxH }),
  );

  console.log('[ocr] recognize ←', safeUri);
  const result = await TextRecognition.recognize(safeUri, TextRecognitionScript.KOREAN);
  console.log('[ocr] blocks =', result.blocks.length, '| fullText =', JSON.stringify(result.text));

  const lines: OcrLine[] = [];
  result.blocks.forEach((block, bi) => {
    block.lines.forEach((line, li) => {
      console.log(`[ocr] block${bi}.line${li} raw =`, JSON.stringify({ text: line.text, frame: line.frame }));
      const text = line.text.trim();
      if (!text || !line.frame) {
        console.log(`[ocr] block${bi}.line${li} skipped (empty text or no frame)`);
        return;
      }
      const box = normalize(line.frame, pxW, pxH);
      console.log(`[ocr] block${bi}.line${li} norm =`, JSON.stringify({ text, box }));
      lines.push({ text, box });
    });
  });

  console.log('[ocr] total usable lines =', lines.length);
  return lines;
}
