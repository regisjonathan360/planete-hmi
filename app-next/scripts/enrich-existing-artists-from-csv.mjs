/**
 * Complète les artistes existants depuis un CSV vérifié, sans création.
 *
 * Usage :
 *   node scripts/enrich-existing-artists-from-csv.mjs "C:\chemin\artistes.csv"
 *   node scripts/enrich-existing-artists-from-csv.mjs "C:\chemin\artistes.csv" --apply
 *
 * Le mode par défaut est une simulation. --apply ne remplit que les champs
 * manquants et ne crée jamais de nouvel artiste.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const outputDir = resolve(appDir, "..", "outputs", "csv-artist-import");
const csvPath = process.argv.find((arg) => arg.toLowerCase().endsWith(".csv"));
const applyChanges = process.argv.includes("--apply");
const useLinkedProject = process.argv.includes("--linked");

if (!csvPath) {
  throw new Error("Chemin du CSV requis.");
}

if (!useLinkedProject) {
  throw new Error("Ajoutez --linked pour cibler explicitement Supabase hébergé.");
}

const URL_FIELDS = {
  youtube_url: "url_youtube",
  spotify_url: "url_spotify",
  apple_music_url: "url_apple_music",
  audiomack_url: "url_audiomack",
  deezer_url: "url_deezer",
  soundcloud_url: "url_soundcloud",
  tiktok_url: "url_tiktok",
  instagram_url: "url_instagram",
};

const PLATFORM_RULES = {
  url_youtube: {
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com"],
    path: /^\/(?:(?:channel|c|user)\/[^/]+|@[^/]+(?:\/(?:videos|featured|shorts|streams|playlists|community|about))?|(?!watch(?:\/|$)|playlist(?:\/|$)|shorts(?:\/|$)|results(?:\/|$)|feed(?:\/|$)|embed(?:\/|$)|live(?:\/|$))[^/]+)\/?$/i,
  },
  url_spotify: { hosts: ["open.spotify.com"], path: /^\/(?:intl-[^/]+\/)?artist\//i },
  url_apple_music: { hosts: ["music.apple.com"], path: /^\/[^/]+\/artist\//i },
  url_audiomack: { hosts: ["audiomack.com", "www.audiomack.com"], path: /^\/[^/]+/ },
  url_deezer: { hosts: ["deezer.com", "www.deezer.com"], path: /^\/(?:[^/]+\/)?artist\//i },
  url_soundcloud: { hosts: ["soundcloud.com", "www.soundcloud.com"], path: /^\/[^/]+/ },
  url_tiktok: { hosts: ["tiktok.com", "www.tiktok.com"], path: /^\/@[^/]+/i },
  url_instagram: { hosts: ["instagram.com", "www.instagram.com"], path: /^\/[^/]+/ },
};

const SELECT_FIELDS = [
  "id",
  "name",
  "slug",
  "haitian_status",
  "verified_at",
  "is_active",
  "tags",
  "bio",
  ...Object.values(URL_FIELDS),
].join(",");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]))
  );
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSlug(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function asBoolean(value) {
  return ["true", "1", "yes", "oui"].includes(String(value ?? "").trim().toLowerCase());
}

function normalizeProfileUrl(rawValue, targetField) {
  if (isBlank(rawValue)) return null;
  const rule = PLATFORM_RULES[targetField];

  try {
    const url = new URL(String(rawValue).trim());
    if (url.protocol !== "https:" || !rule.hosts.includes(url.hostname.toLowerCase())) {
      return null;
    }
    if (!rule.path.test(url.pathname)) return null;

    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function roleTags(row) {
  const tags = [];
  if (asBoolean(row.is_groupe)) tags.push("Groupe");
  if (asBoolean(row.is_musicien)) tags.push("Musicien");
  if (asBoolean(row["is Producer/Beatmaker"])) tags.push("Producteur", "Beatmaker");
  if (asBoolean(row.is_dj)) tags.push("DJ");
  return tags;
}

function addToIndex(index, key, artist) {
  if (!key) return;
  const matches = index.get(key) ?? [];
  matches.push(artist);
  index.set(key, matches);
}

function oneMatch(index, key) {
  const matches = index.get(key) ?? [];
  return matches.length === 1 ? matches[0] : null;
}

function matchArtist(row, indexes) {
  const csvName = normalizeName(row.name);
  const csvSlug = normalizeSlug(row.slug);
  const byId = indexes.byId.get(row.id);

  if (byId) {
    return normalizeName(byId.name) === csvName
      ? { artist: byId, method: "id" }
      : { conflict: "id_name_conflict" };
  }

  const bySlug = oneMatch(indexes.bySlug, csvSlug);
  if (bySlug) {
    return normalizeName(bySlug.name) === csvName
      ? { artist: bySlug, method: "slug" }
      : { conflict: "slug_name_conflict" };
  }

  const byName = oneMatch(indexes.byName, csvName);
  if (byName) return { artist: byName, method: "normalized_name" };

  return {
    conflict: (indexes.byName.get(csvName)?.length ?? 0) > 1
      ? "ambiguous_name"
      : "no_existing_artist",
  };
}

function buildPatch(row, artist) {
  const patch = {};
  const invalidUrls = [];

  for (const [csvField, targetField] of Object.entries(URL_FIELDS)) {
    if (!isBlank(artist[targetField]) || isBlank(row[csvField])) continue;
    const url = normalizeProfileUrl(row[csvField], targetField);
    if (url) patch[targetField] = url;
    else invalidUrls.push(csvField);
  }

  if (isBlank(artist.bio) && !isBlank(row.description)) {
    patch.bio = row.description.trim();
  }

  const additions = roleTags(row);
  const existingTags = Array.isArray(artist.tags) ? artist.tags : [];
  const mergedTags = [...new Set([...existingTags, ...additions])];
  if (mergedTags.length !== existingTags.length) patch.tags = mergedTags;

  if (artist.haitian_status !== "verified_haitian") {
    patch.haitian_status = "verified_haitian";
    if (!artist.verified_at) patch.verified_at = new Date().toISOString();
  }

  return { patch, invalidUrls };
}

function queryLinked(sql) {
  const executable = process.platform === "win32" ? "supabase.exe" : "supabase";
  const result = spawnSync(
    executable,
    ["db", "query", "--linked", "--output-format", "json", sql],
    { cwd: appDir, encoding: "utf8", windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
  );

  if (result.status !== 0) {
    throw new Error(
      `Requête Supabase impossible : ${String(result.stderr).trim()} ${String(result.stdout).trim()}`
    );
  }

  const payload = JSON.parse(result.stdout);
  return Array.isArray(payload.rows) ? payload.rows : [];
}

function runLinkedFile(filePath) {
  const executable = process.platform === "win32" ? "supabase.exe" : "supabase";
  const result = spawnSync(
    executable,
    ["db", "query", "--linked", "--file", filePath],
    { cwd: appDir, encoding: "utf8", windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
  );

  if (result.status !== 0) {
    throw new Error(`Transaction Supabase annulée : ${String(result.stderr).trim()}`);
  }
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildAssignment(field, value) {
  if (field === "tags") {
    const tags = value.map(quoteSql).join(", ");
    return `tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY[${tags}]::text[]) AS tag
    )`;
  }

  if (field === "haitian_status") {
    return `haitian_status = ${quoteSql(value)}`;
  }

  if (field === "verified_at") {
    return `verified_at = coalesce(verified_at, ${quoteSql(value)}::timestamptz)`;
  }

  return `${field} = coalesce(nullif(btrim(${field}), ''), ${quoteSql(value)})`;
}

function buildApplySql(plannedUpdates) {
  const updates = plannedUpdates.map(({ artist, patch }) => {
    const assignments = Object.entries(patch)
      .map(([field, value]) => buildAssignment(field, value))
      .concat("updated_at = now()")
      .join(",\n    ");

    return `UPDATE public.artists
  SET ${assignments}
  WHERE id = ${quoteSql(artist.id)}::uuid;`;
  });

  return `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

${updates.join("\n\n")}

COMMIT;
`;
}

function valuesEqual(field, expected, actual) {
  if (field === "tags") {
    const actualTags = Array.isArray(actual) ? actual : [];
    return expected.every((tag) => actualTags.includes(tag));
  }
  if (field === "verified_at") return !isBlank(actual);
  return String(actual ?? "") === String(expected ?? "");
}

async function main() {
  const csvText = await readFile(resolve(csvPath), "utf8");
  const allRows = parseCsv(csvText);
  const verifiedRows = allRows.filter((row) => row.haitian_status === "verified_haitian");

  const artists = queryLinked(
    `select ${SELECT_FIELDS} from public.artists order by name, id;`
  );

  const indexes = {
    byId: new Map(),
    bySlug: new Map(),
    byName: new Map(),
  };

  for (const artist of artists ?? []) {
    indexes.byId.set(artist.id, artist);
    addToIndex(indexes.bySlug, normalizeSlug(artist.slug), artist);
    addToIndex(indexes.byName, normalizeName(artist.name), artist);
  }

  const report = {
    mode: applyChanges ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    csvRows: allRows.length,
    verifiedRows: verifiedRows.length,
    databaseArtists: artists.length,
    matched: 0,
    changed: 0,
    unchanged: 0,
    failed: 0,
    conflicts: {},
    fieldsFilled: {},
    details: [],
  };

  const backup = [];
  const plannedUpdates = [];

  for (const row of verifiedRows) {
    const match = matchArtist(row, indexes);
    if (!match.artist) {
      report.conflicts[match.conflict] = (report.conflicts[match.conflict] ?? 0) + 1;
      report.details.push({
        csvId: row.id,
        name: row.name,
        action: "skipped",
        reason: match.conflict,
      });
      continue;
    }

    report.matched += 1;
    const { patch, invalidUrls } = buildPatch(row, match.artist);
    const fields = Object.keys(patch);

    if (fields.length === 0) {
      report.unchanged += 1;
      report.details.push({
        csvId: row.id,
        artistId: match.artist.id,
        name: match.artist.name,
        matchMethod: match.method,
        action: "unchanged",
        invalidUrls,
      });
      continue;
    }

    backup.push(match.artist);
    plannedUpdates.push({ artist: match.artist, patch });

    report.changed += 1;
    for (const field of fields) {
      report.fieldsFilled[field] = (report.fieldsFilled[field] ?? 0) + 1;
    }
    report.details.push({
      csvId: row.id,
      artistId: match.artist.id,
      name: match.artist.name,
      matchMethod: match.method,
      action: applyChanges ? "planned_update" : "would_update",
      fields,
      invalidUrls,
    });
  }

  await mkdir(outputDir, { recursive: true });
  const suffix = applyChanges ? "applied" : "dry-run";
  const backupPath = resolve(outputDir, `artist-enrichment-backup-${suffix}.json`);
  const sqlPath = resolve(outputDir, "artist-enrichment-transaction.sql");

  await writeFile(backupPath, JSON.stringify(backup, null, 2), "utf8");

  if (applyChanges && plannedUpdates.length > 0) {
    await writeFile(sqlPath, buildApplySql(plannedUpdates), "utf8");
    runLinkedFile(sqlPath);

    const verificationRows = queryLinked(
      `select ${SELECT_FIELDS} from public.artists
       where id = any(ARRAY[${plannedUpdates.map(({ artist }) => `${quoteSql(artist.id)}::uuid`).join(",")}]);`
    );
    const verifiedById = new Map(verificationRows.map((artist) => [artist.id, artist]));

    for (const { artist, patch } of plannedUpdates) {
      const actual = verifiedById.get(artist.id);
      const valid = actual && Object.entries(patch).every(
        ([field, expected]) => valuesEqual(field, expected, actual[field])
      );
      if (!valid) {
        throw new Error(`Vérification échouée après mise à jour pour ${artist.name}.`);
      }
    }

    for (const detail of report.details) {
      if (detail.action === "planned_update") detail.action = "updated";
    }
  }

  await writeFile(
    resolve(outputDir, `artist-enrichment-${suffix}.json`),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log(JSON.stringify({
    mode: report.mode,
    csvRows: report.csvRows,
    verifiedRows: report.verifiedRows,
    databaseArtists: report.databaseArtists,
    matched: report.matched,
    changed: report.changed,
    unchanged: report.unchanged,
    failed: report.failed,
    conflicts: report.conflicts,
    fieldsFilled: report.fieldsFilled,
    reportPath: resolve(outputDir, `artist-enrichment-${suffix}.json`),
    backupPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Erreur d'import.");
  process.exitCode = 1;
});
