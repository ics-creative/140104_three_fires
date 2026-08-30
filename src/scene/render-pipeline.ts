import * as THREE from "three/webgpu";
import { max, pass, renderOutput, vec3, vec4 } from "three/tsl";

interface TslNode extends Readonly<Record<"r" | "g" | "b" | "a" | "rgb", TslNode>> {
  sub(value: number): TslNode;
  max(value: number): TslNode;
  mul(value: number): TslNode;
  min(value: number): TslNode;
  add(value: TslNode): TslNode;
}
// TslNodeには、このファイルで使うTSLメソッドを定義する。TypeScriptが展開する型の量が減る。
const tslMax = max as unknown as (...values: TslNode[]) => TslNode;
const tslVec3 = vec3 as unknown as (value: TslNode) => TslNode;
const tslVec4 = vec4 as unknown as (rgb: TslNode, alpha: TslNode) => THREE.Node;
/**
 * HDRハイライトのしきい値、倍率、加算上限。すべて0以上。
 * thresholdを上げると対象が狭くなる。gainは加算倍率、maxは加算値の上限。
 */
const HDR_BOOST = { threshold: 2, gain: 0.2, max: 0.5 } as const;
/** 基本色を0〜1へ圧縮し、しきい値の超過量をRGB各成分へ加算する。 */
export function createRenderPipeline(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const colorScene = pass(scene, camera, { type: THREE.HalfFloatType }).getTextureNode("output");
  // LinearToneMappingで基本色を0〜1へ圧縮する。
  const colorDisplay = renderOutput(colorScene, THREE.LinearToneMapping) as unknown as TslNode;

  // NoToneMappingのRGB最大値からthreshold超過量を求め、RGB各成分へ同じ値を加算する。
  const colorHDR = renderOutput(colorScene, THREE.NoToneMapping) as unknown as TslNode;
  const levelHighlight = tslMax(colorHDR.r, colorHDR.g, colorHDR.b)
    .sub(HDR_BOOST.threshold)
    .max(0)
    .mul(HDR_BOOST.gain)
    .min(HDR_BOOST.max);
  const colorHighlight = tslVec3(levelHighlight);

  // outputColorTransform=falseを設定し、outputNodeの計算結果を出力する。
  pipeline.outputColorTransform = false;
  pipeline.outputNode = tslVec4(colorDisplay.rgb.add(colorHighlight), colorDisplay.a);
  return pipeline;
}
