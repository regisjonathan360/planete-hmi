"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * StageLightsBackground — Projecteurs lyres LED 3D sur les côtés.
 *
 * 2 projecteurs à gauche, 2 à droite. Les pieds sont toujours collés
 * aux bords latéraux de la page quel que soit le ratio de l'écran.
 * Utilise useThree pour calculer les limites visibles en fonction du viewport.
 */

const BEAM_COLORS = [
  new THREE.Color(0x8b5cf6), // violet
  new THREE.Color(0x3b82f6), // bleu
  new THREE.Color(0xec4899), // rose
  new THREE.Color(0xfbbf24), // doré
];

function MovingHead({
  position,
  rotation,
  colorIndex,
  phaseOffset,
  isMobile,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  colorIndex: number;
  phaseOffset: number;
  isMobile: boolean;
}) {
  const headGroupRef = useRef<THREE.Group>(null);
  const beamColor = BEAM_COLORS[colorIndex % BEAM_COLORS.length];

  const beamMaterial = useMemo(
    () => {
      // Shader custom pour un dégradé qui s'estompe vers la pointe évasée
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: beamColor },
        },
        vertexShader: `
          varying float vFade;
          void main() {
            // position.y va de -0.5 (base évasée) à +0.5 (pointe/lentille)
            // On veut que la base évasée soit transparente (fade out)
            vFade = smoothstep(-0.5, 0.1, position.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vFade;
          void main() {
            gl_FragColor = vec4(uColor, 0.08 * vFade);
          }
        `,
      });
      return mat;
    },
    [beamColor]
  );

  const lensMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      }),
    [beamColor]
  );

  useFrame((state) => {
    if (!headGroupRef.current) return;
    const t = state.clock.getElapsedTime() * 1.2 + phaseOffset;
    headGroupRef.current.rotation.x = Math.sin(t) * 0.6;
    headGroupRef.current.rotation.y = Math.cos(t * 0.8) * 0.5;
  });

  const beamLength = isMobile ? 6 : 9;

  return (
    <group position={position} rotation={rotation}>
      {/* Base (collée au bord) */}
      <mesh>
        <boxGeometry args={[0.12, 0.5, 0.3]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>

      {/* Bras en U (horizontal depuis le mur) */}
      <mesh position={[0.2, 0.12, 0]}>
        <boxGeometry args={[0.28, 0.04, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0.2, -0.12, 0]}>
        <boxGeometry args={[0.28, 0.04, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Tête + faisceau */}
      <group ref={headGroupRef} position={[0.4, 0, 0]}>
        {/* Corps tête */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.13, 0.16, 16]} />
          <meshStandardMaterial color="#111" roughness={0.5} metalness={0.4} />
        </mesh>

        {/* Lentille */}
        <mesh position={[0.1, 0, 0]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <primitive object={lensMaterial} attach="material" />
        </mesh>

        {/* LEDs */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh
            key={i}
            position={[
              0.06,
              Math.cos((i * Math.PI) / 3) * 0.08,
              Math.sin((i * Math.PI) / 3) * 0.08,
            ]}
          >
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshBasicMaterial color={beamColor} transparent opacity={0.5} />
          </mesh>
        ))}

        {/* Faisceau — fin, part de la lentille vers l'intérieur */}
        <mesh position={[beamLength / 2 + 0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[isMobile ? 0.7 : 1.0, beamLength, 32, 1, true]} />
          <primitive object={beamMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

function Scene({ isMobile }: { isMobile: boolean }) {
  const { viewport } = useThree();

  // Calculer le bord droit et gauche en unités 3D selon le viewport actuel
  const edgeX = viewport.width / 2;

  // 2 projecteurs à gauche, 2 à droite, collés aux bords
  const positions: { pos: [number, number, number]; rot: [number, number, number] }[] = [
    // Gauche haut — base collée au bord gauche, pointe vers la droite
    { pos: [-edgeX, 1.5, 0], rot: [0, 0, 0] },
    // Gauche bas
    { pos: [-edgeX, -1.5, 0], rot: [0, 0, 0] },
    // Droite haut — base collée au bord droit, pointe vers la gauche (miroir)
    { pos: [edgeX, 1.5, 0], rot: [0, Math.PI, 0] },
    // Droite bas
    { pos: [edgeX, -1.5, 0], rot: [0, Math.PI, 0] },
  ];

  // Mobile : seulement 2 (un de chaque côté)
  const subset = isMobile ? [positions[0], positions[2]] : positions;

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[0, 3, 5]} intensity={0.3} />

      {subset.map((p, i) => (
        <MovingHead
          key={i}
          position={p.pos}
          rotation={p.rot}
          colorIndex={i}
          phaseOffset={i * 1.5}
          isMobile={isMobile}
        />
      ))}
    </>
  );
}

export function StageLightsBackground() {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMobile(window.innerWidth < 768);
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!mounted || reducedMotion) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        dpr={isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5)}
        gl={{ antialias: !isMobile, alpha: true, powerPreference: "low-power" }}
        style={{ background: "transparent", pointerEvents: "none" }}
        events={() => ({ enabled: false, priority: 0, compute: () => {} } as never)}
      >
        <Scene isMobile={isMobile} />
      </Canvas>
    </div>
  );
}
