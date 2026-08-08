import "server-only";

export interface MonCashAutomaticConfiguration {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  callbackUrl: string;
}

export interface MonCashCreatedPayment {
  token: string;
  redirectUrl: string;
}

export interface MonCashPaymentDetails {
  reference: string;
  transactionId: string;
  amount: number;
  message: string;
  successful: boolean;
}

type MonCashTokenCache = {
  cacheKey: string;
  accessToken: string;
  expiresAt: number;
};

let tokenCache: MonCashTokenCache | null = null;

export function getMonCashAutomaticConfiguration(): MonCashAutomaticConfiguration | null {
  const clientId = process.env.MONCASH_CLIENT_ID?.trim();
  const clientSecret = process.env.MONCASH_CLIENT_SECRET?.trim();
  const returnUrl = process.env.MONCASH_RETURN_URL?.trim();
  const callbackUrl = process.env.MONCASH_CALLBACK_URL?.trim();
  if (
    !clientId ||
    !clientSecret ||
    !isValidPublicUrl(returnUrl) ||
    !isValidPublicUrl(callbackUrl)
  ) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    environment: process.env.MONCASH_ENVIRONMENT === "production" ? "production" : "sandbox",
    returnUrl,
    callbackUrl,
  };
}

export async function createMonCashPayment(
  configuration: MonCashAutomaticConfiguration,
  reference: string,
  amount: number,
): Promise<MonCashCreatedPayment> {
  const accessToken = await getAccessToken(configuration);
  const response = await monCashRequest(configuration, "/v1/CreatePayment", {
    method: "POST",
    accessToken,
    body: { amount, orderId: reference },
  });
  const paymentToken = objectValue(response, "payment_token");
  const token = stringValue(paymentToken, "token");
  if (!token) {
    throw new MonCashApiError("Réponse MonCash invalide lors de la création du paiement.");
  }

  const { gatewayBase } = monCashEndpoints(configuration.environment);
  const redirectUrl = new URL(`${gatewayBase}/Payment/Redirect`);
  redirectUrl.searchParams.set("token", token);

  return { token, redirectUrl: redirectUrl.toString() };
}

export async function retrieveMonCashPayment(
  configuration: MonCashAutomaticConfiguration,
  lookup: { transactionId: string } | { orderId: string },
): Promise<MonCashPaymentDetails> {
  const accessToken = await getAccessToken(configuration);
  const byTransaction = "transactionId" in lookup;
  const response = await monCashRequest(
    configuration,
    byTransaction
      ? "/v1/RetrieveTransactionPayment"
      : "/v1/RetrieveOrderPayment",
    {
      method: "POST",
      accessToken,
      body: lookup,
    },
  );
  const payment = objectValue(response, "payment");
  const reference = stringValue(payment, "reference");
  const transactionId = stringValue(payment, "transaction_id");
  const amount = numberValue(payment, "cost");
  const message = stringValue(payment, "message");
  if (!reference || !transactionId || amount === null || !message) {
    throw new MonCashApiError("Réponse MonCash invalide lors de la vérification.");
  }

  return {
    reference,
    transactionId,
    amount,
    message,
    successful: ["success", "successful", "completed"].includes(
      message.trim().toLowerCase(),
    ),
  };
}

export class MonCashApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "MonCashApiError";
  }
}

async function getAccessToken(
  configuration: MonCashAutomaticConfiguration,
): Promise<string> {
  const cacheKey = [
    configuration.environment,
    configuration.clientId,
    configuration.clientSecret,
  ].join(":");
  if (
    tokenCache?.cacheKey === cacheKey &&
    tokenCache.expiresAt > Date.now() + 5_000
  ) {
    return tokenCache.accessToken;
  }

  const { apiBase } = monCashEndpoints(configuration.environment);
  const authorization = Buffer.from(
    `${configuration.clientId}:${configuration.clientSecret}`,
    "utf8",
  ).toString("base64");
  const response = await requestJson(`${apiBase}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      scope: "read,write",
      grant_type: "client_credentials",
    }),
  });
  const accessToken = stringValue(response, "access_token");
  const expiresIn = numberValue(response, "expires_in");
  if (!accessToken || expiresIn === null || expiresIn <= 0) {
    throw new MonCashApiError("Réponse d’authentification MonCash invalide.");
  }

  tokenCache = {
    cacheKey,
    accessToken,
    expiresAt: Date.now() + expiresIn * 1_000,
  };
  return accessToken;
}

async function monCashRequest(
  configuration: MonCashAutomaticConfiguration,
  path: string,
  options: {
    method: "POST";
    accessToken: string;
    body: Record<string, string | number>;
  },
): Promise<unknown> {
  const { apiBase } = monCashEndpoints(configuration.environment);
  return requestJson(`${apiBase}${path}`, {
    method: options.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.body),
  });
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new MonCashApiError("Le service MonCash est temporairement inaccessible.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new MonCashApiError(
      "Le service MonCash a renvoyé une réponse illisible.",
      response.status,
    );
  }
  if (!response.ok) {
    throw new MonCashApiError(
      safeProviderError(payload) ?? "La demande MonCash a échoué.",
      response.status,
    );
  }
  return payload;
}

function monCashEndpoints(environment: "sandbox" | "production") {
  if (environment === "production") {
    return {
      apiBase: "https://moncashbutton.digicelgroup.com/Api",
      gatewayBase: "https://moncashbutton.digicelgroup.com/Moncash-middleware",
    };
  }
  return {
    apiBase: "https://sandbox.moncashbutton.digicelgroup.com/Api",
    gatewayBase:
      "https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware",
  };
}

function isValidPublicUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function objectValue(
  value: unknown,
  key: string,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as Record<string, unknown>)[key];
  return candidate && typeof candidate === "object"
    ? (candidate as Record<string, unknown>)
    : null;
}

function stringValue(
  value: unknown,
  key: string,
): string | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate === "string" || typeof candidate === "number") {
    return String(candidate);
  }
  return null;
}

function numberValue(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  const candidate = Number((value as Record<string, unknown>)[key]);
  return Number.isFinite(candidate) ? candidate : null;
}

function safeProviderError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as Record<string, unknown>).message;
  return typeof candidate === "string" && candidate.length <= 240
    ? candidate
    : null;
}
