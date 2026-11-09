/**
 * KB-1019 장면 1: 자체 모델 v1(.pte, 앱 자산) 로드 + 프레임 워크릿 실행.
 * executorch 내장 탐지 훅은 출력 3개(boxes·scores·classes)를 요구해 (1, 8400, 14) 단일 출력 모델을 못 받는다 —
 * 같은 저수준 API(loadModel·tensor·execute·cv 전처리)로 직접 조립한다. 모델 파일은 AGPL 계열, 시연 브랜치 전용.
 */
import { Asset } from 'expo-asset';
import { loadModel, tensor, wrapAsync } from 'react-native-executorch';
import { createImagePreprocessor, type ImageBuffer } from 'react-native-executorch/cv';
import { TUNING, fileUriToPath, postprocess, type Det } from './bbqModel';

// 자산 모듈 id는 require로만 얻는다(Metro 자산)
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const BBQ_MODEL = require('../../../assets/models/bbq_v1_coreml_o2o.pte') as number;
const ROWS = 8400;
const COLS = 14;

/** at = 워크릿 런타임 단조 시각(ms) — 이름표 유지·다수결·불판 조건·FPS의 시계 */
export type BbqRun = { dets: Det[]; inferMs: number; postMs: number; at: number };
export type BbqDetector = { dispose: () => void; loadMs: number; run: (input: ImageBuffer) => BbqRun };

export async function createBbqDetector(cfg: { module: number; attempt?: number }): Promise<BbqDetector> {
  const t0 = Date.now();
  const [asset] = await Asset.loadAsync(cfg.module);
  const uri = asset?.localUri ?? asset?.uri ?? '';
  const model = await wrapAsync(loadModel)(fileUriToPath(uri)); // P-636: 인코딩된 file URL 그대로면 AccessFailed
  const out = tensor('float32', [1, ROWS, COLS]);
  const pre = createImagePreprocessor(
    { resizeMode: 'letterbox', interpolation: 'linear', normalizeOpts: { alpha: 1 / 255, beta: 0 }, padValue: TUNING.padValue },
    [1, 3, TUNING.input, TUNING.input],
  );
  const loadMs = Date.now() - t0;

  const run = (input: ImageBuffer): BbqRun => {
    'worklet';
    const now = () => globalThis.performance?.now?.() ?? Date.now();
    const a = now();
    model.execute('forward', [pre.process(input)], [out]);
    const b = now();
    const dets = postprocess(out.getData(new Float32Array(ROWS * COLS)), ROWS, COLS, input.width, input.height);
    const at = now();
    return { dets, inferMs: b - a, postMs: at - b, at };
  };

  const dispose = () => {
    pre.dispose();
    out.dispose();
    model.dispose();
  };
  return { dispose, loadMs, run };
}

