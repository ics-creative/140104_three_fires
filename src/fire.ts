import { CustomBounce } from "gsap/CustomBounce";
import { CustomEase } from "gsap/CustomEase";
// 3Dの位置と炎の明るさだけを動かすため、GSAPの基本機能だけを読み込む。
import { gsap } from "gsap/gsap-core";
import * as THREE from "three/webgpu";
import { createInstancedBillboard } from "./billboard";
import { GROUND_LEVEL_Y } from "./environment";
import {
  createFireParticleSystem,
  type FireParticleEmitter,
  type FireParticleTextures,
} from "./fire-particles";
import { createRandomNumberGenerator } from "./random";

// CustomBounceは内部でCustomEaseを使う。登録と曲線の作成は起動時に一度だけ行う。
gsap.registerPlugin(CustomEase, CustomBounce);

/**
 * 同時に用意する飛ぶ火元の数。1以上の整数。増やすほど粒とライトの処理が増える。
 * 中央の点光源を足した数が、renderer.tsの点光源上限以下になるようにする。
 */
const FLYING_FIRE_SOURCE_COUNT = 100;

/** 火元が飛び始めてから、床で跳ね返りを終えるまでの秒数。0より大きくする。 */
const SOURCE_FLIGHT_DURATION_SECONDS = 3.0;

/** 火元が飛び始めるまでの待ち時間。秒で0以上。0ならすぐ飛び始める。 */
const getRandomSourceLaunchDelaySeconds = createRandomNumberGenerator({
  rangeMin: 0,
  startValue: 0,
  addRange: 6,
});

/** フレアとライトを暗くする秒数。0以上、飛行時間以下。0なら一瞬で消える。 */
const SOURCE_LIGHT_AND_FLARE_FADE_DURATION_SECONDS = 1;

/** 新しく出す粒を0へ減らす秒数。0以上、飛行時間以下。0なら一瞬で止める。 */
const SOURCE_PARTICLE_SPAWN_REDUCTION_DURATION_SECONDS = 0.3;

/** 火元が点灯するときに明るくなる秒数。0以上。0なら一瞬で点灯する。 */
const SOURCE_IGNITION_DURATION_SECONDS = 0.2;

/** 横長フレアの高さ判定。Y座標がSTART以下なら消え、END以上なら完全に出る。STARTはEND未満。 */
const STREAK_FLARE_HEIGHT_FADE_START = 180;
const STREAK_FLARE_HEIGHT_FADE_END = 320;

/** 横長フレアが現れる前方距離。START以下で消え、END以上で完全に出る。STARTはEND未満。 */
const STREAK_FLARE_DEPTH_FADE_IN_START = 120;
const STREAK_FLARE_DEPTH_FADE_IN_END = 220;

/** 横長フレアが消える前方距離。STARTから薄くなり、END以上で消える。STARTはEND未満。 */
const STREAK_FLARE_DEPTH_FADE_OUT_START = 650;
const STREAK_FLARE_DEPTH_FADE_OUT_END = 850;

/**
 * 横長フレアを出せる火元を、何個おきに選ぶか。
 * 1以上、火元の数以下の整数を使う。1ならすべてで、大きいほど候補が減る。
 */
const STREAK_FLARE_CANDIDATE_STEP = 3;

/**
 * 1画面に同時表示できる横長フレアの最大数。
 * 0以上の整数を使う。0なら非表示。候補数より大きくしても表示数は増えない。
 */
const STREAK_FLARE_MAX_VISIBLE_COUNT = 5;

/** 通常フレアの幅。3D空間で0以上。0なら見えず、負数は使わない。 */
const SOURCE_FLARE_WORLD_SIZE = 240;

/** 横長フレアの幅。3D空間で0以上。0なら見えず、負数は使わない。 */
const NEAR_FLARE_WORLD_SIZE = 720;

/** 通常フレアへ掛けるHDR倍率。0で消え、1が元の明るさ。1超も使え、上限補正はしない。 */
const FLYING_SOURCE_FLARE_HDR_BRIGHTNESS = 10;

/** 横長フレアへ掛けるHDR倍率。0で消え、1が元の明るさ。1超も使え、上限補正はしない。 */
const NEAR_FLARE_HDR_BRIGHTNESS = 2;

/** 横長フレア画像の高さ。画像のpx数で1以上の整数にする。 */
const NEAR_FLARE_TEXTURE_HEIGHT_PIXELS = 512;

