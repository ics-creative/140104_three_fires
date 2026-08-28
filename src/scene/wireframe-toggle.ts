import * as THREE from "three/webgpu";

type WireframeMaterial = THREE.Material & {
  wireframe: boolean;
};

/** マテリアルがThree.js組み込みのワイヤーフレーム表示に対応しているか調べる。 */
function supportsWireframe(material: THREE.Material): material is WireframeMaterial {
  return "wireframe" in material && typeof material.wireframe === "boolean";
}

/** チェックボックスの状態を、scene内にあるすべてのMeshへ反映する。 */
export function setupWireframeToggle(scene: THREE.Scene, checkbox: HTMLInputElement) {
  checkbox.addEventListener("change", () => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!supportsWireframe(material) || material.wireframe === checkbox.checked) continue;

        material.wireframe = checkbox.checked;
        material.needsUpdate = true;
      }
    });
  });
}
