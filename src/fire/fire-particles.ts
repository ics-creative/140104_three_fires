import * as THREE from "three/webgpu";
import { createInstancedBillboard } from "./billboard";
import { createRandomNumberGenerator } from "./random";

/** 1つの飛ぶ火元が使う粒数。0以上の整数。0なら尾を出さず、増やすほど処理が増える。 */
const FLYING_FIRE_PARTICLE_COUNT_PER_SOURCE = 40;

/** 中央の炎に使う粒数。0以上の整数。0なら中央の粒を出さず、増やすほど処理が増える。 */
const CENTER_FIRE_PARTICLE_COUNT = 160;

/** 何粒に1粒をくっきりした画像にするか。1以上の整数。1なら全粒をくっきりさせる。 */
const SHARP_PARTICLE_INTERVAL = 4;

/** 粒画像配列内で、ぼかし画像とくっきり画像を指す番号。 */
const BLURRED_PARTICLE_TEXTURE_INDEX = 0;
const SHARP_PARTICLE_TEXTURE_INDEX = 1;

/** 寿命の最後に暗くする最長秒数。0なら暗くしない。実際は寿命の半分との小さい方を使う。 */
const PARTICLE_LIFETIME_FADE_MAX_SECONDS = 1;

/** 最初に粒が現れるまでの待ち時間。秒で0以上。0なら待たない。 */
const getRandomParticleInitialDelaySeconds = createRandomNumberGenerator({
  rangeMin: 0,
  startValue: 0,
  addRange: 2,
});

/** 粒を出せない間に再確認する秒数。0より大きくする。 */
const PARTICLE_SPAWN_RETRY_SECONDS = 0.1;

/** 粒の寿命。秒で0より大きくする。 */
const getRandomParticleLifetimeSeconds = createRandomNumberGenerator({
  rangeMin: 0,
  startValue: 0.1,
  addRange: 0.6,
});

/** 粒が生まれる位置を火元からずらす3D距離。0なら火元と同じ位置。 */
const getRandomParticleEmissionOffset = createRandomNumberGenerator({
  startValue: -10,
  addRange: 20,
});

/** X・Z方向の初速。3D距離/秒。0なら横へ動かない。 */
const getRandomParticleHorizontalVelocity = createRandomNumberGenerator({
  startValue: -300,
  addRange: 600,
});

/** Y方向の初速。3D距離/秒で0以上。0なら最初から上昇しない。 */
const getRandomParticleUpwardVelocity = createRandomNumberGenerator({
  rangeMin: 0,
  startValue: 700,
  addRange: 600,
});

/** X・Z方向の加速度。3D距離/秒²。0なら進む向きを曲げない。 */
const getRandomParticleHorizontalAcceleration = createRandomNumberGenerator({
  startValue: -300,
  addRange: 600,
});

/** 火元の発生率と比べ、粒を出すか決める値。0〜1。 */
const getRandomParticleSpawnThreshold = createRandomNumberGenerator({
  rangeMin: 0,
  rangeMax: 1,
  startValue: 0,
  addRange: 1,
});

/** 飛ぶ火元から出る粒の直径。3D空間で0以上。STARTからENDへ寿命中に変わる。 */
const FLYING_PARTICLE_WORLD_SIZE_START = 50;
const FLYING_PARTICLE_WORLD_SIZE_END = 14;

/** ぼかした中央粒の幅と高さ。3D空間で0以上。STARTからENDへ寿命中に広がる。 */
const CENTER_BODY_WORLD_WIDTH_START = 220;
const CENTER_BODY_WORLD_WIDTH_END = 720;
const CENTER_BODY_WORLD_HEIGHT_START = 280;
const CENTER_BODY_WORLD_HEIGHT_END = 900;

/** くっきりした中央粒の幅と高さ。3D空間で0以上。STARTからENDへ寿命中に広がる。 */
const CENTER_CORE_WORLD_WIDTH_START = 120;
const CENTER_CORE_WORLD_WIDTH_END = 340;
const CENTER_CORE_WORLD_HEIGHT_START = 180;
const CENTER_CORE_WORLD_HEIGHT_END = 520;

