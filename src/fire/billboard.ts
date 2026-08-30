import * as THREE from "three/webgpu";

/**
 * maxInstancesは0以上の整数で、生成できるインスタンス数の上限になる。
 * renderOrderは透明物の描画順を決める。heightScaleは1が等倍、0が高さ0、負数が上下反転。
 */
type BillboardOptions = Pick<THREE.MeshBasicMaterialParameters, "depthTest" | "alphaTest"> & {
  texture: THREE.Texture;
  maxInstances: number;
  renderOrder: number;
  heightScale?: number;
};

/** 同じ画像の板を1回でまとめて描く。位置・向き・大きさ・色は呼び出し側が更新する。 */
export function createBillboards(options: BillboardOptions) {
  const { texture, maxInstances, renderOrder, heightScale, ...materialParameters } = options;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    ...materialParameters,
  });
  // 円を12分割し、粒の頂点数を抑える。
  const geometry = new THREE.CircleGeometry(0.5, 12);
  if (heightScale !== undefined) geometry.scale(1, heightScale, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);

  // setColorAtでinstanceColorを作る。位置と色はDynamicDrawUsageで毎フレーム更新する。
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color());
  mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);

  // frustumCulled=falseで全インスタンスを描画候補へ入れる。
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return mesh;
}
