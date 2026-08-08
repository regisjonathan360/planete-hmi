import { describe, expect, it } from "vitest";
import {
  CONSENT_DURATION_MS,
  createConsentChoice,
  parseConsentChoice,
} from "./consent";

describe("consentement aux traceurs", () => {
  it("conserve un accord ou un refus pendant six mois", () => {
    const choice = createConsentChoice(false, 1_000);

    expect(choice.analytics).toBe(false);
    expect(choice.expiresAt).toBe(1_000 + CONSENT_DURATION_MS);
    expect(parseConsentChoice(JSON.stringify(choice), 2_000)).toEqual(choice);
  });

  it("ignore un choix expiré, corrompu ou d’une ancienne version", () => {
    expect(parseConsentChoice("not-json", 10)).toBeNull();
    expect(
      parseConsentChoice(JSON.stringify(createConsentChoice(true, 1)), 1 + CONSENT_DURATION_MS),
    ).toBeNull();
    expect(
      parseConsentChoice(JSON.stringify({ ...createConsentChoice(true, 10), version: 0 }), 20),
    ).toBeNull();
  });
});