/**
 * 横長フレア画像から使う縦範囲。0〜画像の高さのpx数を使う。
 * TOPをBOTTOMより大きくすると、切り出した画像を上下反転して貼る。
 */
const NEAR_FLARE_VISIBLE_TOP_PIXELS = 512;
const NEAR_FLARE_VISIBLE_BOTTOM_PIXELS = 336;
const NEAR_FLARE_TEXTURE_V_START = NEAR_FLARE_VISIBLE_TOP_PIXELS / NEAR_FLARE_TEXTURE_HEIGHT_PIXELS;
const NEAR_FLARE_TEXTURE_V_END =
  NEAR_FLARE_VISIBLE_BOTTOM_PIXELS / NEAR_FLARE_TEXTURE_HEIGHT_PIXELS;

/** 火元が上がる最高地点のY座標。床以上にする。 */
const getRandomSourcePeakHeight = createRandomNumberGenerator({
  rangeMin: GROUND_LEVEL_Y,
  startValue: 200,
  addRange: 500,
});

/** 火元が着地するX・Z座標。3D空間の距離。 */
const getRandomSourceLandingPosition = createRandomNumberGenerator({
  startValue: -1_500,
  addRange: 3_000,
});

/**
 * Y方向の動きに付ける名前。strengthは0〜1で、大きいほど跳ねる回数が増える。
 * 1本のTweenで床から上がり、同じ床へ戻す。
 */
const SOURCE_VERTICAL_BOUNCE_EASE_NAME = "sourceVerticalBounce";
CustomBounce.create(SOURCE_VERTICAL_BOUNCE_EASE_NAME, {
  strength: 0.7,
  endAtStart: true,
});

/** この秒数以下の移動は速度を0とみなす。0以上にする。 */
const SOURCE_VELOCITY_DELTA_MIN_SECONDS = 0.0001;

/** この速さを超える移動は中央への瞬間移動とみなし、速度を0にする。0より大きくする。 */
const SOURCE_TELEPORT_SPEED_WORLD_UNITS_PER_SECOND = 5_000;

/** 中央ライトが1秒で増える明るさ。0以上。0なら点灯せず、大きいほど早く最大になる。 */
const CENTER_LIGHT_FADE_IN_PER_SECOND = 6;

/** 通常フレアの透明度。0〜1。0で透明、1で不透明。 */
const getRandomSourceFlareOpacity = createRandomNumberGenerator({
  rangeMin: 0,
  rangeMax: 1,
  startValue: 0.8,
  addRange: 0.2,
});

/** 横長フレアの透明度。0〜1。0で透明、1で不透明。 */
const getRandomNearFlareOpacity = createRandomNumberGenerator({
  rangeMin: 0,
  rangeMax: 1,
  startValue: 0.6,
  addRange: 0.4,
});

/** 炎が床へ映すライト色。24bitのRGB値で指定する。 */
const FIRE_LIGHT_COLOR = 0xff6622;

/** 飛ぶ火元の光が届く距離。3D空間で0以上。0なら距離の上限を付けない。 */
const getRandomFlyingFireLightDistance = createRandomNumberGenerator({
  rangeMin: 0,
  startValue: 1_100,
  addRange: 40,
});

/** 中央ライトが届く距離。3D空間で0以上。0なら距離の上限を付けない。 */
const CENTER_FIRE_LIGHT_DISTANCE = 1_100;

/** 火元の明るさ倍率。0〜1。0で消灯、1で元の明るさ。 */
const getRandomFlyingFireLightIntensityScale = createRandomNumberGenerator({
  rangeMin: 0,
  rangeMax: 1,
  startValue: 0.8,
  addRange: 0.3,
});

/** 飛ぶライトを火元から上へずらす距離。3D空間で0以上。0なら火元と同じ高さ。 */
const FLYING_FIRE_LIGHT_HEIGHT = 16;

/** 中央ライトを床から上へずらす距離。3D空間で0以上。0なら床と同じ高さ。 */
const CENTER_FIRE_LIGHT_HEIGHT = 80;

/** 中央ライトの強さ。0以上。0なら消灯し、上限補正はしない。 */
const CENTER_FIRE_LIGHT_INTENSITY = 12;

/** 通常フレアの描画順。粒より後、横長フレアより先になる値にする。 */
const SOURCE_FLARE_RENDER_ORDER = 2;

