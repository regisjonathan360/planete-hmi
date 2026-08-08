import "server-only";

export interface PayPalConfiguration {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  webhookId: string;
}

export function getPayPalConfiguration(): PayPalConfiguration | null {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!clientId || !clientSecret || !webhookId) return null;
  return {
    clientId,
    clientSecret,
    environment: process.env.PAYPAL_ENVIRONMENT === "production" ? "production" : "sandbox",
    webhookId,
  };
}

// Aucun endpoint PayPal n’est exposé tant que le SDK officiel et les
// identifiants ne sont pas configurés.
