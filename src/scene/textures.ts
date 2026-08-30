import * as THREE from "three/webgpu";
import urlFireBlurred from "../assets/fire_particle.png";
import urlFireSharp from "../assets/fire_particle_sharp.png";
import urlFloorColor from "../assets/floor_diffuse.jpg";
import urlFloorNormal from "../assets/floor_normal.jpg";
import urlFloorSpecular from "../assets/floor_specular.jpg";
import urlFlare from "../assets/lens_frare.png";
import urlFlareStreak from "../assets/lens_frare_active.png";

/** 床テクスチャの繰り返し回数。0より大きい値で、1が画像1枚分。小数も指定できる。 */
const NUM_FLOOR_TILES = 24;
/** loadTexturesの戻り値。床、粒、フレアのTextureを持つ。 */
export type TextureSet = ReturnType<typeof loadTextures>;
/** 静的importした画像の読み込みを開始し、Textureを返す。読み込み完了後に画像データが設定される。 */
export function loadTextures() {
  const loader = new THREE.TextureLoader();
  const textureFloorColor = loader.load(urlFloorColor);
  const textureFloorNormal = loader.load(urlFloorNormal);
  const textureFloorSpecular = loader.load(urlFloorSpecular);
  const textureFireBlurred = loader.load(urlFireBlurred);
  const textureFireSharp = loader.load(urlFireSharp);
  const textureFlare = loader.load(urlFlare);
  const textureFlareStreak = loader.load(urlFlareStreak);
  const texturesFloor = [textureFloorColor, textureFloorNormal, textureFloorSpecular];
  const texturesParticles = [textureFireBlurred, textureFireSharp] as const;

  // 床の色・炎・フレアはsRGB、法線と反射は数値テクスチャとして読む。
  for (const texture of [textureFloorColor, ...texturesParticles, textureFlare, textureFlareStreak])
    texture.colorSpace = THREE.SRGBColorSpace;

  // RepeatWrappingで床画像を敷き詰める。
  for (const texture of texturesFloor) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.setScalar(NUM_FLOOR_TILES);
  }

  // minFilterはNearestFilter、generateMipmapsはfalse。床と炎の輪郭を残す。
  for (const texture of [...texturesFloor, ...texturesParticles]) {
    texture.generateMipmaps = false;
    texture.minFilter = texture.magFilter = THREE.NearestFilter;
  }

  // 横線を含む帯を切り出し、上下を反転して横長フレアに使う。
  textureFlareStreak.offset.y = 1;
  textureFlareStreak.repeat.y = 336 / 512 - 1;
  return {
    textureFloorColor,
    textureFloorNormal,
    textureFloorSpecular,
    texturesParticles,
    textureFlare,
    textureFlareStreak,
  };
}
