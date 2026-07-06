// Spotify : aucun endpoint public pour le classement territorial « Popular in
// Haiti ». Mode manuel -> statut explicite, aucun faux succès.
import { manualImportRequired } from "../_shared/utils.ts";
Deno.serve(() => manualImportRequired("spotify"));