/** 横長フレアの描画順。粒と通常フレアより後になる値にする。 */
const NEAR_FLARE_RENDER_ORDER = 3;

/** 画面中央に残る炎の3D座標。Yは床と同じ高さにする。 */
const CENTER_FIRE_POSITION = new THREE.Vector3(0, GROUND_LEVEL_Y, 0);

/** 炎の表示に使う3種類の画像。 */
type FireFieldTextures = {
  /** ぼかした粒と、くっきりした粒の画像。 */
  particleTextures: FireParticleTextures;

  /** 火元の丸いフレア画像。 */
  sourceFlareTexture: THREE.Texture;

  /** 画面を横へ伸びるフレア画像。 */
  nearFlareTexture: THREE.Texture;
};

/** 飛ぶ火元1つが持つ表示状態と、前フレームの位置。 */
type FlyingFireSource = FireParticleEmitter & {
  /** 火元とライトをまとめて動かす入れ物。 */
  group: THREE.Group;

  /** 速度を求めるために保存する、前フレームの3D座標。 */
  previousPosition: THREE.Vector3;

  /** 火元と一緒に動く点光源。 */
  pointLight: THREE.PointLight;

  /** フレアとライトへ掛ける明るさ。0〜1。 */
  brightness: number;

  /** trueの間だけ、個別のライトとフレアを表示する。 */
  isFlying: boolean;
};

/**
 * sceneへ中央の炎、飛ぶ火元、点光源、フレアを追加し、毎フレームの更新関数を返す。
 * 返した関数には0以上の経過秒を渡し、呼ぶ前にcameraの行列を更新する。
 */
