"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/** Rayon de la sphère. Tout le reste (anneaux, cadrage caméra) en dépend. */
const R = 2;
/** Rayon englobant anneaux compris, utilisé pour cadrer la caméra. */
const FIT_R = R * 1.31;

/**
 * Étendue en latitude occupée par Haïti sur la planète, en degrés.
 *
 * La carte est peinte à l'échelle géographique (même nombre de degrés par
 * degré en longitude et en latitude), centrée sur l'équateur du globe : c'est
 * une vraie projection équirectangulaire. La courbure de la sphère se charge
 * du raccourcissement sur les bords, ce qui donne une carte réellement
 * enroulée sur la boule plutôt qu'une image posée devant.
 *
 * 56° laisse la carte grande et lisible sans l'approcher des pôles, où le
 * maillage équirectangulaire se pince.
 */
const LAT_SPAN_DEG = 56;

type GeoRing = [number, number][];

interface GeoFeature {
  properties: { NAME_1?: string };
  geometry:
    | { type: "Polygon"; coordinates: GeoRing[] }
    | { type: "MultiPolygon"; coordinates: GeoRing[][] };
}

function ringsOf(f: GeoFeature): GeoRing[] {
  return f.geometry.type === "MultiPolygon"
    ? (f.geometry.coordinates.flat() as GeoRing[])
    : f.geometry.coordinates;
}

/**
 * Construit la texture équirectangulaire de la planète.
 *
 * La carte est agrandie d'un facteur constant depuis ses coordonnées
 * géographiques réelles, puis placée à cheval sur l'équateur du globe. Le
 * rapport degrés/pixel est identique en longitude et en latitude : la sphère
 * applique donc naturellement le raccourcissement d'un vrai globe, et la carte
 * paraît collée à la surface au lieu d'être plaquée face à la caméra.
 */
