/* eslint-disable @next/next/no-img-element -- avatars distants (Spotify/YouTube) */
"use client";

import { useState, useMemo } from "react";
import { HaitiInteractiveGlobe } from "@/components/HaitiMap";
import Link from "next/link";
import { artistAvatarSrc } from "@/lib/artists/avatar";
import styles from "./carte.module.css";

interface Department {
  id: string;
  name: string;
  code: string;
  haiti_communes: Array<{ id: string; name: string }>;
}

export interface MapArtist {
  id: string;
  name: string;
  slug: string;
  /** Commune de naissance, quand elle est renseignée. */
  communeId: string | null;
  imageUrl: string | null;
}

interface HaitiMapPageProps {
  artistsByDepartment: Record<string, MapArtist[]>;
  departments: Department[];
}

/** Vignette d'artiste réutilisée par les trois vues de la carte. */
function ArtistCard({ artist }: { artist: MapArtist }) {
  return (
    <Link href={`/artistes/${artist.slug}`} className={styles.artistCard}>
      <img src={artistAvatarSrc(artist.imageUrl)} alt="" className={styles.artistImg} />
      <span>{artist.name}</span>
    </Link>
  );
}

export function HaitiMapPage({ artistsByDepartment, departments }: HaitiMapPageProps) {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedCommune, setSelectedCommune] = useState<{ id: string; name: string } | null>(null);

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

  // Données pour le globe interactif (shape adaptée au composant).
  const artistsByDepartmentForGlobe = useMemo(() => {
    const result: Record<string, { id: string; name: string; imageUrl: string | null }[]> = {};
    for (const [code, artists] of Object.entries(artistsByDepartment)) {
      result[code] = artists.map((a) => ({ id: a.id, name: a.name, imageUrl: a.imageUrl }));
    }
    return result;
  }, [artistsByDepartment]);

  // Vue commune : artistes rattachés à cette commune
  if (selectedDept && selectedCommune) {
    const communeArtists = (artistsByDepartment[selectedDept.code] ?? []).filter(
      (artist) => artist.communeId === selectedCommune.id,
    );
    return (
      <main className={styles.page}>
        <button className={styles.backBtn} onClick={handleBack}>← Retour à {selectedDept.name}</button>
        <h1 className={styles.title}>{selectedCommune.name}</h1>
        <p className={styles.subtitle}>{selectedDept.name}</p>
        <div className={styles.artistGrid}>
          {communeArtists.length > 0 ? (
            communeArtists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)
          ) : (
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
              onClick={() => setSelectedCommune({ id: commune.id, name: commune.name })}
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
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      </main>
    );
  }

  // Vue carte complète : le globe 3D interactif EST la carte.
  // Pas besoin de la carte SVG séparée en dessous : chaque département est
  // cliquable directement sur la sphère.
  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Carte <span className={styles.accent}>HMI</span></h1>
        <p className={styles.subtitle}>Découvrez les artistes haïtiens par département</p>
      </div>

      {/* Globe 3D interactif : chaque département est un mesh cliquable */}
      <HaitiInteractiveGlobe
        onDepartmentClick={handleDepartmentClick}
        artistsByDepartment={artistsByDepartmentForGlobe}
      />
    </main>
  );
}