/** 各粒へ掛けるHDR倍率。0で消え、1が元の明るさ。1超も使え、上限補正はしない。 */
const FLYING_BODY_HDR_BRIGHTNESS = 1.6;
const FLYING_CORE_HDR_BRIGHTNESS = 2.4;
const CENTER_BODY_HDR_BRIGHTNESS = 0.75;
const CENTER_CORE_HDR_BRIGHTNESS = 2.6;

/** 中央粒へ掛ける大きさ。0以上でMINはMAX以下。1が元の大きさ、0なら見えない。 */
const CENTER_PARTICLE_SCALE_MIN = 0.55;
const CENTER_PARTICLE_SCALE_MAX = 1.1;

/** 火元がこの速さ未満なら、移動方向の後ろへ尾を引かない。3D距離/秒で0より大きくする。 */
const TRAIL_SOURCE_SPEED_MIN = 40;

/** 火元の速さから尾の後方速度を作る倍率。0以上。0でも後方速度のMINは残る。 */
const TRAIL_BACKWARD_SPEED_FACTOR = 0.55;

/** 尾の後方速度を収める範囲。3D距離/秒で0以上、MINはMAX以下にする。 */
const TRAIL_BACKWARD_SPEED_MIN = 350;
const TRAIL_BACKWARD_SPEED_MAX = 900;

/** 尾を軌道の周りへ散らす速さ。3D距離/秒で0以上。0なら散らさない。 */
const getRandomTrailRadialSpeed = createRandomNumberGenerator({
  rangeMin: 0,
  startValue: 60,
  addRange: 120,
});

/** 尾を散らす向き。単位はラジアン。 */
const getRandomTrailAngleRadians = createRandomNumberGenerator({
  rangeMin: 0,
  rangeMax: Math.PI * 2,
  startValue: 0,
  addRange: Math.PI * 2,
});

/** 尾の速度を1秒ごとに弱める空気抵抗。0より大きくする。大きいほど早く止まる。 */
const TRAIL_AIR_DRAG_PER_SECOND = 5;

/** 尾を上へ浮かせる加速度。3D距離/秒²。0なら浮かず、負数なら下へ動く。 */
const TRAIL_BUOYANCY_WORLD_UNITS_PER_SECOND_SQUARED = 1_200;

/** 尾へ掛ける横加速度の倍率。0以上。0なら横へ曲げず、1なら元の強さ。 */
const TRAIL_HORIZONTAL_ACCELERATION_SCALE = 0.25;

/** 中央炎へ掛ける横加速度の倍率。0以上。0なら曲げず、1なら元の強さ。 */
const CENTER_HORIZONTAL_ACCELERATION_SCALE = 0.45;

/** 捨てる透明度の境目。0〜1。0なら捨てず、1なら完全に不透明な画素だけを残す。 */
const PARTICLE_ALPHA_CUTOFF = 0.01;

/** 粒の描画順。通常フレアと横長フレアより小さい値にする。 */
const PARTICLE_RENDER_ORDER = 1;

/** ぼかした粒の開始色と終了色。24bitのRGB値で指定する。 */
const PARTICLE_BODY_COLOR_START = new THREE.Color(0xff6622);
const PARTICLE_BODY_COLOR_END = new THREE.Color(0x990000);

/** くっきりした粒の開始色と終了色。HDR倍率はあとで掛ける。 */
const PARTICLE_CORE_COLOR_START = new THREE.Color().setRGB(1, 0.55, 0.18);
const PARTICLE_CORE_COLOR_END = new THREE.Color(0xff3300);

/** 粒が生まれるたびに使い回す、移動のひな形。 */
type ParticleMotionTemplate = {
  /** 最初に表示するまでの待ち時間。秒で0以上。 */
  initialDelaySeconds: number;

  /** 粒が見えている時間。秒で0より大きくする。 */
  lifetimeSeconds: number;

  /** 粒を出すか決める乱数。0以上1未満。 */
  spawnThreshold: number;

  /** 火元からずらす3D距離。 */
  emissionOffset: THREE.Vector3;

  /** 中央炎の初速。3D距離/秒。 */
  initialVelocity: THREE.Vector3;

  /** 飛ぶ火元の軌道まわりへ散らす初速。3D距離/秒。 */
  trailSpreadVelocity: THREE.Vector3;

  /** X・Z方向へ曲げる加速度。3D距離/秒²。 */
  horizontalAcceleration: THREE.Vector3;
};

