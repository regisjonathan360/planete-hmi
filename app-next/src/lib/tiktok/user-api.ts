import "server-only";

import { z } from "zod";
import { isTikTokTokenEncryptionConfigured } from "./token-crypto";

const AUTHORIZATION_URL = "https://www.tiktok.com/v2/auth/authorize/";
const DEFAULT_API_BASE_URL = "https://open.tiktokapis.com/v2";
const REQUESTED_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
] as const;

export const TIKTOK_OAUTH_STATE_COOKIE = "phmi_tiktok_oauth_state";

const apiErrorSchema = z
  .object({
    code: z.union([z.string(), z.number()]),
    message: z.string().optional(),
    log_id: z.string().optional(),
  })
  .passthrough();

const apiEnvelopeSchema = z
  .object({ error: apiErrorSchema })
  .passthrough();

const oauthErrorSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
  log_id: z.string().optional(),
});

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  open_id: z.string().min(1),
  scope: z.string().default(""),
  token_type: z.string().default("Bearer"),
  expires_in: z.coerce.number().int().positive(),
  refresh_expires_in: z.coerce.number().int().positive(),
});

const userSchema = z.object({
  open_id: z.string().min(1),
  union_id: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  bio_description: z.string().nullable().optional(),
  profile_deep_link: z.string().nullable().optional(),
  is_verified: z.boolean().optional().default(false),
  username: z.string().nullable().optional(),
  follower_count: z.coerce.number().int().nonnegative().optional().default(0),
  following_count: z.coerce.number().int().nonnegative().optional().default(0),
  likes_count: z.coerce.number().int().nonnegative().optional().default(0),
  video_count: z.coerce.number().int().nonnegative().optional().default(0),
});

const videoSchema = z.object({
  id: z.string().min(1),
  create_time: z.coerce.number().int().positive(),
  cover_image_url: z.string().nullable().optional(),
  share_url: z.string().nullable().optional(),
  video_description: z.string().nullable().optional(),
  duration: z.coerce.number().int().nonnegative().nullable().optional(),
  height: z.coerce.number().int().positive().nullable().optional(),
  width: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().nullable().optional(),
  embed_link: z.string().nullable().optional(),
  like_count: z.coerce.number().int().nonnegative().optional().default(0),
  comment_count: z.coerce.number().int().nonnegative().optional().default(0),
  share_count: z.coerce.number().int().nonnegative().optional().default(0),
  view_count: z.coerce.number().int().nonnegative().optional().default(0),
});

const userResponseSchema = z.object({
  data: z.object({ user: userSchema }),
  error: apiErrorSchema,
});

const videoListResponseSchema = z.object({
  data: z.object({
    videos: z.array(videoSchema).default([]),
    cursor: z.coerce.number().int().optional().default(0),
    has_more: z.boolean().optional().default(false),
  }),
  error: apiErrorSchema,
});

const videoQueryResponseSchema = z.object({
  data: z.object({ videos: z.array(videoSchema).default([]) }),
  error: apiErrorSchema,
});

export type TikTokOAuthTokens = z.infer<typeof tokenSchema>;
export type TikTokUserProfile = z.infer<typeof userSchema>;
export type TikTokDisplayVideo = z.infer<typeof videoSchema>;

export class TikTokUserApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly logId?: string
  ) {
    super(message);
    this.name = "TikTokUserApiError";
  }

  get requiresReauthorization(): boolean {
    return [
      "access_token_invalid",
      "invalid_grant",
      "invalid_token",
      "unauthorized_client",
    ].includes(this.code);
  }
}

function apiBaseUrl(): string {
  return (process.env.TIKTOK_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

function requiredConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim();

  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error(
      "TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET et TIKTOK_REDIRECT_URI sont requis."
    );
  }

  return { clientKey, clientSecret, redirectUri };
}

export function isTikTokOAuthConfigured(): boolean {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY?.trim() &&
      process.env.TIKTOK_CLIENT_SECRET?.trim() &&
      process.env.TIKTOK_REDIRECT_URI?.trim() &&
      isTikTokTokenEncryptionConfigured()
  );
}

export function buildTikTokAuthorizationUrl(state: string): URL {
  const { clientKey, redirectUri } = requiredConfig();
  const url = new URL(AUTHORIZATION_URL);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", REQUESTED_SCOPES.join(","));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("disable_auto_auth", "1");
  return url;
}

function scopesFromString(value: string): string[] {
  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function normalizeTikTokScopes(value: string | string[]): string[] {
  return Array.isArray(value) ? value : scopesFromString(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new TikTokUserApiError(
      "TikTok a retourne une reponse illisible.",
      "invalid_response",
      response.status
    );
  }
}

async function requestWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { ...init, cache: "no-store" });
    if (response.status !== 429 || attempt === 2) return response;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }

  throw new Error("Requete TikTok interrompue.");
}

function assertApiSuccess(errorValue: z.infer<typeof apiErrorSchema>, status: number) {
  const code = String(errorValue.code);
  if (code === "ok" || code === "0") return;

  throw new TikTokUserApiError(
    errorValue.message || "TikTok a refuse la requete.",
    code,
    status,
    errorValue.log_id
  );
}

