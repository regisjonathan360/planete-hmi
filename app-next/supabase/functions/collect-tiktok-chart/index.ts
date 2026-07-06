// TikTok : pas de classement national universel via API publique. Mode manuel.
// La métrique est le nombre de publications, jamais des streams/vues.
import { manualImportRequired } from "../_shared/utils.ts";
Deno.serve(() => manualImportRequired("tiktok"));
