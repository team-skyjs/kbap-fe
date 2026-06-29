/**
 * ocr.ts — on-device OCR wrapper over @react-native-ml-kit/text-recognition.
 * Native module → only runs in a dev build (NOT Expo Go / web). Importing is
 * safe; calling recognize() throws a LINKING_ERROR if the native side is absent,
 * which we surface as ocrAvailable=false so the screen can fall back.
 *
 * Returns line-level text + boxes normalized to 0..1 against the image size.
 * Boxes stay on-device for the overlay; only text is sent to the BE (§13-3).
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

/**
 * Recognize menu lines in a captured image.
 * @param uri  image file URI from the camera
 * @param imgW captured photo pixel width
 * @param imgH captured photo pixel height
 */
export async function recognizeMenuLines(
  uri: string,
  imgW: number,
  imgH: number,
): Promise<OcrLine[]> {
  const result = await TextRecognition.recognize(uri, TextRecognitionScript.KOREAN);
  const lines: OcrLine[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      const text = line.text.trim();
      if (!text || !line.frame) continue;
      lines.push({ text, box: normalize(line.frame, imgW, imgH) });
    }
  }
  return lines;
}
