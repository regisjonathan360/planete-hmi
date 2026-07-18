import { describe, it, expect } from "vitest";
import { normalizeTikTokUsername, tiktokUsernamesMatch } from "../normalize-username";

describe("normalizeTikTokUsername", () => {
  it("extrait le pseudo depuis un @pseudo", () => {
    expect(normalizeTikTokUsername("@x_ojo_official")).toBe("x_ojo_official");
  });

  it("extrait le pseudo brut", () => {
    expect(normalizeTikTokUsername("x_ojo_official")).toBe("x_ojo_official");
  });

  it("extrait depuis une URL standard", () => {
    expect(normalizeTikTokUsername("https://www.tiktok.com/@x_ojo_official")).toBe("x_ojo_official");
  });

  it("extrait depuis une URL avec slash final", () => {
    expect(normalizeTikTokUsername("https://www.tiktok.com/@x_ojo_official/")).toBe("x_ojo_official");
  });

  it("extrait depuis une URL avec paramètres", () => {
    expect(normalizeTikTokUsername("https://www.tiktok.com/@x_ojo_official?lang=fr&is_from_webapp=1")).toBe("x_ojo_official");
  });

  it("normalise la capitalisation", () => {
    expect(normalizeTikTokUsername("X_OJO_Official")).toBe("x_ojo_official");
    expect(normalizeTikTokUsername("@X_OJO_OFFICIAL")).toBe("x_ojo_official");
  });

  it("gère une URL sans www", () => {
    expect(normalizeTikTokUsername("https://tiktok.com/@test_user")).toBe("test_user");
  });

  it("retourne null pour une valeur vide", () => {
    expect(normalizeTikTokUsername("")).toBeNull();
    expect(normalizeTikTokUsername(null)).toBeNull();
    expect(normalizeTikTokUsername(undefined)).toBeNull();
  });

  it("retourne null pour une valeur invalide", () => {
    expect(normalizeTikTokUsername("not a username!")).toBeNull();
    expect(normalizeTikTokUsername("https://example.com")).toBeNull();
  });
});

describe("tiktokUsernamesMatch", () => {
  it("correspondance exacte", () => {
    expect(tiktokUsernamesMatch("x_ojo_official", "x_ojo_official")).toBe(true);
  });

  it("correspondance insensible à la casse", () => {
    expect(tiktokUsernamesMatch("X_OJO_Official", "x_ojo_official")).toBe(true);
  });

  it("correspondance URL vs pseudo", () => {
    expect(tiktokUsernamesMatch("https://www.tiktok.com/@x_ojo_official", "x_ojo_official")).toBe(true);
  });

  it("non-correspondance", () => {
    expect(tiktokUsernamesMatch("other_user", "x_ojo_official")).toBe(false);
  });

  it("gère les null", () => {
    expect(tiktokUsernamesMatch(null, "x_ojo_official")).toBe(false);
    expect(tiktokUsernamesMatch("x_ojo_official", null)).toBe(false);
  });

  it("correspondance avec @ et URL avec paramètres", () => {
    expect(tiktokUsernamesMatch("@x_ojo_official", "https://www.tiktok.com/@x_ojo_official?lang=fr")).toBe(true);
  });
});
