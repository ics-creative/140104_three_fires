import { ClusteredLighting } from "three/addons/lighting/ClusteredLighting.js";
import { Inspector } from "three/addons/inspector/Inspector.js";
import * as ColorSpaces from "three/addons/math/ColorSpaces.js";
import * as THREE from "three/webgpu";

/**
 * [最大ライト数,タイル1辺のpx数,奥行き分割数,1区画のライト上限]。すべて1以上の整数。
 * 最大ライト数は実際のライト数以上、区画上限は最大ライト数以下にする。区画を細かくすると判定は正確になるが処理が増える。
 * 各区画では上限数までのライトを使う。
 */
const CLUSTER_OPTIONS = [128, 128, 16, 104] as const;
/** 指定したcanvasへ、HDRとクラスターライティングを使うWebGPUレンダラーを作る。 */
export function createRenderer(canvas: HTMLCanvasElement) {
  // Extended sRGBの変換方法をThree.jsへ登録する。
  THREE.ColorManagement.define({
    [ColorSpaces.ExtendedSRGBColorSpace]: ColorSpaces.ExtendedSRGBColorSpaceImpl,
  });

  const renderer = new THREE.WebGPURenderer({
    canvas,
    // canvasを不透明で作る。
    alpha: false,
    // 16ビット浮動小数点の描画バッファで、1を超える明るさを保持する。
    outputType: THREE.HalfFloatType,
  });

  // Extended sRGBでHDR画面へ出力する。
  renderer.outputColorSpace = ColorSpaces.ExtendedSRGBColorSpace;
  // 画面を区画化し、各画素に近いライトを割り当てる。
  renderer.lighting = new ClusteredLighting(...CLUSTER_OPTIONS);

  // InspectorでFPSとGPU時間を表示する。
  renderer.inspector = new Inspector();
  return renderer;
}
