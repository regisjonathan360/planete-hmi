import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { PaymentProvider } from "./types";
import { getPublicPaymentConfiguration } from "./config";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function createContributionReference(): string {
  return `HMI-${randomCode(6)}-${randomCode(10)}`;
}

export function paymentModeForProvider(
  provider: PaymentProvider,
): "AUTOMATIC" | "MANUAL" | "EXTERNAL_REDIRECT" {
  if (provider === "paypal") return "AUTOMATIC";
  if (provider === "moncash" || provider === "natcash") {
    const method = getPublicPaymentConfiguration().methods.find(
      (candidate) => candidate.id === provider,
    );
    return method?.mode ?? "MANUAL";
  }
  return "EXTERNAL_REDIRECT";
}

export function isProviderAvailable(provider: PaymentProvider): boolean {
  const config = getPublicPaymentConfiguration();
  const direct = config.methods.find((method) => method.id === provider);
  if (direct) return direct.enabled && direct.configured;
  return config.externalTransfers.some(
    (method) => method.id === provider && method.enabled && Boolean(method.publicUrl),
  );
}

export function hashRateLimitKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 160) || "unknown";
  const salt = process.env.SUPABASE_SECRET_KEY?.slice(-24) || "planete-hmi";
  return createHash("sha256")
    .update(`${scope}:${ip}:${agent}:${salt}`)
    .digest("hex");
}

export function safeNullable(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}
