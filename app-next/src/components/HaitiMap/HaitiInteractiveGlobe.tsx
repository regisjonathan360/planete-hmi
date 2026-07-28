/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
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

interface MapArtist {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface HaitiInteractiveGlobeProps {
  onDepartmentClick?: (code: string, name: string) => void;
  artistsByDepartment?: Record<string, MapArtist[]>;
}

const HASC_TO_CODE: Record<string, string> = {
  "HT.AR": "ARTIBONITE",
  "HT.CE": "CENTRE",
  "HT.GA": "GRAND_ANSE",
  "HT.NI": "NIPPES",
  "HT.ND": "NORD",
  "HT.NE": "NORD_EST",
  "HT.NO": "NORD_OUEST",
  "HT.OU": "OUEST",
  "HT.SD": "SUD",
  "HT.SE": "SUD_EST",
};

// ---------- Constantes ----------

const R = 2;
/**
 * Plus ce nombre est grand, plus la carte prend de place sur le globe.
 * 72° donne une emprise d'environ 59% du rayon en hauteur — beaucoup plus
 * lisible que les 56° précédents.
 */
const LAT_SPAN_DEG = 72;
const DEG2RAD = Math.PI / 180;
/** Distance de détachement au hover (fraction du rayon). */
const HOVER_LIFT = 0.04;

// Couleurs alternées bleu/rouge (drapeau haïtien) avec animation mélange
const DEPT_COLORS = ["#1a3a8f", "#c62828", "#1a3a8f", "#c62828", "#1a3a8f", "#c62828", "#1a3a8f", "#c62828", "#1a3a8f", "#c62828"];

function ringsOf(f: GeoFeature): GeoRing[] {
  return f.geometry.type === "MultiPolygon"
    ? (f.geometry.coordinates.flat() as GeoRing[])
    : f.geometry.coordinates;
}

// ---------- Projection ----------

function geoToSphere(
  lng: number, lat: number, cx: number, cy: number, zoom: number, radius: number,
): THREE.Vector3 {
  const lonRad = (lng - cx) * zoom * DEG2RAD;
  const latRad = (lat - cy) * zoom * DEG2RAD;
  return new THREE.Vector3(
    -radius * Math.cos(latRad) * Math.sin(lonRad),
    radius * Math.sin(latRad),
    radius * Math.cos(latRad) * Math.cos(lonRad),
  );
}

/**
 * Construit la géométrie d'un département à la surface de la sphère.
 *
 * On subdivise davantage (curveSegments: 12) pour éviter les trous sur les
 * formes complexes. Chaque vertex est ensuite projeté sur la sphère.
 */
function buildDepartmentGeometry(
  rings: GeoRing[], cx: number, cy: number, zoom: number, radius: number,
): THREE.BufferGeometry {
  const mainShape = new THREE.Shape();
  for (let i = 0; i < rings[0].length; i++) {
    const u = (rings[0][i][0] - cx) * zoom * DEG2RAD;
    const v = (rings[0][i][1] - cy) * zoom * DEG2RAD;
    if (i === 0) mainShape.moveTo(u, v);
    else mainShape.lineTo(u, v);
  }
  mainShape.closePath();

  for (let r = 1; r < rings.length; r++) {
    const hole = new THREE.Path();
    for (let j = 0; j < rings[r].length; j++) {
      const u = (rings[r][j][0] - cx) * zoom * DEG2RAD;
      const v = (rings[r][j][1] - cy) * zoom * DEG2RAD;
      if (j === 0) hole.moveTo(u, v);
      else hole.lineTo(u, v);
    }
    hole.closePath();
    mainShape.holes.push(hole);
  }

  // curveSegments = 12 : beaucoup plus de triangles, plus aucun trou
  const shapeGeo = new THREE.ShapeGeometry(mainShape, 12);
  const pos = shapeGeo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const lonRad = pos.getX(i);
    const latRad = pos.getY(i);
    const x = -radius * Math.cos(latRad) * Math.sin(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.cos(lonRad);
    pos.setXYZ(i, x, y, z);
  }

  shapeGeo.computeVertexNormals();
  return shapeGeo;
}

/**
 * Contour d'un département sous forme de ligne.
 * Sert à dessiner le néon lumineux autour des départements.
 */
function buildOutlinePositions(
  rings: GeoRing[], cx: number, cy: number, zoom: number, radius: number,
): Float32Array {
  const points: number[] = [];
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      const v = geoToSphere(lng, lat, cx, cy, zoom, radius);
      points.push(v.x, v.y, v.z);
    }
    // Fermer le ring en revenant au premier point
    const v = geoToSphere(ring[0][0], ring[0][1], cx, cy, zoom, radius);
    points.push(v.x, v.y, v.z);
  }
  return new Float32Array(points);
}

