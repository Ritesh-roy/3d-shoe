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

  useFrame(() => {
    if (scrollState.colorway !== colorway) setColorway(scrollState.colorway);
    const target = scrollState.explode;
    if (Math.abs(target - explode) > 0.005) {
      setExplode(explode + (target - explode) * 0.12);
    }
  });

  return (
    <>
      <color attach="background" args={["#0a0b10"]} />
      <fog attach="fog" args={["#0a0b10", 8, 22]} />

      {/* Balanced studio lighting — no blown-out highlights */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.8}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-6, 4, -3]} intensity={0.6} color="#7ab8ff" />
      <directionalLight position={[0, -2, 4]} intensity={0.4} color="#ff9c7a" />
      <spotLight position={[0, 6, 0]} angle={0.6} penumbra={1} intensity={20} color="#ffffff" />

      <Environment preset="studio" environmentIntensity={0.75} background={false} />

      <Particles count={220} />
      <Sparkles count={50} scale={8} size={1.5} speed={0.25} color="#ffffff" opacity={0.4} />

      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.3}>
        <group ref={shoeRef} position={[0, 0, 0]}>
          <Shoe colorway={colorway} explode={explode} targetSize={2.4} />
        </group>
      </Float>

      <ContactShadows
        position={[0, -1.1, 0]}
        opacity={0.7}
        scale={10}
        blur={2.8}
        far={4}
        color="#000000"
      />

      <CameraRig shoeRef={shoeRef} />

      <EffectComposer>
        <Bloom intensity={0.4} luminanceThreshold={0.85} luminanceSmoothing={0.3} mipmapBlur />
        <DepthOfField focusDistance={0.015} focalLength={0.05} bokehScale={1.5} />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

export function Experience() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.5, 5.5], fov: 32, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.85,
      }}
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

