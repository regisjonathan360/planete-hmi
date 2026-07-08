import fs from "node:fs/promises";
import path from "node:path";

const inputCsv = path.resolve("data/haitian-artists-research/final/artistes_a_verifier_manuellement.csv");
const outputDir = path.resolve("data/haitian-artists-research/final");
const outputJson = path.join(outputDir, "artistes_nationalite_haitienne_sources.json");
const progressJson = path.join(outputDir, "artistes_nationalite_haitienne_sources.progress.json");

const userAgent = "PlaneteHMIResearch/1.0 (local verification; contact: research@planetehmi.local)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  const headers = rows.shift().map((header) => fixMojibake(header).replace(/^\uFEFF|^ï»¿/, ""));
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, fixMojibake(values[index] ?? "")])),
  );
}

function fixMojibake(value) {
  if (!/[ÃÂ]|ï»¿/.test(value)) return value;
  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function cleanName(name) {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(lead singer|lead vocal|producteur|beatmaker|gospel|compas|rapper|rappeur|groupe|haiti|ht)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryVariants(name) {
  const cleaned = cleanName(name);
  const variants = [name, cleaned];
  if (name.includes("(")) variants.push(name.replace(/[()]/g, " "));
  if (/^ti\s/i.test(cleaned)) variants.push(cleaned.replace(/^ti\s/i, ""));
  return [...new Set(variants.map((variant) => variant.trim()).filter(Boolean))].slice(0, 3);
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function writeJsonWithRetry(filePath, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await fs.writeFile(filePath, body, "utf8");
      return;
    } catch (error) {
      lastError = error;
      await sleep(250 * attempt);
    }
  }

  throw lastError;
}

async function wikidataSearch(name) {
  const variants = queryVariants(name);
  const found = [];

  for (const variant of variants) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbsearchentities");
    url.searchParams.set("search", variant);
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");

    try {
      const data = await getJson(url);
      for (const item of data.search ?? []) {
        if (!found.some((existing) => existing.id === item.id)) {
          found.push({
            id: item.id,
            label: item.label ?? "",
            description: item.description ?? "",
            matched_query: variant,
            url: `https://www.wikidata.org/wiki/${item.id}`,
          });
        }
      }
    } catch (error) {
      found.push({ error: `Wikidata search failed for "${variant}": ${error.message}` });
    }

    await sleep(60);
  }

  const ids = found.filter((item) => item.id).slice(0, 3).map((item) => item.id);
  if (ids.length === 0) return found;

  const entityUrl = new URL("https://www.wikidata.org/w/api.php");
  entityUrl.searchParams.set("action", "wbgetentities");
  entityUrl.searchParams.set("ids", ids.join("|"));
  entityUrl.searchParams.set("props", "labels|descriptions|claims|sitelinks");
  entityUrl.searchParams.set("languages", "en|fr");
  entityUrl.searchParams.set("format", "json");

  const entityData = await getJson(entityUrl);
  const linkedIds = new Set();
  const properties = ["P27", "P19", "P495", "P17", "P740", "P159", "P276", "P131", "P937"];

  for (const entity of Object.values(entityData.entities ?? {})) {
    for (const property of properties) {
      for (const claim of entity.claims?.[property] ?? []) {
        const id = claim.mainsnak?.datavalue?.value?.id;
        if (id) linkedIds.add(id);
      }
    }
  }

  const labels = {};
  if (linkedIds.size > 0) {
    const labelUrl = new URL("https://www.wikidata.org/w/api.php");
    labelUrl.searchParams.set("action", "wbgetentities");
    labelUrl.searchParams.set("ids", [...linkedIds].join("|"));
    labelUrl.searchParams.set("props", "labels|descriptions");
    labelUrl.searchParams.set("languages", "en|fr");
    labelUrl.searchParams.set("format", "json");

    const labelData = await getJson(labelUrl);
    for (const [id, entity] of Object.entries(labelData.entities ?? {})) {
      labels[id] = entity.labels?.en?.value ?? entity.labels?.fr?.value ?? id;
    }
  }

  return found.map((item) => {
    if (!item.id) return item;
    const entity = entityData.entities?.[item.id];
    if (!entity) return item;

    const claimLabels = {};
    for (const property of properties) {
      claimLabels[property] = (entity.claims?.[property] ?? [])
        .map((claim) => claim.mainsnak?.datavalue?.value?.id)
        .filter(Boolean)
        .map((id) => labels[id] ?? id);
    }

    return {
      ...item,
      label: entity.labels?.en?.value ?? entity.labels?.fr?.value ?? item.label,
      description: entity.descriptions?.en?.value ?? entity.descriptions?.fr?.value ?? item.description,
      wikipedia_url: entity.sitelinks?.enwiki?.url ?? entity.sitelinks?.frwiki?.url ?? "",
      claims: claimLabels,
    };
  });
}

async function musicBrainzSearch(name) {
  const variants = queryVariants(name);
  const found = [];

  for (const variant of variants.slice(0, 1)) {
    const url = new URL("https://musicbrainz.org/ws/2/artist/");
    url.searchParams.set("query", `artist:"${variant}"`);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", "5");

    try {
      const data = await getJson(url);
      for (const artist of data.artists ?? []) {
        if (!found.some((existing) => existing.id === artist.id)) {
          found.push({
            id: artist.id,
            name: artist.name ?? "",
            type: artist.type ?? "",
            country: artist.country ?? "",
            area: artist.area?.name ?? "",
            begin_area: artist["begin-area"]?.name ?? "",
            disambiguation: artist.disambiguation ?? "",
            score: artist.score ?? null,
            matched_query: variant,
            url: `https://musicbrainz.org/artist/${artist.id}`,
          });
        }
      }
    } catch (error) {
      found.push({ error: `MusicBrainz search failed for "${variant}": ${error.message}` });
    }

    await sleep(1100);
  }

  return found.slice(0, 5);
}

