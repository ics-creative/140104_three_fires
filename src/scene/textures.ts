import * as THREE from "three/webgpu";
import fireParticleBlurredUrl from "../assets/fire_particle.png";
import fireParticleSharpUrl from "../assets/fire_particle_sharp.png";
import floorColorUrl from "../assets/floor_diffuse.jpg";
import floorNormalUrl from "../assets/floor_normal.jpg";
import floorSpecularUrl from "../assets/floor_specular.jpg";
import fireFlareUrl from "../assets/lens_frare.png";
import nearFireFlareUrl from "../assets/lens_frare_active.png";

/** 床画像を一辺に並べる回数。0より大きくする。1なら画像を1枚だけ貼り、小数も使える。 */
const FLOOR_TEXTURE_REPEAT_COUNT = 24;

export type SceneTextures = {
  /** 床の色を描く画像。 */
  floorColor: THREE.Texture;

  /** 床の細かな凹凸を表す数値画像。 */
  floorNormal: THREE.Texture;

  /** 床の反射しやすい場所を表す数値画像。 */
  floorSpecular: THREE.Texture;

  /** ぼかした炎と、くっきりした炎の画像。順番を変えない。 */
  fireParticles: readonly [blurred: THREE.Texture, sharp: THREE.Texture];

  /** 火元の丸い光を描く画像。 */
  fireFlare: THREE.Texture;

  /** 画面を横へ伸びる大きな光を描く画像。 */
  nearFireFlare: THREE.Texture;
};

/**
 * 静的importした画像の読み込みを始め、設定済みのTextureをすぐ返す。
 * 画像データは読み込みが終わったものからTextureへ入る。
 */
export function loadSceneTextures(): SceneTextures {
  const textureLoader = new THREE.TextureLoader();
  const floorColor = textureLoader.load(floorColorUrl);
  const floorNormal = textureLoader.load(floorNormalUrl);
  const floorSpecular = textureLoader.load(floorSpecularUrl);
  const fireParticles = [
    textureLoader.load(fireParticleBlurredUrl),
    textureLoader.load(fireParticleSharpUrl),
  ] as const;
  const fireFlare = textureLoader.load(fireFlareUrl);
  const nearFireFlare = textureLoader.load(nearFireFlareUrl);

  // 人が見る色の画像だけをsRGBとして読む。凹凸と反射の画像は数値データのまま使う。
  for (const colorTexture of [floorColor, ...fireParticles, fireFlare, nearFireFlare]) {
    colorTexture.colorSpace = THREE.SRGBColorSpace;
  }

  // 床の模様を繰り返し、元画像の荒い質感をぼかさずに残す。
  for (const floorTexture of [floorColor, floorNormal, floorSpecular]) {
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.setScalar(FLOOR_TEXTURE_REPEAT_COUNT);
    floorTexture.generateMipmaps = false;
    floorTexture.minFilter = THREE.NearestFilter;
    floorTexture.magFilter = THREE.NearestFilter;
  }

  // 2種類の炎の粒は、元画像の輪郭をぼかさずに使う。
  for (const fireParticle of fireParticles) {
    fireParticle.generateMipmaps = false;
    fireParticle.minFilter = THREE.NearestFilter;
    fireParticle.magFilter = THREE.NearestFilter;
  }

  return {
    floorColor,
    floorNormal,
    floorSpecular,
    fireParticles,
    fireFlare,
    nearFireFlare,
  };
}
