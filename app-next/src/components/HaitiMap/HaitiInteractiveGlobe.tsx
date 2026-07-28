/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useEffect, useState, useMemo, useCallback, type RefObject } from "react";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Earcut from "earcut";
import { artistAvatarSrc } from "@/lib/artists/avatar";
import styles from "./haiti-map.module.css";

// ---------- Types ----------

type GeoRing = [number, number][];

interface GeoFeature {
  properties: { NAME_1: string; HASC_1: string };
  geometry:
    | { type: "Polygon"; coordinates: GeoRing[] }
    | { type: "MultiPolygon"; coordinates: GeoRing[][] };
}

interface MapArtist { id: string; name: string; imageUrl: string | null }

interface HaitiInteractiveGlobeProps {
  onDepartmentClick?: (code: string, name: string) => void;
  artistsByDepartment?: Record<string, MapArtist[]>;
}

const HASC_TO_CODE: Record<string, string> = {
  "HT.AR": "ARTIBONITE", "HT.CE": "CENTRE", "HT.GA": "GRAND_ANSE",
  "HT.NI": "NIPPES", "HT.ND": "NORD", "HT.NE": "NORD_EST",
  "HT.NO": "NORD_OUEST", "HT.OU": "OUEST", "HT.SD": "SUD", "HT.SE": "SUD_EST",
};

// ---------- Constantes ----------

const R = 2;
const LAT_SPAN_DEG = 72;
const DEG2RAD = Math.PI / 180;
const HOVER_LIFT = 0.045;

function ringsOf(f: GeoFeature): GeoRing[] {
  return f.geometry.type === "MultiPolygon"
    ? (f.geometry.coordinates.flat() as GeoRing[])
    : f.geometry.coordinates;
}

/** Returns groups of rings: each group is [outerRing, ...holes]. */
function polygonsOf(f: GeoFeature): GeoRing[][] {
  if (f.geometry.type === "MultiPolygon") {
    return f.geometry.coordinates as GeoRing[][];
  }
  return [f.geometry.coordinates as GeoRing[]];
}

// ---------- Projection ----------

/** Point 3D sur la sphère. cx/cy = centre géographique d'Haïti. */
function toSphere(lng: number, lat: number, cx: number, cy: number, zoom: number, radius: number): [number, number, number] {
  const lonRad = (lng - cx) * zoom * DEG2RAD;
  const latRad = (lat - cy) * zoom * DEG2RAD;
  // Pas de signe négatif sur x : corrige l'inversion gauche-droite
  return [
    radius * Math.cos(latRad) * Math.sin(lonRad),
    radius * Math.sin(latRad),
    radius * Math.cos(latRad) * Math.cos(lonRad),
  ];
}