/** 粒1つについて、フレームをまたいで保存する状態。 */
type ParticleState = {
  /** 粒が生まれてからの秒数。負数の間は表示を待っている。 */
  ageSeconds: number;

  /** trueなら中央炎、falseなら飛ぶ火元の尾。 */
  isCenterFire: boolean;

  /** 使う画像を指す番号。 */
  textureIndex: number;

  /** 粒を出す火元。nullなら中央炎。 */
  emitter: FireParticleEmitter | null;

  /** 粒が生まれた瞬間の3D座標。 */
  emissionOrigin: THREE.Vector3;

  /** 粒が生まれた瞬間の速度。3D距離/秒。 */
  emissionVelocity: THREE.Vector3;

  /** この粒が使う移動のひな形。 */
  motion: ParticleMotionTemplate;
};

/** 同じ画像を使う粒と、その粒を一度に描くMesh。 */
type ParticleBatch = {
  states: ParticleState[];
  mesh: THREE.InstancedMesh;
};

/** ぼかした粒と、くっきりした粒をこの順で受け取る。 */
export type FireParticleTextures = readonly [blurred: THREE.Texture, sharp: THREE.Texture];

/** 粒を出す場所、速度、量を毎フレーム受け取る。 */
export type FireParticleEmitter = {
  /** 火元の3D座標。 */
  position: THREE.Vector3;

  /** 火元の速度。3D距離/秒。 */
  velocity: THREE.Vector3;

  /**
   * 新しい粒を出す割合。0〜1。0なら止め、1ならすべて出す。
   * 0以下は0個、1以上は全粒になるが、値自体は補正しない。
   */
  particleSpawnRate: number;
};

/**
 * sceneへ2種類の粒を描くMeshを追加し、毎フレームの更新関数を返す。
 * 呼び出し側でemittersを先に更新し、返した関数へ0以上の経過秒を渡す。
 */
