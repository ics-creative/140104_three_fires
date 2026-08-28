import * as THREE from "three/webgpu";

/** 丸い板の辺の数。3以上の整数。増やすほど丸くなるが、頂点も増える。 */
const BILLBOARD_EDGE_COUNT = 12;

type BillboardOptions = {
  /** 板へ貼る画像。 */
  texture: THREE.Texture;

  /** 同時に作れる板の最大数。0以上の整数。作成したあとでは増やせない。 */
  maxInstanceCount: number;

  /** 描く順番。小さい値から先に描き、決まった上下限はない。 */
  renderOrder: number;

  /** falseなら、ほかの3D物体の後ろにあっても隠さない。 */
  depthTest?: boolean;

  /** 捨てる透明度の境目。0〜1。0なら透明な画素を切り捨てない。 */
  alphaTest?: number;

  /** 画像から使う縦範囲の始点。0が下、1が上。0〜1を想定し、補正はしない。 */
  textureVStart?: number;

  /** 縦範囲の終点。0〜1を想定し、始点より小さくすると画像が上下反転する。 */
  textureVEnd?: number;

  /** 0番目の板へ最初に設定する色。各板の色は呼び出し側があとで上書きする。 */
  initialColor?: THREE.Color;
};

/**
 * 同じ画像を一度の描画でたくさん表示するInstancedMeshを作る。
 * 向きと大きさは呼び出し側が毎フレーム更新する。
 */
export function createInstancedBillboard({
  texture,
  maxInstanceCount,
  renderOrder,
  depthTest = true,
  alphaTest = 0,
  textureVStart = 0,
  textureVEnd = 1,
  initialColor = new THREE.Color(0xffffff),
}: BillboardOptions) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    alphaTest,
    depthTest,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(
    createBillboardGeometry(textureVStart, textureVEnd),
    material,
    maxInstanceCount,
  );

  // 位置と色は毎フレーム書き換えるため、GPUへ更新方法を先に伝える。
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, initialColor);
  mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);

  // 各インスタンスは大きく動くため、前の位置を使った画面外判定では消さない。
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return mesh;
}

/**
 * 画像の縦範囲を切り出した丸い板を作る。
 * startとendが同じなら高さ0、startが大きければ上下反転する。値は補正しない。
 */
function createBillboardGeometry(textureVStart: number, textureVEnd: number) {
  const visibleVRange = textureVEnd - textureVStart;

  // 多角形にして、画像の透明な角をGPUが描く量を減らす。
  const geometry = new THREE.CircleGeometry(0.5, BILLBOARD_EDGE_COUNT);
  geometry.scale(1, visibleVRange, 1);
  if (visibleVRange === 1) return geometry;

  // 元画像の上下を切り、光が入っている部分だけを板へ貼る。
  const textureCoordinates = geometry.getAttribute("uv");
  for (let vertexIndex = 0; vertexIndex < textureCoordinates.count; vertexIndex += 1) {
    const originalV = textureCoordinates.getY(vertexIndex);
    textureCoordinates.setY(vertexIndex, textureVStart + originalV * visibleVRange);
  }
  return geometry;
}
