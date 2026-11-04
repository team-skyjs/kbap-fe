import { createHash } from 'crypto';
import { AppState } from 'react-native';
const mockFiles = new Map<string, Uint8Array>();
const mockBytes = Uint8Array.from([255, 216, 255, 217]);
const mockHash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const mockManifest = JSON.stringify({ protocol_version: 'kbap-mlkit-capture-v1', samples: Array.from({ length: 32 }, (_, i) => {
  const id = `ocr-v2-${String(i + 1).padStart(3, '0')}`;
  return { sample_id: id, path: `images/${id}.jpg`, source_sha256: createHash('sha256').update(Uint8Array.from([255,216,255,217])).digest('hex') };
}) });
jest.mock('../protocol', () => ({ ...jest.requireActual('../protocol'),
  MANIFEST_SHA: jest.requireActual<typeof import('crypto')>('crypto').createHash('sha256').update(mockManifest).digest('hex') }));
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///test' },
  Directory: class { uri: string; constructor(...p: string[]) { this.uri = p.join('/'); } create() {} },
  File: class {
    static pickFileAsync = jest.fn();
    uri: string;
    constructor(...p: (string | { uri: string })[]) { this.uri = p.map(x => typeof x === 'string' ? x : x.uri).join('/'); }
    get exists() { return mockFiles.has(this.uri); }
    get name() { return this.uri.split('/').pop(); }
    write(data: string | Uint8Array) { mockFiles.set(this.uri, typeof data === 'string' ? Buffer.from(data) : data); }
    delete() { mockFiles.delete(this.uri); }
    async bytes() { if (!mockFiles.has(this.uri)) throw new Error('missing'); return mockFiles.get(this.uri); }
    async text() { return Buffer.from(mockFiles.get(this.uri)!).toString(); }
  },
}));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'sha256' }, digest: async (_a: string, b: Uint8Array) => {
  const hash = jest.requireActual<typeof import('crypto')>('crypto').createHash('sha256').update(b).digest();
  return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
} }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-application', () => ({}));
jest.mock('react-native-share', () => ({}));
jest.mock('@/lib/scan/ocr', () => ({}));
jest.mock('@/lib/deviceInfo', () => ({}));
// Import after hoisted mocks; synthetic bytes test IO only, never native OCR quality.
const native = jest.requireActual('../native') as typeof import('../native');
beforeEach(() => {
  mockFiles.clear(); native.state.manifest = null; AppState.currentState = 'active';
  global.fetch = jest.fn(async (url: string) => ({ ok: true, url,
    arrayBuffer: async () => url.endsWith('manifest.json') ? Buffer.from(mockManifest) : mockBytes })) as unknown as typeof fetch;
});
it('downloads exactly the pinned manifest +32 original files and loads them offline', async () => {
  await native.prepare('127.0.0.1', () => {});
  expect(global.fetch).toHaveBeenCalledTimes(33);
  expect(native.state.manifest?.samples).toHaveLength(32);
  (global.fetch as jest.Mock).mockClear();
  await native.loadLocal(); expect(global.fetch).not.toHaveBeenCalled();
  expect(mockHash(mockFiles.get('file:///test/mlkit-collector-v1/ocr-v2-001.jpg')!)).toBe(mockHash(mockBytes));
});
it('rejects changed manifest and photo bytes instead of matching only filenames', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, arrayBuffer: async () => Buffer.from('{}') });
  await expect(native.prepare('127.0.0.1', () => {})).rejects.toThrow('MANIFEST_HASH');
  (global.fetch as jest.Mock).mockImplementation(async (url: string) => ({ ok: true, url,
    arrayBuffer: async () => url.endsWith('manifest.json') ? Buffer.from(mockManifest) : Buffer.from('changed') }));
  await expect(native.prepare('127.0.0.1', () => {})).rejects.toThrow('IMAGE_HASH');
  expect(native.state.manifest).toBeNull();
});
it('rejects cached corruption and redirected fixture responses', async () => {
  await native.prepare('127.0.0.1', () => {});
  mockFiles.set('file:///test/mlkit-collector-v1/ocr-v2-001.jpg', Buffer.from('wrong'));
  await expect(native.loadLocal()).rejects.toThrow('HASH');
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, url: 'https://example.com/manifest.json' });
  await expect(native.prepare('127.0.0.1', () => {})).rejects.toThrow('DOWNLOAD');
});

it('file picker cancellation, denied access and missing selections never prepare a bundle', async () => {
  const { File } = jest.requireMock('expo-file-system');
  File.pickFileAsync.mockResolvedValueOnce({ canceled: true });
  await expect(native.importFiles(() => {})).rejects.toThrow('CANCELLED');
  File.pickFileAsync.mockRejectedValueOnce(new Error('Permission denied'));
  await expect(native.importFiles(() => {})).rejects.toThrow('Permission denied');
  File.pickFileAsync.mockResolvedValueOnce({ canceled: false, result: [] });
  await expect(native.importFiles(() => {})).rejects.toThrow('FILES');
  expect(native.state.manifest).toBeNull();
  expect(native.state.downloading).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});
