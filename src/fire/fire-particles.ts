import * as THREE from "three/webgpu";
import { createBillboards } from "./billboard";

/**
 * 粒の個数。numPerSourceとnumCenterは0以上の整数。値に比例してCPUとGPUの負荷が増える。
 * stepSharpは1以上の整数。1で全粒が鮮明になり、値を増やすほど鮮明な粒の割合が下がる。
 */
const PARTICLES = { numPerSource: 40, numCenter: 160, stepSharp: 4 } as const;
/**
 * 乱数範囲は[最小値,最大値)。最小値≦最大値。時間は秒、速度はワールド単位/秒、加速度はワールド単位/秒²。
 * 待ち時間は0以上、寿命は0より大きくする。
 * 上向き速度と尾の散る速さは0以上。位置・水平速度・水平加速度には負数も使える。
 * 範囲を広げるほど動きにばらつきが出る。
 */
const MOTION_RANGES = {
  secDelay: [0, 2],
  secLife: [0.1, 0.7],
  positionOffset: [-10, 10],
  velocityHorizontal: [-300, 300],
  velocityUpward: [700, 1_300],
  accelerationHorizontal: [-300, 300],
  speedTrail: [60, 180],
} as const;
/**
 * [ぼかした画像,くっきりした画像]の色と大きさ。widthとheightは0以上の[開始値,終了値]。
 * 終了値が大きければ膨らみ、小さければ縮む。
 * brightnessは0以上。1が画像本来の明るさで、1を超える値がHDRの高輝度になる。
 */
const PARTICLE_STYLES = [
  {
    colorStart: new THREE.Color(0xff6622),
    colorEnd: new THREE.Color(0x990000),
    source: { width: [50, 14], height: [50, 14], brightness: 1.6 },
    center: { width: [220, 720], height: [280, 900], brightness: 0.75 },
  },
  {
    colorStart: new THREE.Color().setRGB(1, 0.55, 0.18),
    colorEnd: new THREE.Color(0xff3300),
    source: { width: [50, 14], height: [50, 14], brightness: 2.4 },
    center: { width: [120, 340], height: [180, 520], brightness: 2.6 },
  },
] as const;
/**
 * 飛ぶ火元から出た尾の動き。速さはワールド単位/秒、空気抵抗は1秒あたり、浮力はワールド単位/秒²。
 * speedSourceMin以下では横方向の拡散速度を使う。
 * speedSourceMin・逆向き速度・倍率・浮力は0以上、逆向き速度の最小値は最大値以下にする。
 * 空気抵抗は0より大きく、増やすと早く減速する。逆向き速度・浮力・横加速度倍率を
 * 増やすと、それぞれ尾が長く、上へ浮き、横へ広がる。
 */
const TRAIL = {
  backward: { speedSourceMin: 40, ratioSpeed: 0.55, rangeSpeed: [350, 900] },
  air: { rateDrag: 5, accelerationUpward: 1_200 },
  scaleAcceleration: 0.25,
} as const;
/** 中央炎の横加速度倍率。0以上。0で真上へ進み、値を上げると左右へ広がる。 */
const SCALE_ACCELERATION_CENTER = 0.45;
/** 中央粒へ掛ける大きさの範囲。0以上で最小値≦最大値。1で設定表の大きさになる。 */
const RANGE_SCALE_CENTER = [0.55, 1.1] as const;
/** 寿命末尾のフェード時間上限。0以上。実際のフェード時間は寿命の半分以下になる。 */
const SEC_FADE_MAX = 1;
/** 次の発生判定まで待つ秒数。0より大きく、小さいほど発生割合の変化を早く反映する。 */
const SEC_RETRY_SPAWN = 0.1;
/** alphaTestは0〜1、renderOrderは透明物の描画順。粒はフレアより先に描く。 */
const RENDERING = { alphaTest: 0.01, renderOrder: 1 } as const;