export function createFireField(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  textures: FireFieldTextures,
) {
  const sourceFlareMesh = createInstancedBillboard({
    texture: textures.sourceFlareTexture,
    maxInstanceCount: FLYING_FIRE_SOURCE_COUNT,
    renderOrder: SOURCE_FLARE_RENDER_ORDER,
    // フレアはレンズ内の光なので、3D物体の前後関係では隠さない。
    depthTest: false,
  });
  const nearFlareMesh = createInstancedBillboard({
    texture: textures.nearFlareTexture,
    maxInstanceCount: FLYING_FIRE_SOURCE_COUNT,
    renderOrder: NEAR_FLARE_RENDER_ORDER,
    depthTest: false,
    textureVStart: NEAR_FLARE_TEXTURE_V_START,
    textureVEnd: NEAR_FLARE_TEXTURE_V_END,
  });
  scene.add(sourceFlareMesh, nearFlareMesh);

  const flyingFireSources = Array.from({ length: FLYING_FIRE_SOURCE_COUNT }, () =>
    createFlyingFireSource(scene),
  );

  // 待機中の火元ライトは同じ場所へ重なるため、中央の1灯へ明るさをまとめる。
  const centerPointLight = createFirePointLight(CENTER_FIRE_LIGHT_DISTANCE);
  centerPointLight.position.set(0, GROUND_LEVEL_Y + CENTER_FIRE_LIGHT_HEIGHT, 0);
  scene.add(centerPointLight);
  let centerLightBrightness = 0;

  const updateParticles = createFireParticleSystem(
    scene,
    camera,
    textures.particleTextures,
    flyingFireSources,
    CENTER_FIRE_POSITION,
  );

  // InstancedMeshへ書く値は使い回し、毎フレームのごみを作らない。
  const scratchMatrix = new THREE.Matrix4();
  const scratchScale = new THREE.Vector3();
  const scratchColor = new THREE.Color();
  const sourcePositionInCameraSpace = new THREE.Vector3();

  const updateSourceLightsAndFlares = (deltaSeconds: number) => {
    const sourceFlareMaterial = sourceFlareMesh.material;
    const nearFlareMaterial = nearFlareMesh.material;

    // 小さな乱数で、炎とライトが完全に静止して見えないようにする。
    sourceFlareMaterial.opacity = getRandomSourceFlareOpacity();
    nearFlareMaterial.opacity = getRandomNearFlareOpacity();
    centerLightBrightness = Math.min(
      1,
      centerLightBrightness + deltaSeconds * CENTER_LIGHT_FADE_IN_PER_SECOND,
    );

    let visibleNearFlareCount = 0;

    for (let sourceIndex = 0; sourceIndex < flyingFireSources.length; sourceIndex += 1) {
      const source = flyingFireSources[sourceIndex];
      updateSourceVelocity(source, deltaSeconds);

      // 飛んでいる火元だけ個別ライトを使う。待機中の明るさは中央へ足さない。
      source.pointLight.visible = source.isFlying;
      if (source.isFlying) {
        source.pointLight.distance = getRandomFlyingFireLightDistance();
        source.pointLight.intensity = source.brightness * getRandomFlyingFireLightIntensityScale();
      }

      // 待機中の火元は中央専用の粒へ任せ、同じフレアが中央で重なるのを防ぐ。
      scratchColor.setScalar(
        source.isFlying ? source.brightness * FLYING_SOURCE_FLARE_HDR_BRIGHTNESS : 0,
      );
      scratchScale.setScalar(SOURCE_FLARE_WORLD_SIZE);
      scratchMatrix.compose(source.group.position, camera.quaternion, scratchScale);
      sourceFlareMesh.setMatrixAt(sourceIndex, scratchMatrix);
      sourceFlareMesh.setColorAt(sourceIndex, scratchColor);

      // 一部の火元だけを候補にし、近くを高く横切る間だけ横長フレアを出す。
      sourcePositionInCameraSpace
        .copy(source.group.position)
        .applyMatrix4(camera.matrixWorldInverse);
      const cameraDepth = -sourcePositionInCameraSpace.z;
      const heightFade = THREE.MathUtils.smoothstep(
        source.group.position.y,
        STREAK_FLARE_HEIGHT_FADE_START,
        STREAK_FLARE_HEIGHT_FADE_END,
      );
      const depthFadeIn = THREE.MathUtils.smoothstep(
        cameraDepth,
        STREAK_FLARE_DEPTH_FADE_IN_START,
        STREAK_FLARE_DEPTH_FADE_IN_END,
      );
      const depthFadeOut =
        1 -
        THREE.MathUtils.smoothstep(
          cameraDepth,
          STREAK_FLARE_DEPTH_FADE_OUT_START,
          STREAK_FLARE_DEPTH_FADE_OUT_END,
        );
      const streakFlareBrightness = heightFade * depthFadeIn * depthFadeOut;
      const shouldShowNearFlare =
        source.isFlying &&
        sourceIndex % STREAK_FLARE_CANDIDATE_STEP === 0 &&
        streakFlareBrightness > 0 &&
        visibleNearFlareCount < STREAK_FLARE_MAX_VISIBLE_COUNT;

      // 見える大きなフレアを配列の先頭から詰め、残りは描かない。
      if (shouldShowNearFlare) {
        scratchColor.setScalar(
          source.brightness * streakFlareBrightness * NEAR_FLARE_HDR_BRIGHTNESS,
        );
        scratchScale.setScalar(NEAR_FLARE_WORLD_SIZE);
        scratchMatrix.compose(source.group.position, camera.quaternion, scratchScale);
        nearFlareMesh.setMatrixAt(visibleNearFlareCount, scratchMatrix);
        nearFlareMesh.setColorAt(visibleNearFlareCount, scratchColor);
        visibleNearFlareCount += 1;
      }
    }

    centerPointLight.intensity = centerLightBrightness * CENTER_FIRE_LIGHT_INTENSITY;

    // CPUで書き換えた位置と色を、このフレームでGPUへ送る。
    sourceFlareMesh.instanceMatrix.needsUpdate = true;
    if (sourceFlareMesh.instanceColor) sourceFlareMesh.instanceColor.needsUpdate = true;
    nearFlareMesh.count = visibleNearFlareCount;
    nearFlareMesh.instanceMatrix.needsUpdate = true;
    if (nearFlareMesh.instanceColor) nearFlareMesh.instanceColor.needsUpdate = true;
  };

  return (deltaSeconds: number) => {
    updateSourceLightsAndFlares(deltaSeconds);
    updateParticles(deltaSeconds);
  };
}

/** GSAPで飛ばす1つの火元と、その場所を照らすライトを作る。 */
function createFlyingFireSource(scene: THREE.Scene): FlyingFireSource {
  const group = new THREE.Group();
  group.position.copy(CENTER_FIRE_POSITION);

  const pointLight = createFirePointLight(getRandomFlyingFireLightDistance());
  pointLight.position.y = FLYING_FIRE_LIGHT_HEIGHT;
  group.add(pointLight);

  const source: FlyingFireSource = {
    group,
    position: group.position,
    velocity: new THREE.Vector3(),
    previousPosition: group.position.clone(),
    particleSpawnRate: 0,
    pointLight,
    brightness: 0,
    isFlying: false,
  };
  scene.add(group);
  startSourceFlightAnimation(source);
  return source;
}

