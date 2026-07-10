import "server-only";

import type {
  TikTokApiClientConfig,
  TikTokVideoQueryParams,
  TikTokVideoResponse,
} from "./types";
import {
  TIKTOK_API_BASE_URL,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
} from "./constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pause l'exécution pendant `ms` millisecondes.
 * Exposée pour permettre le stubbing dans les tests.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcule le délai de backoff exponentiel (base 4).
 * attempt 0 → 1s, attempt 1 → 4s, attempt 2 → 16s
 */
function getBackoffDelay(attempt: number): number {
  return RETRY_BASE_DELAY_MS * Math.pow(4, attempt);
}

// ---------------------------------------------------------------------------
// TikTok API Client
// ---------------------------------------------------------------------------

/**
 * Client pour l'API TikTok Research.
 *
 * - Authentification OAuth2 client_credentials
 * - Retry avec exponential backoff (base 4) sur HTTP 429
 * - Logging structuré de chaque requête
 */
export class TikTokApiClient {
  private readonly config: TikTokApiClientConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config?: Partial<TikTokApiClientConfig>) {
    const clientKey = config?.clientKey ?? process.env.TIKTOK_CLIENT_KEY;
    const clientSecret =
      config?.clientSecret ?? process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      throw new Error(
        "[TikTokApiClient] TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET sont requis. " +
          "Vérifiez vos variables d'environnement serveur."
      );
    }

    this.config = {
      clientKey,
      clientSecret,
      baseUrl:
        config?.baseUrl ??
        process.env.TIKTOK_API_BASE_URL ??
        TIKTOK_API_BASE_URL,
    };
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  /**
   * Authentifie le client avec l'API TikTok via OAuth2 client_credentials.
   * Met en cache le token jusqu'à son expiration.
   *
   * @returns Le access_token valide.
   * @throws Si l'authentification échoue (401/403 ou erreur réseau).
   */
  async authenticate(): Promise<string> {
    // Retourner le token en cache s'il est encore valide (marge de 60s)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const url = `${this.config.baseUrl}/oauth/token/`;

    console.log("[TikTokApiClient] Authentification en cours", {
      url,
      clientKey: this.config.clientKey.slice(0, 4) + "****",
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_key: this.config.clientKey,
        client_secret: this.config.clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("[TikTokApiClient] Échec d'authentification", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });
      throw new Error(
        `[TikTokApiClient] Authentification échouée (HTTP ${response.status}): ${response.statusText}. ` +
          "Vérifiez TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET."
      );
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // expires_in est en secondes
    const expiresInMs = (data.expires_in ?? 7200) * 1000;
    this.tokenExpiresAt = Date.now() + expiresInMs;

    console.log("[TikTokApiClient] Authentification réussie", {
      expiresIn: data.expires_in ?? 7200,
    });

    return this.accessToken!;
  }

  // -------------------------------------------------------------------------
  // Video Query
  // -------------------------------------------------------------------------

  /**
   * Recherche des vidéos TikTok via l'API Research.
   * Gère la pagination via cursor et les retries sur 429.
   *
   * @param params Paramètres de recherche (région, hashtags, keywords, dates…)
   * @returns Réponse contenant les vidéos, le cursor et has_more.
   * @throws Sur erreur d'auth (401/403) sans retry, ou après MAX_RETRIES sur 429.
   */
  async queryVideos(
    params: TikTokVideoQueryParams
  ): Promise<TikTokVideoResponse> {
    const token = await this.authenticate();
    const url = `${this.config.baseUrl}/video/query/`;

    const body = this.buildQueryBody(params);

    console.log("[TikTokApiClient] queryVideos — requête", {
      url,
      params: {
        region_code: params.region_code,
        hashtag_names: params.hashtag_names,
        keyword: params.keyword,
        start_date: params.start_date,
        end_date: params.end_date,
        max_count: params.max_count,
        cursor: params.cursor,
      },
    });

    return this.executeWithRetry(url, token, body);
  }

  // -------------------------------------------------------------------------
  // Private — Request execution with retry
  // -------------------------------------------------------------------------

  private async executeWithRetry(
    url: string,
    token: string,
    body: object
  ): Promise<TikTokVideoResponse> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      // Auth errors — ne pas retry
      if (response.status === 401 || response.status === 403) {
        const errorBody = await response.text().catch(() => "");
        console.error("[TikTokApiClient] Erreur d'authentification API", {
          status: response.status,
          body: errorBody,
          attempt,
        });
        // Invalider le token en cache
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        throw new Error(
          `[TikTokApiClient] Erreur d'autorisation (HTTP ${response.status}). ` +
            "Le token est invalide ou expiré. Relancez l'authentification."
        );
      }

      // Rate limit — retry avec backoff exponentiel
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = getBackoffDelay(attempt);
          console.log("[TikTokApiClient] Rate limit (429) — retry", {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            delayMs: delay,
          });
          await sleep(delay);
          continue;
        }
        // Plus de retries disponibles
        console.error(
          "[TikTokApiClient] Rate limit (429) — max retries atteint",
          {
            attempts: attempt + 1,
          }
        );
        throw new Error(
          `[TikTokApiClient] Rate limit dépassé après ${MAX_RETRIES} tentatives. ` +
            "L'API TikTok refuse les requêtes. Réessayez plus tard."
        );
      }

      // Autres erreurs serveur
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error("[TikTokApiClient] Erreur API inattendue", {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          attempt,
        });
        throw new Error(
          `[TikTokApiClient] Erreur API (HTTP ${response.status}): ${response.statusText}`
        );
      }

      // Succès
      const data = await response.json();

      const result: TikTokVideoResponse = {
        videos: data.data?.videos ?? [],
        cursor: data.data?.cursor ?? 0,
        has_more: data.data?.has_more ?? false,
      };

      console.log("[TikTokApiClient] queryVideos — réponse reçue", {
        videosCount: result.videos.length,
        cursor: result.cursor,
        hasMore: result.has_more,
      });

      return result;
    }

    // Fallback — ne devrait jamais être atteint
    throw new Error(
      "[TikTokApiClient] Échec inattendu après toutes les tentatives."
    );
  }

  // -------------------------------------------------------------------------
  // Private — Body builder
  // -------------------------------------------------------------------------

  private buildQueryBody(params: TikTokVideoQueryParams): object {
    const query: Record<string, unknown> = {};

    // Filtres AND
    const conditions: object[] = [];

    if (params.region_code) {
      conditions.push({
        field_name: "region_code",
        operation: "IN",
        field_values: [params.region_code],
      });
    }

    if (params.hashtag_names && params.hashtag_names.length > 0) {
      conditions.push({
        field_name: "hashtag_name",
        operation: "IN",
        field_values: params.hashtag_names,
      });
    }

    if (params.keyword) {
      conditions.push({
        field_name: "keyword",
        operation: "IN",
        field_values: [params.keyword],
      });
    }

    if (conditions.length > 0) {
      query.and = conditions;
    }

    return {
      query,
      start_date: params.start_date,
      end_date: params.end_date,
      max_count: params.max_count ?? 100,
      ...(params.cursor !== undefined && params.cursor > 0
        ? { cursor: params.cursor }
        : {}),
    };
  }
}
