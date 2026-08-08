import { describe, expect, it } from "vitest";
import {
  artistTypeFromRoles,
  canonicalizeArtistRoles,
  synchronizeArtistRoleFields,
} from "./roles";

describe("artist roles", () => {
  it("normalise les variantes françaises et anglaises", () => {
    expect(canonicalizeArtistRoles([
      "Chanteuse",
      "producer",
      "Orchestre",
      "Musicienne",
      "chanteur",
    ])).toEqual(["chanteur", "beatmaker", "groupe", "musicien"]);
  });

  it("déduit la catégorie depuis les rôles d'une fiche générique", () => {
    expect(artistTypeFromRoles(["rappeuse"])).toBe("rapper");
    expect(artistTypeFromRoles(["DJ"])).toBe("dj");
    expect(artistTypeFromRoles(["productrice"])).toBe("producer");
  });

  it("ajoute le rôle canonique requis par la catégorie principale", () => {
    expect(synchronizeArtistRoleFields("group", ["chanteur"])).toEqual({
      artistType: "group",
      tags: ["chanteur", "groupe"],
    });
  });

  it("conserve plusieurs rôles tout en choisissant une catégorie principale", () => {
    expect(synchronizeArtistRoleFields("rapper", ["chanteuse", "rappeuse"])).toEqual({
      artistType: "rapper",
      tags: ["chanteur", "rappeur"],
    });
  });
});