async function parseApiResponse<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
  const payload = await readJson(response);
  const envelope = apiEnvelopeSchema.safeParse(payload);

  if (envelope.success) {
    assertApiSuccess(envelope.data.error, response.status);
  }
  if (!response.ok) {
    throw new TikTokUserApiError(
      "TikTok a refuse la requete.",
      "http_error",
      response.status
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new TikTokUserApiError(
      "TikTok a retourne une reponse inattendue.",
      "invalid_response",
      response.status
    );
  }
  return parsed.data;
}

async function tokenRequest(form: URLSearchParams): Promise<TikTokOAuthTokens> {
  const response = await requestWithRetry(`${apiBaseUrl()}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const error = oauthErrorSchema.safeParse(payload);
    throw new TikTokUserApiError(
      error.success
        ? error.data.error_description || "TikTok a refuse le jeton."
        : "TikTok a refuse le jeton.",
      error.success ? error.data.error || "oauth_error" : "oauth_error",
      response.status,
      error.success ? error.data.log_id : undefined
    );
  }

  return tokenSchema.parse(payload);
}

export async function exchangeTikTokAuthorizationCode(
  code: string
): Promise<TikTokOAuthTokens> {
  const { clientKey, clientSecret, redirectUri } = requiredConfig();
  return tokenRequest(
    new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    })
  );
}

export async function refreshTikTokAccessToken(
  refreshToken: string
): Promise<TikTokOAuthTokens> {
  const { clientKey, clientSecret } = requiredConfig();
  return tokenRequest(
    new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}

export async function revokeTikTokAccessToken(accessToken: string): Promise<void> {
  const { clientKey, clientSecret } = requiredConfig();
  const response = await requestWithRetry(`${apiBaseUrl()}/oauth/revoke/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      token: accessToken,
    }),
  });

  if (!response.ok) {
    const payload = await readJson(response);
    const error = oauthErrorSchema.safeParse(payload);
    throw new TikTokUserApiError(
      error.success
        ? error.data.error_description || "La revocation TikTok a echoue."
        : "La revocation TikTok a echoue.",
      error.success ? error.data.error || "revoke_failed" : "revoke_failed",
      response.status,
      error.success ? error.data.log_id : undefined
    );
  }
}

export async function fetchTikTokUserProfile(
  accessToken: string,
  grantedScopes: string[]
): Promise<TikTokUserProfile> {
  const scopes = new Set(grantedScopes);
  const fields = ["open_id", "union_id", "avatar_url", "display_name"];

  if (scopes.has("user.info.profile")) {
    fields.push("bio_description", "profile_deep_link", "is_verified", "username");
  }
  if (scopes.has("user.info.stats")) {
    fields.push("follower_count", "following_count", "likes_count", "video_count");
  }

  const response = await requestWithRetry(
    `${apiBaseUrl()}/user/info/?fields=${encodeURIComponent(fields.join(","))}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const parsed = await parseApiResponse(response, userResponseSchema);
  return parsed.data.user;
}

const VIDEO_FIELDS = [
  "id",
  "create_time",
  "cover_image_url",
  "share_url",
  "video_description",
  "duration",
  "height",
  "width",
  "title",
  "embed_link",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
].join(",");

export function getTikTokSyncMaxPages(): number {
  const configured = Number.parseInt(process.env.TIKTOK_SYNC_MAX_PAGES ?? "10", 10);
  if (!Number.isFinite(configured)) return 10;
  return Math.min(Math.max(configured, 1), 50);
}

export async function listTikTokVideos(
  accessToken: string,
  maxPages = getTikTokSyncMaxPages()
): Promise<{ videos: TikTokDisplayVideo[]; truncated: boolean }> {
  const videos: TikTokDisplayVideo[] = [];
  let cursor: number | undefined;
  let hasMore = true;
  let page = 0;

  while (hasMore && page < maxPages) {
    const response = await requestWithRetry(
      `${apiBaseUrl()}/video/list/?fields=${encodeURIComponent(VIDEO_FIELDS)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          max_count: 20,
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      }
    );
    const parsed = await parseApiResponse(response, videoListResponseSchema);
    videos.push(...parsed.data.videos);
    cursor = parsed.data.cursor;
    hasMore = parsed.data.has_more;
    page++;
  }

  return { videos, truncated: hasMore };
}

export async function queryTikTokVideos(
  accessToken: string,
  videoIds: string[]
): Promise<TikTokDisplayVideo[]> {
  if (videoIds.length === 0) return [];
  if (videoIds.length > 20) throw new Error("TikTok accepte au maximum 20 videos par requete.");

  const response = await requestWithRetry(
    `${apiBaseUrl()}/video/query/?fields=${encodeURIComponent(VIDEO_FIELDS)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filters: { video_ids: videoIds } }),
    }
  );
  const parsed = await parseApiResponse(response, videoQueryResponseSchema);
  return parsed.data.videos;
}
