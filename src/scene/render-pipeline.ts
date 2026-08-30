import * as THREE from "three";
import { max, pass, renderOutput, vec3, vec4 } from "three/tsl";
import { RenderPipeline, WebGPURenderer } from "three/webgpu";

interface ScalarNode {
  sub(value: number): ScalarNode;
  max(value: number): ScalarNode;
  mul(value: number): ScalarNode;
  min(value: number): ScalarNode;
}

interface VectorNode {
  add(value: VectorNode): VectorNode;
}

interface ColorNode {
  readonly r: ScalarNode;
  readonly g: ScalarNode;
  readonly b: ScalarNode;
  readonly a: ScalarNode;
  readonly rgb: VectorNode;
}

// TSLの型は演算をつなぐと計算量が急増するため、ここで使う形だけに絞る。
const findMaximum = max as unknown as (...values: ScalarNode[]) => ScalarNode;
const createVector3 = vec3 as unknown as (value: ScalarNode) => VectorNode;
const createVector4 = vec4 as unknown as (
  rgb: VectorNode,
  alpha: ScalarNode,
) => NonNullable<RenderPipeline["outputNode"]>;

/** HDRとして残し始める明るさ。0以上。1なら通常の白を超えた部分だけを使う。 */
const HDR_HIGHLIGHT_THRESHOLD = 2;

/** 白いHDR光へ掛ける強さ。0以上。0ならHDR光を足さない。 */
const HDR_HIGHLIGHT_GAIN = 0.2;

/** 足し戻すHDR光の上限。0以上。大きいほど眩しくなるが、画面ごとの差も出やすい。 */
const HDR_HIGHLIGHT_MAX = 0.5;

/**
 * 炎の基本色を通常の表示範囲へ収め、白熱部分だけをHDRとして描く。
 * HDR部分を白に揃えることで、画面のHDR特性が違っても炎の色相を保つ。
 */
export function createSceneRenderPipeline(
  renderer: WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) {
  const renderPipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { type: THREE.HalfFloatType });
  const sceneColor = scenePass.getTextureNode("output");

  // 基本画は色ごとの値を0〜1へ収め、ブラウザーへ同じ色を渡す。
  const displayColor = renderOutput(sceneColor, THREE.LinearToneMapping) as unknown as ColorNode;

  // 圧縮前に白を超えていた量だけを取り出し、色の偏りがないHDR光へ変える。
  const extendedColor = renderOutput(sceneColor, THREE.NoToneMapping) as unknown as ColorNode;
  const sourcePeak = findMaximum(extendedColor.r, extendedColor.g, extendedColor.b);
  const hdrBrightness = sourcePeak
    .sub(HDR_HIGHLIGHT_THRESHOLD)
    .max(0)
    .mul(HDR_HIGHLIGHT_GAIN)
    .min(HDR_HIGHLIGHT_MAX);
  const hdrHighlight = createVector3(hdrBrightness);

  // 上の2つで色変換を済ませているため、自動の色変換は重ねない。
  renderPipeline.outputColorTransform = false;
  renderPipeline.outputNode = createVector4(displayColor.rgb.add(hdrHighlight), displayColor.a);
  return renderPipeline;
}