// ---------- Composants 3D ----------

function OceanSphere() {
  return (
    <mesh>
      <sphereGeometry args={[R * 0.993, 64, 64]} />
      <meshStandardMaterial color="#060a14" roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

function Rings() {
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ringGeo = useMemo(() => new THREE.RingGeometry(R * 1.14, R * 1.22, 128), []);
  const ring2Geo = useMemo(() => new THREE.RingGeometry(R * 1.25, R * 1.27, 128), []);

  useEffect(() => () => { ringGeo.dispose(); ring2Geo.dispose(); }, [ringGeo, ring2Geo]);

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.05;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * 0.025;
  });

  return (
    <>
      <mesh ref={ringRef} rotation={[Math.PI / 2.7, 0.28, 0]}>
        <primitive object={ringGeo} attach="geometry" />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2.7, 0.28, 0]}>
        <primitive object={ring2Geo} attach="geometry" />
        <meshBasicMaterial color="#00d4b8" transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[R * 1.04, 64, 64]} />
      <meshBasicMaterial color="#7c5cff" transparent opacity={0.06} side={THREE.BackSide} />
    </mesh>
  );
}

// ---------- Département individuel ----------

interface DepartmentMeshProps {
  feature: GeoFeature;
  index: number;
  cx: number;
  cy: number;
  zoom: number;
  isHovered: boolean;
  onHover: (code: string | null) => void;
  onClick: (code: string, name: string) => void;
}

function DepartmentMesh({ feature, index, cx, cy, zoom, isHovered, onHover, onClick }: DepartmentMeshProps) {
  const code = HASC_TO_CODE[feature.properties.HASC_1] ?? feature.properties.NAME_1;
  const name = feature.properties.NAME_1;
  const rings = ringsOf(feature);
  const meshRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.LineSegments>(null);

  // Géométries : surface + contour
  const geometry = useMemo(
    () => buildDepartmentGeometry(rings, cx, cy, zoom, R * 1.002),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, zoom],
  );

  const outlinePositions = useMemo(
    () => buildOutlinePositions(rings, cx, cy, zoom, R * 1.003),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, zoom],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Animation de détachement + glow au hover
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Lift vers l'extérieur (le long des normales = radial sur une sphère)
    const targetScale = isHovered ? 1 + HOVER_LIFT : 1;
    const currentScale = meshRef.current.scale.x;
    const newScale = THREE.MathUtils.lerp(currentScale, targetScale, Math.min(1, delta * 12));
    meshRef.current.scale.setScalar(newScale);

    if (outlineRef.current) {
      outlineRef.current.scale.setScalar(newScale);
    }
  });

  const baseColor = useMemo(() => new THREE.Color(DEPT_COLORS[index % DEPT_COLORS.length]), [index]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(code);
    document.body.style.cursor = "pointer";
  }, [code, onHover]);

  const handlePointerOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = "";
  }, [onHover]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(code, name);
  }, [code, name, onClick]);

  // Contour néon : visible en permanence (discret), très vif au hover
  const outlineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(outlinePositions, 3));
    return geo;
  }, [outlinePositions]);

  useEffect(() => () => outlineGeo.dispose(), [outlineGeo]);

  return (
    <group>
      {/* Surface du département */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <meshStandardMaterial
          color={baseColor}
          emissive={isHovered ? new THREE.Color("#7c5cff") : baseColor}
          emissiveIntensity={isHovered ? 0.8 : 0.12}
          roughness={isHovered ? 0.25 : 0.55}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Contour néon : toujours visible, très brillant au hover */}
      <lineSegments ref={outlineRef} geometry={outlineGeo}>
        <lineBasicMaterial
          color={isHovered ? "#00ffcc" : "#7c5cff"}
          transparent
          opacity={isHovered ? 1 : 0.35}
          linewidth={1}
        />
      </lineSegments>
    </group>
  );
}

// ---------- Labels ----------

