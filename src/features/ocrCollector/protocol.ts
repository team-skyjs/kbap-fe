/** P-610: OCR evidence only. No model scores, labels, credentials or API client. */
import { runtimeContext } from '@/lib/engagement/runtimeContext';
import type { OcrLine } from '@/lib/scan/ocr';

export const PROTOCOL = 'kbap-mlkit-capture-v1';
export const MANIFEST_SHA = '6f689125f75d1a42c49a206fc0a39c7da105c5a1568d77e7141921e62aa31eb1';
export type Sample = { sample_id: string; path: string; source_sha256: string };
export type Manifest = { protocol_version: string; samples: Sample[] };
export type CaptureRow = {
  sample_id: string; source_sha256: string; status: 'ok' | 'error';
  elapsed_ms: number; preprocessing: string; lines: OcrLine[]; error_code?: string;
};
export type Device = {
  platform: 'ios' | 'android'; model: string; os_version: string; kind: 'physical' | 'simulator';
  app_build: string; ocr_library_version: string; script: 'KOREAN';
};
export function allowed(channel: string | null | undefined, dev: boolean, base: string): boolean {
  const context = runtimeContext({ development: dev, os: 'unknown', beBase: base, channel });
  if (context.be_env !== 'dev') return false;
  const url = new URL(base);
  return !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === '/' &&
    (channel === 'teamtest' || channel === 'development' || ((channel == null || channel === '') && dev));
}

/** Only a numeric private/loopback IPv4 and a fixed port. No path, token or DNS. */
export function fixtureOrigin(host: string): string {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || +p > 255)) throw new Error('HOST');
  const [a, b] = parts.map(Number);
  if (!(a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31))) throw new Error('HOST');
  return `http://${host}:8878`;
}
export function parseManifest(text: string): Manifest {
  const m = JSON.parse(text) as Manifest;
  if (m.protocol_version !== PROTOCOL || !Array.isArray(m.samples) || m.samples.length !== 32) throw new Error('MANIFEST');
  const ids = new Set<string>();
  for (const s of m.samples) {
    if (!/^ocr-v2-0(0[1-9]|[12]\d|3[0-2])$/.test(s.sample_id) ||
        s.path !== `images/${s.sample_id}.jpg` || !/^[a-f0-9]{64}$/.test(s.source_sha256) || ids.has(s.sample_id)) throw new Error('MANIFEST');
    ids.add(s.sample_id);
  }
  return m;
}

/** Read JPEG SOF and EXIF orientation from verified bytes, before decoding. */
export function jpegMetadata(bytes: Uint8Array): { width: number; height: number; orientation: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint16(0) !== 0xffd8) throw new Error('JPEG');
  let width = 0, height = 0, orientation = 1;
  for (let p = 2; p + 4 <= bytes.length;) {
    if (bytes[p] !== 255) throw new Error('JPEG');
    const marker = bytes[p + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = v.getUint16(p + 2);
    if (length < 2 || p + 2 + length > bytes.length) throw new Error('JPEG');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      height = v.getUint16(p + 5); width = v.getUint16(p + 7);
    }
    if (marker === 0xe1 && length >= 16 && v.getUint32(p + 4) === 0x45786966) {
      const t = p + 10;
      const little = v.getUint16(t) === 0x4949;
      const ifd = t + v.getUint32(t + 4, little);
      const end = p + 2 + length;
      if (ifd + 2 > end) throw new Error('EXIF');
      const count = v.getUint16(ifd, little);
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + 12 * i;
        if (entry + 12 > end) throw new Error('EXIF');
        if (v.getUint16(entry, little) === 0x112) orientation = v.getUint16(entry + 8, little);
      }
    }
    p += 2 + length;
  }
  if (!width || !height || orientation < 1 || orientation > 8) throw new Error('JPEG');
  return { width, height, orientation };
}
export function validateLines(lines: OcrLine[]): OcrLine[] {
  for (const line of lines) {
    const b = line.box;
    if (typeof line.text !== 'string' || 'confidence' in line ||
      ![b.x, b.y, b.width, b.height].every(n => Number.isFinite(n) && n >= 0 && n <= 1) ||
      b.x + b.width > 1.02 || b.y + b.height > 1.02) throw new Error('GEOMETRY');
  }
  return lines.map(({ text, box }) => ({ text, box }));
}
