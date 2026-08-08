import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getPublicPaymentConfiguration } from "./config";

const PAYMENT_ENV = [
  "MONCASH_CLIENT_ID",
  "MONCASH_CLIENT_SECRET",
  "MONCASH_RETURN_URL",
  "MONCASH_CALLBACK_URL",
  "MONCASH_API_ENABLED",
  "NEXT_PUBLIC_MONCASH_DISPLAY_NAME",
  "NEXT_PUBLIC_MONCASH_NUMBER",
  "NEXT_PUBLIC_MONCASH_MERCHANT_CODE",
  "NEXT_PUBLIC_MONCASH_QR_URL",
  "NEXT_PUBLIC_NATCASH_DISPLAY_NAME",
  "NEXT_PUBLIC_NATCASH_NUMBER",
  "NEXT_PUBLIC_NATCASH_MERCHANT_CODE",
  "NEXT_PUBLIC_NATCASH_QR_URL",
  "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
  "NEXT_PUBLIC_PAYPAL_HOSTED_BUTTON_ID",
] as const;

describe("configuration des paiements locaux", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const name of PAYMENT_ENV) vi.stubEnv(name, "");
  });

  it("active le parcours automatique MonCash avec la configuration complète", () => {
    vi.stubEnv("MONCASH_API_ENABLED", "true");
    vi.stubEnv("MONCASH_CLIENT_ID", "client");
    vi.stubEnv("MONCASH_CLIENT_SECRET", "secret");
    vi.stubEnv(
      "MONCASH_RETURN_URL",
      "https://example.com/api/contributions/moncash/return",
    );
    vi.stubEnv(
      "MONCASH_CALLBACK_URL",
      "https://example.com/api/contributions/moncash/callback",
    );

    const moncash = getPublicPaymentConfiguration().methods.find(
      (method) => method.id === "moncash",
    );

    expect(moncash).toMatchObject({
      configured: true,
      enabled: true,
      mode: "AUTOMATIC",
      badge: "Paiement sécurisé",
    });
  });

  it("utilise le compte personnel MonCash tant que l’API n’est pas activée", () => {
    const configuration = getPublicPaymentConfiguration();
    const moncash = configuration.methods.find(
      (method) => method.id === "moncash",
    );

    expect(moncash).toMatchObject({
      configured: true,
      mode: "MANUAL",
      badge: "Transfert manuel",
    });
    expect(configuration.wallets.moncash).toMatchObject({
      displayName: "Régis Jonathan",
      number: "+509 3732-9331",
      qrUrl: "/brand/payments/moncash-regis-jonathan.jpg",
    });
  });

  it("configure le transfert personnel NatCash et son QR", () => {
    const configuration = getPublicPaymentConfiguration();
    expect(configuration.methods.find((method) => method.id === "natcash")).toMatchObject({
      configured: true,
      mode: "MANUAL",
      badge: "Transfert manuel",
    });
    expect(configuration.wallets.natcash).toMatchObject({
      displayName: "Jonathan Regis",
      number: "+509 4159-8724",
      qrUrl: "/brand/payments/natcash-jonathan-regis.png",
    });
  });

  it("configure le bouton PayPal Hosted Buttons fourni", () => {
    const configuration = getPublicPaymentConfiguration();
    const paypal = configuration.methods.find((method) => method.id === "paypal");

    expect(paypal).toMatchObject({
      enabled: true,
      configured: true,
      mode: "AUTOMATIC",
      currencies: ["USD"],
    });
    expect(configuration.paypal).toMatchObject({
      hostedButtonId: "JDCLSL36KW6QQ",
    });
    expect(configuration.paypal.clientId).toContain("BAAVJ3IHZQcqASSM1ZDa2t8hHgj");
  });
});
