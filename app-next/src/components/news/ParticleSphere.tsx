"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* Sphère cosmos — design « 21st » (démo cosmos-3d-orbit-gallery) :
   nuage de particules dorées sur une sphère + couvertures d'articles en
   orbite sur l'équateur, face vers l'extérieur. Dérive très lente.
   Les textures sont chargées via TextureLoader (CORS anonyme) ; les images
   illisibles sont ignorées sans crash. */

const PARTICLE_COUNT = 1500;
const PARTICLE_SIZE_MIN = 0.005;
const PARTICLE_SIZE_MAX = 0.01;
const SPHERE_RADIUS = 9;
const POSITION_RANDOMNESS = 4;
const IMAGE_SIZE = 1.5;
const ROTATION_SPEED_Y = 0.0005;

interface ParticleSphereProps {
  images: string[];
  /** prefers-reduced-motion : coupe la dérive de la sphère */
  reduced?: boolean;
}

/** Charge les textures des couvertures, ignore les échecs (CORS, 404…). */
function useCoverTextures(images: string[]): THREE.Texture[] {
  const [textures, setTextures] = useState<THREE.Texture[]>([]);

  useEffect(() => {
    let alive = true;
    setTextures([]);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const loaded: THREE.Texture[] = [];
    for (const url of images) {
      loader.load(
        url,
        (texture) => {
          if (!alive) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          loaded.push(texture);
          setTextures([...loaded]);
        },
        undefined,
        () => {
          /* image illisible (CORS/404) → on la saute silencieusement */
        }
      );
    }

    return () => {
      alive = false;
    };
  }, [images]);

  return textures;
}

interface Particle {
  position: [number, number, number];
  scale: number;
  color: THREE.Color;
}

export function ParticleSphere({ images, reduced = false }: ParticleSphereProps) {
  const groupRef = useRef<THREE.Group>(null);
  const instancedRef = useRef<THREE.InstancedMesh>(null);

  const textures = useCoverTextures(images);

  /* Particules dorées (teintes jaune-orangé, comme la démo 21st) */
  const particles = useMemo<Particle[]>(() => {
    const result: Particle[] = [];
    const color = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
      const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
      const radiusVariation = SPHERE_RADIUS + (Math.random() - 0.5) * POSITION_RANDOMNESS;

      const x = radiusVariation * Math.cos(theta) * Math.sin(phi);
      const y = radiusVariation * Math.cos(phi);
      const z = radiusVariation * Math.sin(theta) * Math.sin(phi);

      color.setHSL(
        0.05 + Math.random() * 0.1,
        0.8,
        0.6 + Math.random() * 0.3
      );

      result.push({
        position: [x, y, z],
        scale: Math.random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN) + PARTICLE_SIZE_MIN,
        color: color.clone(),
      });
    }

    return result;
  }, []);

  /* Couvertures disposées sur l'équateur, orientées vers l'extérieur */
  const orbiting = useMemo(() => {
    const count = textures.length;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const position = new THREE.Vector3(
        SPHERE_RADIUS * Math.cos(angle),
        0,
        SPHERE_RADIUS * Math.sin(angle)
      );
      const outward = position.clone().normalize();
      const matrix = new THREE.Matrix4();
      matrix.lookAt(position, position.clone().add(outward), new THREE.Vector3(0, 1, 0));
      const rotation = new THREE.Euler().setFromRotationMatrix(matrix);

      return {
        position: [position.x, position.y, position.z] as [number, number, number],
        rotation: [rotation.x, rotation.y, rotation.z] as [number, number, number],
      };
    });
  }, [textures.length]);

  /* Écrit les positions/couleurs des particules une seule fois (InstancedMesh) */
  useLayoutEffect(() => {
    const mesh = instancedRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    particles.forEach((particle, i) => {
      dummy.position.set(particle.position[0], particle.position[1], particle.position[2]);
      dummy.scale.setScalar(particle.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, particle.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [particles]);

  useFrame(() => {
    if (!reduced && groupRef.current) {
      groupRef.current.rotation.y += ROTATION_SPEED_Y;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={instancedRef}
        args={[undefined, undefined, PARTICLE_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {orbiting.map((image, i) => (
        <mesh key={i} position={image.position} rotation={image.rotation}>
          <planeGeometry args={[IMAGE_SIZE, IMAGE_SIZE]} />
          <meshBasicMaterial map={textures[i]} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}