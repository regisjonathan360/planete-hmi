export const ARTIST_GENRES = [
  { value: "konpa", label: "Konpa" },
  { value: "konpa-direk", label: "Konpa dirèk" },
  { value: "raboday", label: "Rabòday" },
  { value: "rasin", label: "Rasin" },
  { value: "mizik-twoubadou", label: "Mizik twoubadou" },
  { value: "rara", label: "Rara" },
  { value: "zouk", label: "Zouk" },
  { value: "gospel", label: "Gospel / musique évangélique" },
  { value: "hip-hop-rap", label: "Hip-Hop / Rap" },
  { value: "trap", label: "Trap" },
  { value: "drill", label: "Drill" },
  { value: "r-b", label: "R&B" },
  { value: "soul", label: "Soul" },
  { value: "afrosounds", label: "Afrobeats / Afrosounds" },
  { value: "dancehall", label: "Dancehall" },
  { value: "reggae", label: "Reggae" },
  { value: "pop", label: "Pop" },
  { value: "jazz-blues", label: "Jazz / Blues" },
  { value: "rock", label: "Rock" },
  { value: "electronic", label: "Musique électronique" },
  { value: "latin", label: "Musique latine" },
  { value: "caribbean", label: "Musique caribéenne" },
  { value: "world-music", label: "World music" },
  { value: "folk-acoustic", label: "Folk / acoustique" },
  { value: "classical", label: "Musique classique" },
  { value: "instrumental", label: "Instrumental" },
  { value: "other", label: "Autre" },
] as const;

export function artistGenreOptions(currentValue: string) {
  const normalizedCurrent = currentValue.trim();
  if (!normalizedCurrent || ARTIST_GENRES.some((genre) => genre.value === normalizedCurrent)) {
    return ARTIST_GENRES;
  }

  return [
    { value: normalizedCurrent, label: `${normalizedCurrent} (valeur existante)` },
    ...ARTIST_GENRES,
  ];
}
