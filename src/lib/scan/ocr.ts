/**
 * ocr.ts — on-device OCR wrapper over @react-native-ml-kit/text-recognition.
 * Native module → only runs in a dev build (NOT Expo Go / web). Importing is
 * safe; calling recognize() throws a LINKING_ERROR if the native side is absent,
 * which we surface so the screen can show a clear OCR-specific error.
 *
 * Returns line-level text + boxes normalized to 0..1 against the image size.
 * Boxes stay on-device for the overlay; only text is sent to the BE (§13-3).
 *
 * iOS note: the native side loads the image via [NSURL URLWithString:url] +
 * dataWithContentsOfURL, which REQUIRES a scheme (file://). expo-camera /
 * expo-image-picker return file:// URIs already; we defensively re-add it.
 *
 * Step-by-step console logs (prefix "[ocr]") are intentional for the spike —
 * watch them in the Metro terminal to confirm ML Kit pulls text + boxes.
 */
import TextRecognition, {
  TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';
import type { BoundingBox } from '@/lib/api/scanTypes';

export interface OcrLine {
  text: string;
  box: BoundingBox; // normalized 0..1
}

function normalize(
  frame: { left: number; top: number; width: number; height: number },
  imgW: number,
  imgH: number,
): BoundingBox {
  return {
    x: imgW ? frame.left / imgW : 0,
    y: imgH ? frame.top / imgH : 0,
    width: imgW ? frame.width / imgW : 0,
    height: imgH ? frame.height / imgH : 0,
  };
}

/** Ensure a file path carries a scheme ML Kit's NSURL can resolve. */
function ensureScheme(uri: string): string {
  if (/^(file|content|https?|ph|asset):/i.test(uri)) return uri;
  return `file://${uri}`;
}

/**
 * Recognize menu lines in a captured image.
 * @param uri  image file URI from the camera / gallery
 * @param imgW captured photo pixel width
 * @param imgH captured photo pixel height
 */
export async function recognizeMenuLines(
  uri: string,
  imgW: number,
  imgH: number,
): Promise<OcrLine[]> {
  const safeUri = ensureScheme(uri);
  console.log('[ocr] recognize ←', { uri: safeUri, imgW, imgH });

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
      const box = normalize(line.frame, imgW, imgH);
      console.log(`[ocr] block${bi}.line${li} norm =`, JSON.stringify({ text, box }));
      lines.push({ text, box });
    });
  });

  console.log('[ocr] total usable lines =', lines.length);
  return lines;
}
