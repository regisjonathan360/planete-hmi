"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ParticleSphere } from "./ParticleSphere";

/* Hero cosmos pleine page — design « 21st » (démo cosmos-3d-orbit-gallery) :
   fond noir plein écran, sphère de particules + couvertures d'articles en
   orbite, titre poétique superposé en haut. La sphère se fait attraper
   et faire tourner (rotation/zoom libres, pan désactivé pour le scroll). */

interface NewsCosmosHeroProps {
  images: string[];
  tag?: string;
  statement?: React.ReactNode;
  /** Contenu superposé au milieu des étoiles (cartes d'actualités). */
  children?: React.ReactNode;
}

export function NewsCosmosHero({
  images,
  tag = "// Actualités — Planète HMI",
  statement = (
    <>
      Actualités <span className="fx-o">HMI</span>
    </>
  ),
  children,
}: NewsCosmosHeroProps) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <section className="news-cosmos-hero" aria-label="Actualités de la musique haïtienne">
      <Canvas
        camera={{ position: [-10, 1.5, 10], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        className="news-cosmos-hero__canvas"
        style={{ position: "absolute", inset: 0 }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <ParticleSphere images={images} reduced={reduced} />
        <OrbitControls
          enablePan={false}
          enableZoom
          enableRotate
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          minDistance={6}
          maxDistance={26}
        />
      </Canvas>

      <div className="news-cosmos-hero__overlay">
        <p className="section-tag">{tag}</p>
        <h1 className="news-cosmos-hero__title">{statement}</h1>
      </div>

      {children && <div className="news-cosmos-hero__content">{children}</div>}
    </section>
  );
}