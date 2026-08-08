export const CONSENT_STORAGE_KEY = "planete-hmi-cookie-consent";
export const CONSENT_VERSION = 1;
export const CONSENT_DURATION_MS = 180 * 24 * 60 * 60 * 1000;
export const CONSENT_CHANGED_EVENT = "planete-hmi:consent-changed";
export const OPEN_COOKIE_SETTINGS_EVENT = "planete-hmi:open-cookie-settings";

export interface ConsentChoice {
  version: number;
  necessary: true;
  analytics: boolean;
  decidedAt: number;
  expiresAt: number;
}

export function createConsentChoice(
  analytics: boolean,
  now = Date.now(),
): ConsentChoice {
  return {
    version: CONSENT_VERSION,
    necessary: true,
    analytics,
    decidedAt: now,
    expiresAt: now + CONSENT_DURATION_MS,
  };
}

export function parseConsentChoice(
  raw: string | null,
  now = Date.now(),
): ConsentChoice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ConsentChoice>;
    if (
      value.version !== CONSENT_VERSION ||
      value.necessary !== true ||
      typeof value.analytics !== "boolean" ||
      typeof value.decidedAt !== "number" ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= now
    ) {
      return null;
    }
    return value as ConsentChoice;
  } catch {
    return null;
  }
}
