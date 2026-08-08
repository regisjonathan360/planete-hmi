/**
 * Rate limiting logic for the Community Interactions Arena.
 *
 * Two layers of rate limiting:
 * 1. Action-level: 1 comment / 10s, 10 reactions / 60s per member
 * 2. API-level: 60 req/min per IP, 30 writes/min per member
 *
 * Requirements: 10.8, 15.4, 15.5
 */

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type ApiRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: string };

/** Rate limit configuration per action type */
const ACTION_LIMITS = {
  comment: { maxActions: 1, windowSeconds: 10 },
  reaction: { maxActions: 10, windowSeconds: 60 },
} as const;

/** API rate limit configuration */
const API_LIMITS = {
  ipRequestsPerMinute: 60,
  memberWritesPerMinute: 30,
} as const;

/**
 * In-memory store for API rate limiting.
 * Maps a key (IP or member ID) to an array of request timestamps.
 */
const apiRateStore: Map<string, Date[]> = new Map();

/**
 * Check whether a member's action is allowed based on their recent timestamps.
 *
 * For 'comment': at most 1 comment within the last 10 seconds.
 * For 'reaction': at most 10 reactions within the last 60 seconds.
 *
 * @param memberId - The member attempting the action
 * @param action - The type of action ('comment' or 'reaction')
 * @param timestamps - Recent timestamps of this action type by this member
 * @returns Whether the action is allowed, or how many seconds to wait
 */
export function checkRateLimit(
  memberId: string,
  action: "comment" | "reaction",
  timestamps: Date[]
): RateLimitResult {
  const { maxActions, windowSeconds } = ACTION_LIMITS[action];
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  // Filter timestamps within the rate limiting window
  const recentActions = timestamps.filter((ts) => ts >= windowStart);

  if (recentActions.length < maxActions) {
    return { allowed: true };
  }

  // Find the oldest timestamp in the window to determine when the window expires
  const sortedRecent = [...recentActions].sort(
    (a, b) => a.getTime() - b.getTime()
  );

  // The earliest action in the window — once it falls out of the window, a slot opens
  const earliestInWindow = sortedRecent[0];
  const retryAfterMs =
    earliestInWindow.getTime() + windowSeconds * 1000 - now.getTime();
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, retryAfterSeconds),
  };
}

/**
 * Check whether an API request is allowed based on IP and member rate limits.
 *
 * Uses an in-memory store to track request timestamps per IP and per member.
 * - 60 requests/min per IP
 * - 30 writes/min per member (if authenticated)
 *
 * @param ip - The client IP address
 * @param memberId - The authenticated member ID, or null for anonymous requests
 * @returns Whether the request is allowed, or the reason and wait time
 */
export function checkApiRateLimit(
  ip: string,
  memberId: string | null
): ApiRateLimitResult {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  // Check IP rate limit
  const ipKey = `ip:${ip}`;
  const ipTimestamps = getAndClean(ipKey, oneMinuteAgo);

  if (ipTimestamps.length >= API_LIMITS.ipRequestsPerMinute) {
    const oldest = ipTimestamps[0];
    const retryAfterMs = oldest.getTime() + 60 * 1000 - now.getTime();
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      reason: "Trop de requêtes depuis cette adresse IP.",
    };
  }

  // Check member write rate limit
  if (memberId) {
    const memberKey = `member:${memberId}`;
    const memberTimestamps = getAndClean(memberKey, oneMinuteAgo);

    if (memberTimestamps.length >= API_LIMITS.memberWritesPerMinute) {
      const oldest = memberTimestamps[0];
      const retryAfterMs = oldest.getTime() + 60 * 1000 - now.getTime();
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
        reason: "Trop de requêtes d'écriture pour ce membre.",
      };
    }

    // Record the member request
    memberTimestamps.push(now);
    apiRateStore.set(memberKey, memberTimestamps);
  }

  // Record the IP request
  ipTimestamps.push(now);
  apiRateStore.set(ipKey, ipTimestamps);

  return { allowed: true };
}

/**
 * Retrieve timestamps for a key, filtering out entries older than the cutoff.
 * Also prunes the store to avoid unbounded growth.
 */
function getAndClean(key: string, cutoff: Date): Date[] {
  const existing = apiRateStore.get(key) ?? [];
  const filtered = existing.filter((ts) => ts >= cutoff);
  apiRateStore.set(key, filtered);
  return filtered;
}

/**
 * Reset the in-memory API rate store. Useful for testing.
 */
export function resetApiRateStore(): void {
  apiRateStore.clear();
}
