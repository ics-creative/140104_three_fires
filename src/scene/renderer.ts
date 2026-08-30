import { ClusteredLighting } from "three/addons/lighting/ClusteredLighting.js";
import { Inspector } from "three/addons/inspector/Inspector.js";
import {
  ExtendedSRGBColorSpace,
  ExtendedSRGBColorSpaceImpl,
} from "three/addons/math/ColorSpaces.js";
import * as THREE from "three/webgpu";

/** 同時に扱える点光源の総数。1以上の整数で、実際に作る点光源数以上にする。 */
const MAX_CLUSTERED_LIGHTS = 128;

/** 画面をライト用に分ける正方形の一辺。描画画素で1以上の整数。小さいほど処理が増える。 */
const LIGHT_CLUSTER_TILE_SIZE = 128;

/** 奥行きを分ける区画数。1以上の整数。1なら奥行きで分けず、増やすほど処理が増える。 */
const LIGHT_CLUSTER_DEPTH_SLICES = 16;

/** 1区画で扱える点光源数。1以上、総数以下の整数。容量を超えた光はその区画で欠ける。 */
const MAX_LIGHTS_PER_CLUSTER = 104;

/** 指定したcanvasへ、HDRとクラスターライティングを使うWebGPUレンダラーを作る。 */
export function createSceneRenderer(canvas: HTMLCanvasElement) {
  // 白より明るい値をHDR画面へ渡せる色空間をThree.jsへ登録する。
  THREE.ColorManagement.define({
    [ExtendedSRGBColorSpace]: ExtendedSRGBColorSpaceImpl,
  });

  const renderer = new THREE.WebGPURenderer({
    canvas,
    // canvasをほかの画面と透過合成しない。
    alpha: false,
    // 各色を16bit浮動小数点で持ち、炎の重なった明るさを白で切らない。
    outputType: THREE.HalfFloatType,
  });

  // 白より明るい値を、対応するHDR画面へ渡す。
  renderer.outputColorSpace = ExtendedSRGBColorSpace;

  // 近くにあるライトだけを区画ごとに調べ、全ライトの計算を毎画素で行わない。
  renderer.lighting = new ClusteredLighting(
    MAX_CLUSTERED_LIGHTS,
    LIGHT_CLUSTER_TILE_SIZE,
    LIGHT_CLUSTER_DEPTH_SLICES,
    MAX_LIGHTS_PER_CLUSTER,
  );

  // Inspectorを最後に設定する。設定時にレンダラーの準備が始まるため順番が重要。
  renderer.inspector = new Inspector();
  return renderer;
}

/**
 * カメラと描画領域を画面サイズへ合わせる。
 * 幅と高さは画面上のpxで、0以下なら1pxにする。devicePixelRatioは0より大きくする。
 * devicePixelRatioが1なら等倍で、大きいほど描画画素と処理量が増える。上限補正はしない。
 */
export function resizeRenderer(
  renderer: THREE.WebGPURenderer,
  camera: THREE.PerspectiveCamera,
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number,
) {
  const width = Math.max(viewportWidth, 1);
  const height = Math.max(viewportHeight, 1);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(width, height);
}
