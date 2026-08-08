/**
 * Génère le HTML du podium planétaire injecté dans la page d'accueil.
 *
 * Remplace le contenu codé en dur du fichier statique `index.html` entre les
 * marqueurs <!-- PODIUM_START --> et <!-- PODIUM_END -->.
 */
import type { HomepageChartEntry } from "./homepage-chart";

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function movementHtml(entry: HomepageChartEntry): string {
  if (entry.movement === null) return '<span class="trend new">N</span>';
  if (entry.movement > 0) return `<span class="trend up">▲ ${entry.movement}</span>`;
  if (entry.movement < 0) return `<span class="trend down">▼ ${Math.abs(entry.movement)}</span>`;
  return '<span class="trend">•</span>';
}

const PLACEHOLDER = "/image/artists/planet-hmi-artist-placeholder-square.webp.webp";

function imgSrc(entry: HomepageChartEntry): string {
  return entry.artworkUrl || PLACEHOLDER;
}

function profileUrl(entry: HomepageChartEntry): string {
  if (entry.artistSlug) return `/artistes/${entry.artistSlug}`;
  return "/artistes";
}

function podiumCard(entry: HomepageChartEntry, rank: number): string {
  const variant = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";
  const size = rank === 1 ? 340 : 300;
  const crown = rank === 1 ? '<span class="podium__crown" aria-hidden="true">♛</span>' : "";
  const btnClass = rank === 1 ? "btn btn-primary" : "btn btn-outline";

  return `
<article class="podium__card podium__card--${variant}" data-preview-artist="${esc(entry.artistName)}" data-preview-titre="${esc(entry.title)}">
  ${crown}
  <span class="podium__rank">${rank}</span>
  <div class="podium__media">
    <img src="${esc(imgSrc(entry))}" alt="${esc(entry.artistName)}" loading="lazy" width="${size}" height="${size}" />
    <button class="preview-btn" type="button" aria-label="Écouter un extrait de ${esc(entry.artistName)}" data-preview-toggle>
      <span class="preview-btn__icon preview-btn__icon--play" aria-hidden="true"></span>
      <span class="preview-btn__icon preview-btn__icon--pause" aria-hidden="true"></span>
      <span class="preview-btn__spinner" aria-hidden="true"></span>
      <span class="preview-btn__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </button>
  </div>
  <h3 class="podium__name">${esc(entry.title)}</h3>
  <p class="podium__stat">${esc(entry.artistName)} ${movementHtml(entry)}</p>
  <a class="${btnClass}" href="${esc(profileUrl(entry))}">Voir le profil</a>
</article>`;
}

function miniCard(entry: HomepageChartEntry, rank: number): string {
  return `
<article class="mini" data-preview-artist="${esc(entry.artistName)}" data-preview-titre="${esc(entry.title)}">
  <span class="mini__rank">${rank}</span>
  <img src="${esc(imgSrc(entry))}" alt="${esc(entry.artistName)}" loading="lazy" width="72" height="72" />
  <div class="mini__meta"><span class="mini__name">${esc(entry.title)}</span><span class="mini__stat">${esc(entry.artistName)}</span></div>
  ${movementHtml(entry)}
  <button class="preview-btn preview-btn--sm" type="button" aria-label="Écouter un extrait de ${esc(entry.artistName)}" data-preview-toggle>
    <span class="preview-btn__icon preview-btn__icon--play" aria-hidden="true"></span>
    <span class="preview-btn__icon preview-btn__icon--pause" aria-hidden="true"></span>
    <span class="preview-btn__spinner" aria-hidden="true"></span>
    <span class="preview-btn__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  </button>
</article>`;
}

/**
 * Construit le HTML complet du podium. Si aucune donnée n'est publiée, renvoie
 * une chaîne vide (le HTML statique de démo reste en place).
 */
export function buildPodiumHtml(entries: HomepageChartEntry[]): string {
  if (entries.length < 3) return "";

  const podium = entries.slice(0, 3);
  const mini = entries.slice(3, 5);

  // L'ordre visuel du podium est : 2e, 1er, 3e (comme un vrai podium).
  const podiumHtml = [podiumCard(podium[1], 2), podiumCard(podium[0], 1), podiumCard(podium[2], 3)].join("");

  const miniHtml = mini.length > 0
    ? `<div class="rank-mini reveal">${mini.map((e, i) => miniCard(e, i + 4)).join("")}</div>`
    : "";

  return [
    `<div class="podium reveal" id="artistes">${podiumHtml}</div>`,
    miniHtml,
    '<p class="disclaimer">Classement calculé automatiquement à partir de la moyenne des positions sur toutes les plateformes publiées.</p>',
  ].join("\n");
}
