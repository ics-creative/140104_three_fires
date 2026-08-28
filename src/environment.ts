import * as THREE from "three/webgpu";
import fireParticleBlurredUrl from "./imgs/fire_particle.png";
import fireParticleSharpUrl from "./imgs/fire_particle_sharp.png";
import floorColorUrl from "./imgs/floor_diffuse.jpg";
import floorNormalUrl from "./imgs/floor_normal.jpg";
import floorSpecularUrl from "./imgs/floor_specular.jpg";
import fireFlareUrl from "./imgs/lens_frare.png";
import nearFireFlareUrl from "./imgs/lens_frare_active.png";

/** 床と火元が共有するY座標。0が原点で、負数は原点より下。 */
export const GROUND_LEVEL_Y = -300;

/** 正方形の床の一辺。3D空間の単位で0より大きくする。0なら床は見えない。 */
const FLOOR_WORLD_SIZE = 18_000;

/** 床画像を一辺に並べる回数。0より大きくする。1なら画像を1枚だけ貼り、小数も使える。 */
const FLOOR_TEXTURE_REPEAT_COUNT = 24;

/** 床の反射色へ掛ける明るさ。0以上。0なら反射せず、1超はHDRとして強く光る。 */
const FLOOR_SPECULAR_BRIGHTNESS = 8;

/** 床に映る光の輪郭の細さ。0以上。大きいほど細く、0へ近いほど広くなる。 */
const FLOOR_SHININESS = 40;

type SceneTextures = {
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

/** loadSceneTexturesの戻り値から、GROUND_LEVEL_Yへ水平に置く床を作る。 */
export function createFloor(textures: SceneTextures) {
  const material = new THREE.MeshPhongMaterial({
    map: textures.floorColor,
    normalMap: textures.floorNormal,
    specularMap: textures.floorSpecular,
    specular: new THREE.Color().setRGB(
      FLOOR_SPECULAR_BRIGHTNESS,
      FLOOR_SPECULAR_BRIGHTNESS,
      FLOOR_SPECULAR_BRIGHTNESS,
    ),
    shininess: FLOOR_SHININESS,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_WORLD_SIZE, FLOOR_WORLD_SIZE),
    material,
  );
  floor.position.y = GROUND_LEVEL_Y;
  floor.rotation.x = -Math.PI / 2;
  return floor;
}
