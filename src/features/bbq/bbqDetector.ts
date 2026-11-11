/**
 * KB-1019 장면 1: 자체 모델 v1(.pte, 앱 자산) 로드 + 프레임 워크릿 실행.
 * executorch 내장 탐지 훅은 출력 3개(boxes·scores·classes)를 요구해 단일 출력 모델을 못 받는다 —
 * 같은 저수준 API(loadModel·tensor·execute·cv 전처리)로 직접 조립한다. 모델 파일은 AGPL 계열, 시연 브랜치 전용.
 * 백엔드 2종(P-637): coreml = et_coreml_o2o (1,8400,14) · xnnpack = et_xnnpack_e2e (1,300,6).
 */
import { Asset } from 'expo-asset';
import { loadModel, tensor, wrapAsync } from 'react-native-executorch';
import { createImagePreprocessor, type ImageBuffer } from 'react-native-executorch/cv';
import { OUTPUT_SHAPE, TUNING, decode, fileUriToPath, postprocess, topScore, type Det, type ModelKind } from './bbqModel';

// 자산 모듈 id는 require로만 얻는다(Metro 자산)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const COREML = require('../../../assets/models/bbq_v3_coreml_o2o.pte') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XNNPACK = require('../../../assets/models/bbq_v3_xnnpack_e2e.pte') as number;
export type BbqBackend = 'coreml' | 'xnnpack';
export const BBQ_MODELS: Record<BbqBackend, { module: number; kind: ModelKind }> = {
  coreml: { module: COREML, kind: 'o2o' },
  xnnpack: { module: XNNPACK, kind: 'e2e' },
};
/** 가이드·쌈 코칭 기본 = Core ML */
export const BBQ_MODEL = COREML;

/** at = 워크릿 런타임 단조 시각(ms). diag = 측정 화면 진단(입력·출력 모양, 최고 점수·클래스, 임계값 통과 수) */
export type BbqRun = {
  dets: Det[];
  inferMs: number;
  postMs: number;
  at: number;
  diag: { inShape: string; outShape: string; top: number; topCls: number; pass: number };
};
export type BbqDetector = { dispose: () => void; loadMs: number; kind: ModelKind; run: (input: ImageBuffer) => BbqRun };

export async function createBbqDetector(cfg: { module: number; kind?: ModelKind; attempt?: number }): Promise<BbqDetector> {
  const kind: ModelKind = cfg.kind ?? 'o2o';
  const t0 = Date.now();
  const [asset] = await Asset.loadAsync(cfg.module);
  const uri = asset?.localUri ?? asset?.uri ?? '';
  const model = await wrapAsync(loadModel)(fileUriToPath(uri)); // P-636: 인코딩된 file URL 그대로면 AccessFailed
  const shape = OUTPUT_SHAPE[kind];
  const numel = shape[0] * shape[1] * shape[2];
  const out = tensor('float32', [...shape]);
  const pre = createImagePreprocessor(
    { resizeMode: 'letterbox', interpolation: 'linear', normalizeOpts: { alpha: 1 / 255, beta: 0 }, padValue: TUNING.padValue },
    [1, 3, TUNING.input, TUNING.input],
  );
  const loadMs = Date.now() - t0;
  const outShape = shape.join('x');
  const thresholds = TUNING.thresholds;

  // 워크릿: 기본 인자·매개변수 스코프에서 클로저 값을 읽지 않는다(P-637 — 플러그인 회귀 유닛이 잠금)
  const run = (input: ImageBuffer): BbqRun => {
    'worklet';
    const now = () => globalThis.performance?.now?.() ?? Date.now();
    const a = now();
    const tIn = pre.process(input);
    model.execute('forward', [tIn], [out]);
    const b = now();
    const data = out.getData(new Float32Array(numel));
    const dets = postprocess(kind, data, input.width, input.height);
    const at = now();
    const top = topScore(kind, data);
    return {
      dets,
      inferMs: b - a,
      postMs: at - b,
      at,
      diag: { inShape: `${input.width}x${input.height}>${tIn.shape.join('x')}`, outShape, top: top.score, topCls: top.cls, pass: decode(kind, data, thresholds).length },
    };
  };

  const dispose = () => {
    pre.dispose();
    out.dispose();
    model.dispose();
  };
  return { dispose, loadMs, kind, run };
}