/**
 * 炎の光を広い床まで届ける点光源を作る。
 * distanceは3D空間で0以上。0なら届く距離に上限を付けない。
 */
function createFirePointLight(distance: number) {
  const pointLight = new THREE.PointLight(FIRE_LIGHT_COLOR, 0, distance);

  // 通常の距離減衰をなくし、指定距離の手前から消す。
  pointLight.decay = 0;
  return pointLight;
}

/** 現在と前の位置から火元の速度を求める。deltaSecondsは0以上の経過秒。 */
function updateSourceVelocity(source: FlyingFireSource, deltaSeconds: number) {
  if (!source.isFlying || deltaSeconds <= SOURCE_VELOCITY_DELTA_MIN_SECONDS) {
    source.velocity.set(0, 0, 0);
    source.previousPosition.copy(source.position);
    return;
  }

  source.velocity.subVectors(source.position, source.previousPosition).divideScalar(deltaSeconds);
  source.previousPosition.copy(source.position);

  // 中央へ戻る瞬間は軌跡ではないため、異常に大きな速度を粒へ渡さない。
  if (source.velocity.length() > SOURCE_TELEPORT_SPEED_WORLD_UNITS_PER_SECOND) {
    source.velocity.set(0, 0, 0);
  }
}

/** 火元を中央から上へ飛ばし、横へ広げながら床へ落とす動きを繰り返す。 */
function startSourceFlightAnimation(source: FlyingFireSource) {
  const sourcePosition = source.group.position;
  const launchDelaySeconds = getRandomSourceLaunchDelaySeconds();
  const peakHeight = getRandomSourcePeakHeight();
  const landingX = getRandomSourceLandingPosition();
  const landingZ = getRandomSourceLandingPosition();

  gsap
    .timeline({ repeat: -1, repeatRefresh: true })
    .to(
      source,
      {
        brightness: 1,
        duration: SOURCE_IGNITION_DURATION_SECONDS,
        ease: "sine.out",
      },
      0,
    )
    .set(source, { isFlying: true, particleSpawnRate: 1 }, launchDelaySeconds)
    .to(
      sourcePosition,
      {
        x: landingX,
        z: landingZ,
        duration: SOURCE_FLIGHT_DURATION_SECONDS,
        ease: "power1.out",
      },
      launchDelaySeconds,
    )
    .to(
      sourcePosition,
      {
        y: peakHeight,
        duration: SOURCE_FLIGHT_DURATION_SECONDS,
        ease: SOURCE_VERTICAL_BOUNCE_EASE_NAME,
      },
      launchDelaySeconds,
    )
    // 尾の粒は急に切らず、飛行が終わる前に新しく出す数を減らす。
    .to(
      source,
      {
        particleSpawnRate: 0,
        duration: SOURCE_PARTICLE_SPAWN_REDUCTION_DURATION_SECONDS,
        ease: "power2.in",
      },
      launchDelaySeconds +
        SOURCE_FLIGHT_DURATION_SECONDS -
        SOURCE_PARTICLE_SPAWN_REDUCTION_DURATION_SECONDS,
    )
    // 飛行が終わる直前だけ暗くし、火元が急に消えたように見せない。
    .to(
      source,
      {
        brightness: 0,
        duration: SOURCE_LIGHT_AND_FLARE_FADE_DURATION_SECONDS,
        ease: "sine.inOut",
      },
      launchDelaySeconds +
        SOURCE_FLIGHT_DURATION_SECONDS -
        SOURCE_LIGHT_AND_FLARE_FADE_DURATION_SECONDS,
    )
    // 次の周回は中央から始め、待機中のライトを中央へまとめる。
    .set(
      sourcePosition,
      { x: 0, y: GROUND_LEVEL_Y, z: 0 },
      launchDelaySeconds + SOURCE_FLIGHT_DURATION_SECONDS,
    )
    .set(
      source,
      { brightness: 1, particleSpawnRate: 0, isFlying: false },
      launchDelaySeconds + SOURCE_FLIGHT_DURATION_SECONDS,
    );
}
