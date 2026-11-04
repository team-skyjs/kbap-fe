import { validateLines, type Sample, type CaptureRow } from './protocol';
import type { OcrLine } from '@/lib/scan/ocr';

const failureCode = (error: unknown): string => {
  const code = error instanceof Error ? error.message : '';
  return ['HASH', 'JPEG', 'EXIF', 'DECODE_SIZE', 'BACKGROUND', 'CANCELLED', 'FILE_PERMISSION', 'FILE_READ', 'DECODE', 'NATIVE_OCR'].includes(code)
    ? code : 'OCR_OR_FILE_ERROR';
};

type Output = { lines: OcrLine[]; preprocessing: string };
export type Attempt = CaptureRow & { session_id: string; sequence: number; started_at: string; execution_order: 'first_in_session' | 'subsequent_in_session' };
type Dependencies = {
  execute: (sample: Sample, describe: (s: string) => void) => Promise<Output>;
  save: (rows: CaptureRow[], attempts: Attempt[]) => Promise<void>;
  now: () => number;
  timeoutMs?: number;
};
/** A timeout stops scheduling, not native work. busy remains true until native settles. */
export class CollectorRunner {
  busy = false;
  rows = new Map<string, CaptureRow>();
  attempts: Attempt[] = [];
  private stopped: string | null = null;
  private sessionCount = 0;
  private sessionId = new Date().toISOString();
  private interrupt: ((reason: string) => void) | null = null;
  constructor(private deps: Dependencies) {}
  get interrupted() { return this.stopped !== null; }
  cancel(reason = 'CANCELLED') { this.stopped = reason; this.interrupt?.(reason); }
  async run(samples: Sample[], changed: () => void): Promise<void> {
    if (this.busy) throw new Error('BUSY');
    this.busy = true; this.stopped = null; changed();
    try {
      for (const sample of samples) {
        if (this.stopped) break;
        const start = this.deps.now();
        const startedAt = new Date().toISOString();
        let preprocessing = 'Preparation did not finish; native OCR may not have started.';
        let timer: ReturnType<typeof setTimeout> | undefined;
        const interrupted = new Promise<{ error: string }>(resolve => {
          this.interrupt = reason => resolve({ error: reason });
          timer = setTimeout(() => this.cancel('TIMEOUT'), this.deps.timeoutMs ?? 60000);
        });
        // Handle all rejections immediately, including late native failures after cancellation.
        const work = Promise.resolve().then(() => this.deps.execute(sample, s => { preprocessing = s; }))
          .then(output => ({ output }), error => ({ error: failureCode(error) }));
        const outcome = await Promise.race([work, interrupted]);
        if (timer) clearTimeout(timer);
        this.interrupt = null;
        let row: CaptureRow = { sample_id: sample.sample_id, source_sha256: sample.source_sha256,
          status: 'error', error_code: 'OCR_OR_FILE_ERROR', elapsed_ms: Math.max(0, this.deps.now() - start), preprocessing, lines: [] };
        if ('output' in outcome) {
          try {
            row = { ...row, status: 'ok', preprocessing: outcome.output.preprocessing, lines: validateLines(outcome.output.lines) };
            delete row.error_code;
          } catch { row.error_code = 'GEOMETRY'; }
        } else { row.error_code = outcome.error; }
        this.rows.set(sample.sample_id, row);
        this.attempts.push({ ...row, session_id: this.sessionId, sequence: this.attempts.length + 1, started_at: startedAt,
          execution_order: this.sessionCount++ === 0 ? 'first_in_session' : 'subsequent_in_session' });
        changed();
        try { await this.deps.save([...this.rows.values()], this.attempts); }
        finally { await work; } // Keep serialization even if local persistence fails.
      }
    } finally { this.busy = false; this.interrupt = null; changed(); }
  }
}
