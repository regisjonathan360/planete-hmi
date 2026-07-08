import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("../..");
const sourceJson = path.join(root, "data/haitian-artists-research/final/artistes_nationalite_haitienne_sources.json");
const outputDir = path.resolve(".");
const outputXlsx = path.join(outputDir, "verification-nationalite-artistes-haitiens.xlsx");
const outputCsv = path.join(outputDir, "verification-nationalite-artistes-haitiens.csv");

const musicRegex =
  /\b(rapper|rappeur|singer|chanteur|musician|musicien|songwriter|composer|producer|producteur|record producer|band|groupe|saxophonist|hip hop|compas|kompa|gospel|zouk|artist musical|musical artist)\b/i;
const nonMusicRegex =
  /\b(painter|poet|politician|footballer|actress|actor|journalist|model|capital|city|commune|skier|film director|ecrivain|writer)\b/i;
const localHaitiRegex =
  /\b(ha[ïi]ti|ha[ïi]tien|ha[ïi]tienne|haitian|compas|kompa|gospel|worship|vodou|jacmel|cap|les cayes|klass|5lan|disip|septentrional)\b/i;
const groupRegex = /\b(groupe|band|orchestre|orchestra|collectif|worship|team)\b/i;

const directNonHaitian = new Set([
  "Clever",
  "Jocelyne Béroard",
  "Kwame Nkrumah-Acheampong",
  "Lil Uzi Vert",
  "M.I.A. (rapper)",
  "Maffio",
  "Maia Vidal",
  "Major Myjah",
  "MC Solaar",
  "Oj Da Juiceman",
  "P. Reign",
  "Remy Ma",
  "Roach Killa",
  "Sammus",
  "Young Zee",
]);

const manualOverrides = {
  "$NOT": {
    nationalite: "OUI - origine haïtienne diaspora confirmée",
    catalogue: "OK musical - diaspora",
    confidence: 92,
    proof: "Source publique",
    entityKind: "solo diaspora",
    sourceType: "Wikipedia / GQ",
    sourceUrl: "https://en.wikipedia.org/wiki/Snot_(rapper)",
    secondaryUrl: "https://www.gq.com/story/snot-ethereal-interview-doja-asap-rocky",
    evidence:
      "$NOT / SNOT est un rappeur américain; sources publiques indiquent une origine haïtienne et dominicaine. À classer diaspora, pas nationalité haïtienne stricte.",
    action: "Garder comme diaspora haïtienne, avec mention 'origine haïtienne'.",
  },
  "Kwame Nkrumah-Acheampong": {
    nationalite: "NON - autre nationalité confirmée",
    catalogue: "À retirer - pas artiste musical",
    confidence: 96,
    proof: "Source publique",
    entityKind: "personne non musicale",
    sourceType: "Wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Kwame_Nkrumah-Acheampong",
    secondaryUrl: "",
    evidence: "Source publique: skieur ghanéen, pas artiste musical haïtien.",
    action: "Retirer du catalogue artistes HMI.",
  },
  "Major Myjah": {
    nationalite: "NON - autre nationalité confirmée",
    catalogue: "À retirer sauf collaboration",
    confidence: 92,
    proof: "Source publique",
    entityKind: "solo non haïtien",
    sourceType: "Wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Major_Myjah",
    secondaryUrl: "",
    evidence: "Source publique: musicien jamaïcain-américain, origine Jamaïque/Miami.",
    action: "Retirer comme artiste haïtien; garder seulement si collaboration haïtienne documentée.",
  },
  "P. Reign": {
    nationalite: "NON - autre nationalité confirmée",
    catalogue: "À retirer sauf collaboration",
    confidence: 90,
    proof: "Source publique",
    entityKind: "solo non haïtien",
    sourceType: "Wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Preme",
    secondaryUrl: "",
    evidence: "Source publique: rappeur canadien, d'origine guyanaise selon la biographie publique.",
    action: "Retirer comme artiste haïtien.",
  },
  "Jocelyne Béroard": {
    nationalite: "NON - autre nationalité confirmée",
    catalogue: "À retirer sauf collaboration/actualité liée",
    confidence: 92,
    proof: "Source publique",
    entityKind: "solo non haïtien",
    sourceType: "Wikipedia / Le Monde",
    sourceUrl: "https://en.wikipedia.org/wiki/Jocelyne_B%C3%A9roard",
    secondaryUrl: "https://www.lemonde.fr/culture/article/2024/05/15/jocelyne-beroard-veut-entretenir-la-memoire-de-jacob-desvarieux_6233482_3246.html",
    evidence: "Source publique: chanteuse française née en Martinique, connue avec Kassav'.",
    action: "Ne pas classer comme artiste haïtienne.",
  },
  "Clever": {
    nationalite: "NON - autre nationalité confirmée",
    catalogue: "À retirer sauf preuve d'origine haïtienne",
    confidence: 88,
    proof: "Source publique",
    entityKind: "solo non haïtien",
    sourceType: "Wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Clever_(musician)",
    secondaryUrl: "",
    evidence: "Source publique: rappeur américain né en Alabama; aucune preuve publique trouvée d'origine haïtienne.",
    action: "Retirer ou garder en attente seulement si une source d'origine haïtienne est fournie.",
  },
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function sourceLabel(evidence) {
  return String(evidence ?? "").split(":")[0].trim();
}

function isLikelyHomonym(item) {
  const name = item.artist_name;
  const text = `${name} ${item.notes} ${item.genres}`;
  const label = sourceLabel(item.evidence_summary);
  const cleanName = normalize(name);
  const cleanLabel = normalize(label);
  const exactEnough =
    cleanLabel === cleanName ||
    (cleanName.length > 6 && cleanLabel.includes(cleanName)) ||
    (cleanLabel.length > 6 && cleanName.includes(cleanLabel));

  if (!item.source_url) return false;
  if (directNonHaitian.has(name)) return false;
  if (
    item.verdict === "NON_HAITIEN" &&
    localHaitiRegex.test(text) &&
    (/\([^)]*\)/.test(name) || /\bhaiti\b/i.test(name) || groupRegex.test(text))
  ) {
    return true;
  }
  if (/\([^)]*\)/.test(name) && !exactEnough) return true;
  if (localHaitiRegex.test(text) && !exactEnough) return true;
  if (["rico", "roro", "gonzales", "maestro", "oswald", "woods", "val"].includes(cleanName)) return true;
  return false;
}

