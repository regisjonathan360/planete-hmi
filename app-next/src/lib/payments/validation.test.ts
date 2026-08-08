import { describe, expect, it } from "vitest";
import {
  contributionInputSchema,
  contributionReferenceSchema,
  manualConfirmationSchema,
  reviewContributionSchema,
} from "./validation";

describe("validation des contributions", () => {
  it("accepte une contribution manuelle valide", () => {
    const result = contributionInputSchema.parse({
      amount: 250,
      currency: "HTG",
      provider: "moncash",
      idempotencyKey: "70b3ee76-3739-4414-bda8-f02a7b279c0f",
      anonymous: true,
    });
    expect(result.amount).toBe(250);
    expect(result.anonymous).toBe(true);
  });

  it("refuse un montant nul ou négatif", () => {
    expect(() =>
      contributionInputSchema.parse({
        amount: 0,
        currency: "HTG",
        provider: "natcash",
        idempotencyKey: "70b3ee76-3739-4414-bda8-f02a7b279c0f",
      }),
    ).toThrow();
  });

  it("refuse un fournisseur inventé", () => {
    expect(() =>
      contributionInputSchema.parse({
        amount: 100,
        currency: "HTG",
        provider: "faux-portefeuille",
        idempotencyKey: "70b3ee76-3739-4414-bda8-f02a7b279c0f",
      }),
    ).toThrow();
  });

  it("valide une référence difficile à deviner au format attendu", () => {
    expect(
      contributionReferenceSchema.parse("HMI-AB23CD-9KLMN234PQ"),
    ).toBe("HMI-AB23CD-9KLMN234PQ");
    expect(() => contributionReferenceSchema.parse("HMI-123")).toThrow();
  });

  it("exige un identifiant de transaction pour la confirmation manuelle", () => {
    expect(() =>
      manualConfirmationSchema.parse({
        reference: "HMI-AB23CD-9KLMN234PQ",
        transactionCode: "",
        amount: 100,
      }),
    ).toThrow();
  });

  it("limite les décisions administratives aux statuts prévus", () => {
    expect(
      reviewContributionSchema.parse({
        status: "CONFIRMED",
        reason: "Transaction vérifiée dans le portefeuille marchand.",
      }).status,
    ).toBe("CONFIRMED");
    expect(() =>
      reviewContributionSchema.parse({
        status: "REFUNDED",
        reason: "Test",
      }),
    ).toThrow();
  });
});
