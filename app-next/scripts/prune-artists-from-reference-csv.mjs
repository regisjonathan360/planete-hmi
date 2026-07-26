/**
 * Supprime de Supabase hébergé les artistes absents du CSV de référence,
 * tout en conservant les artistes issus des classements Audiomack/Deezer.
 *
 * Sécurité :
 * - simulation par défaut ;
 * - --linked obligatoire ;
 * - --apply exige --confirm-delete=<nombre exact de la simulation> ;
 * - sauvegarde complète avant suppression ;
 * - transaction, délais d'attente et nouvelle vérification des protections.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const outputDir = resolve(appDir, "..", "outputs", "csv-artist-prune");
const csvPath = process.argv.find((arg) => arg.toLowerCase().endsWith(".csv"));
const applyChanges = process.argv.includes("--apply");
const useLinkedProject = process.argv.includes("--linked");
const confirmationArg = process.argv.find((arg) => arg.startsWith("--confirm-delete="));
const confirmedDeleteCount = confirmationArg
  ? Number.parseInt(confirmationArg.split("=")[1] ?? "", 10)
  : null;

if (!csvPath) throw new Error("Chemin du CSV requis.");
if (!useLinkedProject) {
  throw new Error("Ajoutez --linked pour cibler explicitement Supabase hébergé.");
}

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

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryLinked(sql) {
  const executable = process.platform === "win32" ? "supabase.exe" : "supabase";
  const result = spawnSync(
    executable,
    ["db", "query", "--linked", "--output-format", "json", sql],
    {
      cwd: appDir,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    }
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
    {
      cwd: appDir,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `Transaction Supabase annulée : ${String(result.stderr).trim()} ${String(result.stdout).trim()}`
    );
  }
}

function addIndex(index, key, value) {
  if (!key) return;
  const values = index.get(key) ?? [];
  values.push(value);
  index.set(key, values);
}

const PROTECTED_ARTISTS_SQL = `
  SELECT ta.artist_id, cs.source_key
  FROM public.chart_sources cs
  JOIN public.chart_editions e ON e.chart_source_id = cs.id
  JOIN public.chart_entries ce ON ce.chart_edition_id = e.id
  JOIN public.track_artists ta ON ta.track_id = ce.track_id
  WHERE lower(cs.platform) IN ('audiomack', 'deezer')
     OR lower(cs.source_key) LIKE 'audiomack%'
     OR lower(cs.source_key) LIKE 'deezer%'

  UNION

  SELECT ta.artist_id, cs.source_key
  FROM public.chart_sources cs
  JOIN public.chart_editions e ON e.chart_source_id = cs.id
  JOIN public.chart_entries ce ON ce.chart_edition_id = e.id
  JOIN public.platform_tracks pt ON pt.id = ce.platform_track_id
  JOIN public.track_artists ta ON ta.track_id = pt.track_id
  WHERE lower(cs.platform) IN ('audiomack', 'deezer')
     OR lower(cs.source_key) LIKE 'audiomack%'
     OR lower(cs.source_key) LIKE 'deezer%'
`;

function classifyArtist(artist, csvIndexes, protectedById) {
  const reasons = [];
  const nameKey = normalizeName(artist.name);
  const slugKey = normalizeSlug(artist.slug);
  const csvById = csvIndexes.byId.get(artist.id);
  const csvByName = csvIndexes.byName.get(nameKey) ?? [];
  const csvBySlug = csvIndexes.bySlug.get(slugKey) ?? [];

  if (csvById && normalizeName(csvById.name) === nameKey) {
    reasons.push("csv_id_and_name");
  } else if (csvById) {
    reasons.push("csv_id_conflict_preserved");
  }

  if (csvBySlug.some((row) => normalizeName(row.name) === nameKey)) {
    reasons.push("csv_slug_and_name");
  } else if (csvBySlug.length > 0) {
    reasons.push("csv_slug_conflict_preserved");
  }

  if (csvByName.length > 0) reasons.push("csv_normalized_name");
  if (protectedById.has(artist.id)) reasons.push("audiomack_deezer_chart");
  if (artist.user_id) reasons.push("claimed_profile_preserved");

  return {
    keep: reasons.length > 0,
    reasons,
    ambiguous: reasons.some((reason) => reason.includes("conflict_preserved")),
  };
}

async function collectBackup(candidateIds, candidateArtists) {
  if (candidateIds.length === 0) {
    return { artists: [], dependencies: {} };
  }

  const ids = candidateIds.map((id) => `${quoteSql(id)}::uuid`).join(",");
  const whereAny = `ANY(ARRAY[${ids}])`;
  const queries = {
    artist_accounts:
      `SELECT * FROM public.artist_accounts WHERE artist_id = ${whereAny} OR claim_target_artist_id = ${whereAny};`,
    artist_claim_audit:
      `SELECT * FROM public.artist_claim_audit WHERE artist_id = ${whereAny};`,
    artist_merge_candidates:
      `SELECT * FROM public.artist_merge_candidates WHERE artist_a_id = ${whereAny} OR artist_b_id = ${whereAny};`,
    artist_merges:
      `SELECT * FROM public.artist_merges WHERE kept_artist_id = ${whereAny};`,
    artist_platform_identities:
      `SELECT * FROM public.artist_platform_identities WHERE artist_id = ${whereAny};`,
    artist_tiktok_connections:
      `SELECT * FROM public.artist_tiktok_connections WHERE artist_id = ${whereAny};`,
    artist_tiktok_videos:
      `SELECT * FROM public.artist_tiktok_videos WHERE artist_id = ${whereAny};`,
    tiktok_sounds:
      `SELECT * FROM public.tiktok_sounds WHERE artist_id = ${whereAny};`,
    track_artists:
      `SELECT * FROM public.track_artists WHERE artist_id = ${whereAny};`,
    user_favorites:
      `SELECT * FROM public.user_favorites WHERE artist_id = ${whereAny};`,
    youtube_channel_artists:
      `SELECT * FROM public.youtube_channel_artists WHERE artist_id = ${whereAny};`,
    youtube_channels:
      `SELECT * FROM public.youtube_channels WHERE artist_id = ${whereAny};`,
  };

  const dependencies = {};
  for (const [table, sql] of Object.entries(queries)) {
    dependencies[table] = queryLinked(sql);
  }

  return { artists: candidateArtists, dependencies };
}

function buildDeleteSql(candidateIds, expectedDeleteCount) {
  const values = candidateIds.map((id) => `(${quoteSql(id)}::uuid)`).join(",\n  ");

  return `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE prune_artist_ids (
  id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO prune_artist_ids (id) VALUES
  ${values};

DO $check$
DECLARE
  candidate_count integer;
BEGIN
  SELECT count(*) INTO candidate_count
  FROM public.artists a
  JOIN prune_artist_ids p ON p.id = a.id;

  IF candidate_count <> ${expectedDeleteCount} THEN
    RAISE EXCEPTION 'artist_count_changed: expected %, got %',
      ${expectedDeleteCount}, candidate_count;
  END IF;

  IF EXISTS (
    WITH protected AS (${PROTECTED_ARTISTS_SQL})
    SELECT 1
    FROM protected x
    JOIN prune_artist_ids p ON p.id = x.artist_id
  ) THEN
    RAISE EXCEPTION 'new_audiomack_or_deezer_protection_detected';
  END IF;
END
$check$;

UPDATE public.artist_accounts aa
SET claim_target_artist_id = NULL
FROM prune_artist_ids p
WHERE aa.claim_target_artist_id = p.id;

DELETE FROM public.artist_claim_audit d
USING prune_artist_ids p
WHERE d.artist_id = p.id;

DELETE FROM public.artist_merges d
USING prune_artist_ids p
WHERE d.kept_artist_id = p.id;

DELETE FROM public.youtube_channel_artists d
USING prune_artist_ids p
WHERE d.artist_id = p.id;

DO $delete$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.artists a
  USING prune_artist_ids p
  WHERE a.id = p.id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> ${expectedDeleteCount} THEN
    RAISE EXCEPTION 'unexpected_deleted_count: expected %, got %',
      ${expectedDeleteCount}, deleted_count;
  END IF;
END
$delete$;

COMMIT;
`;
}

async function main() {
  const csvText = await readFile(resolve(csvPath), "utf8");
  const csvRows = parseCsv(csvText);
  const requiredHeaders = ["id", "name", "slug"];
  if (csvRows.length === 0 || requiredHeaders.some((header) => !(header in csvRows[0]))) {
    throw new Error("Le CSV ne contient pas les colonnes id, name et slug attendues.");
  }

  const csvIndexes = {
    byId: new Map(),
    byName: new Map(),
    bySlug: new Map(),
  };
  for (const row of csvRows) {
    if (row.id) csvIndexes.byId.set(row.id, row);
    addIndex(csvIndexes.byName, normalizeName(row.name), row);
    addIndex(csvIndexes.bySlug, normalizeSlug(row.slug), row);
  }

  const artists = queryLinked("SELECT * FROM public.artists ORDER BY name, id;");
  const protectedRows = queryLinked(`
    WITH protected AS (${PROTECTED_ARTISTS_SQL})
    SELECT
      p.artist_id,
      array_agg(DISTINCT p.source_key ORDER BY p.source_key) AS source_keys
    FROM protected p
    GROUP BY p.artist_id
    ORDER BY p.artist_id;
  `);
  const protectedById = new Map(
    protectedRows.map((row) => [row.artist_id, row.source_keys])
  );

  const kept = [];
  const candidates = [];
  const ambiguous = [];
  for (const artist of artists) {
    const classification = classifyArtist(artist, csvIndexes, protectedById);
    const detail = {
      id: artist.id,
      name: artist.name,
      slug: artist.slug,
      userId: artist.user_id,
      reasons: classification.reasons,
      protectedSources: protectedById.get(artist.id) ?? [],
    };
    if (classification.keep) kept.push(detail);
    else candidates.push({ ...artist, deletionReason: "absent_from_reference_csv" });
    if (classification.ambiguous) ambiguous.push(detail);
  }

  const candidateIds = candidates.map((artist) => artist.id);
  if (applyChanges && confirmedDeleteCount !== candidateIds.length) {
    throw new Error(
      `Confirmation invalide : utilisez --confirm-delete=${candidateIds.length}.`
    );
  }

  const backup = await collectBackup(candidateIds, candidates);
  const dependencyCounts = Object.fromEntries(
    Object.entries(backup.dependencies).map(([table, rows]) => [table, rows.length])
  );
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  await mkdir(outputDir, { recursive: true });

  const report = {
    mode: applyChanges ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    sourceCsv: resolve(csvPath),
    csvRows: csvRows.length,
    databaseArtistsBefore: artists.length,
    keptArtists: kept.length,
    protectedArtistsInDatabase: protectedById.size,
    claimedArtistsPreserved: kept.filter((artist) =>
      artist.reasons.includes("claimed_profile_preserved")
    ).length,
    ambiguousArtistsPreserved: ambiguous.length,
    deleteCandidates: candidates.length,
    claimedDeleteCandidates: 0,
    dependencyCounts,
    ambiguous,
    candidates: candidates.map((artist) => ({
      id: artist.id,
      name: artist.name,
      slug: artist.slug,
      userId: artist.user_id,
      haitianStatus: artist.haitian_status,
      deletionReason: artist.deletionReason,
    })),
  };

  const reportPath = resolve(outputDir, `artist-prune-${timestamp}.json`);
  const backupPath = resolve(outputDir, `artist-prune-backup-${timestamp}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(backupPath, JSON.stringify(backup, null, 2), "utf8");

  if (applyChanges && candidateIds.length > 0) {
    const sqlPath = resolve(outputDir, `artist-prune-transaction-${timestamp}.sql`);
    await writeFile(sqlPath, buildDeleteSql(candidateIds, candidateIds.length), "utf8");
    runLinkedFile(sqlPath);

    const remainingCandidates = queryLinked(
      `SELECT id FROM public.artists
       WHERE id = ANY(ARRAY[${candidateIds.map((id) => `${quoteSql(id)}::uuid`).join(",")}]);`
    );
    if (remainingCandidates.length > 0) {
      throw new Error("Vérification échouée : certains artistes ciblés existent encore.");
    }

    const protectedMissing = queryLinked(`
      WITH protected AS (${PROTECTED_ARTISTS_SQL})
      SELECT DISTINCT p.artist_id
      FROM protected p
      LEFT JOIN public.artists a ON a.id = p.artist_id
      WHERE a.id IS NULL;
    `);
    if (protectedMissing.length > 0) {
      throw new Error("Vérification échouée : un artiste protégé manque après suppression.");
    }

    const after = queryLinked("SELECT count(*)::integer AS count FROM public.artists;");
    report.databaseArtistsAfter = after[0]?.count;
    report.deletedArtists = candidateIds.length;
    report.verification = {
      targetedArtistsRemaining: remainingCandidates.length,
      protectedArtistsMissing: protectedMissing.length,
      expectedDatabaseArtistsAfter: artists.length - candidateIds.length,
      actualDatabaseArtistsAfter: after[0]?.count,
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  }

  console.log(JSON.stringify({
    mode: report.mode,
    csvRows: report.csvRows,
    databaseArtistsBefore: report.databaseArtistsBefore,
    keptArtists: report.keptArtists,
    protectedArtistsInDatabase: report.protectedArtistsInDatabase,
    claimedArtistsPreserved: report.claimedArtistsPreserved,
    ambiguousArtistsPreserved: report.ambiguousArtistsPreserved,
    deleteCandidates: report.deleteCandidates,
    claimedDeleteCandidates: report.claimedDeleteCandidates,
    dependencyCounts: report.dependencyCounts,
    databaseArtistsAfter: report.databaseArtistsAfter,
    reportPath,
    backupPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Erreur de nettoyage.");
  process.exitCode = 1;
});
