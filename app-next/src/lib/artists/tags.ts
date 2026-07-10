/**
 * Étiquettes de rôle des artistes.
 * Un artiste peut cumuler plusieurs étiquettes.
 *
 * Palette de couleurs et icônes associées.
 */

export type ArtistTag = "chanteur" | "rappeur" | "beatmaker" | "auteur_compositeur" | "groupe" | "dj";

export interface TagMeta {
  id: ArtistTag;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const ARTIST_TAGS: TagMeta[] = [
  {
    id: "chanteur",
    label: "Chanteur",
    icon: "🎤",
    color: "#46b7ff",
    bgColor: "rgba(70, 183, 255, 0.15)",
  },
  {
    id: "rappeur",
    label: "Rappeur",
    icon: "🎙️",
    color: "#ff5c7c",
    bgColor: "rgba(255, 92, 124, 0.15)",
  },
  {
    id: "beatmaker",
    label: "Beatmaker / Producteur",
    icon: "🎹",
    color: "#ffb347",
    bgColor: "rgba(255, 179, 71, 0.15)",
  },
  {
    id: "auteur_compositeur",
    label: "Auteur / Compositeur",
    icon: "✍️",
    color: "#3ddc84",
    bgColor: "rgba(61, 220, 132, 0.15)",
  },
  {
    id: "groupe",
    label: "Groupe",
    icon: "👥",
    color: "#c084fc",
    bgColor: "rgba(192, 132, 252, 0.15)",
  },
  {
    id: "dj",
    label: "DJ",
    icon: "🎧",
    color: "#f472b6",
    bgColor: "rgba(244, 114, 182, 0.15)",
  },
];

export function getTagMeta(id: string): TagMeta | undefined {
  return ARTIST_TAGS.find((t) => t.id === id);
}