export function createFireParticleSystem(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  particleTextures: FireParticleTextures,
  emitters: readonly FireParticleEmitter[],
  centerFirePosition: THREE.Vector3,
) {
  const motionTemplates = createParticleMotionTemplates();
  const particleStates = createParticleStates(emitters, centerFirePosition, motionTemplates);
  const particleBatches = createParticleBatches(scene, particleTextures, particleStates);

  // すべての粒の更新中に新しいオブジェクトを作らないよう、計算用の値を使い回す。
  const scratchMatrix = new THREE.Matrix4();
  const scratchPosition = new THREE.Vector3();
  const scratchScale = new THREE.Vector3();
  const scratchColor = new THREE.Color();

  /** 1種類の画像を使う粒を更新する。deltaSecondsは0以上の経過秒。 */
  function updateParticleBatch(batch: ParticleBatch, deltaSeconds: number) {
    for (let particleIndex = 0; particleIndex < batch.states.length; particleIndex += 1) {
      const particle = batch.states[particleIndex];
      const previousAgeSeconds = particle.ageSeconds;
      particle.ageSeconds += deltaSeconds;

      const hasFinishedLifetime = particle.ageSeconds >= particle.motion.lifetimeSeconds;
      const hasFinishedWaiting = previousAgeSeconds < 0 && particle.ageSeconds >= 0;

      if (hasFinishedLifetime || hasFinishedWaiting) {
        // 新しく出す粒だけを減らす。すでに飛んだ粒は寿命までそのまま残す。
        if (canSpawnParticle(particle)) {
          if (hasFinishedLifetime) {
            particle.ageSeconds %= particle.motion.lifetimeSeconds;
          }
          captureParticleEmissionState(particle, centerFirePosition);
        } else {
          particle.ageSeconds = -PARTICLE_SPAWN_RETRY_SECONDS;
        }
      }

      // 最初の待ち時間中は、大きさを0にして同じMeshの中へ隠す。
      if (particle.ageSeconds < 0) {
        scratchScale.setScalar(0);
        scratchMatrix.compose(centerFirePosition, camera.quaternion, scratchScale);
        batch.mesh.setMatrixAt(particleIndex, scratchMatrix);
        continue;
      }

      const lifetimeProgress = particle.ageSeconds / particle.motion.lifetimeSeconds;
      const lifetimeFadeFactor = getParticleLifetimeFadeFactor(
        particle.ageSeconds,
        particle.motion.lifetimeSeconds,
      );
      const halfAgeSquared = particle.ageSeconds * particle.ageSeconds * 0.5;

      scratchPosition.copy(particle.emissionOrigin).add(particle.motion.emissionOffset);
      if (particle.isCenterFire) {
        // 中央は上昇速度を保ち、横風だけで炎の形を曲げる。
        scratchPosition.addScaledVector(particle.emissionVelocity, particle.ageSeconds);
        scratchPosition.x +=
          particle.motion.horizontalAcceleration.x *
          halfAgeSquared *
          CENTER_HORIZONTAL_ACCELERATION_SCALE;
        scratchPosition.z +=
          particle.motion.horizontalAcceleration.z *
          halfAgeSquared *
          CENTER_HORIZONTAL_ACCELERATION_SCALE;
      } else {
        // 尾は後方へ出たあと空気で減速し、横へ散りながら上へ浮く。
        const dragAdjustedTime = getDragAdjustedTime(particle.ageSeconds);
        scratchPosition.addScaledVector(particle.emissionVelocity, dragAdjustedTime);
        scratchPosition.x +=
          particle.motion.horizontalAcceleration.x *
          halfAgeSquared *
          TRAIL_HORIZONTAL_ACCELERATION_SCALE;
        scratchPosition.y +=
          (TRAIL_BUOYANCY_WORLD_UNITS_PER_SECOND_SQUARED / TRAIL_AIR_DRAG_PER_SECOND) *
          (particle.ageSeconds - dragAdjustedTime);
        scratchPosition.z +=
          particle.motion.horizontalAcceleration.z *
          halfAgeSquared *
          TRAIL_HORIZONTAL_ACCELERATION_SCALE;
      }
      const isSharpParticle = particle.textureIndex === SHARP_PARTICLE_TEXTURE_INDEX;
      setParticleWorldScale(
        scratchScale,
        particle.isCenterFire,
        isSharpParticle,
        lifetimeProgress,
        particle.motion.spawnThreshold,
      );
      scratchColor
        .copy(isSharpParticle ? PARTICLE_CORE_COLOR_START : PARTICLE_BODY_COLOR_START)
        .lerp(
          isSharpParticle ? PARTICLE_CORE_COLOR_END : PARTICLE_BODY_COLOR_END,
          lifetimeProgress,
        );
      scratchColor.multiplyScalar(lifetimeFadeFactor * getParticleHdrBrightness(particle));

      // 平らな粒をカメラと同じ向きにし、どの角度から見ても丸く見せる。
      scratchMatrix.compose(scratchPosition, camera.quaternion, scratchScale);
      batch.mesh.setMatrixAt(particleIndex, scratchMatrix);
      batch.mesh.setColorAt(particleIndex, scratchColor);
    }

    // CPUで書き換えた位置と色を、このフレームでGPUへ送る。
    batch.mesh.instanceMatrix.needsUpdate = true;
    if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
  }

  return (deltaSeconds: number) => {
    for (const particleBatch of particleBatches) {
      updateParticleBatch(particleBatch, deltaSeconds);
    }
  };
}

/** 粒ごとに決めた画像へ分け、画像ごとに1つのInstancedMeshへまとめる。 */
function createParticleBatches(
  scene: THREE.Scene,
  particleTextures: FireParticleTextures,
  particleStates: ParticleState[],
) {
  const statesByTexture = particleTextures.map(() => [] as ParticleState[]);

  for (const particleState of particleStates) {
    statesByTexture[particleState.textureIndex].push(particleState);
  }

  return particleTextures.map((texture, textureIndex): ParticleBatch => {
    const states = statesByTexture[textureIndex];
    const mesh = createInstancedBillboard({
      texture,
      maxInstanceCount: states.length,
      renderOrder: PARTICLE_RENDER_ORDER,
      alphaTest: PARTICLE_ALPHA_CUTOFF,
      initialColor:
        textureIndex === SHARP_PARTICLE_TEXTURE_INDEX
          ? PARTICLE_CORE_COLOR_START
          : PARTICLE_BODY_COLOR_START,
    });
    scene.add(mesh);
    return { states, mesh };
  });
}

