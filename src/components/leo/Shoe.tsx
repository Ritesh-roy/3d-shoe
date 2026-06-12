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

type PartKey = "upper" | "midsole" | "outsole" | "heel";

const PART_DIRS: Record<PartKey, [number, number, number]> = {
  upper: [0, 1.0, 0.05],
  midsole: [0, -0.45, 0],
  outsole: [0, -1.0, 0],
  heel: [0, 0.25, -1.0],
};

const EXPLODE_MAGNITUDE = 1.1;

interface ShoeProps {
  colorway?: Colorway;
  explode?: number;
  targetSize?: number;
}

// Split a mesh's geometry into 4 part-buckets based on triangle centroid.
function splitMeshIntoParts(
  mesh: THREE.Mesh,
  bounds: { min: THREE.Vector3; max: THREE.Vector3 },
): Partial<Record<PartKey, THREE.Mesh>> {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
  if (!posAttr) return {};
  const normAttr = geom.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const uvAttr = geom.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const index = geom.getIndex();

  // Bake mesh's local-to-scene transform into vertex positions of the parts.
  mesh.updateWorldMatrix(true, false);
  const mat4 = mesh.matrixWorld.clone();
  const nmat = new THREE.Matrix3().getNormalMatrix(mat4);

  const triCount = index ? index.count / 3 : posAttr.count / 3;
  const buckets: Record<PartKey, { pos: number[]; nor: number[]; uv: number[] }> = {
    upper: { pos: [], nor: [], uv: [] },
    midsole: { pos: [], nor: [], uv: [] },
    outsole: { pos: [], nor: [], uv: [] },
    heel: { pos: [], nor: [], uv: [] },
  };

  const yMin = bounds.min.y;
  const yRange = bounds.max.y - bounds.min.y || 1;
  const zMin = bounds.min.z;
  const zRange = bounds.max.z - bounds.min.z || 1;

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const na = new THREE.Vector3();
  const nb = new THREE.Vector3();
  const nc = new THREE.Vector3();
  const cent = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const ia = index ? index.getX(t * 3) : t * 3;
    const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    va.fromBufferAttribute(posAttr, ia).applyMatrix4(mat4);
    vb.fromBufferAttribute(posAttr, ib).applyMatrix4(mat4);
    vc.fromBufferAttribute(posAttr, ic).applyMatrix4(mat4);
    cent.copy(va).add(vb).add(vc).multiplyScalar(1 / 3);

    const ny = (cent.y - yMin) / yRange; // 0..1 bottom..top
    const nz = (cent.z - zMin) / zRange; // 0..1 back..front

    let key: PartKey;
    if (ny > 0.45) key = "upper";
    else if (nz < 0.32) key = "heel";
    else if (ny < 0.18) key = "outsole";
    else key = "midsole";

    const bucket = buckets[key];
    bucket.pos.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);

    if (normAttr) {
      na.fromBufferAttribute(normAttr, ia).applyMatrix3(nmat).normalize();
      nb.fromBufferAttribute(normAttr, ib).applyMatrix3(nmat).normalize();
      nc.fromBufferAttribute(normAttr, ic).applyMatrix3(nmat).normalize();
      bucket.nor.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
    }
    if (uvAttr) {
      bucket.uv.push(
        uvAttr.getX(ia), uvAttr.getY(ia),
        uvAttr.getX(ib), uvAttr.getY(ib),
        uvAttr.getX(ic), uvAttr.getY(ic),
      );
    }
  }

  const out: Partial<Record<PartKey, THREE.Mesh>> = {};
  (Object.keys(buckets) as PartKey[]).forEach((k) => {
    const b = buckets[k];
    if (b.pos.length === 0) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    if (b.nor.length) g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
    else g.computeVertexNormals();
    if (b.uv.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    const cloneMat = (mesh.material as THREE.Material).clone();
    const m = new THREE.Mesh(g, cloneMat);
    m.castShadow = true;
    m.receiveShadow = true;
    out[k] = m;
  });
  return out;
}

export function Shoe({ colorway = "white", explode = 0, targetSize = 2.2 }: ShoeProps) {
  const { scene } = useGLTF(shoeAsset.url) as any;
  const { gl } = useThree();
  const root = useRef<THREE.Group>(null);
  const partGroupsRef = useRef<Record<PartKey, THREE.Group> | null>(null);

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

    // Compute global bounds in source-local space (before our normalizing transform).
    source.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(source);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fit = targetSize / maxDim;

    // Collect every mesh, then split each into part-meshes.
    const sourceMeshes: THREE.Mesh[] = [];
    source.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) sourceMeshes.push(m);
    });

    const partGroups: Record<PartKey, THREE.Group> = {
      upper: new THREE.Group(),
      midsole: new THREE.Group(),
      outsole: new THREE.Group(),
      heel: new THREE.Group(),
    };
    (Object.keys(partGroups) as PartKey[]).forEach((k) => {
      partGroups[k].name = `part-${k}`;
      (partGroups[k].userData as any).originPos = new THREE.Vector3(0, 0, 0);
      (partGroups[k].userData as any).explodeDir = new THREE.Vector3(...PART_DIRS[k]).normalize();
    });

    const bounds = { min: box.min.clone(), max: box.max.clone() };

    sourceMeshes.forEach((mesh) => {
      const parts = splitMeshIntoParts(mesh, bounds);
      (Object.keys(parts) as PartKey[]).forEach((k) => {
        const pm = parts[k];
        if (!pm) return;
        // tune material
        const mat = pm.material as THREE.MeshStandardMaterial;
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
        partGroups[k].add(pm);
      });
    });

    const builtRoot = new THREE.Group();
    (Object.keys(partGroups) as PartKey[]).forEach((k) => builtRoot.add(partGroups[k]));

    partGroupsRef.current = partGroups;

    return { built: builtRoot, fitScale: fit, centerOffset: center };
  }, [gl, scene, targetSize]);

  // Color tinting (re-tints all part meshes)
  useEffect(() => {
    const tint = new THREE.Color(COLORS[colorway]);
    built.traverse((obj) => {
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

  // Explode: translate each part-group along its assigned direction
  useEffect(() => {
    const groups = partGroupsRef.current;
    if (!groups) return;
    (Object.keys(groups) as PartKey[]).forEach((k) => {
      const g = groups[k];
      const dir = (g.userData as any).explodeDir as THREE.Vector3;
      g.position.copy(dir).multiplyScalar(explode * EXPLODE_MAGNITUDE);
    });
  }, [explode]);

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