/** Construit un polygone sans trou et le plaque réellement sur la sphère. */
function buildDeptGeometry(
  rings: GeoRing[], cx: number, cy: number, zoom: number, radius: number,
): THREE.BufferGeometry {
  const outer = rings[0];
  const flatCoords: number[] = [];
  for (const [lng, lat] of outer) {
    flatCoords.push((lng - cx) * zoom, (lat - cy) * zoom);
  }

  const triangles = Earcut(flatCoords, undefined, 2);

  if (triangles.length === 0) {
    return buildFallbackGeometry([outer], cx, cy, zoom, radius);
  }

  const vertexCount = flatCoords.length / 2;
  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const lng2d = flatCoords[i * 2] / zoom + cx;
    const lat2d = flatCoords[i * 2 + 1] / zoom + cy;
    const [x, y, z] = toSphere(lng2d, lat2d, cx, cy, zoom, radius);
    vertices.push(new THREE.Vector3(x, y, z));
  }

  const positions: number[] = [];
  const appendTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, depth: number) => {
    if (depth === 0) {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      return;
    }
    const ab = a.clone().add(b).normalize().multiplyScalar(radius);
    const bc = b.clone().add(c).normalize().multiplyScalar(radius);
    const ca = c.clone().add(a).normalize().multiplyScalar(radius);
    appendTriangle(a, ab, ca, depth - 1);
    appendTriangle(ab, b, bc, depth - 1);
    appendTriangle(ca, bc, c, depth - 1);
    appendTriangle(ab, bc, ca, depth - 1);
  };

  for (let i = 0; i < triangles.length; i += 3) {
    appendTriangle(vertices[triangles[i]], vertices[triangles[i + 1]], vertices[triangles[i + 2]], 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Fusionne séparément les îles d'un MultiPolygon au lieu d'en faire des trous. */
function buildFeatureGeometry(
  polygons: GeoRing[][], cx: number, cy: number, zoom: number, radius: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const polygon of polygons) {
    if (!polygon[0]?.length) continue;
    const part = buildDeptGeometry([polygon[0]], cx, cy, zoom, radius);
    const attribute = part.getAttribute("position");
    for (let i = 0; i < attribute.count; i++) {
      positions.push(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
    }
    part.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Fallback quand earcut échoue : triangle fan depuis le centroïde. */
function buildFallbackGeometry(
  rings: GeoRing[], cx: number, cy: number, zoom: number, radius: number,
): THREE.BufferGeometry {
  const outer = rings[0];
  // Centroïde
  let sx = 0, sy = 0;
  for (const [lng, lat] of outer) { sx += lng; sy += lat; }
  const clng = sx / outer.length;
  const clat = sy / outer.length;

  const positions: number[] = [];
  const indices: number[] = [];
  const [cx3, cy3, cz3] = toSphere(clng, clat, cx, cy, zoom, radius);
  positions.push(cx3, cy3, cz3); // vertex 0 = centroïde

  for (let i = 0; i < outer.length; i++) {
    const [x, y, z] = toSphere(outer[i][0], outer[i][1], cx, cy, zoom, radius);
    positions.push(x, y, z);
    const next = (i + 1) % outer.length;
    indices.push(0, i + 1, next + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Contour 3D pour le glow néon. */
function buildOutline(
  rings: GeoRing[], cx: number, cy: number, zoom: number, radius: number,
): Float32Array {
  const pts: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1, z1] = toSphere(ring[i][0], ring[i][1], cx, cy, zoom, radius);
      const next = ring[(i + 1) % ring.length];
      const [x2, y2, z2] = toSphere(next[0], next[1], cx, cy, zoom, radius);
      pts.push(x1, y1, z1, x2, y2, z2);
    }
  }
  return new Float32Array(pts);
}

// ---------- Shader pour le gradient animé bleu/rouge ----------

const DEPT_VERTEX = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DEPT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    // Gradient animé bleu ↔ rouge (4s cycle, comme le bouton SVG)
    float t = sin(uTime * 1.5708) * 0.5 + 0.5; // 0→1→0 en 4s
    vec3 blue = vec3(0.106, 0.247, 0.659);   // #1b3fa8
    vec3 red = vec3(0.827, 0.184, 0.184);    // #d32f2f
    float longitudeMix = clamp(vPosition.x / 4.0 + 0.5, 0.0, 1.0);
    vec3 baseColor = mix(blue, red, t * 0.5 + longitudeMix * 0.5);

    // Au hover : teinte plus vive + émission cyan
    vec3 hoverGlow = vec3(0.0, 0.83, 0.8); // #00d4cc
    vec3 color = mix(baseColor, hoverGlow, uHover * 0.4);

    // Éclairage Lambertien simple
    float light = max(dot(vNormal, normalize(vec3(0.3, 0.4, 1.0))), 0.0);
    color *= 0.6 + light * 0.5;

    // Émission au hover
    color += hoverGlow * uHover * 0.35;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ---------- Composants 3D ----------

function OceanSphere() {
  return (
    <mesh>
      <sphereGeometry args={[R * 0.99, 64, 64]} />
      <meshStandardMaterial color="#050810" roughness={0.9} metalness={0.0} />
    </mesh>
  );
}

function PlanetRings() {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const g1 = useMemo(() => new THREE.RingGeometry(R * 1.12, R * 1.19, 128), []);
  const g2 = useMemo(() => new THREE.RingGeometry(R * 1.22, R * 1.24, 128), []);
  useEffect(() => () => { g1.dispose(); g2.dispose(); }, [g1, g2]);
  useFrame((_, d) => { if (r1.current) r1.current.rotation.z += d * 0.04; if (r2.current) r2.current.rotation.z -= d * 0.02; });
  return (
    <>
      <mesh ref={r1} rotation={[Math.PI / 2.7, 0.28, 0]}>
        <primitive object={g1} attach="geometry" />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI / 2.7, 0.28, 0]}>
        <primitive object={g2} attach="geometry" />
        <meshBasicMaterial color="#00d4b8" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function Atmosphere() {
  return (
    <mesh><sphereGeometry args={[R * 1.035, 64, 64]} /><meshBasicMaterial color="#7c5cff" transparent opacity={0.05} side={THREE.BackSide} /></mesh>
  );
}

// ---------- Département ----------

interface DeptProps {
  feature: GeoFeature; cx: number; cy: number; zoom: number;
  isActive: boolean;
  onHover: (c: string | null) => void;
  onSelect: (c: string) => void;
  onClick: (c: string, n: string) => void;
}

function DepartmentMesh({ feature, cx, cy, zoom, isActive, onHover, onSelect, onClick }: DeptProps) {
  const code = HASC_TO_CODE[feature.properties.HASC_1] ?? feature.properties.NAME_1;
  const name = feature.properties.NAME_1;
  const meshRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.LineSegments>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(
    () => buildFeatureGeometry(polygonsOf(feature), cx, cy, zoom, R * 1.003),
    [feature, cx, cy, zoom],
  );
  const outlineGeo = useMemo(() => {
    const rings = polygonsOf(feature).map((polygon) => polygon[0]).filter(Boolean);
    const positions = buildOutline(rings, cx, cy, zoom, R * 1.006);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [feature, cx, cy, zoom]);

  useEffect(() => () => { geometry.dispose(); outlineGeo.dispose(); }, [geometry, outlineGeo]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHover: { value: 0 },
  }), []);

  useFrame((state, delta) => {
    // Animation du gradient
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      const target = isActive ? 1 : 0;
      matRef.current.uniforms.uHover.value = THREE.MathUtils.lerp(
        matRef.current.uniforms.uHover.value, target, Math.min(1, delta * 10),
      );
    }
    // Détachement animé
    if (meshRef.current) {
      const targetScale = isActive ? 1 + HOVER_LIFT : 1;
      meshRef.current.scale.setScalar(
        THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, Math.min(1, delta * 10)),
      );
    }
    if (outlineRef.current) {
      outlineRef.current.scale.copy(meshRef.current?.scale ?? new THREE.Vector3(1, 1, 1));
    }
  });

  const handleOver = useCallback((e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(code); document.body.style.cursor = "pointer"; }, [code, onHover]);
  const handleOut = useCallback(() => { onHover(null); document.body.style.cursor = ""; }, [onHover]);
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(code, name); }, [code, name, onClick]);
  const handleDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(code);
    onHover(code);
  }, [code, onHover, onSelect]);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} onPointerOver={handleOver} onPointerOut={handleOut} onPointerDown={handleDown} onClick={handleClick}>
        <shaderMaterial
          ref={matRef}
          vertexShader={DEPT_VERTEX}
          fragmentShader={DEPT_FRAGMENT}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Contour néon : discret au repos, très brillant au hover */}
      <lineSegments ref={outlineRef} geometry={outlineGeo}>
        <lineBasicMaterial
          color={isActive ? "#00ffcc" : "#7c5cff"}
          transparent
          opacity={isActive ? 1.0 : 0.25}
        />
      </lineSegments>
    </group>
  );
}

