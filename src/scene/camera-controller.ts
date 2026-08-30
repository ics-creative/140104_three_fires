import { gsap } from "gsap/gsap-core";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three/webgpu";

/**
 * カメラ操作の設定。距離は0より大きく、distanceMin≦distanceStart≦distanceMaxにする。
 * 仰角は度で0≦degreeElevationMin≦degreeElevation≦degreeElevationMax≦90。開始演出は真上から始まる。
 * degreeDragPerPixelは大きいほど回転が速く、負数で左右が反転する。
 * heightScaleは0以上。1がOrbitControlsの球面軌道で、大きいほどカメラの高さが増える。
 * rateDampingは0より大きく、大きいほど早く止まる。
 * secIntroは0以上。大きいほど開始演出が長くなる。
 */
const CAMERA = {
  distanceStart: 1_000,
  distanceMin: 450,
  distanceMax: 2_500,
  degreeAzimuth: 45,
  degreeElevation: 5,
  degreeElevationMin: 0.5,
  degreeElevationMax: 30,
  degreeDragPerPixel: 0.4,
  heightScale: 2,
  rateDamping: -Math.log(20 / 21) * 60,
  secIntro: 2.4,
} as const;
/**
 * OrbitControlsで操作用カメラを回転させ、Y方向へheightScaleを掛けて描画用カメラへ反映する。
 * 返す更新関数には0以上の経過秒を渡す。
 */
export function createCameraController(
  camera: THREE.PerspectiveCamera,
  controlElement: HTMLElement,
) {
  const cameraOrbit = new THREE.PerspectiveCamera();
  cameraOrbit.position.setFromSphericalCoords(
    CAMERA.distanceStart,
    THREE.MathUtils.degToRad(90 - CAMERA.degreeElevation),
    THREE.MathUtils.degToRad(CAMERA.degreeAzimuth),
  );

  const controls = new OrbitControls(cameraOrbit, controlElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  // ホイール100px分の距離倍率をOrbitControlsのzoomSpeedへ換算する。
  controls.zoomSpeed = Math.log(1 / 1.2) / Math.log(0.95);
  controls.minDistance = CAMERA.distanceMin;
  controls.maxDistance = CAMERA.distanceMax;
  controls.minPolarAngle = THREE.MathUtils.degToRad(90 - CAMERA.degreeElevationMax);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(90 - CAMERA.degreeElevationMin);

  const positionIntro = new THREE.Vector3(0, CAMERA.distanceStart, 0);
  const stateIntro = { progress: 0 };
  const tweenIntro = gsap.to(stateIntro, {
    progress: 1,
    duration: CAMERA.secIntro,
    ease: "expo.out",
  });
  // 操作開始時にイントロ補間を終了する。
  controls.addEventListener("start", () => tweenIntro.progress(1).kill());
  let distanceDisplay: number = CAMERA.distanceStart;

  return (secDelta: number) => {
    // OrbitControlsのrotateSpeedをdegreeDragPerPixelに合わせる。
    controls.rotateSpeed = (CAMERA.degreeDragPerPixel * controlElement.clientHeight) / 360;
    controls.dampingFactor = 1 - Math.exp(-CAMERA.rateDamping * secDelta);
    controls.update();

    // ホイール後の距離をdampで補間する。
    distanceDisplay = THREE.MathUtils.damp(
      distanceDisplay,
      cameraOrbit.position.length(),
      CAMERA.rateDamping,
      secDelta,
    );
    camera.position
      .copy(positionIntro)
      .lerp(cameraOrbit.position, stateIntro.progress)
      .setLength(distanceDisplay);
    camera.position.y *= CAMERA.heightScale;
    camera.lookAt(0, 0, 0);
  };
}
