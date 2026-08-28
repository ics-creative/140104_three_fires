import * as THREE from "three/webgpu";

/** 炎の中心からカメラまでの開始距離。最短距離以上、最長距離以下にする。 */
const DEFAULT_CAMERA_DISTANCE = 1_000;

/** ホイールで近づける最短距離。3D空間で0より大きく、開始距離以下にする。 */
const MIN_CAMERA_DISTANCE = 450;

/** ホイールで遠ざかれる最長距離。3D空間で開始距離以上にする。 */
const MAX_CAMERA_DISTANCE = 2_500;

/** ホイールのdeltaYが100増えたときに距離へ掛ける倍率。1以上。1なら距離は変わらない。 */
const WHEEL_DISTANCE_MULTIPLIER_PER_100_PIXELS = 1.2;

/** カメラの高さへ掛ける倍率。0以上。1なら横方向と同じ比率になる。 */
const CAMERA_HEIGHT_SCALE = 2;

/** 開始時の横角度と上下角度。単位は度。 */
const INTRO_AZIMUTH_DEGREES = 0;
const INTRO_ELEVATION_DEGREES = 90;

/** 開始演出で目指す角度。横0度は+Z、90度は+X、上下0度は水平。 */
const DEFAULT_AZIMUTH_DEGREES = 45;
const DEFAULT_ELEVATION_DEGREES = 5;

/** 操作できる上下角度。0〜90度で、最小値は最大値以下にする。 */
const MIN_ELEVATION_DEGREES = 0.5;
const MAX_ELEVATION_DEGREES = 30;

/** マウスを1px動かしたときの角度。0より大きくする。0なら動かず、負数なら逆向き。 */
const DRAG_DEGREES_PER_PIXEL = 0.4;

/** 1フレーム後に残す角度差の割合。0より大きく1未満。1へ近いほどゆっくり止まる。 */
const DAMPING_REMAINING_RATIO = 20 / 21;

/** 減速の基準にするFPS。0より大きくする。実際のFPSが変わっても動きは変えない。 */
const DAMPING_REFERENCE_FPS = 60;

/** フレームレートに関係なく同じ減速になるよう直した、1秒あたりの減速率。 */
const CAMERA_DAMPING_RATE = -Math.log(DAMPING_REMAINING_RATIO) * DAMPING_REFERENCE_FPS;

/** 床より少し上を見て、中央の炎と飛ぶ火元を一緒に画面へ入れる注視点。 */
const CAMERA_LOOK_AT_POSITION = new THREE.Vector3();

/**
 * 左ドラッグとホイール操作をcontrolElementへ追加し、カメラを毎フレーム更新する関数を返す。
 * 返した関数には前フレームからの秒数を0以上で渡す。同じ要素では一度だけ作る。
 */
export function createCameraController(
  camera: THREE.PerspectiveCamera,
  controlElement: HTMLElement,
) {
  let currentAzimuthDegrees = INTRO_AZIMUTH_DEGREES;
  let currentElevationDegrees = INTRO_ELEVATION_DEGREES;
  let targetAzimuthDegrees = DEFAULT_AZIMUTH_DEGREES;
  let targetElevationDegrees = DEFAULT_ELEVATION_DEGREES;
  let currentDistance = DEFAULT_CAMERA_DISTANCE;
  let targetDistance = DEFAULT_CAMERA_DISTANCE;

  let activePointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartAzimuthDegrees = 0;
  let dragStartElevationDegrees = 0;

  controlElement.addEventListener("pointerdown", (event) => {
    if (activePointerId !== null || event.button !== 0) return;

    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;

    // 現在角度ではなく目標角度を動かすため、開始演出の途中でもすぐ操作できる。
    dragStartAzimuthDegrees = targetAzimuthDegrees;
    dragStartElevationDegrees = targetElevationDegrees;
    controlElement.setPointerCapture(event.pointerId);
  });

  controlElement.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;

    targetAzimuthDegrees =
      dragStartAzimuthDegrees - (event.clientX - dragStartX) * DRAG_DEGREES_PER_PIXEL;
    targetElevationDegrees = THREE.MathUtils.clamp(
      dragStartElevationDegrees + (event.clientY - dragStartY) * DRAG_DEGREES_PER_PIXEL,
      MIN_ELEVATION_DEGREES,
      MAX_ELEVATION_DEGREES,
    );
  });

  controlElement.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const distanceMultiplier = WHEEL_DISTANCE_MULTIPLIER_PER_100_PIXELS ** (event.deltaY / 100);
      targetDistance = THREE.MathUtils.clamp(
        targetDistance * distanceMultiplier,
        MIN_CAMERA_DISTANCE,
        MAX_CAMERA_DISTANCE,
      );
    },
    { passive: false },
  );

  const stopDragging = (event: PointerEvent) => {
    if (event.pointerId === activePointerId) activePointerId = null;
  };
  controlElement.addEventListener("pointerup", stopDragging);
  controlElement.addEventListener("pointercancel", stopDragging);

  return (deltaSeconds: number) => {
    currentAzimuthDegrees = THREE.MathUtils.damp(
      currentAzimuthDegrees,
      targetAzimuthDegrees,
      CAMERA_DAMPING_RATE,
      deltaSeconds,
    );
    currentElevationDegrees = THREE.MathUtils.damp(
      currentElevationDegrees,
      targetElevationDegrees,
      CAMERA_DAMPING_RATE,
      deltaSeconds,
    );
    currentDistance = THREE.MathUtils.damp(
      currentDistance,
      targetDistance,
      CAMERA_DAMPING_RATE,
      deltaSeconds,
    );

    // 横角度、上下角度、距離から、炎を中心に回るカメラの位置を求める。
    const azimuthRadians = THREE.MathUtils.degToRad(currentAzimuthDegrees);
    const elevationRadians = THREE.MathUtils.degToRad(currentElevationDegrees);
    const horizontalDistance = currentDistance * Math.cos(elevationRadians);
    camera.position.set(
      horizontalDistance * Math.sin(azimuthRadians),
      currentDistance * Math.sin(elevationRadians) * CAMERA_HEIGHT_SCALE,
      horizontalDistance * Math.cos(azimuthRadians),
    );
    camera.lookAt(CAMERA_LOOK_AT_POSITION);
  };
}