type ParticleMotion = ReturnType<typeof createMotion>;
type ParticleState = {
  secAge: number;
  emitter: ParticleEmitter | null;
  positionStart: THREE.Vector3;
  velocityStart: THREE.Vector3;
  motion: ParticleMotion;
};
/** ぼかした粒と、くっきりした粒をこの順で受け取る。 */
export type ParticleTextures = readonly [blurred: THREE.Texture, sharp: THREE.Texture];
/** 粒を出す場所、速度、量を毎フレーム受け取る。 */
export type ParticleEmitter = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  /** 0〜1。0で新規発生0、1で全粒の発生を許可する。既存の粒は寿命まで更新する。 */
  ratioSpawn: number;
};
/** 画像ごとにInstancedMeshを作り、2ドローコールで描く。火元を先に更新し、0以上の経過秒を渡す。 */
export function createParticleSystem(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  textures: ParticleTextures,
  emitters: readonly ParticleEmitter[],
  positionCenter: THREE.Vector3,
) {
  const numMotions = Math.max(PARTICLES.numPerSource, PARTICLES.numCenter);
  const motions = Array.from({ length: numMotions }, createMotion);
  const batches = createBatches(scene, textures, emitters, motions);
  // 毎フレーム使うMatrix4、Vector3、Colorを共用する。
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  return (secDelta: number) => {
    for (const batch of batches) {
      const style = PARTICLE_STYLES[batch.textureIndex];
      for (let particleIndex = 0; particleIndex < batch.states.length; particleIndex += 1) {
        const particle = batch.states[particleIndex];
        const motion = particle.motion;
        particle.secAge += secDelta;

        if (
          particle.secAge >= motion.secLife ||
          (particle.secAge >= 0 && particle.secAge < secDelta)
        ) {
          // 発生割合が粒ごとの抽選値以下の間は、次の発生判定まで待機する。
          if (particle.emitter && particle.emitter.ratioSpawn <= motion.thresholdSpawn) {
            particle.secAge = -SEC_RETRY_SPAWN;
          } else {
            particle.secAge %= motion.secLife;
            captureEmission(particle, positionCenter);
          }
        }

        // 待機中の粒はスケールを0にする。
        if (particle.secAge < 0) {
          matrix.compose(positionCenter, camera.quaternion, scale.setScalar(0));
          batch.mesh.setMatrixAt(particleIndex, matrix);
          continue;
        }

        const isCenter = particle.emitter === null;
        const secAge = particle.secAge;
        const ratioLife = secAge / motion.secLife;
        const halfAgeSquared = secAge * secAge * 0.5;
        position.copy(particle.positionStart).add(motion.positionOffset);

        if (isCenter) {
          // 中央は上向きの初速を保ち、粒ごとの横加速度で炎を広げる。
          position.addScaledVector(particle.velocityStart, secAge);
        } else {
          // 尾は後方へ出たあと空気で減速し、横へ散りながら上へ浮く。
          const secDrag = getDragTime(secAge);
          position.addScaledVector(particle.velocityStart, secDrag);
          position.y += (TRAIL.air.accelerationUpward / TRAIL.air.rateDrag) * (secAge - secDrag);
        }
        position.addScaledVector(
          motion.accelerationHorizontal,
          halfAgeSquared * (isCenter ? SCALE_ACCELERATION_CENTER : TRAIL.scaleAcceleration),
        );

        const appearance = isCenter ? style.center : style.source;
        const scaleSize = isCenter ? motion.scaleCenter : 1;
        scale.set(
          THREE.MathUtils.lerp(appearance.width[0], appearance.width[1], ratioLife) * scaleSize,
          THREE.MathUtils.lerp(appearance.height[0], appearance.height[1], ratioLife) * scaleSize,
          1,
        );
        color
          .copy(style.colorStart)
          .lerp(style.colorEnd, ratioLife)
          .multiplyScalar(getLifeFade(secAge, motion.secLife) * appearance.brightness);

        // camera.quaternionで平面をカメラへ向ける。
        matrix.compose(position, camera.quaternion, scale);
        batch.mesh.setMatrixAt(particleIndex, matrix);
        batch.mesh.setColorAt(particleIndex, color);
      }

      // CPUで書き換えた位置と色を、このフレームでGPUへ送る。
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.mesh.instanceColor!.needsUpdate = true;
    }
  };
}

