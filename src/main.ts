import * as THREE from "three/webgpu";
import { createFireField } from "./fire/fire-field";
import { createCameraController } from "./scene/camera-controller";
import { createFloor } from "./scene/floor";
import { createSceneRenderPipeline } from "./scene/render-pipeline";
import { createSceneRenderer, resizeRenderer } from "./scene/renderer";
import { loadSceneTextures } from "./scene/textures";
import { setupWireframeToggle } from "./scene/wireframe-toggle";
import "./styles.css";

/** 霧を始める距離と、完全にする距離。3D空間で0以上、nearはfar未満にする。 */
const FOG_NEAR_DISTANCE = 1_000;
const FOG_FAR_DISTANCE = 8_000;

/** カメラが縦に見渡す角度。度数で0より大きく180未満にする。 */
const CAMERA_FIELD_OF_VIEW_DEGREES = 70;

/** 描画する手前と奥の距離。nearは0より大きく、farはnearより大きくする。 */
const CAMERA_NEAR_DISTANCE = 20;
const CAMERA_FAR_DISTANCE = 20_000;

/** 床全体へ回す光の色。RGBは0以上で、0ならその色なし、1超ならHDR。 */
const FLOOR_LIGHT_COLOR = new THREE.Color().setRGB(0.6, 0.2, 0);

/** 上から床へ当てる光の強さ。0以上。0なら消灯し、決まった上限はない。 */
const FLOOR_LIGHT_INTENSITY = 1.4;

/** 床の暗い部分を持ち上げる光の強さ。0以上。0なら消灯し、決まった上限はない。 */
const FLOOR_AMBIENT_LIGHT_INTENSITY = 0.7;

/** 1フレームでカメラと粒を進める上限秒数。0より大きくする。0なら時間更新が止まる。 */
const MAX_FRAME_DELTA_SECONDS = 0.05;

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const wireframeToggle = document.querySelector<HTMLInputElement>("#wireframe-toggle")!;
const renderer = createSceneRenderer(canvas);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, FOG_NEAR_DISTANCE, FOG_FAR_DISTANCE);

const camera = new THREE.PerspectiveCamera(
  CAMERA_FIELD_OF_VIEW_DEGREES,
  1,
  CAMERA_NEAR_DISTANCE,
  CAMERA_FAR_DISTANCE,
);
const updateCameraPosition = createCameraController(camera, canvas);

const sceneTextures = loadSceneTextures();
scene.add(createFloor(sceneTextures));

const floorLight = new THREE.DirectionalLight(FLOOR_LIGHT_COLOR, FLOOR_LIGHT_INTENSITY);
floorLight.position.set(0, 1_000, -100);
const floorAmbientLight = new THREE.AmbientLight(FLOOR_LIGHT_COLOR, FLOOR_AMBIENT_LIGHT_INTENSITY);
scene.add(floorLight, floorAmbientLight);

const updateFireField = createFireField(scene, camera, {
  particleTextures: sceneTextures.fireParticles,
  sourceFlareTexture: sceneTextures.fireFlare,
  nearFlareTexture: sceneTextures.nearFireFlare,
});
setupWireframeToggle(scene, wireframeToggle);
const renderPipeline = createSceneRenderPipeline(renderer, scene, camera);
const frameTimer = new THREE.Timer();

function resizeViewport() {
  resizeRenderer(renderer, camera, window.innerWidth, window.innerHeight, window.devicePixelRatio);
}

function renderFrame() {
  frameTimer.update();
  const deltaSeconds = Math.min(frameTimer.getDelta(), MAX_FRAME_DELTA_SECONDS);

  updateCameraPosition(deltaSeconds);

  // フレアの向きと距離判定に今のカメラ行列を使うため、炎より先に更新する。
  camera.updateMatrixWorld();
  updateFireField(deltaSeconds);
  renderPipeline.render();
}

resizeViewport();
window.addEventListener("resize", resizeViewport);
await renderer.setAnimationLoop(renderFrame);
