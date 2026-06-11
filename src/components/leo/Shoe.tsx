import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import shoeAsset from "@/assets/leo-shoe.glb.asset.json";

useGLTF.preload(shoeAsset.url);

export type Colorway = "white" | "grey" | "red" | "volt";

const COLORS: Record<Colorway, THREE.ColorRepresentation> = {
  white: "#f5f5f5",
  grey: "#6b7280",
  red: "#dc2626",
  volt: "#d4ff00",
};

interface ShoeProps {
  colorway?: Colorway;
  explode?: number; // 0 -> 1
}

export function Shoe({ colorway = "white", explode = 0 }: ShoeProps) {
  const { scene } = useGLTF(shoeAsset.url) as any;
  const root = useRef<THREE.Group>(null);

  // Clone the scene so multiple instances don't share matrices
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && "roughness" in mat) {
          mat.envMapIntensity = 1.2;
        }
        // store original position for explode
        (mesh.userData as any).origPos = mesh.position.clone();
        (mesh.userData as any).explodeDir = mesh.position
          .clone()
          .sub(new THREE.Vector3(0, 0, 0))
          .normalize();
        if ((mesh.userData as any).explodeDir.lengthSq() === 0) {
          (mesh.userData as any).explodeDir = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random(),
            (Math.random() - 0.5) * 2,
          ).normalize();
        }
      }
    });
    return c;
  }, [scene]);

  // Color tinting
  useEffect(() => {
    const tint = new THREE.Color(COLORS[colorway]);
    cloned.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.color) {
          if (!(mesh.userData as any).origColor) {
            (mesh.userData as any).origColor = mat.color.clone();
          }
          const orig = (mesh.userData as any).origColor as THREE.Color;
          mat.color.copy(orig).lerp(tint, 0.55);
          mat.needsUpdate = true;
        }
      }
    });
  }, [colorway, cloned]);

  // Explode
  useEffect(() => {
    cloned.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const orig = (mesh.userData as any).origPos as THREE.Vector3;
        const dir = (mesh.userData as any).explodeDir as THREE.Vector3;
        if (orig && dir) {
          mesh.position.copy(orig).add(dir.clone().multiplyScalar(explode * 0.4));
        }
      }
    });
  }, [explode, cloned]);

  return (
    <group ref={root} dispose={null}>
      <primitive object={cloned} />
    </group>
  );
}