// ---------- Labels ----------

function DepartmentLabels({ features, cx, cy, zoom, hovered }: {
  features: GeoFeature[]; cx: number; cy: number; zoom: number; hovered: string | null;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      for (const child of groupRef.current.children) child.quaternion.copy(camera.quaternion);
    }
  });

  const labels = useMemo(() => features.map((f) => {
    const code = HASC_TO_CODE[f.properties.HASC_1] ?? f.properties.NAME_1;
    const rings = ringsOf(f);
    const biggest = rings.reduce((a, b) => (b.length > a.length ? b : a));
    let sx = 0, sy = 0;
    for (const [x, y] of biggest) { sx += x; sy += y; }
    const [px, py, pz] = toSphere(sx / biggest.length, sy / biggest.length, cx, cy, zoom, R * 1.06);
    return { code, name: f.properties.NAME_1, position: new THREE.Vector3(px, py, pz) };
  }), [features, cx, cy, zoom]);

  return (
    <group ref={groupRef}>
      {labels.map((label) => {
        const isHov = hovered === label.code;
        return (
          <sprite key={label.code} position={label.position} scale={[0.48, 0.14, 1]}>
            <spriteMaterial transparent opacity={isHov ? 1 : 0.8}>
              <canvasTexture
                attach="map"
                image={(() => {
                  const cvs = document.createElement("canvas");
                  cvs.width = 512;
                  cvs.height = 80;
                  const ctx = cvs.getContext("2d")!;
                  ctx.font = "bold 38px Inter, system-ui, sans-serif";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  // Ombre portée
                  ctx.shadowColor = "rgba(0,0,0,0.9)";
                  ctx.shadowBlur = 8;
                  ctx.fillStyle = isHov ? "#00ffcc" : "rgba(248,245,236,0.92)";
                  ctx.fillText(label.name, 256, 42);
                  return cvs;
                })()}
              />
            </spriteMaterial>
          </sprite>
        );
      })}
    </group>
  );
}