/** 全火元で共有する動きを作る。共有すると乱数と保存量を増やさずに済む。 */
function createParticleMotionTemplates() {
  return Array.from(
    {
      length: Math.max(FLYING_FIRE_PARTICLE_COUNT_PER_SOURCE, CENTER_FIRE_PARTICLE_COUNT),
    },
    (): ParticleMotionTemplate => ({
      initialDelaySeconds: getRandomParticleInitialDelaySeconds(),
      lifetimeSeconds: getRandomParticleLifetimeSeconds(),
      spawnThreshold: getRandomParticleSpawnThreshold(),
      emissionOffset: new THREE.Vector3(
        getRandomParticleEmissionOffset(),
        getRandomParticleEmissionOffset(),
        getRandomParticleEmissionOffset(),
      ),
      initialVelocity: new THREE.Vector3(
        getRandomParticleHorizontalVelocity(),
        getRandomParticleUpwardVelocity(),
        getRandomParticleHorizontalVelocity(),
      ),
      trailSpreadVelocity: createTrailSpreadVelocity(),
      horizontalAcceleration: new THREE.Vector3(
        getRandomParticleHorizontalAcceleration(),
        0,
        getRandomParticleHorizontalAcceleration(),
      ),
    }),
  );
}

/** 尾を軌道の周りへ散らす、地面と平行な速度を作る。 */
function createTrailSpreadVelocity() {
  const angle = getRandomTrailAngleRadians();
  const speed = getRandomTrailRadialSpeed();
  return new THREE.Vector3(Math.cos(angle) * speed, 0, Math.sin(angle) * speed);
}

/** 飛ぶ火元の粒と、中央の炎の粒を同じ配列へまとめる。 */
function createParticleStates(
  emitters: readonly FireParticleEmitter[],
  centerFirePosition: THREE.Vector3,
  motionTemplates: ParticleMotionTemplate[],
) {
  const flyingParticleMotionTemplates = motionTemplates.slice(
    0,
    FLYING_FIRE_PARTICLE_COUNT_PER_SOURCE,
  );
  const particleStates = emitters.flatMap((emitter) =>
    flyingParticleMotionTemplates.map((motion, particleIndex) =>
      createParticleState(
        motion,
        emitter,
        centerFirePosition,
        false,
        getParticleTextureIndex(particleIndex),
      ),
    ),
  );

  for (let particleIndex = 0; particleIndex < CENTER_FIRE_PARTICLE_COUNT; particleIndex += 1) {
    particleStates.push(
      createParticleState(
        motionTemplates[particleIndex],
        null,
        centerFirePosition,
        true,
        getParticleTextureIndex(particleIndex),
      ),
    );
  }
  return particleStates;
}

/** 1つの粒が持つ、使い回し可能な状態を作る。 */
function createParticleState(
  motion: ParticleMotionTemplate,
  emitter: FireParticleEmitter | null,
  centerFirePosition: THREE.Vector3,
  isCenterFire: boolean,
  textureIndex: number,
): ParticleState {
  return {
    ageSeconds: -motion.initialDelaySeconds,
    isCenterFire,
    textureIndex,
    emitter,
    emissionOrigin: (emitter?.position ?? centerFirePosition).clone(),
    emissionVelocity: (isCenterFire ? motion.initialVelocity : motion.trailSpreadVelocity).clone(),
    motion,
  };
}

/** 生まれた位置と速度を保存し、その後は火元を追いかけさせない。 */
function captureParticleEmissionState(particle: ParticleState, centerFirePosition: THREE.Vector3) {
  const emitter = particle.emitter;
  particle.emissionOrigin.copy(emitter?.position ?? centerFirePosition);

  if (!emitter) {
    particle.emissionVelocity.copy(particle.motion.initialVelocity);
    return;
  }

  particle.emissionVelocity.copy(particle.motion.trailSpreadVelocity);
  const sourceSpeed = emitter.velocity.length();
  if (sourceSpeed < TRAIL_SOURCE_SPEED_MIN) return;

  const backwardSpeed = THREE.MathUtils.clamp(
    sourceSpeed * TRAIL_BACKWARD_SPEED_FACTOR,
    TRAIL_BACKWARD_SPEED_MIN,
    TRAIL_BACKWARD_SPEED_MAX,
  );
  particle.emissionVelocity.addScaledVector(emitter.velocity, -backwardSpeed / sourceSpeed);
}