function deriveRow(item, duplicateCount) {
  if (manualOverrides[item.artist_name]) {
    return {
      ...item,
      ...manualOverrides[item.artist_name],
      duplicateFlag: duplicateCount > 1 ? "Doublon dans le CSV source" : "",
    };
  }

  const text = `${item.artist_name} ${item.notes} ${item.genres} ${item.evidence_summary}`;
  const isGroup = groupRegex.test(text) || item.verdict.includes("GROUPE");
  const hasPublicSource = Boolean(item.source_url);
  const sourceLooksMusical = musicRegex.test(item.evidence_summary);
  const sourceLooksNonMusical = nonMusicRegex.test(item.evidence_summary);
  const homonym = isLikelyHomonym(item);

  let nationalite = "À VÉRIFIER - preuve publique insuffisante";
  let catalogue = "Recherche manuelle requise";
  let proof = hasPublicSource ? "Source publique faible/ambiguë" : "Source publique manquante";
  let confidence = Number(item.confidence || item.confidence_score || 50);
  let entityKind = isGroup ? "groupe/collectif" : "solo";
  let action = "Chercher une source indépendante avant validation.";
  let evidence = item.evidence_summary || item.notes || "";

  if (homonym) {
    nationalite = "À VÉRIFIER - homonyme probable";
    catalogue = "Ne pas rejeter/valider sans contrôle";
    proof = "Source trouvée probablement sur un autre artiste";
    confidence = Math.min(confidence, 50);
    action = "Vérifier manuellement le bon artiste; la source trouvée ne semble pas correspondre.";
  } else if (item.verdict === "NON_HAITIEN") {
    nationalite = "NON - autre nationalité confirmée";
    catalogue = "À retirer sauf collaboration";
    proof = "Source publique";
    confidence = Math.max(confidence, 82);
    entityKind = "solo non haïtien";
    action = "Retirer du catalogue haïtien, sauf rôle de collaboration explicitement documenté.";
  } else if (item.verdict === "CONFIRME_ORIGINE_HAITIENNE_DIASPORA") {
    nationalite = "OUI - origine haïtienne diaspora confirmée";
    catalogue = "OK musical - diaspora";
    proof = "Source publique";
    confidence = Math.max(confidence, 88);
    action = "Garder avec statut diaspora/origine haïtienne.";
  } else if (item.verdict === "CONFIRME_HAITIEN" || item.verdict === "GROUPE_HAITIEN") {
    if (sourceLooksNonMusical && !sourceLooksMusical) {
      nationalite = "OUI - haïtien confirmé, rôle musical à vérifier";
      catalogue = "À vérifier - rôle musical non confirmé";
      proof = "Source publique confirme Haïti mais pas le rôle musical";
      confidence = Math.min(confidence, 75);
      action = "Ne valider dans le catalogue musique qu'après preuve musicale.";
    } else {
      nationalite = item.verdict === "GROUPE_HAITIEN" ? "OUI - groupe haïtien confirmé" : "OUI - haïtien confirmé";
      catalogue = "OK musical";
      proof = "Source publique";
      confidence = Math.max(confidence, 88);
      action = "Garder dans le catalogue.";
    }
  } else if (item.verdict === "PROBABLE_HAITIEN" || item.verdict === "PROBABLE_GROUPE_HAITIEN") {
    nationalite = isGroup
      ? "PROBABLE - groupe haïtien, source à ajouter"
      : "PROBABLE - haïtien, source à ajouter";
    catalogue = "Peut rester provisoirement";
    proof = "Base interne / notes existantes";
    confidence = Math.min(confidence, 75);
    action = "Chercher une source publique avant de passer en vérifié.";
  } else if (localHaitiRegex.test(text)) {
    nationalite = isGroup
      ? "PROBABLE - groupe haïtien, source à ajouter"
      : "PROBABLE - haïtien, source à ajouter";
    catalogue = "Peut rester provisoirement";
    proof = "Indice haïtien dans les notes, sans source publique";
    confidence = Math.max(Math.min(confidence, 70), 60);
    action = "Ajouter une source publique ou média local fiable.";
  }

  return {
    ...item,
    nationalite,
    catalogue,
    confidence,
    proof,
    entityKind,
    sourceType: item.source_type || "",
    sourceUrl: item.source_url || "",
    secondaryUrl: item.secondary_source_url || "",
    evidence,
    action,
    duplicateFlag: duplicateCount > 1 ? "Doublon dans le CSV source" : "",
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const raw = JSON.parse(await fs.readFile(sourceJson, "utf8"));
const nameCounts = new Map();
for (const item of raw) nameCounts.set(item.artist_name, (nameCounts.get(item.artist_name) ?? 0) + 1);
const rows = raw.map((item) => deriveRow(item, nameCounts.get(item.artist_name) ?? 1));

const detailHeaders = [
  "row_number",
  "artist_name",
  "nationalite_verdict",
  "catalogue_action",
  "confidence",
  "proof_level",
  "entity_kind",
  "source_type",
  "source_url",
  "secondary_source_url",
  "evidence_summary",
  "recommended_action",
  "genres_originaux",
  "notes_originales",
  "duplicate_flag",
];

const detailMatrix = rows.map((row) => [
  Number(row.row_number),
  row.artist_name,
  row.nationalite,
  row.catalogue,
  Number(row.confidence),
  row.proof,
  row.entityKind,
  row.sourceType,
  row.sourceUrl,
  row.secondaryUrl,
  row.evidence,
  row.action,
  row.genres,
  row.notes,
  row.duplicateFlag,
]);

const csv = [detailHeaders, ...detailMatrix].map((line) => line.map(csvEscape).join(",")).join("\n");
await fs.writeFile(outputCsv, `${csv}\n`, "utf8");

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Résumé");
const details = workbook.worksheets.add("Détails");
summary.showGridLines = false;
details.showGridLines = false;

const summaryRows = [
  ["Vérification nationalité haïtienne", "", "", ""],
  ["Fichier source", "artistes_a_verifier_manuellement.csv", "", ""],
  ["Date de vérification", "2026-07-07", "", ""],
  ["Total lignes", "=COUNTA('Détails'!B2:B300)", "", ""],
  ["", "", "", ""],
  ["Statut", "Nombre", "Lecture", "Action"],
  ["OUI - haïtien confirmé", '=COUNTIF(\'Détails\'!C2:C300,"OUI - haïtien confirmé")', "Source publique claire", "Garder"],
  [
    "OUI - origine haïtienne diaspora confirmée",
    '=COUNTIF(\'Détails\'!C2:C300,"OUI - origine haïtienne diaspora confirmée")',
    "Origine haïtienne confirmée, nationalité stricte parfois étrangère",
    "Garder en diaspora",
  ],
  ["OUI - groupe haïtien confirmé", '=COUNTIF(\'Détails\'!C2:C300,"OUI - groupe haïtien confirmé")', "Groupe/source publique", "Garder"],
  [
    "OUI - haïtien confirmé, rôle musical à vérifier",
    '=COUNTIF(\'Détails\'!C2:C300,"OUI - haïtien confirmé, rôle musical à vérifier")',
    "Nationalité confirmée, activité musicale pas assez prouvée",
    "Vérifier musique",
  ],
  [
    "PROBABLE - haïtien, source à ajouter",
    '=COUNTIF(\'Détails\'!C2:C300,"PROBABLE - haïtien, source à ajouter")',
    "Notes internes favorables, source publique manquante",
    "Sourcer",
  ],
  [
    "PROBABLE - groupe haïtien, source à ajouter",
    '=COUNTIF(\'Détails\'!C2:C300,"PROBABLE - groupe haïtien, source à ajouter")',
    "Groupe local probable, source publique manquante",
    "Sourcer",
  ],
  ["NON - autre nationalité confirmée", '=COUNTIF(\'Détails\'!C2:C300,"NON - autre nationalité confirmée")', "Source publique non haïtienne", "Retirer"],
  [
    "À VÉRIFIER - homonyme probable",
    '=COUNTIF(\'Détails\'!C2:C300,"À VÉRIFIER - homonyme probable")',
    "La source trouvée vise probablement un autre artiste",
    "Contrôle manuel",
  ],
  [
    "À VÉRIFIER - preuve publique insuffisante",
    '=COUNTIF(\'Détails\'!C2:C300,"À VÉRIFIER - preuve publique insuffisante")',
    "Pas assez de preuve structurée",
    "Contrôle manuel",
  ],
];

summary.getRangeByIndexes(0, 0, summaryRows.length, 4).values = summaryRows;
details.getRangeByIndexes(0, 0, 1, detailHeaders.length).values = [detailHeaders];
details.getRangeByIndexes(1, 0, detailMatrix.length, detailHeaders.length).values = detailMatrix;

summary.getRange("A1:D1").merge();
summary.getRange("A1:D1").format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF", size: 16 },
};
summary.getRange("A6:D6").format = {
  fill: "#2563EB",
  font: { bold: true, color: "#FFFFFF" },
};
summary.getRange(`A6:D${summaryRows.length}`).format.borders = {
  insideHorizontal: { style: "thin", color: "#D1D5DB" },
  bottom: { style: "thin", color: "#9CA3AF" },
};
summary.getRange("A1:D15").format.wrapText = true;
summary.getRange("A:A").format.columnWidth = 40;
summary.getRange("B:B").format.columnWidth = 14;
summary.getRange("C:C").format.columnWidth = 48;
summary.getRange("D:D").format.columnWidth = 22;

details.getRangeByIndexes(0, 0, 1, detailHeaders.length).format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF" },
};
details.getRangeByIndexes(0, 0, detailMatrix.length + 1, detailHeaders.length).format.borders = {
  insideHorizontal: { style: "thin", color: "#E5E7EB" },
  bottom: { style: "thin", color: "#D1D5DB" },
};
details.getRange("A:A").format.columnWidth = 10;
details.getRange("B:B").format.columnWidth = 28;
details.getRange("C:C").format.columnWidth = 42;
details.getRange("D:D").format.columnWidth = 34;
details.getRange("E:E").format.columnWidth = 12;
details.getRange("F:G").format.columnWidth = 28;
details.getRange("H:H").format.columnWidth = 20;
details.getRange("I:J").format.columnWidth = 42;
details.getRange("K:L").format.columnWidth = 64;
details.getRange("M:N").format.columnWidth = 34;
details.getRange("O:O").format.columnWidth = 24;
details.getRangeByIndexes(0, 0, detailMatrix.length + 1, detailHeaders.length).format.wrapText = true;
details.freezePanes.freezeRows(1);

