export interface AudiomackTickerEntry {
  rank: number;
  title: string;
  artistName: string;
  rankChange: number | null;
  isNew: boolean;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function movementMarkup(entry: AudiomackTickerEntry): string {
  if (entry.isNew) {
    return '<b class="ticker__movement ticker__movement--new" aria-label="Nouveau">N</b>';
  }

  if (entry.rankChange && entry.rankChange > 0) {
    return `<b class="ticker__movement up" aria-label="Progression de ${entry.rankChange} places">▲ ${entry.rankChange}</b>`;
  }

  if (entry.rankChange && entry.rankChange < 0) {
    return `<b class="ticker__movement down" aria-label="Recul de ${Math.abs(entry.rankChange)} places">▼ ${Math.abs(entry.rankChange)}</b>`;
  }

  return '<b class="ticker__movement ticker__movement--stable" aria-label="Position stable">•</b>';
}

function entryMarkup(entry: AudiomackTickerEntry): string {
  return [
    '<span class="ticker__item">',
    `<strong class="ticker__rank">#${escapeHtml(entry.rank)}</strong>`,
    movementMarkup(entry),
    `<span>${escapeHtml(entry.artistName)}</span>`,
    `<em>${escapeHtml(entry.title)}</em>`,
    "</span>",
  ].join("");
}

export function buildAudiomackTickerHtml(
  entries: AudiomackTickerEntry[]
): string {
  if (entries.length === 0) {
    return [
      '<div class="ticker ticker--empty" role="status">',
      '<span class="ticker__empty">Le classement Audiomack est en cours de mise à jour.</span>',
      "</div>",
    ].join("");
  }

  const items = entries.map(entryMarkup).join("");

  return [
    '<div class="ticker" role="region" aria-label="Top Audiomack Haïti">',
    '<div class="ticker__track">',
    `<div class="ticker__group">${items}</div>`,
    `<div class="ticker__group" aria-hidden="true">${items}</div>`,
    "</div>",
    "</div>",
  ].join("");
}
