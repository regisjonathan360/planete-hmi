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

// ---------- Projection ----------

const R = 2;
const LAT_SPAN_DEG = 56;
const DEG2RAD = Math.PI / 180;

function ringsOf(f: GeoFeature): GeoRing[] {
  return f.geometry.type === "MultiPolygon"
    ? (f.geometry.coordinates.flat() as GeoRing[])
    : f.geometry.coordinates;
}

/**
 * Convertit un point géographique (lng, lat) en position 3D à la surface
 * de la sphère. Le centre d'Haïti est placé face caméra (lon=0, lat=0).
 */
function geoToSphere(
  lng: number,
  lat: number,
  cx: number,
  cy: number,
  zoom: number,
  radius: number,
): THREE.Vector3 {
  const lonRad = (lng - cx) * zoom * DEG2RAD;
  const latRad = (lat - cy) * zoom * DEG2RAD;
  return new THREE.Vector3(
    -radius * Math.cos(latRad) * Math.sin(lonRad),
    radius * Math.sin(latRad),
    radius * Math.cos(latRad) * Math.cos(lonRad),
  );
}

/** Construit un Shape Three.js à partir d'un anneau de coordonnées géographiques. */
function ringToShape(
  ring: GeoRing,
  cx: number,
  cy: number,
  zoom: number,
): THREE.Shape {
  const shape = new THREE.Shape();
  // On projette en « coordonnées texel » plate d'abord, en UV.
  // Pas besoin d'être parfaitement fidèle pour l'interactivité :
  // on utilise ExtrudeGeometry pour coller le mesh à la sphère.
  for (let i = 0; i < ring.length; i++) {
    const u = (ring[i][0] - cx) * zoom * DEG2RAD;
    const v = (ring[i][1] - cy) * zoom * DEG2RAD;
    if (i === 0) shape.moveTo(u, v);
    else shape.lineTo(u, v);
  }
  shape.closePath();
  return shape;
}

/**
 * Crée la géométrie d'un département posée à la surface de la sphère.
 *
 * On ne peut pas simplement extruder un Shape dans l'espace de la sphère.
 * À la place, on crée un ShapeGeometry plan puis on déforme chaque vertex
 * pour le plaquer sur la sphère via la projection équirectangulaire.
 */
function buildDepartmentGeometry(
  rings: GeoRing[],
  cx: number,
  cy: number,
  zoom: number,
  radius: number,
): THREE.BufferGeometry {
  const mainShape = ringToShape(rings[0], cx, cy, zoom);
  // Les anneaux supplémentaires sont des trous (lacs, enclaves).
  for (let i = 1; i < rings.length; i++) {
    const hole = new THREE.Path();
    for (let j = 0; j < rings[i].length; j++) {
      const u = (rings[i][j][0] - cx) * zoom * DEG2RAD;
      const v = (rings[i][j][1] - cy) * zoom * DEG2RAD;
      if (j === 0) hole.moveTo(u, v);
      else hole.lineTo(u, v);
    }
    hole.closePath();
    mainShape.holes.push(hole);
  }

  const shapeGeo = new THREE.ShapeGeometry(mainShape, 4);
  const pos = shapeGeo.attributes.position;

  // Déformer : chaque vertex (u, v, 0) → point 3D sur la sphère.
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

// ---------- Composants 3D ----------

function OceanSphere() {
  return (
    <mesh>
      <sphereGeometry args={[R * 0.995, 64, 64]} />
      <meshStandardMaterial color="#080d1a" roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

function Rings() {
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ringGeo = useMemo(() => new THREE.RingGeometry(R * 1.16, R * 1.24, 128), []);
  const ring2Geo = useMemo(() => new THREE.RingGeometry(R * 1.27, R * 1.295, 128), []);

  useEffect(() => () => { ringGeo.dispose(); ring2Geo.dispose(); }, [ringGeo, ring2Geo]);

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.06;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * 0.03;
  });

  return (
    <>
      <mesh ref={ringRef} rotation={[Math.PI / 2.7, 0.28, 0]}>
        <primitive object={ringGeo} attach="geometry" />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2.7, 0.28, 0]}>
        <primitive object={ring2Geo} attach="geometry" />
        <meshBasicMaterial color="#00d4b8" transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[R * 1.045, 64, 64]} />
      <meshBasicMaterial color="#7c5cff" transparent opacity={0.07} side={THREE.BackSide} />
    </mesh>
  );
}

