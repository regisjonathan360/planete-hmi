import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createMonCashPayment,
  getMonCashAutomaticConfiguration,
  retrieveMonCashPayment,
  type MonCashAutomaticConfiguration,
} from "./moncash";

const configuration: MonCashAutomaticConfiguration = {
  clientId: "client-test",
  clientSecret: "secret-test",
  environment: "sandbox",
  returnUrl: "https://example.com/support/moncash/return",
  callbackUrl: "https://example.com/api/contributions/moncash/callback",
};

describe("adaptateur MonCash", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exige les identifiants et deux URLs publiques valides", () => {
    vi.stubEnv("MONCASH_CLIENT_ID", "client");
    vi.stubEnv("MONCASH_CLIENT_SECRET", "secret");
    vi.stubEnv("MONCASH_RETURN_URL", "https://example.com/return");
    vi.stubEnv("MONCASH_CALLBACK_URL", "javascript:alert(1)");

    expect(getMonCashAutomaticConfiguration()).toBeNull();

    vi.stubEnv(
      "MONCASH_CALLBACK_URL",
      "https://example.com/api/contributions/moncash/callback",
    );
    expect(getMonCashAutomaticConfiguration()).toMatchObject({
      clientId: "client",
      environment: "sandbox",
    });
  });

  it("authentifie, crée le paiement et produit la redirection officielle", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          access_token: "access-token",
          expires_in: 59,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          payment_token: { token: "payment-token" },
        }),
      );

    const payment = await createMonCashPayment(
      configuration,
      "HMI-AB23CD-9KLMN234PQ",
      250,
    );

    expect(payment.redirectUrl).toBe(
      "https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=payment-token",
    );
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/Api/oauth/token");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/Api/v1/CreatePayment");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        amount: 250,
        orderId: "HMI-AB23CD-9KLMN234PQ",
      }),
    );
  });

  it("vérifie une transaction auprès de MonCash", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          access_token: "another-access-token",
          expires_in: 59,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          payment: {
            reference: "HMI-ZY98XW-765432QWER",
            transaction_id: "12874820",
            cost: 500,
            message: "successful",
          },
        }),
      );

    const payment = await retrieveMonCashPayment(
      { ...configuration, clientId: "another-client" },
      { transactionId: "12874820" },
    );

    expect(payment).toEqual({
      reference: "HMI-ZY98XW-765432QWER",
      transactionId: "12874820",
      amount: 500,
      message: "successful",
      successful: true,
    });
  });
});
