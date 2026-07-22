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

export interface Dims {
  width: number;
  height: number;
}

/** frame 우/하단이 치수 안에 드는가 — 반올림 여유 2% */
const FIT_EPS = 1.02;
const fits = (d: Dims, maxRight: number, maxBottom: number) =>
  maxRight <= d.width * FIT_EPS && maxBottom <= d.height * FIT_EPS;

/**
 * P-056(KB-176 🔴): 정규화 분모 선택 — **ML Kit이 실제 참조한 치수**를 쓴다.
 * iOS는 measured(디코드 픽셀)가 정답(KB-141 — reported가 point인 기기 존재)인데,
 * 안드는 저장 파일이 절반 다운스케일되어 measured(942×2040)가 ML Kit 기준
 * (원치수 1883×4080)과 어긋남 → y 2배 뻥튀기·클램프 미표시. 플랫폼 하드코딩
 * 대신 **frame 최대 좌표를 수용하는 쪽을 채택** — 두 치수가 정수배 관계면
 * 스케일 보정과 동치라 견고하다. 우선순위: measured(기존 iOS 정답) → reported →
 * 둘 다 못 담으면 큰 쪽(클램프 최소화).
 */
export function chooseDenominator(
  measured: Dims | null,
  reported: Dims,
  maxRight: number,
  maxBottom: number,
): { pxW: number; pxH: number; basis: 'measured' | 'reported' | 'larger-fallback' } {
  const m = measured && measured.width > 0 && measured.height > 0 ? measured : null;
  const r = reported.width > 0 && reported.height > 0 ? reported : null;
  if (m && fits(m, maxRight, maxBottom)) return { pxW: m.width, pxH: m.height, basis: 'measured' };
  if (r && fits(r, maxRight, maxBottom)) return { pxW: r.width, pxH: r.height, basis: 'reported' };
  // 어느 쪽도 못 담음 — 큰 쪽으로 클램프 손실 최소화 (측정 실패 시 reported 폴백 겸)
  const pick = m && r ? (m.width * m.height >= r.width * r.height ? m : r) : (m ?? r ?? { width: 0, height: 0 });
  return { pxW: pick.width, pxH: pick.height, basis: 'larger-fallback' };
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

  // 후보 치수 수집 — 분모 확정은 frame 최대 좌표를 본 뒤(아래, P-056)
  const measured = await getPixelSize(safeUri);
  console.log(
    '[ocr] dims reported(point?) =',
    JSON.stringify({ fallbackW, fallbackH }),
    '| measured(pixel) =',
    JSON.stringify(measured),
  );

  console.log('[ocr] recognize ←', safeUri);
  // ⑥ 용량: iOS 바이너리에 Korean 모델만 번들됨(patches/@react-native-ml-kit* —
  // 한국어 인식기가 라틴 문자도 읽음). KOREAN 외 스크립트를 쓰려면 podspec 패치에
  // 해당 pod을 복원해야 함 — 안 하면 네이티브가 "Unsupported script"로 reject.
  const result = await TextRecognition.recognize(safeUri, TextRecognitionScript.KOREAN);
  console.log('[ocr] blocks =', result.blocks.length, '| fullText =', JSON.stringify(result.text));

  // 1차 수집: 텍스트+frame만 — 분모 선택에 frame 최대 좌표가 필요 (P-056)
  const raw: { text: string; frame: { left: number; top: number; width: number; height: number } }[] = [];
  let maxRight = 0;
  let maxBottom = 0;
  result.blocks.forEach((block, bi) => {
    block.lines.forEach((line, li) => {
      console.log(`[ocr] block${bi}.line${li} raw =`, JSON.stringify({ text: line.text, frame: line.frame }));
      const text = line.text.trim();
      if (!text || !line.frame) {
        console.log(`[ocr] block${bi}.line${li} skipped (empty text or no frame)`);
        return;
      }
      raw.push({ text, frame: line.frame });
      maxRight = Math.max(maxRight, line.frame.left + line.frame.width);
      maxBottom = Math.max(maxBottom, line.frame.top + line.frame.height);
    });
  });

  // P-056: ML Kit이 실제 참조한 치수 채택 — 채택 근거 로그 필수 (과제 지시)
  const { pxW, pxH, basis } = chooseDenominator(
    measured,
    { width: fallbackW, height: fallbackH },
    maxRight,
    maxBottom,
  );
  console.log(
    '[ocr] denominator =',
    JSON.stringify({ pxW, pxH, basis, maxRight: Math.round(maxRight), maxBottom: Math.round(maxBottom) }),
  );

  const lines: OcrLine[] = raw.map(({ text, frame }) => {
    const box = normalize(frame, pxW, pxH);
    console.log('[ocr] norm =', JSON.stringify({ text, box }));
    return { text, box };
  });

  console.log('[ocr] total usable lines =', lines.length);
  return lines;
}
