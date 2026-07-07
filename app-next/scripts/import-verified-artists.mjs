/**
 * Importe les artistes vérifiés (CSV) dans Supabase Cloud.
 * Idempotent : ne crée pas de doublons (utilise le slug comme clé unique).
 *
 * Usage : node scripts/import-verified-artists.mjs
 * Nécessite SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "..", "data", "haitian-artists-research", "final", "haitian_artists_verified.csv");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pagbhnttzwwsnnmolwwi.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_KEY) {
  console.error("SUPABASE_SECRET_KEY manquant. Définis-le dans .env.local ou en variable d'environnement.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"/, "").replace(/"$/, ""));
  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += char; }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function slugify(name) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function mapHaitianStatus(csvStatus) {
  if (csvStatus === "verified_haitian" || csvStatus === "verified_haitian_diaspora" || csvStatus === "verified_haitian_group") return csvStatus;
  // Mapper les status du CSV vers ceux de la DB
  const map = {
    "HT": "verified_haitian",
    "US": "verified_haitian_diaspora",
    "CA": "verified_haitian_diaspora",
    "FR": "verified_haitian_diaspora",
    "DE": "verified_haitian_diaspora",
  };
  return csvStatus || "verified_haitian";
}

async function main() {
  console.log("Lecture du CSV...");
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(raw);
  console.log(`${rows.length} artistes dans le CSV.`);

  let created = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const name = row.artist_name?.replace(/^"/, "").replace(/"$/, "");
    if (!name) continue;

    const slug = row.slug || slugify(name);
    const haitianStatus = row.haitian_status || mapHaitianStatus(row.birth_country);
    const score = parseInt(row.confidence_score) || 80;

    // Vérifier si l'artiste existe déjà (par slug)
    const { data: existing } = await supabase
      .from("artists")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("artists").insert({
      name,
      slug,
      haitian_status: haitianStatus,
      country_code: row.birth_country || "HT",
      is_active: true,
      confidence_score: score,
      verified_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") { skipped++; } // duplicate
      else { console.error(`Erreur pour ${name}: ${error.message}`); errors++; }
    } else {
      created++;
    }
  }

  console.log(`\nRésultat : ${created} créés, ${skipped} déjà existants, ${errors} erreurs.`);

  // Vérification
  const { count } = await supabase.from("artists").select("id", { count: "exact", head: true });
  console.log(`Total artistes en base : ${count}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