/** 粒の状態を画像別に分け、画像ごとのInstancedMeshを作る。 */
function createBatches(
  scene: THREE.Scene,
  textures: ParticleTextures,
  emitters: readonly ParticleEmitter[],
  motions: ParticleMotion[],
) {
  const statesByTexture = textures.map(() => [] as ParticleState[]);
  const addStates = (emitter: ParticleEmitter | null, numParticles: number) => {
    for (let particleIndex = 0; particleIndex < numParticles; particleIndex += 1) {
      const motion = motions[particleIndex];
      const textureIndex = particleIndex % PARTICLES.stepSharp === PARTICLES.stepSharp - 1 ? 1 : 0;
      statesByTexture[textureIndex].push({
        secAge: -motion.secDelay,
        emitter,
        positionStart: new THREE.Vector3(),
        velocityStart: new THREE.Vector3(),
        motion,
      });
    }
  };
  for (const emitter of emitters) addStates(emitter, PARTICLES.numPerSource);
  addStates(null, PARTICLES.numCenter);

  return textures.map((texture, textureIndex) => {
    const states = statesByTexture[textureIndex];
    const mesh = createBillboards({
      texture,
      maxInstances: states.length,
      renderOrder: RENDERING.renderOrder,
      alphaTest: RENDERING.alphaTest,
    });
    scene.add(mesh);
    return { textureIndex, states, mesh };
  });
}
/** 粒番号ごとの待ち時間、寿命、初速、加速度を乱数で決める。同じ番号の設定は全火元で共有する。 */
function createMotion() {
  const randomRange = THREE.MathUtils.randFloat;
  const angleTrail = randomRange(0, Math.PI * 2);
  const speedTrail = randomRange(...MOTION_RANGES.speedTrail);
  return {
    secDelay: randomRange(...MOTION_RANGES.secDelay),
    secLife: randomRange(...MOTION_RANGES.secLife),
    thresholdSpawn: Math.random(),
    scaleCenter: randomRange(...RANGE_SCALE_CENTER),
    positionOffset: new THREE.Vector3(
      randomRange(...MOTION_RANGES.positionOffset),
      randomRange(...MOTION_RANGES.positionOffset),
      randomRange(...MOTION_RANGES.positionOffset),
    ),
    velocityCenter: new THREE.Vector3(
      randomRange(...MOTION_RANGES.velocityHorizontal),
      randomRange(...MOTION_RANGES.velocityUpward),
      randomRange(...MOTION_RANGES.velocityHorizontal),
    ),
    velocityTrail: new THREE.Vector3().setFromCylindricalCoords(speedTrail, angleTrail, 0),
    accelerationHorizontal: new THREE.Vector3(
      randomRange(...MOTION_RANGES.accelerationHorizontal),
      0,
      randomRange(...MOTION_RANGES.accelerationHorizontal),
    ),
  };
}
/** 発生時の位置と速度をParticleStateに保存し、その値を粒の軌道に使う。 */
function captureEmission(particle: ParticleState, positionCenter: THREE.Vector3) {
  const emitter = particle.emitter;
  particle.positionStart.copy(emitter?.position ?? positionCenter);
  particle.velocityStart.copy(
    emitter ? particle.motion.velocityTrail : particle.motion.velocityCenter,
  );
  if (!emitter) return;
  const speedSource = emitter.velocity.length();
  if (speedSource <= TRAIL.backward.speedSourceMin) return;
  const speedBackward = THREE.MathUtils.clamp(
    speedSource * TRAIL.backward.ratioSpeed,
    ...TRAIL.backward.rangeSpeed,
  );
  particle.velocityStart.addScaledVector(emitter.velocity, -speedBackward / speedSource);
}
/** フェード開始前は明るさ倍率1、寿命末尾はsmoothstepで1から0へ変化する。 */
function getLifeFade(secAge: number, secLife: number) {
  const secFade = Math.min(SEC_FADE_MAX, secLife * 0.5);
  return THREE.MathUtils.smoothstep(secLife - secAge, 0, secFade);
}
/** 空気抵抗後の移動距離を「初速×秒」で計算するための秒数を返す。secAgeは0以上。 */
function getDragTime(secAge: number) {
  return -Math.expm1(-TRAIL.air.rateDrag * secAge) / TRAIL.air.rateDrag;
}
