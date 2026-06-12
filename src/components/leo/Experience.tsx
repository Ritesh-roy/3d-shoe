import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  Float,
  Html,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SSAO } from "@react-three/postprocessing";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { Shoe, type Colorway } from "./Shoe";
import { Particles } from "./Particles";
import { scrollState } from "./scrollState";

// Camera keyframes — cinematic storytelling, shoe stays fully assembled
const CAM_KEYS: Array<{ pos: [number, number, number]; tgt: [number, number, number]; fov: number }> = [
  { pos: [0, 0.4, 4.2], tgt: [0, 0, 0], fov: 32 },              // 0 hero
  { pos: [2.8, 1.2, 3.6], tgt: [0, 0.05, 0], fov: 30 },         // 1 architecture — 3/4 reveal
  { pos: [-2.4, 0.5, 2.2], tgt: [-0.2, 0.2, 0.1], fov: 24 },    // 2 materials A — upper fabric macro
  { pos: [-0.6, -0.7, 2.0], tgt: [0, -0.35, 0], fov: 22 },      // 3 materials B — outsole macro
  { pos: [1.6, 0.1, 2.0], tgt: [0.25, 0.0, -0.05], fov: 22 },   // 4 materials C — stitching / side panel
  { pos: [1.4, 0.5, -2.4], tgt: [0.1, 0.2, -0.4], fov: 26 },    // 5 materials D — heel construction
  { pos: [-3.6, 0.8, 4.2], tgt: [0, 0.15, 0], fov: 34 },        // 6 performance — side profile
  { pos: [0, 0.3, 4.0], tgt: [0, 0, 0], fov: 30 },              // 7 colorways
  { pos: [4.2, 0.6, 1.2], tgt: [0, 0, 0], fov: 32 },            // 8 360 orbit
  { pos: [1.4, 0.6, 3.2], tgt: [0, 0.1, 0], fov: 32 },          // 9 technology
  { pos: [0, 0.4, 4.6], tgt: [0, 0, 0], fov: 28 },              // 10 finale
];

// Section index → primary camera keyframe. Materials section sweeps cam keys 2→5.
const SECTION_CAMS: number[] = [0, 1, 2, 6, 7, 8, 9, 10];
const MATERIALS_SECTION = 2;
const MATERIALS_CAM_RANGE: [number, number] = [2, 5];


function CameraRig({ shoeRef }: { shoeRef: React.MutableRefObject<THREE.Group | null> }) {
  const { camera } = useThree();
  const tmpPos = useRef(new THREE.Vector3());
  const tmpTgt = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    // Build a fractional camera-key position from active section + sub-progress.
    // Materials section sweeps across an inner cam-key range for cinematic macros.
    const sIdx = Math.min(SECTION_CAMS.length - 1, Math.max(0, scrollState.section));
    const sProg = Math.min(1, Math.max(0, scrollState.sectionProgress));

    let camPos: number;
    if (sIdx === MATERIALS_SECTION) {
      const [a, b] = MATERIALS_CAM_RANGE;
      camPos = a + (b - a) * sProg;
    } else {
      const fromCam = SECTION_CAMS[sIdx];
      const toCam = SECTION_CAMS[Math.min(sIdx + 1, SECTION_CAMS.length - 1)];
      camPos = fromCam + (toCam - fromCam) * sProg;
    }

    const totalKeys = CAM_KEYS.length - 1;
    const i = Math.min(totalKeys, Math.floor(camPos));
    const f = camPos - i;
    const a = CAM_KEYS[i];
    const b = CAM_KEYS[Math.min(i + 1, totalKeys)];

    tmpPos.current.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], f),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], f),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], f),
    );
    tmpPos.current.x += scrollState.mouseX * 0.2;
    tmpPos.current.y += scrollState.mouseY * 0.12;

    tmpTgt.current.set(
      THREE.MathUtils.lerp(a.tgt[0], b.tgt[0], f),
      THREE.MathUtils.lerp(a.tgt[1], b.tgt[1], f),
      THREE.MathUtils.lerp(a.tgt[2], b.tgt[2], f),
    );

    camera.position.lerp(tmpPos.current, Math.min(1, dt * 3));
    const persp = camera as THREE.PerspectiveCamera;
    const targetFov = THREE.MathUtils.lerp(a.fov, b.fov, f);
    persp.fov += (targetFov - persp.fov) * Math.min(1, dt * 3);
    persp.updateProjectionMatrix();
    camera.lookAt(tmpTgt.current);

    // Slow 360 rotation when on the orbit section (index 5)
    if (shoeRef.current) {
      let rotY = 0;
      if (sIdx === 5) rotY = sProg * Math.PI * 2;
      else if (sIdx > 5) rotY = Math.PI * 2;
      shoeRef.current.rotation.y += (rotY - shoeRef.current.rotation.y) * Math.min(1, dt * 2.5);
    }
  });
  return null;
}

function SceneInner() {
  const shoeRef = useRef<THREE.Group | null>(null);
  const [colorway, setColorway] = useState<Colorway>("white");

  useFrame(() => {
    if (scrollState.colorway !== colorway) setColorway(scrollState.colorway);
  });

  return (
    <>
      <color attach="background" args={["#07080c"]} />
      <fog attach="fog" args={["#07080c", 12, 28]} />

      {/* Soft studio rig — low intensity, environment does most of the lighting */}
      <ambientLight intensity={0.08} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.42}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0001}
        shadow-radius={6}
      />
      <directionalLight position={[-6, 4, -3]} intensity={0.14} color="#8ec1ff" />
      <directionalLight position={[0, -2, 4]} intensity={0.1} color="#ffb088" />

      <Environment preset="studio" environmentIntensity={0.38} background={false} />

      <Particles count={60} />

      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.3}>
        <group ref={shoeRef} position={[0, 0, 0]}>
          <Shoe colorway={colorway} explode={explode} targetSize={2.85} />
        </group>
      </Float>

      <ContactShadows
        position={[0, -1.1, 0]}
        opacity={0.85}
        scale={10}
        blur={2.4}
        far={4}
        color="#000000"
      />

      <CameraRig shoeRef={shoeRef} />

      <EffectComposer multisampling={8} enableNormalPass>
        <SSAO samples={32} radius={0.14} intensity={18} luminanceInfluence={0.55} />
        <Bloom intensity={0.025} luminanceThreshold={1.3} luminanceSmoothing={0.55} mipmapBlur />
        <Vignette eskil={false} offset={0.3} darkness={0.85} />
      </EffectComposer>

    </>
  );
}

export function Experience() {
  return (
    <Canvas
      shadows
      dpr={[1.5, 2.5]}
      camera={{ position: [0, 0.5, 5.5], fov: 32, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.42,
        powerPreference: "high-performance",
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

