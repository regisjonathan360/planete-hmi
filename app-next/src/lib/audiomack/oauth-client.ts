/**
 * Client OAuth 1.0a pour l'API Audiomack — SERVEUR UNIQUEMENT.
 * Signe les requêtes conformément à la documentation Audiomack.
 * Ne jamais importer ce fichier côté client.
 */
import "server-only";
import crypto from "crypto";

const API_BASE = "https://api.audiomack.com/v1";

function getKeys() {
  const key = process.env.AUDIOMACK_CONSUMER_KEY;
  const secret = process.env.AUDIOMACK_CONSUMER_SECRET;
  if (!key || !secret) return null;
  return { key, secret };
}

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&`; // No token secret (2-legged)
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildAuthHeader(consumerKey: string, consumerSecret: string, method: string, url: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_version: "1.0",
  };

  const signature = generateSignature(method, url, oauthParams, consumerSecret);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}

export interface AudiomackApiResult {
  ok: boolean;
  data: unknown;
  error?: string;
}

/**
 * Appelle l'API Audiomack avec signature OAuth 1.0a.
 * Retourne null si les clés ne sont pas configurées.
 */
export async function audiomackGet(path: string): Promise<AudiomackApiResult | null> {
  const keys = getKeys();
  if (!keys) return null;

  const url = `${API_BASE}${path}`;
  const auth = buildAuthHeader(keys.key, keys.secret, "GET", url);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { ok: false, data: null, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Récupère la playlist Weekly 100: Haiti */
export async function fetchAudiomackHaitiChart(): Promise<AudiomackApiResult | null> {
  return audiomackGet("/playlist/geo-charts/haiti");
}

export function hasAudiomackKeys(): boolean {
  return !!(process.env.AUDIOMACK_CONSUMER_KEY && process.env.AUDIOMACK_CONSUMER_SECRET);
}
