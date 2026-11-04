import { Platform, AppState } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Manipulator from 'expo-image-manipulator';
import * as Application from 'expo-application';
import Share from 'react-native-share';
import { recognizeMenuLines } from '@/lib/scan/ocr';
import { collectDeviceInfo } from '@/lib/deviceInfo';
import { CollectorRunner, type Attempt } from './runner';
import { PROTOCOL, MANIFEST_SHA, fixtureOrigin, parseManifest, jpegMetadata, type Sample, type Manifest, type Device, type CaptureRow, validateLines } from './protocol';

const directory = new Directory(Paths.document, 'mlkit-collector-v1');
const manifestFile = new File(directory, 'manifest.json');
const recoveryFile = new File(directory, 'latest.json');
export const state: { manifest: Manifest | null; downloading: boolean; downloadAbort: AbortController | null } =
  { manifest: null, downloading: false, downloadAbort: null };
let sessionDevice: Device | null = null;
export function currentDevice() { return sessionDevice; }
let exportFile: File | null = null;
const sha = async (bytes: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)))
  .map(b => b.toString(16).padStart(2, '0')).join('');

async function verified(file: File, hash: string): Promise<Uint8Array<ArrayBuffer>> {
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = await file.bytes(); } catch (e) {
    const code = (e as { code?: string })?.code;
    throw new Error(code === 'EACCES' || code === 'EPERM' ? 'FILE_PERMISSION' : 'FILE_READ');
  }
  if (await sha(bytes) !== hash) throw new Error('HASH');
  return bytes;
}
function photo(sample: Sample): File { return new File(directory, `${sample.sample_id}.jpg`); }
function active() { if (AppState.currentState !== 'active') throw new Error('BACKGROUND'); }
export function stop(reason = 'CANCELLED') { state.downloadAbort?.abort(); runner.cancel(reason); }

