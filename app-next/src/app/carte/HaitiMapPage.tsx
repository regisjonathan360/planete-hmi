"use client";

import { useState } from "react";
import { HaitiMapSVG, HaitiGlobe } from "@/components/HaitiMap";
import Link from "next/link";
import styles from "./carte.module.css";

interface Department {
  id: string;
  name: string;
  code: string;
  haiti_communes: Array<{ id: string; name: string }>;
}

interface HaitiMapPageProps {
  artistsByDepartment: Record<string, Array<{ id: string; name: string; image_url: string | null }>>;
  departments: Department[];
}

export function HaitiMapPage({ artistsByDepartment, departments }: HaitiMapPageProps) {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);

  function handleDepartmentClick(code: string) {
    const dept = departments.find((d) => d.code === code);
    if (dept) {
      setSelectedDept(dept);
      setSelectedCommune(null);
    }
  }

  function handleBack() {
    if (selectedCommune) {
      setSelectedCommune(null);
    } else {
      setSelectedDept(null);
    }
  }

  // Vue commune : artistes de cette commune
  if (selectedDept && selectedCommune) {
    const communeArtists = artistsByDepartment[selectedDept.code]?.filter(() => true) ?? []; // TODO: filter by commune when data is available
    return (
      <main className={styles.page}>
        <button className={styles.backBtn} onClick={handleBack}>← Retour à {selectedDept.name}</button>
        <h1 className={styles.title}>{selectedCommune}</h1>
        <p className={styles.subtitle}>{selectedDept.name}</p>
        <div className={styles.artistGrid}>
          {communeArtists.length > 0 ? communeArtists.map((artist) => (
            <Link href={`/artistes/${artist.id}`} key={artist.id} className={styles.artistCard}>
              {artist.image_url ? (
                <img src={artist.image_url} alt="" className={styles.artistImg} />
              ) : (
                <div className={styles.artistImgPlaceholder}>♪</div>
              )}
              <span>{artist.name}</span>
            </Link>
          )) : (
            <p className={styles.empty}>Aucun artiste enregistré pour cette commune.</p>
          )}
        </div>
      </main>
    );
  }

  // Vue département zoomé : communes cliquables
  if (selectedDept) {
    return (
      <main className={styles.page}>
        <button className={styles.backBtn} onClick={handleBack}>← Retour à la carte</button>
        <h1 className={styles.title}>{selectedDept.name}</h1>
        <p className={styles.subtitle}>{artistsByDepartment[selectedDept.code]?.length ?? 0} artistes originaires</p>

        <div className={styles.communeGrid}>
          {selectedDept.haiti_communes.map((commune) => (
            <button
              key={commune.id}
              className={styles.communeCard}
              onClick={() => setSelectedCommune(commune.name)}
            >
              <span className={styles.communeIcon}>📍</span>
              <span>{commune.name}</span>
            </button>
          ))}
        </div>

        {/* Artistes du département */}
        <h2 className={styles.sectionTitle}>Artistes de {selectedDept.name}</h2>
        <div className={styles.artistGrid}>
          {(artistsByDepartment[selectedDept.code] ?? []).map((artist) => (
            <Link href={`/artistes/${artist.id}`} key={artist.id} className={styles.artistCard}>
              {artist.image_url ? (
                <img src={artist.image_url} alt="" className={styles.artistImg} />
              ) : (
                <div className={styles.artistImgPlaceholder}>♪</div>
              )}
              <span>{artist.name}</span>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  // Vue carte complète
  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Carte <span className={styles.accent}>HMI</span></h1>
        <p className={styles.subtitle}>Découvrez les artistes haïtiens par département</p>
      </div>
      {/* Globe 3D avec la carte d'Haïti */}
      <HaitiGlobe />
      <p style={{ textAlign: "center", color: "#9a9ac0", fontSize: "0.82rem", margin: "0.5rem 0 2rem" }}>
        Faites tourner la planète • Cliquez un département ci-dessous
      </p>
      <HaitiMapSVG
        onDepartmentClick={handleDepartmentClick}
        artistsByDepartment={artistsByDepartment}
      />
    </main>
  );
}