function containsHaiti(text) {
  return /\b(haiti|ha[ïi]ti|haitian|ha[ïi]tien|ha[ïi]tienne|port-au-prince|cap-ha[ïi]tien|jacmel|les cayes|gona[ïi]ves)\b/i.test(
    text,
  );
}

function classify(row, wikidata, musicbrainz) {
  const evidence = [];

  for (const item of wikidata.filter((entry) => entry.id)) {
    const claimText = Object.values(item.claims ?? {}).flat().join("; ");
    const text = `${item.label} ${item.description} ${claimText}`;
    const hasHaiti = containsHaiti(text);
    const hasNonHaitiCitizen =
      item.claims?.P27?.length > 0 && !item.claims.P27.some((value) => containsHaiti(value));

    if (hasHaiti) {
      evidence.push({
        verdict: /diaspora|descent|origin|parent/i.test(text)
          ? "CONFIRME_ORIGINE_HAITIENNE_DIASPORA"
          : "CONFIRME_HAITIEN",
        confidence: item.claims?.P27?.some((value) => containsHaiti(value)) ? 95 : 88,
        source_type: "Wikidata/Wikipedia",
        summary: `${item.label}: ${item.description}. Preuves: ${claimText || "description publique"}.`,
        source_url: item.wikipedia_url || item.url,
      });
    } else if (hasNonHaitiCitizen && /rapper|singer|musician|record producer|artist|chanteur|musicien/i.test(text)) {
      evidence.push({
        verdict: "NON_HAITIEN",
        confidence: 82,
        source_type: "Wikidata",
        summary: `${item.label}: ${item.description}. Pays/citoyennete indiquee: ${item.claims.P27.join("; ")}.`,
        source_url: item.wikipedia_url || item.url,
      });
    }
  }

  for (const item of musicbrainz.filter((entry) => entry.id)) {
    const text = `${item.name} ${item.type} ${item.country} ${item.area} ${item.begin_area} ${item.disambiguation}`;
    if (item.country === "HT" || containsHaiti(text)) {
      evidence.push({
        verdict: item.type?.toLowerCase() === "group" ? "GROUPE_HAITIEN" : "CONFIRME_HAITIEN",
        confidence: item.country === "HT" ? 90 : 82,
        source_type: "MusicBrainz",
        summary: `${item.name}: country=${item.country || "n/a"}, area=${item.area || "n/a"}, begin_area=${item.begin_area || "n/a"}.`,
        source_url: item.url,
      });
    }
  }

  const sourceNote = `${row.notes ?? ""} ${row.genres ?? ""}`;
  if (evidence.length === 0 && containsHaiti(sourceNote)) {
    evidence.push({
      verdict: /groupe|band|orchestra|orchestre/i.test(sourceNote) ? "PROBABLE_GROUPE_HAITIEN" : "PROBABLE_HAITIEN",
      confidence: Math.min(75, Number(row.confidence_score || 65)),
      source_type: "Dataset interne",
      summary: row.notes,
      source_url: "",
    });
  }

  if (evidence.length === 0) {
    return {
      verdict: "A_VERIFIER_MANUELLEMENT",
      confidence: Math.min(55, Number(row.confidence_score || 50)),
      evidence_summary: "Aucune preuve structurée claire trouvee dans Wikidata/MusicBrainz.",
      source_type: "",
      source_url: "",
      secondary_source_url: "",
    };
  }

  evidence.sort((a, b) => b.confidence - a.confidence);
  return {
    verdict: evidence[0].verdict,
    confidence: evidence[0].confidence,
    evidence_summary: evidence[0].summary,
    source_type: evidence[0].source_type,
    source_url: evidence[0].source_url,
    secondary_source_url: evidence.find((item) => item.source_url && item.source_url !== evidence[0].source_url)?.source_url ?? "",
  };
}

const csvText = await fs.readFile(inputCsv, "utf8");
const rows = parseCsv(csvText);
let results = [];

try {
  const existing = JSON.parse(await fs.readFile(progressJson, "utf8"));
  if (Array.isArray(existing)) results = existing;
} catch {
  results = [];
}

for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index];
  const artistName = row.artist_name;
  const existing = results.find((item) => item.artist_name === artistName && item.row_number === index + 2);
  if (existing?.wikidata_candidates && existing?.musicbrainz_candidates) {
    console.log(`[${index + 1}/${rows.length}] ${artistName} (cached)`);
    continue;
  }

  console.log(`[${index + 1}/${rows.length}] ${artistName}`);

  let wikidata = [];
  let musicbrainz = [];
  try {
    wikidata = await wikidataSearch(artistName);
  } catch (error) {
    wikidata = [{ error: `Wikidata failed: ${error.message}` }];
  }

  let decision = classify(row, wikidata, musicbrainz);
  if (!decision.source_url || decision.verdict === "A_VERIFIER_MANUELLEMENT") {
    try {
      musicbrainz = await musicBrainzSearch(artistName);
    } catch (error) {
      musicbrainz = [{ error: `MusicBrainz failed: ${error.message}` }];
    }
    decision = classify(row, wikidata, musicbrainz);
  }

  const enriched = {
    ...row,
    row_number: index + 2,
    ...decision,
    wikidata_candidates: wikidata,
    musicbrainz_candidates: musicbrainz,
  };

  results = results.filter((item) => !(item.artist_name === artistName && item.row_number === index + 2));
  results.push(enriched);
  results.sort((a, b) => a.row_number - b.row_number);
  await writeJsonWithRetry(progressJson, results);
}

await writeJsonWithRetry(outputJson, results);
console.log(`Saved ${outputJson}`);