/** Only the fixed local fixture service. No API client, cookies, tokens or analytics. */
async function download(origin: string, path: string, abort: AbortController): Promise<Uint8Array<ArrayBuffer>> {
  const timeout = setTimeout(() => abort.abort(), 30000);
  try {
    const url = `${origin}/${path}`;
    const response = await fetch(url, { signal: abort.signal, credentials: 'omit', redirect: 'error' });
    if (!response.ok || (response.url && response.url !== url)) throw new Error('DOWNLOAD');
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength > 20000000) throw new Error('SIZE');
    return data;
  } finally { clearTimeout(timeout); }
}
export async function prepare(host: string, progress: (n: number) => void): Promise<void> {
  if (runner.busy || state.downloading) throw new Error('BUSY');
  const origin = fixtureOrigin(host);
  state.downloading = true;
  const abort = new AbortController(); state.downloadAbort = abort;
  try {
    active(); directory.create({ intermediates: true, idempotent: true });
    const bytes = await download(origin, 'manifest.json', abort);
    if (await sha(bytes) !== MANIFEST_SHA) throw new Error('MANIFEST_HASH');
    // Do not trust JSON reserialization for the manifest hash: hash exact downloaded bytes.
    const temporary = new File(directory, 'manifest.pending'); temporary.write(bytes);
    const manifest = parseManifest(await temporary.text()); temporary.delete();
    for (let i = 0; i < manifest.samples.length; i++) {
      active(); if (abort.signal.aborted) throw new Error('CANCELLED');
      const sample = manifest.samples[i], file = photo(sample);
      let cached = false;
      if (file.exists) { try { await verified(file, sample.source_sha256); cached = true; } catch { /* replace corrupt cache */ } }
      if (!cached) {
        const data = await download(origin, sample.path, abort);
        if (await sha(data) !== sample.source_sha256) throw new Error('IMAGE_HASH');
        file.write(data);
      }
      progress(i + 1);
    }
    if (abort.signal.aborted) throw new Error('CANCELLED');
    manifestFile.write(bytes); state.manifest = manifest;
  } finally { state.downloading = false; state.downloadAbort = null; }
}
/** Offline fallback for release ATS/cleartext restrictions. Select manifest plus 32 JPEGs in Files. */
export async function importFiles(progress: (n: number) => void): Promise<void> {
  if (runner.busy || state.downloading) throw new Error('BUSY');
  state.downloading = true;
  try {
    const picked = await File.pickFileAsync({ multipleFiles: true });
    if (picked.canceled) throw new Error('CANCELLED');
    const abort = new AbortController(); state.downloadAbort = abort;
    if (picked.result.length !== 33) throw new Error('FILES');
    const names = new Map(picked.result.map(file => [file.name, file]));
    if (names.size !== 33 || !names.has('manifest.json')) throw new Error('FILES');
    const manifestSource = names.get('manifest.json')!;
    const bytes = await verified(manifestSource, MANIFEST_SHA);
    const manifest = parseManifest(await manifestSource.text());
    // Verify every selected source before replacing the local cache.
    for (const sample of manifest.samples) {
      if (abort.signal.aborted) throw new Error('CANCELLED');
      const file = names.get(`${sample.sample_id}.jpg`);
      if (!file) throw new Error('FILES');
      await verified(file, sample.source_sha256);
    }
    directory.create({ intermediates: true, idempotent: true });
    for (let i = 0; i < manifest.samples.length; i++) {
      if (abort.signal.aborted) throw new Error('CANCELLED');
      const sample = manifest.samples[i];
      const data = await verified(names.get(`${sample.sample_id}.jpg`)!, sample.source_sha256);
      photo(sample).write(data); progress(i + 1);
    }
    manifestFile.write(bytes); state.manifest = manifest;
  } finally { state.downloading = false; state.downloadAbort = null; }
}
export async function loadLocal(): Promise<void> {
  if (!manifestFile.exists) return;
  await verified(manifestFile, MANIFEST_SHA);
  const manifest = parseManifest(await manifestFile.text());
  for (const s of manifest.samples) await verified(photo(s), s.source_sha256);
  state.manifest = manifest;
  if (sessionDevice || runner.busy || !recoveryFile.exists) return;
  const name = await recoveryFile.text();
  if (!/^capture-[a-f0-9-]+\.json$/.test(name)) throw new Error('RECOVERY');
  const file = new File(directory, name);
  const data = JSON.parse(await file.text());
  if (data.fixture_manifest_sha256 !== MANIFEST_SHA || data.protocol_version !== PROTOCOL ||
    !Array.isArray(data.samples) || !Array.isArray(data.attempts) || !data.device) throw new Error('RECOVERY');
  const seen = new Set<string>();
  for (const row of data.samples as CaptureRow[]) {
    const source = manifest.samples.find(s => s.sample_id === row.sample_id);
    if (!source || source.source_sha256 !== row.source_sha256 || seen.has(row.sample_id) ||
      !['ok', 'error'].includes(row.status) || !Number.isFinite(row.elapsed_ms)) throw new Error('RECOVERY');
    validateLines(row.lines); seen.add(row.sample_id);
  }
  sessionDevice = data.device; exportFile = file;
  runner.rows = new Map(data.samples.map((r: CaptureRow) => [r.sample_id, r]));
  runner.attempts = data.attempts;
}
export async function identify(model: string, kind: 'physical' | 'simulator'): Promise<Device> {
  const info = collectDeviceInfo();
  if (!model.trim() || !info.buildNumber || !info.osVersion || !['ios', 'android'].includes(Platform.OS)) throw new Error('DEVICE');
  // iOS simulator status is available without adding expo-device. Fail closed on lookup failure.
  if (Platform.OS === 'ios') {
    const detected = await Application.getIosApplicationReleaseTypeAsync();
    if (detected === Application.ApplicationReleaseType.UNKNOWN) throw new Error('DEVICE_KIND_UNKNOWN');
    if ((detected === Application.ApplicationReleaseType.SIMULATOR) !== (kind === 'simulator')) throw new Error('DEVICE_KIND');
  }
  return { platform: Platform.OS as 'ios' | 'android', model: model.trim(), kind,
    os_version: info.osVersion, app_build: `${info.appVersion}/${info.buildNumber}`,
    ocr_library_version: '2.0.0', script: 'KOREAN' };
}
export function begin(device: Device) {
  if (sessionDevice) {
    if (JSON.stringify(sessionDevice) !== JSON.stringify(device)) throw new Error('DEVICE_CHANGED');
    return;
  }
  sessionDevice = device;
  directory.create({ intermediates: true, idempotent: true });
  exportFile = new File(directory, `capture-${Crypto.randomUUID()}.json`);
}
function capture(rows: CaptureRow[], attempts: Attempt[]) {
  return { protocol_version: PROTOCOL, fixture_manifest_sha256: MANIFEST_SHA, device: sessionDevice,
    samples: rows, attempts, timing: { clock: 'performance.now', includes: 'hash verification + decode + native OCR + normalization',
      cold_start: 'unknown; no cache-reset claim', native_cancel_supported: false },
    device_model_source: 'operator-confirmed', device_kind_source: Platform.OS === 'ios' ? 'operator and native release type' : 'operator-confirmed' };
}
export const runner = new CollectorRunner({
  now: () => performance.now(),
  save: async (rows, attempts) => {
    if (!exportFile) throw new Error('SESSION');
    exportFile.write(JSON.stringify(capture(rows, attempts), null, 2));
    recoveryFile.write(exportFile.name);
  },
  execute: async (sample, describe) => {
    active(); if (runner.interrupted) throw new Error('CANCELLED');
    const source = photo(sample);
    const metadata = jpegMetadata(await verified(source, sample.source_sha256));
    // Decode EXIF once and save an upright, full-resolution PNG. No resize/crop or lossy re-encode.
    // ML Kit receives this orientation-free raster on both platforms, not the original EXIF JPEG.
    const decoded = await Manipulator.manipulateAsync(source.uri, [], { format: Manipulator.SaveFormat.PNG })
      .catch(() => { throw new Error('DECODE'); });
    const info: Record<string, unknown> = { source_jpeg: metadata, decoded_pixels: { width: decoded.width, height: decoded.height },
      operation: 'expo-image-manipulator EXIF decode to upright PNG; no resize; no crop', output_format: 'PNG' };
    describe(JSON.stringify(info));
    try {
      active(); if (runner.interrupted) throw new Error('CANCELLED');
      const expectedW = metadata.orientation >= 5 ? metadata.height : metadata.width;
      const expectedH = metadata.orientation >= 5 ? metadata.width : metadata.height;
      if (decoded.width !== expectedW || decoded.height !== expectedH) throw new Error('DECODE_SIZE');
      const lines = await recognizeMenuLines(decoded.uri, decoded.width, decoded.height, {
        diagnostics: false, onGeometry: geometry => { info.normalization = geometry; },
      }).catch(() => { throw new Error('NATIVE_OCR'); });
      return { lines, preprocessing: JSON.stringify(info) };
    } finally { new File(decoded.uri).delete(); }
  },
});
export async function exportCapture(): Promise<void> {
  if (!exportFile?.exists || runner.busy || state.downloading) throw new Error('BUSY_OR_EMPTY');
  // A partial snapshot is explicitly saved for recovery but is never presented as an ingest-ready capture.
  await Share.open({ url: exportFile.uri, type: 'application/json', failOnCancel: false });
}
