import * as THREE from "three/webgpu";
import type { TextureSet } from "./textures";

/** 床と火元が共有するY座標。0が原点で、負数は原点より下。 */
export const Y_GROUND = -300;

/** 読み込んだ床画像から、火元と同じ高さに置く床を作る。 */
export function createFloor(textures: TextureSet) {
  // 18,000×18,000の床を96×96に分割する。分割数がワイヤーフレームの密度になる。
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18_000, 18_000, 96, 96),
    // specularはHDR反射の強さ、shininessは反射の鋭さを決める。
    new THREE.MeshPhongMaterial({
      map: textures.textureFloorColor,
      normalMap: textures.textureFloorNormal,
      specularMap: textures.textureFloorSpecular,
      specular: new THREE.Color().setScalar(8),
      shininess: 40,
    }),
  );
  floor.position.y = Y_GROUND;
  floor.rotation.x = -Math.PI / 2;
  return floor;
}
