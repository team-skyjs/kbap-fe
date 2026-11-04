import { allowed, fixtureOrigin, parseManifest, jpegMetadata, validateLines, PROTOCOL } from '../protocol';
import { CollectorRunner } from '../runner';
const sample = { sample_id: 'ocr-v2-001', path: 'images/ocr-v2-001.jpg', source_sha256: 'a'.repeat(64) };
const fixtures = Array.from({ length: 32 }, (_, i) => {
  const id = `ocr-v2-${String(i + 1).padStart(3, '0')}`;
  return { ...sample, sample_id: id, path: `images/${id}.jpg` };
});
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
it.each(['production', 'preview', 'unknown'])('blocks %s even with development flag', channel => {
  expect(allowed(channel, true, 'https://dev.kbap.site')).toBe(false);
});
it('requires explicit dev backend and development/teamtest', () => {
  expect(allowed('teamtest', false, 'https://dev.kbap.site')).toBe(true);
  expect(allowed('development', false, 'https://dev.kbap.site')).toBe(true);
  expect(allowed(null, true, 'https://dev.kbap.site')).toBe(true);
  expect(allowed(null, false, 'https://dev.kbap.site')).toBe(false);
  expect(allowed('teamtest', true, 'https://prod.kbap.site')).toBe(false);
});
it.each(['example.com', '8.8.8.8', '169.254.169.254', '127.0.0.1:80', 'user@127.0.0.1', '127.0.0.1/x', '127.00.0.1', '192.168.1.999'])('rejects host %s', host => {
  expect(() => fixtureOrigin(host)).toThrow();
});
it('accepts explicit LAN host only on fixture port', () => expect(fixtureOrigin('192.168.1.20')).toBe('http://192.168.1.20:8878'));
it('rejects missing/duplicate/traversal manifests', () => {
  const parse = (samples: unknown[]) => parseManifest(JSON.stringify({ protocol_version: PROTOCOL, samples }));
  expect(parse(fixtures).samples).toHaveLength(32);
  expect(() => parse(fixtures.slice(1))).toThrow();
  expect(() => parse([fixtures[1], ...fixtures.slice(1)])).toThrow();
  expect(() => parse([{ ...sample, path: '../private-labels.json' }, ...fixtures.slice(1)])).toThrow();
});
it('reads actual JPEG size and rejects non-JPEG', () => {
  expect(jpegMetadata(Uint8Array.from([255,216,255,192,0,11,8,0,100,0,200,1,1,17,0,255,217])))
    .toEqual({ width: 200, height: 100, orientation: 1 });
  expect(() => jpegMetadata(new Uint8Array(20))).toThrow();
});
it('rejects invented confidence, invalid geometry and nonfinite coordinates', () => {
  const line = { text: 'text', box: { x: 0, y: 0, width: 1, height: 1 } };
  expect(validateLines([line])).toEqual([line]);
  expect(() => validateLines([{ ...line, confidence: 1 } as typeof line])).toThrow();
  expect(() => validateLines([{ ...line, box: { ...line.box, x: .5 } }])).toThrow();
  expect(() => validateLines([{ ...line, box: { ...line.box, x: NaN } }])).toThrow();
});
it('keeps native lock after timeout and persists explicit error before drain', async () => {
  jest.useFakeTimers();
  let finish!: (v: { lines: []; preprocessing: string }) => void;
  const execute = jest.fn(() => new Promise<{ lines: []; preprocessing: string }>(r => { finish = r; }));
  const save = jest.fn(async () => {});
  const runner = new CollectorRunner({ execute, save, now: () => performance.now(), timeoutMs: 50 });
  const running = runner.run(fixtures, () => {}); await flush();
  jest.advanceTimersByTime(51); await flush();
  expect(runner.rows.get(sample.sample_id)?.error_code).toBe('TIMEOUT');
  expect(save).toHaveBeenCalledTimes(1);
  expect(runner.busy).toBe(true);
  await expect(runner.run(fixtures, () => {})).rejects.toThrow('BUSY');
  finish({ lines: [], preprocessing: 'decoded' }); await running;
  expect(execute).toHaveBeenCalledTimes(1);
  expect(runner.busy).toBe(false);
  expect(runner.rows.get(sample.sample_id)?.status).toBe('error');
  jest.useRealTimers();
});
it.each(['CANCELLED', 'BACKGROUND'])('preserves %s and retries to one final row with attempt history', async reason => {
  let finish!: () => void;
  let pending = true;
  const runner = new CollectorRunner({ now: () => 10, save: async () => {}, execute: async () => {
    if (pending) await new Promise<void>(r => { finish = r; });
    return { lines: [], preprocessing: 'upright pixels' };
  } });
  const running = runner.run([sample], () => {}); await flush();
  runner.cancel(reason); await flush(); finish(); await running;
  expect(runner.rows.get(sample.sample_id)?.error_code).toBe(reason);
  pending = false; await runner.run([sample], () => {});
  expect(runner.rows.size).toBe(1); expect(runner.attempts).toHaveLength(2);
  expect(runner.rows.get(sample.sample_id)).toMatchObject({ status: 'ok', lines: [] });
});
it('records native rejection separately from successful empty OCR and proceeds', async () => {
  const runner = new CollectorRunner({ now: () => 1, save: async () => {}, execute: async s => {
    if (s.sample_id === sample.sample_id) throw new Error('private native path');
    return { lines: [], preprocessing: 'decoded' };
  } });
  await runner.run(fixtures.slice(0, 2), () => {});
  expect([...runner.rows.values()].map(r => r.status)).toEqual(['error', 'ok']);
  expect(JSON.stringify(runner.attempts)).not.toContain('private native path');
});
it('keeps permission failures explicit without exporting native paths', async () => {
  const runner = new CollectorRunner({ now: () => 1, save: async () => {}, execute: async () => { throw new Error('FILE_PERMISSION'); } });
  await runner.run([sample], () => {});
  expect(runner.rows.get(sample.sample_id)).toMatchObject({ status: 'error', error_code: 'FILE_PERMISSION', lines: [] });
});
