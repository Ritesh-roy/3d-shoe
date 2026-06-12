import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
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
  explode?: number;
  targetSize?: number; // largest bounding dimension in world units
}

export function Shoe({ colorway = "white", explode = 0, targetSize = 2.2 }: ShoeProps) {
  const { scene } = useGLTF(shoeAsset.url) as any;
  const { gl } = useThree();
  const root = useRef<THREE.Group>(null);

  // Clone + normalize the model: center it & scale so its largest dimension == targetSize
  const { cloned, fitScale, centerOffset } = useMemo(() => {
    const c = scene.clone(true);
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

    const tuneTexture = (texture?: THREE.Texture | null, colorMap = false) => {
      if (!texture) return;
      texture.anisotropy = maxAnisotropy;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      if (colorMap) texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    };

    // Compute bounding box of raw scene
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fit = targetSize / maxDim;

    c.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          const mat = material as THREE.MeshStandardMaterial;
          if (!mat || !("roughness" in mat)) return;
          mat.envMapIntensity = 0.65;
          if (mat.roughness < 0.28) mat.roughness = 0.32;
          if (mat.metalness > 0.45) mat.metalness = 0.35;
          if (mat.color) {
            const brightest = Math.max(mat.color.r, mat.color.g, mat.color.b);
            if (brightest > 0.9) mat.color.multiplyScalar(0.82);
          }
          if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
          if ("emissiveIntensity" in mat) mat.emissiveIntensity = 0;
          tuneTexture(mat.map, true);
          tuneTexture(mat.normalMap);
          tuneTexture(mat.roughnessMap);
          tuneTexture(mat.metalnessMap);
          tuneTexture(mat.aoMap);
          tuneTexture(mat.bumpMap);
          tuneTexture(mat.alphaMap);
          tuneTexture(mat.emissiveMap, true);
          mat.needsUpdate = true;
        });
        (mesh.userData as any).origPos = mesh.position.clone();
        const meshBox = new THREE.Box3().setFromObject(mesh);
        const meshCenter = new THREE.Vector3();
        meshBox.getCenter(meshCenter);
        const rel = meshCenter.clone().sub(center);
        const halfY = size.y * 0.5 || 1;
        const halfZ = size.z * 0.5 || 1;
        const ny = rel.y / halfY; // -1..1
        const nz = rel.z / halfZ;
        // Bucket into 4 major parts and pick a single clean axis per part
        const dir = new THREE.Vector3();
        if (ny < -0.35) {
          // outsole / studs — drop downward
          dir.set(0, -1, 0);
        } else if (ny < 0.05) {
          // midsole — small downward
          dir.set(0, -0.55, 0);
        } else if (nz < -0.3) {
          // heel structure — push backward
          dir.set(0, 0.2, -1);
        } else {
          // upper fabric — lift upward
          dir.set(0, 1, 0.05);
        }
        dir.normalize();
        (mesh.userData as any).explodeDir = dir;
      }
    });

    return { cloned: c, fitScale: fit, centerOffset: center };
  }, [gl, scene, targetSize]);

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
          mat.color.copy(orig).lerp(tint, colorway === "white" ? 0.04 : 0.18);
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
          mesh.position.copy(orig).add(dir.clone().multiplyScalar(explode * 0.75));
        }
      }
    });
  }, [explode, cloned]);

  return (
    <group ref={root} dispose={null} scale={fitScale} position={[-centerOffset.x * fitScale, -centerOffset.y * fitScale, -centerOffset.z * fitScale]}>
      <primitive object={cloned} />
    </group>
  );
}
