import { CustomBounce } from "gsap/CustomBounce";
import { CustomEase } from "gsap/CustomEase";
import { gsap } from "gsap/gsap-core";
import * as THREE from "three/webgpu";
import { Y_GROUND } from "../scene/floor";
import type { TextureSet } from "../scene/textures";
import { createBillboards } from "./billboard";
import { createParticleSystem, type ParticleEmitter } from "./fire-particles";

// CustomBounceとCustomEaseを登録し、火元のY座標に使うバウンス曲線を作る。
gsap.registerPlugin(CustomEase, CustomBounce);
const EASE_VERTICAL_BOUNCE = "sourceVerticalBounce";
// endAtStart=trueで曲線の開始値と終了値をそろえる。strengthは0より大きく1以下で、大きいほど跳ね返り回数が増える。
CustomBounce.create(EASE_VERTICAL_BOUNCE, { strength: 0.7, endAtStart: true });
/**
 * 飛ぶ火元の数、軌道、時間を設定する。numSourcesは0以上の整数。
 * secFlightは0より大きく、secIgnition・secParticleFade・secLightFadeは0以上の秒数。
 * secParticleFadeとsecLightFadeの上限はsecFlight。値を下げると着地直前まで粒と光が残る。
 * rangeで始まる値は[最小値,最大値)。最小値≦最大値で、rangeSecDelayは0以上の秒数。
 * 乱数は起動時に火元ごとに決まり、各周回で再利用する。
 * numSourcesを増やすと粒とライトの数が増える。総ライト数はClusteredLightingの上限以下にする。
 * secDeltaMinは0以上、speedResetThresholdは0より大きい値を使う。
 */
const FLIGHT = {
  numSources: 100,
  secFlight: 3,
  secIgnition: 0.2,
  secParticleFade: 0.3,
  secLightFade: 1,
  rangeSecDelay: [0, 6],
  rangePeakHeight: [200, 700],
  rangeLanding: [-1_500, 1_500],
  secDeltaMin: 0.0001,
  speedResetThreshold: 5_000,
} as const;
/**
 * 通常フレアと横長フレアの表示設定。sizeとbrightnessは0以上、rangeOpacityは0〜1。
 * 各rangeは最小値≦最大値。横長フレアは高さと手前距離で現れ、奥側で薄くなる。
 * intervalCandidateは1以上の整数で、大きいほど候補が減る。maxVisibleは0以上の整数で、同時表示数の上限になる。
 * 描画順は粒＜通常フレア＜横長フレア。
 */
const FLARE_SOURCE = {
  size: 240,
  brightness: 10,
  rangeOpacity: [0.8, 1],
  renderOrder: 2,
} as const;
const FLARE_STREAK = {
  size: 720,
  brightness: 2,
  rangeOpacity: [0.6, 1],
  renderOrder: 3,
  intervalCandidate: 3,
  maxVisible: 5,
  rangeHeight: [180, 320],
  rangeDepthIn: [120, 220],
  rangeDepthOut: [650, 850],
} as const;
/**
 * 中央ライトと飛ぶライトの設定。距離・高さ・強さは0以上。強さが1を超えるとHDRの高輝度になる。
 * rateFadeInは0より大きく、値を上げると中央ライトが早く点く。
 * 飛ぶライトの強さ倍率は乱数から求め、上限を1とする。乱数範囲の最大値を1より大きくすると、
 * 倍率1の割合が増える。乱数範囲は最小値≦最大値。
 */
