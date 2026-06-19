import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import shoeAsset from "@/assets/leo-shoe.glb.asset.json";

// Lovable asset URLs are relative to the Lovable host. On other hosts
// (Vercel, custom domains) they 404 — rewrite to the absolute CDN origin.
const LOVABLE_ASSET_HOST = `https://id-preview--${shoeAsset.project_id}.lovable.app`;
const SHOE_URL = shoeAsset.url.startsWith("/__l5e/")
  ? `${LOVABLE_ASSET_HOST}${shoeAsset.url}`
  : shoeAsset.url;

useGLTF.preload(SHOE_URL);

export type Colorway = "white" | "grey" | "red" | "volt";

const COLORS: Record<Colorway, THREE.ColorRepresentation> = {
  white: "#f5f5f5",
  grey: "#6b7280",
  red: "#dc2626",
  volt: "#d4ff00",
};

interface ShoeProps {
  colorway?: Colorway;
  explode?: number; // kept for API compatibility, unused
  targetSize?: number;
}

export function Shoe({ colorway = "white", targetSize = 2.2 }: ShoeProps) {
  const { scene } = useGLTF(SHOE_URL) as any;
  const { gl } = useThree();
  const root = useRef<THREE.Group>(null);

  const { built, fitScale, centerOffset } = useMemo(() => {
    const source = scene.clone(true);
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

    const tuneTexture = (texture?: THREE.Texture | null, colorMap = false) => {
      if (!texture) return;
      texture.anisotropy = maxAnisotropy;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      if (colorMap) texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    };

    source.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(source);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fit = targetSize / maxDim;

    source.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && "roughness" in mat) {
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
        mat.needsUpdate = true;
      }
    });

    return { built: source, fitScale: fit, centerOffset: center };
  }, [gl, scene, targetSize]);

  useEffect(() => {
    const tint = new THREE.Color(COLORS[colorway]);
    built.traverse((obj: THREE.Object3D) => {
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
  }, [colorway, built]);

  return (
    <group
      ref={root}
      dispose={null}
      scale={fitScale}
      position={[-centerOffset.x * fitScale, -centerOffset.y * fitScale, -centerOffset.z * fitScale]}
    >
      <primitive object={built} />
    </group>
  );
}
