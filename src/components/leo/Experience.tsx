import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  Float,
  Sparkles,
  Html,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, DepthOfField } from "@react-three/postprocessing";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { Shoe, type Colorway } from "./Shoe";
import { Particles } from "./Particles";
import { scrollState } from "./scrollState";

// Camera keyframes per section (position + lookAt target)
const CAM_KEYS: Array<{ pos: [number, number, number]; tgt: [number, number, number]; fov: number }> = [
  { pos: [0, 0.4, 3.2], tgt: [0, 0, 0], fov: 35 }, // hero
  { pos: [2.6, 1.2, 3.0], tgt: [0, 0, 0], fov: 38 }, // exploded
  { pos: [0.9, -0.2, 1.2], tgt: [0, 0, 0], fov: 22 }, // materials macro
  { pos: [-3.0, 0.6, 2.4], tgt: [0, 0.1, 0], fov: 50 }, // performance
  { pos: [0, 0.3, 2.8], tgt: [0, 0, 0], fov: 32 }, // colorways
  { pos: [3.0, 0.5, 0.5], tgt: [0, 0, 0], fov: 35 }, // 360
  { pos: [0.0, 0.0, 0.6], tgt: [0, 0, 0], fov: 60 }, // technology / inside
  { pos: [0, 0.4, 3.6], tgt: [0, 0, 0], fov: 30 }, // finale
];

function CameraRig({ shoeRef }: { shoeRef: React.MutableRefObject<THREE.Group | null> }) {
  const { camera } = useThree();
  const tmpPos = useRef(new THREE.Vector3());
  const tmpTgt = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const total = CAM_KEYS.length - 1;
    const p = scrollState.progress * total;
    const i = Math.floor(p);
    const f = p - i;
    const a = CAM_KEYS[Math.min(i, total)];
    const b = CAM_KEYS[Math.min(i + 1, total)];

    tmpPos.current.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], f),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], f),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], f),
    );
    // subtle mouse parallax
    tmpPos.current.x += scrollState.mouseX * 0.25;
    tmpPos.current.y += scrollState.mouseY * 0.15;

    tmpTgt.current.set(
      THREE.MathUtils.lerp(a.tgt[0], b.tgt[0], f),
      THREE.MathUtils.lerp(a.tgt[1], b.tgt[1], f),
      THREE.MathUtils.lerp(a.tgt[2], b.tgt[2], f),
    );

    camera.position.lerp(tmpPos.current, Math.min(1, dt * 4));
    const persp = camera as THREE.PerspectiveCamera;
    const targetFov = THREE.MathUtils.lerp(a.fov, b.fov, f);
    persp.fov += (targetFov - persp.fov) * Math.min(1, dt * 4);
    persp.updateProjectionMatrix();
    camera.lookAt(tmpTgt.current);

    // Shoe slow rotation for 360 section (5..6)
    if (shoeRef.current) {
      const seg = scrollState.progress * total;
      let rotY = 0;
      if (seg > 4.5 && seg < 6) rotY = (seg - 4.5) * Math.PI * 1.6;
      else if (seg >= 6) rotY = 1.5 * Math.PI * 1.6;
      shoeRef.current.rotation.y += (rotY - shoeRef.current.rotation.y) * Math.min(1, dt * 3);
    }
  });
  return null;
}

function SceneInner() {
  const shoeRef = useRef<THREE.Group | null>(null);
  const [colorway, setColorway] = useState<Colorway>("white");
  const [explode, setExplode] = useState(0);

  // Poll scrollState for state-driven props
  useFrame(() => {
    if (scrollState.colorway !== colorway) setColorway(scrollState.colorway);
    const target = scrollState.explode;
    if (Math.abs(target - explode) > 0.005) {
      setExplode(explode + (target - explode) * 0.12);
    }
  });

  return (
    <>
      <color attach="background" args={["#06070a"]} />
      <fog attach="fog" args={["#06070a", 6, 18]} />

      <ambientLight intensity={0.25} />
      <spotLight
        position={[4, 6, 4]}
        angle={0.35}
        penumbra={1}
        intensity={120}
        color="#ffffff"
        castShadow
      />
      <spotLight
        position={[-5, 3, -2]}
        angle={0.5}
        penumbra={1}
        intensity={60}
        color="#ff4d4d"
      />
      <spotLight position={[0, -3, 4]} angle={0.6} penumbra={1} intensity={30} color="#88aaff" />

      <Environment preset="studio" environmentIntensity={0.6} />

      <Particles count={300} />
      <Sparkles count={60} scale={6} size={2} speed={0.3} color="#ffffff" opacity={0.6} />

      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <group ref={shoeRef} position={[0, -0.1, 0]} scale={1}>
          <Shoe colorway={colorway} explode={explode} />
        </group>
      </Float>

      <ContactShadows
        position={[0, -0.55, 0]}
        opacity={0.55}
        scale={8}
        blur={2.5}
        far={3}
        color="#000000"
      />

      <CameraRig shoeRef={shoeRef} />

      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.7} luminanceSmoothing={0.2} mipmapBlur />
        <DepthOfField focusDistance={0.012} focalLength={0.04} bokehScale={2} />
        <Vignette eskil={false} offset={0.2} darkness={0.85} />
      </EffectComposer>
    </>
  );
}

export function Experience() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.4, 3.2], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      onPointerMove={(e) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        scrollState.mouseX = (e.clientX / w) * 2 - 1;
        scrollState.mouseY = -((e.clientY / h) * 2 - 1);
      }}
    >
      <Suspense fallback={<Html center><div style={{ color: "#fff", fontFamily: "sans-serif" }}>Loading…</div></Html>}>
        <SceneInner />
      </Suspense>
    </Canvas>
  );
}
