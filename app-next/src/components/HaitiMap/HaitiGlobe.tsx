"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface HaitiGlobeProps {
  onReady?: () => void;
}

function Globe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const { gl } = useThree();

  // Load Haiti map as texture from the GeoJSON rendered to canvas
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // Dark background (ocean)
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, 1024, 512);

    // Load and render the GeoJSON
    fetch("/data/haiti-departments.geojson")
      .then((r) => r.json())
      .then((geo) => {
        // Find bounds
        let minX = 999, maxX = -999, minY = 999, maxY = -999;
        for (const f of geo.features) {
          const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flat() : f.geometry.coordinates;
          for (const ring of polys) for (const [x, y] of ring) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }

        const w = maxX - minX, h = maxY - minY;
        // Haiti remplit presque toute la texture (minimal padding)
        const padX = 40, padY = 20;
        const scaleX = (1024 - 2 * padX) / w;
        const scaleY = (512 - 2 * padY) / h;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (1024 - w * scale) / 2;
        const offsetY = (512 - h * scale) / 2;

        // Draw each department with gradient fill
        const colors = [
          "#1a3a8f", "#c62828", "#1a3a8f", "#c62828", "#1a3a8f",
          "#c62828", "#1a3a8f", "#c62828", "#1a3a8f", "#c62828",
        ];

        for (let fi = 0; fi < geo.features.length; fi++) {
          const f = geo.features[fi];
          const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flat() : f.geometry.coordinates;

          ctx.fillStyle = colors[fi % colors.length];
          ctx.strokeStyle = "rgba(124, 92, 255, 0.8)";
          ctx.lineWidth = 1.5;

          for (const ring of polys) {
            ctx.beginPath();
            for (let i = 0; i < ring.length; i++) {
              const px = offsetX + (ring[i][0] - minX) * scale;
              const py = offsetY + (maxY - ring[i][1]) * scale;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }

        // Add department names
        ctx.fillStyle = "rgba(244, 239, 228, 0.85)";
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const f of geo.features) {
          const name = f.properties.NAME_1;
          const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flat() : f.geometry.coordinates;
          let sx = 0, sy = 0, cnt = 0;
          for (const ring of polys) for (const [x, y] of ring) {
            sx += offsetX + (x - minX) * scale;
            sy += offsetY + (maxY - y) * scale;
            cnt++;
          }
          if (cnt > 0) {
            ctx.fillText(name, sx / cnt, sy / cnt);
          }
        }

        // Subtle grid lines
        ctx.strokeStyle = "rgba(124, 92, 255, 0.1)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 1024; i += 64) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        }
        for (let i = 0; i < 512; i += 64) {
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        setTexture(tex);
      });
  }, []);

  // Slow auto-rotation
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.05;
    }
  });

  const ringGeometry = useMemo(() => {
    return new THREE.RingGeometry(1.95, 2.1, 64);
  }, []);

  return (
    <group>
      {/* Globe */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.7, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.5}
          metalness={0.1}
          emissive={new THREE.Color("#1a1a3f")}
          emissiveIntensity={0.12}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[1.78, 64, 64]} />
        <meshBasicMaterial
          color="#7c5cff"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Luminous ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2.8, 0.3, 0]}>
        <primitive object={ringGeometry} attach="geometry" />
        <meshBasicMaterial
          color="#7c5cff"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Second thinner ring */}
      <mesh rotation={[Math.PI / 2.8, 0.3, 0]}>
        <ringGeometry args={[2.15, 2.18, 64]} />
        <meshBasicMaterial
          color="#00d4b8"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function HaitiGlobe({ onReady }: HaitiGlobeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    onReady?.();
  }, [onReady]);

  if (!mounted) return null;

  return (
    <div style={{ width: "100%", height: "min(700px, 80vh)", position: "relative" }}>
      <Canvas
        camera={{ position: [0, 0, 3.8], fov: 50 }}
        dpr={Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5)}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={0.8} />
        <pointLight position={[-3, -2, 4]} intensity={0.3} color="#7c5cff" />

        <Globe />

        {/* OrbitControls : drag limité pour toujours voir la carte */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={0.5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={(3 * Math.PI) / 4}
          minAzimuthAngle={-Math.PI / 3}
          maxAzimuthAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}
