import * as THREE from "three/webgpu";
import { createFireField } from "./fire/fire-field";
import { createCameraController } from "./scene/camera-controller";
import { createFloor } from "./scene/floor";
import { createRenderPipeline } from "./scene/render-pipeline";
import { createRenderer } from "./scene/renderer";
import { loadTextures } from "./scene/textures";
import "./styles.css";

/** 床用ライトの色。RGB各成分は0以上で、1を超える値はHDRの高輝度として扱う。 */
const COLOR_FLOOR_LIGHT = new THREE.Color().setRGB(0.6, 0.2, 0);
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const renderer = createRenderer(canvas);

const scene = new THREE.Scene();
// Fogの開始距離は1,000、終了距離は8,000。
scene.fog = new THREE.Fog(0x000000, 1_000, 8_000);
// 縦方向の視野角は70度。nearは20、farは20,000。
const camera = new THREE.PerspectiveCamera(70, 1, 20, 20_000);
const updateCamera = createCameraController(camera, canvas);

const textures = loadTextures();
scene.add(createFloor(textures));

// 平行光で床の反射を作り、環境光で影側へ赤みを加える。
const lightFloor = new THREE.DirectionalLight(COLOR_FLOOR_LIGHT, 1.4);
lightFloor.position.set(0, 1_000, -100);
scene.add(lightFloor, new THREE.AmbientLight(COLOR_FLOOR_LIGHT, 0.7));

const updateFire = createFireField(scene, camera, textures);
const inputWireframe = document.querySelector<HTMLInputElement>("#wireframe-toggle")!;
inputWireframe.addEventListener("change", () => {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    // 床はMeshPhongMaterial、粒とフレアはMeshBasicMaterial。
    Object.assign(object.material, { wireframe: inputWireframe.checked, needsUpdate: true });
  });
});
const pipeline = createRenderPipeline(renderer, scene, camera);
const timer = new THREE.Timer();

/** ウィンドウサイズとdevicePixelRatioをカメラとcanvasに反映する。 */
function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
  timer.update();
  // 1フレームの経過時間は最大0.05秒。タブ復帰時の移動量を抑える。
  const secDelta = Math.min(timer.getDelta(), 0.05);

  updateCamera(secDelta);
  // カメラ行列の更新後にフレアの向きと距離を計算する。
  camera.updateMatrixWorld();
  updateFire(secDelta);
  pipeline.render();
}
resize();
window.addEventListener("resize", resize);
await renderer.setAnimationLoop(render);