const detailRange = `A1:O${detailMatrix.length + 1}`;
const table = details.tables.add(detailRange, true, "VerificationNationalite");
table.showFilterButton = true;
table.showBandedRows = true;

details.getRange(`E2:E${detailMatrix.length + 1}`).format.numberFormat = "0";

for (const [term, color] of [
  ["NON - autre nationalité confirmée", "#FEE2E2"],
  ["À VÉRIFIER - homonyme probable", "#FEF3C7"],
  ["À VÉRIFIER - preuve publique insuffisante", "#FEF3C7"],
  ["PROBABLE - haïtien, source à ajouter", "#DBEAFE"],
  ["PROBABLE - groupe haïtien, source à ajouter", "#DBEAFE"],
  ["OUI - haïtien confirmé", "#DCFCE7"],
  ["OUI - groupe haïtien confirmé", "#DCFCE7"],
  ["OUI - origine haïtienne diaspora confirmée", "#DCFCE7"],
]) {
  details
    .getRange(`C2:C${detailMatrix.length + 1}`)
    .conditionalFormats.add("containsText", { text: term, format: { fill: color } });
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const summaryPreview = await workbook.render({ sheetName: "Résumé", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(path.join(outputDir, "preview-resume.png"), new Uint8Array(await summaryPreview.arrayBuffer()));
const detailsPreview = await workbook.render({ sheetName: "Détails", range: "A1:O25", scale: 1, format: "png" });
await fs.writeFile(path.join(outputDir, "preview-details.png"), new Uint8Array(await detailsPreview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputXlsx);
console.log(`Saved ${outputXlsx}`);
console.log(`Saved ${outputCsv}`);