const LIGHT = {
  color: 0xff6622,
  center: { distance: 1_100, heightOffset: 80, intensity: 12, rateFadeIn: 6 },
  flying: {
    heightOffset: 16,
    rangeDistance: [1_100, 1_140],
    rangeIntensity: [0.8, 1.1],
  },
} as const;
/** 画面中央に残る炎の位置。Yは床と同じ高さにする。 */
const POSITION_CENTER = new THREE.Vector3(0, Y_GROUND, 0);
/** 飛ぶ火元1つが持つ、粒・ライト・前フレームの状態。 */
type FireSource = ParticleEmitter & {
  positionPrevious: THREE.Vector3;
  light: THREE.PointLight;
  brightness: number;
  isFlying: boolean;
};
/** sceneへ炎、点光源、フレアを追加して更新関数を返す。camera行列の更新後に0以上の経過秒を渡す。 */
export function createFireField(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  textures: TextureSet,
) {
  const meshFlare = createBillboards({
    texture: textures.textureFlare,
    maxInstances: FLIGHT.numSources,
    renderOrder: FLARE_SOURCE.renderOrder,
    // depthTest=falseでフレアを常に前面へ描く。
    depthTest: false,
  });
  const meshStreak = createBillboards({
    texture: textures.textureFlareStreak,
    maxInstances: FLARE_STREAK.maxVisible,
    renderOrder: FLARE_STREAK.renderOrder,
    depthTest: false,
    heightScale: textures.textureFlareStreak.repeat.y,
  });
  scene.add(meshFlare, meshStreak);
  const sources = Array.from({ length: FLIGHT.numSources }, () => createSource(scene));
  // 中央ライトは起動時に点灯し、各火元のライトは飛行中に点灯する。
  const lightCenter = createLight(LIGHT.center.distance);
  lightCenter.position.set(0, Y_GROUND + LIGHT.center.heightOffset, 0);
  scene.add(lightCenter);
  gsap.to(lightCenter, {
    intensity: LIGHT.center.intensity,
    duration: 1 / LIGHT.center.rateFadeIn,
    ease: "none",
  });
  const updateParticles = createParticleSystem(
    scene,
    camera,
    textures.texturesParticles,
    sources,
    POSITION_CENTER,
  );
  // 毎フレーム使うMatrix4、Color、Vector3を共用する。
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const positionCameraSpace = new THREE.Vector3();
  const scaleFlare = new THREE.Vector3().setScalar(FLARE_SOURCE.size);
  const scaleStreak = new THREE.Vector3().setScalar(FLARE_STREAK.size);

  return (secDelta: number) => {
    meshFlare.material.opacity = THREE.MathUtils.randFloat(...FLARE_SOURCE.rangeOpacity);
    meshStreak.material.opacity = THREE.MathUtils.randFloat(...FLARE_STREAK.rangeOpacity);
    let numStreaks = 0;
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const source = sources[sourceIndex];
      updateVelocity(source, secDelta);

      // 飛行状態を個別ライトの表示へ反映する。
      source.light.visible = source.isFlying;
      if (source.isFlying) {
        source.light.position.copy(source.position);
        source.light.position.y += LIGHT.flying.heightOffset;
        source.light.distance = THREE.MathUtils.randFloat(...LIGHT.flying.rangeDistance);
        source.light.intensity =
          source.brightness *
          Math.min(THREE.MathUtils.randFloat(...LIGHT.flying.rangeIntensity), 1);
      }

      color.setScalar(source.isFlying ? source.brightness * FLARE_SOURCE.brightness : 0);
      matrix.compose(source.position, camera.quaternion, scaleFlare);
      meshFlare.setMatrixAt(sourceIndex, matrix);
      meshFlare.setColorAt(sourceIndex, color);

      // 飛行中の火元をintervalCandidate間隔で選び、maxVisible件まで距離を調べる。
      if (
        !source.isFlying ||
        sourceIndex % FLARE_STREAK.intervalCandidate !== 0 ||
        numStreaks >= FLARE_STREAK.maxVisible
      ) {
        continue;
      }

      // 高さとカメラ奥行きから横長フレアの明るさを求める。
      positionCameraSpace.copy(source.position).applyMatrix4(camera.matrixWorldInverse);
      const depthCamera = -positionCameraSpace.z;
      const brightnessFlare =
        THREE.MathUtils.smoothstep(source.position.y, ...FLARE_STREAK.rangeHeight) *
        THREE.MathUtils.smoothstep(depthCamera, ...FLARE_STREAK.rangeDepthIn) *
        (1 - THREE.MathUtils.smoothstep(depthCamera, ...FLARE_STREAK.rangeDepthOut));
      if (brightnessFlare <= 0) continue;

      // 表示する横長フレアをインスタンス番号0から順に書き込む。
      color.setScalar(source.brightness * brightnessFlare * FLARE_STREAK.brightness);
      matrix.compose(source.position, camera.quaternion, scaleStreak);
      meshStreak.setMatrixAt(numStreaks, matrix);
      meshStreak.setColorAt(numStreaks, color);
      numStreaks += 1;
    }

    // CPUで書き換えた位置と色を、このフレームでGPUへ送る。
    meshFlare.instanceMatrix.needsUpdate = true;
    meshFlare.instanceColor!.needsUpdate = true;
    meshStreak.count = numStreaks;
    meshStreak.instanceMatrix.needsUpdate = true;
    meshStreak.instanceColor!.needsUpdate = true;
    updateParticles(secDelta);
  };
}
/** GSAPで飛ばす1つの火元と、その場所を照らすライトを作る。 */
function createSource(scene: THREE.Scene): FireSource {
  const position = POSITION_CENTER.clone();
  const light = createLight(THREE.MathUtils.randFloat(...LIGHT.flying.rangeDistance));
  light.position.set(position.x, position.y + LIGHT.flying.heightOffset, position.z);
  scene.add(light);

  const source: FireSource = {
    position,
    velocity: new THREE.Vector3(),
    positionPrevious: position.clone(),
    ratioSpawn: 0,
    light,
    brightness: 0,
    isFlying: false,
  };
  startFlight(source);
  return source;
}
/** decay=0の点光源を作る。光量はdistanceの境界へ近づくほど減り、境界で0になる。 */
function createLight(distance: number) {
  return new THREE.PointLight(LIGHT.color, 0, distance, 0);
}
/** 前回位置との差分から速度を求める。speedResetThresholdを超える速度は周回開始の位置リセットとして0にする。 */
function updateVelocity(source: FireSource, secDelta: number) {
  if (!source.isFlying || secDelta <= FLIGHT.secDeltaMin) {
    source.velocity.set(0, 0, 0);
    source.positionPrevious.copy(source.position);
    return;
  }

  source.velocity.subVectors(source.position, source.positionPrevious).divideScalar(secDelta);
  source.positionPrevious.copy(source.position);
  if (source.velocity.lengthSq() > FLIGHT.speedResetThreshold ** 2) {
    source.velocity.set(0, 0, 0);
  }
}
/** XZ座標を中央から着地点へ移動する。Y座標はCustomBounceで床から最高点へ上がり、同じ飛行時間で床へ戻る。 */
function startFlight(source: FireSource) {
  const randomRange = THREE.MathUtils.randFloat;
  const secDelay = randomRange(...FLIGHT.rangeSecDelay);
  const secEnd = secDelay + FLIGHT.secFlight;
  const tweenHorizontal = {
    x: randomRange(...FLIGHT.rangeLanding),
    z: randomRange(...FLIGHT.rangeLanding),
    duration: FLIGHT.secFlight,
    ease: "power1.out",
  };
  const tweenVertical = {
    y: randomRange(...FLIGHT.rangePeakHeight),
    duration: FLIGHT.secFlight,
    ease: EASE_VERTICAL_BOUNCE,
  };
  gsap
    .timeline({ repeat: -1 })
    .to(source, { brightness: 1, duration: FLIGHT.secIgnition, ease: "sine.out" }, 0)
    .set(source, { isFlying: true, ratioSpawn: 1 }, secDelay)
    .to(source.position, tweenHorizontal, secDelay)
    .to(source.position, tweenVertical, secDelay)
    // 着地前に粒の発生割合と火元の明るさを0まで減らす。
    .to(
      source,
      { ratioSpawn: 0, duration: FLIGHT.secParticleFade, ease: "power2.in" },
      secEnd - FLIGHT.secParticleFade,
    )
    .to(
      source,
      { brightness: 0, duration: FLIGHT.secLightFade, ease: "sine.inOut" },
      secEnd - FLIGHT.secLightFade,
    )
    // 着地時に火元を中央へ戻し、次の周回へ入る。
    .set(source.position, { x: 0, y: Y_GROUND, z: 0 }, secEnd)
    .set(source, { brightness: 1, ratioSpawn: 0, isFlying: false }, secEnd);
}