function buildPlanetTexture(
  geo: { features: GeoFeature[] },
  size: number,
): { color: HTMLCanvasElement; relief: HTMLCanvasElement } {
  const W = size;
  const H = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Carte de relief : terres en clair, océan en sombre. Utilisée comme bumpMap
  // pour que les départements accrochent la lumière comme un vrai continent.
  const reliefCanvas = document.createElement("canvas");
  reliefCanvas.width = W;
  reliefCanvas.height = H;
  const relief = reliefCanvas.getContext("2d")!;
  relief.fillStyle = "#000000";
  relief.fillRect(0, 0, W, H);

  // --- Océan / surface de la planète ---
  const ocean = ctx.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, "#05060f");
  ocean.addColorStop(0.35, "#0b1026");
  ocean.addColorStop(0.5, "#101a3d");
  ocean.addColorStop(0.65, "#0b1026");
  ocean.addColorStop(1, "#05060f");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);

  // Parallèles / méridiens discrets pour lire la rotation
  ctx.strokeStyle = "rgba(124, 92, 255, 0.10)";
  ctx.lineWidth = Math.max(1, W / 1024);
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // --- Bornes géographiques d'Haïti ---
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const f of geo.features) {
    for (const ring of ringsOf(f)) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const spanY = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Agrandissement unique appliqué aux deux axes : la forme reste exacte.
  const zoom = LAT_SPAN_DEG / spanY;

  /**
   * géo (lng, lat) → pixel de la texture équirectangulaire.
   * Le centre d'Haïti est ramené sur (lon 0, lat 0) du globe.
   */
  const toTexel = (lng: number, lat: number): [number, number] => {
    const lonOut = (lng - cx) * zoom;
    const latOut = (lat - cy) * zoom;
    return [((lonOut + 180) / 360) * W, ((90 - latOut) / 180) * H];
  };

  const tracePathOn = (target: CanvasRenderingContext2D, ring: GeoRing) => {
    target.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [px, py] = toTexel(ring[i][0], ring[i][1]);
      if (i === 0) target.moveTo(px, py);
      else target.lineTo(px, py);
    }
    target.closePath();
  };
  const tracePath = (ring: GeoRing) => tracePathOn(ctx, ring);

  // Palette drapeau haïtien, alternée par département
  const palette = ["#1b3fa8", "#c62828", "#22499f", "#b71c1c", "#1f3f96"];
  const unit = W / 2048;

  // Halo sous les terres
  ctx.save();
  ctx.shadowColor = "rgba(124, 92, 255, 0.9)";
  ctx.shadowBlur = 26 * unit;
  ctx.fillStyle = "rgba(124, 92, 255, 0.45)";
  for (const f of geo.features) for (const ring of ringsOf(f)) {
    tracePath(ring);
    ctx.fill();
  }
  ctx.restore();

  // Départements
  geo.features.forEach((f, fi) => {
    ctx.fillStyle = palette[fi % palette.length];
    ctx.strokeStyle = "rgba(230, 235, 255, 0.55)";
    ctx.lineWidth = 2 * unit;
    ctx.lineJoin = "round";
    for (const ring of ringsOf(f)) {
      tracePath(ring);
      ctx.fill();
      ctx.stroke();
    }
  });

  // Relief : terres pleines, bord adouci pour une transition côtière franche.
  relief.fillStyle = "#d8d8d8";
  relief.strokeStyle = "#5a5a5a";
  relief.lineWidth = 6 * unit;
  relief.lineJoin = "round";
  for (const f of geo.features) {
    for (const ring of ringsOf(f)) {
      tracePathOn(relief, ring);
      relief.stroke();
      relief.fill();
    }
  }

  // Noms de départements
  ctx.fillStyle = "rgba(248, 245, 236, 0.95)";
  ctx.strokeStyle = "rgba(4, 4, 12, 0.85)";
  ctx.lineWidth = 4 * unit;
  ctx.font = `bold ${Math.round(21 * unit)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of geo.features) {
    const name = f.properties.NAME_1;
    if (!name) continue;
    // Centroïde du plus grand anneau, plus fiable que la moyenne globale
    const biggest = ringsOf(f).reduce((a, b) => (b.length > a.length ? b : a));
    let sx = 0;
    let sy = 0;
    for (const [x, y] of biggest) {
      sx += x;
      sy += y;
    }
    const [tx, ty] = toTexel(sx / biggest.length, sy / biggest.length);
    ctx.strokeText(name, tx, ty);
    ctx.fillText(name, tx, ty);
  }

  return { color: canvas, relief: reliefCanvas };
}

/** Recadre la caméra pour que la planète remplisse toujours le cadre. */
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const aspect = size.width / Math.max(1, size.height);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = Math.max(FIT_R / Math.sin(vFov / 2), FIT_R / Math.sin(hFov / 2));
    cam.position.set(0, 0, dist * 1.02);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Planet({ gyro }: { gyro: React.RefObject<{ x: number; y: number }> }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const [maps, setMaps] = useState<{ color: THREE.Texture; bump: THREE.Texture } | null>(null);
  const { gl } = useThree();

  useEffect(() => {
    let cancelled = false;
    const size = typeof window !== "undefined" && window.innerWidth > 700 ? 4096 : 2048;
    const anisotropy = gl.capabilities.getMaxAnisotropy();

    fetch("/data/haiti-departments.geojson")
      .then((r) => r.json())
      .then((geo: { features: GeoFeature[] }) => {
        if (cancelled) return;
        const { color, relief } = buildPlanetTexture(geo, size);

        const colorTex = new THREE.CanvasTexture(color);
        colorTex.colorSpace = THREE.SRGBColorSpace;
        colorTex.anisotropy = anisotropy;
        colorTex.needsUpdate = true;

        const bumpTex = new THREE.CanvasTexture(relief);
        bumpTex.anisotropy = anisotropy;
        bumpTex.needsUpdate = true;

        setMaps({ color: colorTex, bump: bumpTex });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [gl]);

  // Libère la mémoire GPU quand les textures sont remplacées ou démontées.
  useEffect(
    () => () => {
      maps?.color.dispose();
      maps?.bump.dispose();
    },
    [maps],
  );

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.06;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * 0.03;
    // Gyroscope mobile : inclinaison douce, amortie, sans jamais masquer la carte
    const g = gyro.current;
    if (groupRef.current && g) {
      groupRef.current.rotation.y += (g.y - groupRef.current.rotation.y) * Math.min(1, delta * 3);
      groupRef.current.rotation.x += (g.x - groupRef.current.rotation.x) * Math.min(1, delta * 3);
    }
  });

  const ringGeometry = useMemo(() => new THREE.RingGeometry(R * 1.16, R * 1.24, 128), []);
  const ring2Geometry = useMemo(() => new THREE.RingGeometry(R * 1.27, R * 1.295, 128), []);

  useEffect(() => {
    return () => {
      ringGeometry.dispose();
      ring2Geometry.dispose();
    };
  }, [ringGeometry, ring2Geometry]);

  return (
    <group ref={groupRef}>
      {/* Sphère : rotation.y = -PI/2 amène le centre de la texture (Haïti) face caméra */}
      <mesh rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[R, 128, 128]} />
        <meshStandardMaterial
          map={maps?.color ?? null}
          bumpMap={maps?.bump ?? null}
          bumpScale={1.4}
          roughness={0.62}
          metalness={0.08}
          emissive={new THREE.Color("#ffffff")}
          emissiveMap={maps?.color ?? null}
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Atmosphère */}
      <mesh>
        <sphereGeometry args={[R * 1.045, 64, 64]} />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.09} side={THREE.BackSide} />
      </mesh>

      {/* Anneaux lumineux */}
      <mesh ref={ringRef} rotation={[Math.PI / 2.7, 0.28, 0]}>
        <primitive object={ringGeometry} attach="geometry" />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2.7, 0.28, 0]}>
        <primitive object={ring2Geometry} attach="geometry" />
        <meshBasicMaterial color="#00d4b8" transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** true si l'appareil expose l'API d'orientation et exige une autorisation (iOS). */
function gyroNeedsPermission(): boolean {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return false;
  return (
    typeof (
      DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    ).requestPermission === "function"
  );
}

export function HaitiGlobe() {
  const [gyroGranted, setGyroGranted] = useState(false);
  const [needsPermission] = useState(gyroNeedsPermission);
  const gyro = useRef({ x: 0, y: 0 });

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const gamma = e.gamma ?? 0; // gauche/droite
    const beta = e.beta ?? 0; // avant/arrière
    // Limites volontairement serrées : la carte reste toujours lisible
    gyro.current.y = THREE.MathUtils.clamp(
      THREE.MathUtils.degToRad(gamma) * 0.6,
      -0.5,
      0.5,
    );
    gyro.current.x = THREE.MathUtils.clamp(
      THREE.MathUtils.degToRad(beta - 45) * 0.4,
      -0.35,
      0.35,
    );
  }, []);

  // Android / desktop : abonnement direct. iOS : après autorisation explicite.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) return;
    if (needsPermission && !gyroGranted) return;

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [handleOrientation, needsPermission, gyroGranted]);

  const enableGyro = async () => {
    const req = (
      DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    ).requestPermission;
    if (typeof req !== "function") return;
    try {
      setGyroGranted((await req()) === "granted");
    } catch {
      setGyroGranted(false);
    }
  };

  const showGyroButton = needsPermission && !gyroGranted;

  return (
    <div
      style={{
        width: "100%",
        height: "min(880px, 88vh)",
        position: "relative",
        touchAction: "pan-y",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <FitCamera />
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 3, 6]} intensity={0.9} />
        <pointLight position={[-4, -2, 4]} intensity={0.45} color="#7c5cff" />

        <Planet gyro={gyro} />

        {/* Rotation manuelle limitée : la carte reste toujours face à l'utilisateur */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={0.45}
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={Math.PI / 2.9}
          maxPolarAngle={(Math.PI * 1.9) / 2.9}
          minAzimuthAngle={-Math.PI / 5}
          maxAzimuthAngle={Math.PI / 5}
        />
      </Canvas>

      {showGyroButton && (
        <button
          type="button"
          onClick={enableGyro}
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "0.5rem 1rem",
            borderRadius: 999,
            border: "1px solid rgba(124,92,255,0.5)",
            background: "rgba(12,12,28,0.8)",
            color: "#f4efe4",
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >
          Activer le gyroscope
        </button>
      )}
    </div>
  );
}