const DEPT_COLORS = ["#1b3fa8", "#c62828", "#22499f", "#b71c1c", "#1f3f96"];
const HOVER_COLOR = new THREE.Color("#7c5cff");
const HOVER_EMISSIVE = new THREE.Color("#00d4b8");

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

  const geometry = useMemo(
    () => buildDepartmentGeometry(rings, cx, cy, zoom, R),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, zoom],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

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

  return (
    <mesh
      geometry={geometry}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <meshStandardMaterial
        color={isHovered ? HOVER_COLOR : baseColor}
        emissive={isHovered ? HOVER_EMISSIVE : baseColor}
        emissiveIntensity={isHovered ? 0.6 : 0.15}
        roughness={isHovered ? 0.3 : 0.6}
        metalness={0.08}
        side={THREE.DoubleSide}
        transparent
        opacity={isHovered ? 1 : 0.88}
      />
    </mesh>
  );
}

/** Label du département, flottant juste au-dessus de la surface. */
function DepartmentLabels({
  features,
  cx,
  cy,
  zoom,
}: {
  features: GeoFeature[];
  cx: number;
  cy: number;
  zoom: number;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    // Faire face à la caméra (billboard).
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
      const pos = geoToSphere(sx / biggest.length, sy / biggest.length, cx, cy, zoom, R * 1.02);
      return { name: f.properties.NAME_1, position: pos };
    });
  }, [features, cx, cy, zoom]);

  return (
    <group ref={groupRef}>
      {labels.map((label) => (
        <sprite key={label.name} position={label.position} scale={[0.35, 0.12, 1]}>
          <spriteMaterial transparent opacity={0.75}>
            <canvasTexture
              attach="map"
              image={(() => {
                const cvs = document.createElement("canvas");
                cvs.width = 256;
                cvs.height = 64;
                const ctx = cvs.getContext("2d")!;
                ctx.fillStyle = "rgba(248,245,236,0.9)";
                ctx.font = "bold 28px system-ui, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
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

function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const aspect = size.width / Math.max(1, size.height);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fitR = R * 1.31;
    const dist = Math.max(fitR / Math.sin(vFov / 2), fitR / Math.sin(hFov / 2));
    cam.position.set(0, 0, dist * 1.02);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Scene({
  features,
  cx,
  cy,
  zoom,
  hovered,
  onHover,
  onClick,
}: {
  features: GeoFeature[];
  cx: number;
  cy: number;
  zoom: number;
  hovered: string | null;
  onHover: (code: string | null) => void;
  onClick: (code: string, name: string) => void;
}) {
  return (
    <>
      <FitCamera />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 3, 6]} intensity={0.9} />
      <pointLight position={[-4, -2, 4]} intensity={0.4} color="#7c5cff" />

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
        rotateSpeed={0.45}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={Math.PI / 2.9}
        maxPolarAngle={(Math.PI * 1.9) / 2.9}
        minAzimuthAngle={-Math.PI / 5}
        maxAzimuthAngle={Math.PI / 5}
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
    if (!geojson) return { cx: -72.3, cy: 19.0, zoom: 27 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of geojson.features) {
      for (const ring of ringsOf(f)) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
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
        camera={{ position: [0, 0, 6], fov: 42 }}
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
        Cliquez un département pour explorer ses artistes • Faites tourner la planète
      </p>
    </div>
  );
}
