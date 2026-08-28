import * as THREE from "three/webgpu";
import type { SceneTextures } from "./textures";

/** 床と火元が共有するY座標。0が原点で、負数は原点より下。 */
export const GROUND_LEVEL_Y = -300;

/** 正方形の床の一辺。3D空間の単位で0より大きくする。0なら床は見えない。 */
const FLOOR_WORLD_SIZE = 18_000;

/** 床の一辺を分ける数。1以上の整数。増やすほど格子が細かくなり、頂点数も増える。 */
const FLOOR_SEGMENT_COUNT = 96;

/** 床の反射色へ掛ける明るさ。0以上。0なら反射せず、1超はHDRとして強く光る。 */
const FLOOR_SPECULAR_BRIGHTNESS = 8;

/** 床に映る光の輪郭の細さ。0以上。大きいほど細く、0へ近いほど広くなる。 */
const FLOOR_SHININESS = 40;

/** 読み込んだ床画像から、火元と同じ高さに置く床を作る。 */
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
    new THREE.PlaneGeometry(
      FLOOR_WORLD_SIZE,
      FLOOR_WORLD_SIZE,
      FLOOR_SEGMENT_COUNT,
      FLOOR_SEGMENT_COUNT,
    ),
    material,
  );
  floor.position.y = GROUND_LEVEL_Y;
  floor.rotation.x = -Math.PI / 2;
  return floor;
}