function DepartmentLabels({
  features, cx, cy, zoom,
}: { features: GeoFeature[]; cx: number; cy: number; zoom: number }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      for (const child of groupRef.current.children) {
        child.quaternion.copy(camera.quaternion);
      }
    }
  });

  const labels = useMemo(() => {
    return features.map((f) => {
      const rings = ringsOf(f);
      const biggest = rings.reduce((a, b) => (b.length > a.length ? b : a));
      let sx = 0, sy = 0;
      for (const [x, y] of biggest) { sx += x; sy += y; }
      const pos = geoToSphere(sx / biggest.length, sy / biggest.length, cx, cy, zoom, R * 1.025);
      return { name: f.properties.NAME_1, position: pos };
    });
  }, [features, cx, cy, zoom]);

  return (
    <group ref={groupRef}>
      {labels.map((label) => (
        <sprite key={label.name} position={label.position} scale={[0.38, 0.13, 1]}>
          <spriteMaterial transparent opacity={0.8}>
            <canvasTexture
              attach="map"
              image={(() => {
                const cvs = document.createElement("canvas");
                cvs.width = 256;
                cvs.height = 64;
                const ctx = cvs.getContext("2d")!;
                ctx.fillStyle = "rgba(248,245,236,0.92)";
                ctx.font = "bold 26px system-ui, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.strokeStyle = "rgba(0,0,0,0.7)";
                ctx.lineWidth = 4;
                ctx.strokeText(label.name, 128, 32);
                ctx.fillText(label.name, 128, 32);
                return cvs;
              })()}
            />
          </spriteMaterial>
        </sprite>
      ))}
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
    const fitR = R * 1.28;
    const dist = Math.max(fitR / Math.sin(vFov / 2), fitR / Math.sin(hFov / 2));
    cam.position.set(0, 0, dist * 0.98);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// ---------- Scène ----------

function Scene({
  features, cx, cy, zoom, hovered, onHover, onClick,
}: {
  features: GeoFeature[]; cx: number; cy: number; zoom: number;
  hovered: string | null;
  onHover: (code: string | null) => void;
  onClick: (code: string, name: string) => void;
}) {
  return (
    <>
      <FitCamera />
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 3, 6]} intensity={1.0} />
      <pointLight position={[-3, -1, 5]} intensity={0.5} color="#7c5cff" />

      <OceanSphere />
      <Atmosphere />
      <Rings />

      {features.map((feature, i) => {
        const code = HASC_TO_CODE[feature.properties.HASC_1] ?? feature.properties.NAME_1;
        return (
          <DepartmentMesh
            key={code}
            feature={feature}
            index={i}
            cx={cx}
            cy={cy}
            zoom={zoom}
            isHovered={hovered === code}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}

      <DepartmentLabels features={features} cx={cx} cy={cy} zoom={zoom} />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        rotateSpeed={0.4}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(Math.PI * 2) / 3}
        minAzimuthAngle={-Math.PI / 4.5}
        maxAzimuthAngle={Math.PI / 4.5}
      />
    </>
  );
}

// ---------- Composant principal ----------

export function HaitiInteractiveGlobe({
  onDepartmentClick,
  artistsByDepartment = {},
}: HaitiInteractiveGlobeProps) {
  const [geojson, setGeojson] = useState<{ features: GeoFeature[] } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/haiti-departments.geojson")
      .then((r) => r.json())
      .then(setGeojson)
      .catch(() => {});
  }, []);

  const { cx, cy, zoom } = useMemo(() => {
    if (!geojson) return { cx: -72.3, cy: 19.0, zoom: 35 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of geojson.features) {
      for (const ring of ringsOf(f)) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      zoom: LAT_SPAN_DEG / (maxY - minY),
    };
  }, [geojson]);

  const handleClick = useCallback(
    (code: string, name: string) => onDepartmentClick?.(code, name),
    [onDepartmentClick],
  );

  if (!geojson) {
    return (
      <div style={{ width: "100%", height: "min(880px, 88vh)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a9ac0" }}>
        Chargement du globe...
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "min(880px, 88vh)" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", touchAction: "pan-y" }}
      >
        <Scene
          features={geojson.features}
          cx={cx}
          cy={cy}
          zoom={zoom}
          hovered={hovered}
          onHover={setHovered}
          onClick={handleClick}
        />
      </Canvas>

      {/* Preview des artistes au survol */}
      {hovered && artistsByDepartment[hovered] && artistsByDepartment[hovered].length > 0 && (
        <div className={styles.artistPreview}>
          <div className={styles.artistScroll}>
            {artistsByDepartment[hovered].map((artist) => (
              <div key={artist.id} className={styles.artistChip}>
                <img
                  src={artistAvatarSrc(artist.imageUrl)}
                  alt=""
                  className={styles.artistAvatar}
                />
                <span>{artist.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", color: "#9a9ac0", fontSize: "0.78rem", margin: 0, pointerEvents: "none" }}>
        Survolez un département pour voir ses artistes • Cliquez pour explorer
      </p>
    </div>
  );
}
