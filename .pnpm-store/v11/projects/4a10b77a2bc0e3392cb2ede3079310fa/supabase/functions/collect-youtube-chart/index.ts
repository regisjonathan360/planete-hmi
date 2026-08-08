// YouTube Music — Haïti (territorial) : reproduit via import vérifié tant
// qu'une source officielle n'est pas disponible. Le classement mostPopular de
// la Data API n'est PAS YouTube Music Charts Haïti et n'est donc pas utilisé ici.
import { manualImportRequired } from "../_shared/utils.ts";
Deno.serve(() => manualImportRequired("youtube"));
