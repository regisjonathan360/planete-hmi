// Audiomack : pas de paramètre géographique Haïti public. Le global n'est jamais
// présenté comme Haïti. Mode manuel tant qu'aucun flux partenaire n'est configuré.
import { json, manualImportRequired } from "../_shared/utils.ts";
Deno.serve(() => {
  const endpoint = Deno.env.get("AUDIOMACK_HAITI_CHART_ENDPOINT");
  if (!endpoint) return manualImportRequired("audiomack");
  return json({
    status: "error",
    platform: "audiomack",
    message: "Flux partenaire Audiomack configuré mais non encore implémenté.",
  }, 501);
});