// ---------- Caméra ----------

function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const aspect = size.width / Math.max(1, size.height);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fitR = R * 1.25;
    const dist = Math.max(fitR / Math.sin(vFov / 2), fitR / Math.sin(hFov / 2));
    cam.position.set(0, 0, dist * 0.95);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// ---------- Scène ----------

function Scene({ features, cx, cy, zoom, hovered, selected, gyro, onHover, onSelect, onClick }: {
  features: GeoFeature[]; cx: number; cy: number; zoom: number;
  hovered: string | null;
  selected: string | null;
  gyro: RefObject<{ x: number; y: number }>;
  onHover: (c: string | null) => void;
  onSelect: (c: string) => void;
  onClick: (c: string, n: string) => void;
}) {
  const worldRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!worldRef.current) return;
    const responsiveness = Math.min(1, delta * 4);
    worldRef.current.rotation.x = THREE.MathUtils.lerp(worldRef.current.rotation.x, gyro.current.x, responsiveness);
    worldRef.current.rotation.y = THREE.MathUtils.lerp(worldRef.current.rotation.y, gyro.current.y, responsiveness);
  });

  return (
    <>
      <FitCamera />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 6]} intensity={0.9} />
      <pointLight position={[-3, 0, 5]} intensity={0.4} color="#7c5cff" />
      <group ref={worldRef}>
        <OceanSphere />
        <Atmosphere />
        <PlanetRings />
        {features.map((feature) => {
          const code = HASC_TO_CODE[feature.properties.HASC_1] ?? feature.properties.NAME_1;
          return (
            <DepartmentMesh key={code} feature={feature} cx={cx} cy={cy} zoom={zoom}
              isActive={hovered === code || selected === code}
              onHover={onHover}
              onSelect={onSelect}
              onClick={onClick} />
          );
        })}
        <DepartmentLabels features={features} cx={cx} cy={cy} zoom={zoom} hovered={selected ?? hovered} />
      </group>
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.4} enableDamping dampingFactor={0.08}
        minPolarAngle={Math.PI / 3} maxPolarAngle={(Math.PI * 2) / 3}
        minAzimuthAngle={-Math.PI / 4} maxAzimuthAngle={Math.PI / 4} />
    </>
  );
}