/**
 * 中央炎は常に出し、飛ぶ火元はparticleSpawnRateに選ばれた粒だけを出す。
 * 放出量が0以下なら0個、1以上なら全粒になる。
 */
function canSpawnParticle(particle: ParticleState) {
  return (
    particle.emitter === null || particle.emitter.particleSpawnRate > particle.motion.spawnThreshold
  );
}

/**
 * 寿命の最後だけふわっと消える明るさを0〜1で返す。
 * ageSecondsは0以上、lifetimeSecondsは0より大きくする。
 */
function getParticleLifetimeFadeFactor(ageSeconds: number, lifetimeSeconds: number) {
  const fadeDurationSeconds = Math.min(PARTICLE_LIFETIME_FADE_MAX_SECONDS, lifetimeSeconds * 0.5);
  return THREE.MathUtils.smoothstep(lifetimeSeconds - ageSeconds, 0, fadeDurationSeconds);
}

/** 空気抵抗で速度が落ちるぶんを含め、粒が初速で進む時間を返す。ageSecondsは0以上。 */
function getDragAdjustedTime(ageSeconds: number) {
  return -Math.expm1(-TRAIL_AIR_DRAG_PER_SECOND * ageSeconds) / TRAIL_AIR_DRAG_PER_SECOND;
}

/**
 * 中央は縦長、飛ぶ火花は正円になる大きさを書き込む。
 * lifetimeProgressとscaleSeedは0〜1を想定し、範囲外でも補正しない。
 */
function setParticleWorldScale(
  target: THREE.Vector3,
  isCenterFire: boolean,
  isSharpParticle: boolean,
  lifetimeProgress: number,
  scaleSeed: number,
) {
  if (isCenterFire) {
    const widthStart = isSharpParticle
      ? CENTER_CORE_WORLD_WIDTH_START
      : CENTER_BODY_WORLD_WIDTH_START;
    const widthEnd = isSharpParticle ? CENTER_CORE_WORLD_WIDTH_END : CENTER_BODY_WORLD_WIDTH_END;
    const heightStart = isSharpParticle
      ? CENTER_CORE_WORLD_HEIGHT_START
      : CENTER_BODY_WORLD_HEIGHT_START;
    const heightEnd = isSharpParticle ? CENTER_CORE_WORLD_HEIGHT_END : CENTER_BODY_WORLD_HEIGHT_END;
    const scaleVariation = THREE.MathUtils.lerp(
      CENTER_PARTICLE_SCALE_MIN,
      CENTER_PARTICLE_SCALE_MAX,
      scaleSeed,
    );
    target.set(
      THREE.MathUtils.lerp(widthStart, widthEnd, lifetimeProgress) * scaleVariation,
      THREE.MathUtils.lerp(heightStart, heightEnd, lifetimeProgress) * scaleVariation,
      1,
    );
    return;
  }

  target.setScalar(
    THREE.MathUtils.lerp(
      FLYING_PARTICLE_WORLD_SIZE_START,
      FLYING_PARTICLE_WORLD_SIZE_END,
      lifetimeProgress,
    ),
  );
}

/** 画像の種類と火元から、粒1つのHDRの明るさを返す。 */
function getParticleHdrBrightness(particle: ParticleState) {
  const isSharpParticle = particle.textureIndex === SHARP_PARTICLE_TEXTURE_INDEX;
  if (particle.isCenterFire) {
    return isSharpParticle ? CENTER_CORE_HDR_BRIGHTNESS : CENTER_BODY_HDR_BRIGHTNESS;
  }
  return isSharpParticle ? FLYING_CORE_HDR_BRIGHTNESS : FLYING_BODY_HDR_BRIGHTNESS;
}

/** 0以上の粒番号から、ぼかし画像かくっきり画像を指す番号を返す。 */
function getParticleTextureIndex(particleIndex: number) {
  return particleIndex % SHARP_PARTICLE_INTERVAL === SHARP_PARTICLE_INTERVAL - 1
    ? SHARP_PARTICLE_TEXTURE_INDEX
    : BLURRED_PARTICLE_TEXTURE_INDEX;
}
