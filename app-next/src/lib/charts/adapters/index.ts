/**
 * Enregistrement central des adaptateurs de plateformes.
 * Importer ce module (effet de bord) rend tous les adaptateurs disponibles
 * via le registre.
 */
import { enregistrerAdaptateur } from "./registry";
import { youtubeAdapter } from "./youtube";
import { spotifyAdapter } from "./spotify";
import { audiomackAdapter } from "./audiomack";
import { appleMusicAdapter } from "./apple-music";
import { tiktokAdapter } from "./tiktok";

enregistrerAdaptateur(youtubeAdapter);
enregistrerAdaptateur(spotifyAdapter);
enregistrerAdaptateur(audiomackAdapter);
enregistrerAdaptateur(appleMusicAdapter);
enregistrerAdaptateur(tiktokAdapter);

export {
  youtubeAdapter,
  spotifyAdapter,
  audiomackAdapter,
  appleMusicAdapter,
  tiktokAdapter,
};
