/** Badge d'évolution : icône + texte + couleur (jamais la couleur seule). */
export function ChartMovementBadge({
  movement,
  entryStatus,
}: {
  movement: number | null;
  entryStatus: string | null;
}) {
  if (entryStatus === "new") {
    return <span className="mv mv--new" aria-label="Nouvelle entrée">★ NEW</span>;
  }
  if (entryStatus === "reentry") {
    return <span className="mv mv--reentry" aria-label="Réentrée">↺ RE</span>;
  }
  if (movement == null || movement === 0) {
    return <span className="mv mv--stable" aria-label="Position stable">▬ 0</span>;
  }
  if (movement > 0) {
    return <span className="mv mv--up" aria-label={`En hausse de ${movement}`}>▲ {movement}</span>;
  }
  return (
    <span className="mv mv--down" aria-label={`En baisse de ${Math.abs(movement)}`}>
      ▼ {Math.abs(movement)}
    </span>
  );
}