// ---------- Composant principal ----------

export function HaitiInteractiveGlobe({ onDepartmentClick, artistsByDepartment = {} }: HaitiInteractiveGlobeProps) {
  const [geojson, setGeojson] = useState<{ features: GeoFeature[] } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const gyro = useRef({ x: 0, y: 0 });
  const gyroOrigin = useRef<{ beta: number; gamma: number } | null>(null);

  useEffect(() => { fetch("/data/haiti-departments.geojson").then((r) => r.json()).then(setGeojson).catch(() => {}); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGyroAvailable("DeviceOrientationEvent" in window);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!gyroEnabled) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      gyroOrigin.current ??= { beta: event.beta, gamma: event.gamma };
      gyro.current = {
        x: THREE.MathUtils.clamp((event.beta - gyroOrigin.current.beta) * DEG2RAD * 0.22, -0.24, 0.24),
        y: THREE.MathUtils.clamp((event.gamma - gyroOrigin.current.gamma) * DEG2RAD * 0.3, -0.32, 0.32),
      };
    };
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => window.removeEventListener("deviceorientation", handleOrientation, true);
  }, [gyroEnabled]);

  const { cx, cy, zoom } = useMemo(() => {
    if (!geojson) return { cx: -72.3, cy: 19.0, zoom: 35 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of geojson.features) for (const ring of ringsOf(f)) for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, zoom: LAT_SPAN_DEG / (maxY - minY) };
  }, [geojson]);

  const handleClick = useCallback((c: string, n: string) => {
    setSelected(c);
    window.setTimeout(() => onDepartmentClick?.(c, n), 240);
  }, [onDepartmentClick]);

  const enableGyroscope = useCallback(async () => {
    type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const orientation = DeviceOrientationEvent as DeviceOrientationWithPermission;
    if (orientation.requestPermission) {
      const permission = await orientation.requestPermission();
      if (permission !== "granted") return;
    }
    gyroOrigin.current = null;
    setGyroEnabled(true);
  }, []);

  if (!geojson) return (
    <div style={{ width: "100%", height: "min(880px, 88vh)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a9ac0" }}>
      Chargement du globe...
    </div>
  );

  return (
    <div className={styles.globeContainer}>
      <div className={styles.globeHitArea}>
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }} style={{ background: "transparent", touchAction: "none" }}>
          <Scene
            features={geojson.features}
            cx={cx}
            cy={cy}
            zoom={zoom}
            hovered={hovered}
            selected={selected}
            gyro={gyro}
            onHover={setHovered}
            onSelect={setSelected}
            onClick={handleClick}
          />
        </Canvas>
      </div>

      {gyroAvailable && !gyroEnabled ? (
        <button type="button" className={styles.gyroButton} onClick={enableGyroscope}>
          Activer le mouvement du téléphone
        </button>
      ) : null}

      {hovered && artistsByDepartment[hovered] && artistsByDepartment[hovered].length > 0 && (
        <div className={styles.artistPreview}>
          <div className={styles.artistScroll}>
            {artistsByDepartment[hovered].map((artist) => (
              <div key={artist.id} className={styles.artistChip}>
                <img src={artistAvatarSrc(artist.imageUrl)} alt="" className={styles.artistAvatar} />
                <span>{artist.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className={styles.globeHint}>
        Touchez directement un département pour l’explorer
      </p>
      <p className={styles.visuallyHidden} aria-live="polite">
        {selected ? `Département sélectionné : ${selected.replaceAll("_", " ")}` : ""}
      </p>
    </div>
  );
}
