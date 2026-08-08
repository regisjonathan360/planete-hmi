import { describe, expect, it } from "vitest";
import {
  groupActivities,
  type ActivityItem,
  type GroupedActivityItem,
} from "./activity-grouping";

/**
 * Helper pour créer un ActivityItem avec des valeurs par défaut.
 */
function makeItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "item-1",
    type: "reaction",
    actorPseudo: "user1",
    actorNiveau: "etoile",
    targetType: "song",
    targetId: "target-1",
    targetLabel: "Chanson Test",
    targetUrl: "/songs/target-1",
    createdAt: "2024-01-15T12:00:00.000Z",
    ...overrides,
  };
}

describe("groupActivities", () => {
  it("retourne une liste vide pour une entrée vide", () => {
    expect(groupActivities([])).toEqual([]);
  });

  it("retourne un seul élément non groupé pour un seul item", () => {
    const items = [makeItem()];
    const result = groupActivities(items);

    expect(result).toHaveLength(1);
    expect(result[0].groupCount).toBe(1);
    expect(result[0].id).toBe("item-1");
  });

  it("regroupe les items de même type et même targetId dans une fenêtre de 60 min", () => {
    const items: ActivityItem[] = [
      makeItem({ id: "a", createdAt: "2024-01-15T12:30:00.000Z" }),
      makeItem({ id: "b", createdAt: "2024-01-15T12:15:00.000Z" }),
      makeItem({ id: "c", createdAt: "2024-01-15T12:00:00.000Z" }),
    ];

    const result = groupActivities(items);

    expect(result).toHaveLength(1);
    expect(result[0].groupCount).toBe(3);
    expect(result[0].id).toBe("a"); // le plus récent
    expect(result[0].createdAt).toBe("2024-01-15T12:30:00.000Z");
  });

  it("ne regroupe PAS les items au-delà de 60 minutes de la tête de groupe", () => {
    const items: ActivityItem[] = [
      makeItem({ id: "a", createdAt: "2024-01-15T13:01:00.000Z" }),
      makeItem({ id: "b", createdAt: "2024-01-15T12:00:00.000Z" }), // 61 min de différence
    ];

    const result = groupActivities(items);

    expect(result).toHaveLength(2);
    expect(result[0].groupCount).toBe(1);
    expect(result[1].groupCount).toBe(1);
  });

  it("regroupe les items à exactement 60 minutes d'écart", () => {
    const items: ActivityItem[] = [
      makeItem({ id: "a", createdAt: "2024-01-15T13:00:00.000Z" }),
      makeItem({ id: "b", createdAt: "2024-01-15T12:00:00.000Z" }), // exactement 60 min
    ];

    const result = groupActivities(items);

    expect(result).toHaveLength(1);
    expect(result[0].groupCount).toBe(2);
  });

  it("ne regroupe PAS les items de types différents", () => {
    const items: ActivityItem[] = [
      makeItem({ id: "a", type: "reaction", createdAt: "2024-01-15T12:10:00.000Z" }),
      makeItem({ id: "b", type: "comment", createdAt: "2024-01-15T12:05:00.000Z" }),
    ];

    const result = groupActivities(items);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("reaction");
    expect(result[1].type).toBe("comment");
  });

  it("ne regroupe PAS les items avec des targetId différents", () => {
    const items: ActivityItem[] = [
      makeItem({ id: "a", targetId: "song-1", createdAt: "2024-01-15T12:10:00.000Z" }),
      makeItem({ id: "b", targetId: "song-2", createdAt: "2024-01-15T12:05:00.000Z" }),
    ];

    const result = groupActivities(items);

    expect(result).toHaveLength(2);
  });

  it("ne regroupe PAS les items sans targetId", () => {
    const items: ActivityItem[] = [
      makeItem({ id: "a", type: "new_member", targetId: undefined, createdAt: "2024-01-15T12:10:00.000Z" }),
      makeItem({ id: "b", type: "new_member", targetId: undefined, createdAt: "2024-01-15T12:05:00.000Z" }),
    ];

    const result = groupActivities(items);

    expect(result).toHaveLength(2);
  });

  it("conserve les données du plus récent item comme représentant du groupe", () => {
    const items: ActivityItem[] = [
      makeItem({
        id: "recent",
        actorPseudo: "alice",
        actorNiveau: "galaxie",
        targetLabel: "Label récent",
        createdAt: "2024-01-15T12:30:00.000Z",
      }),
      makeItem({
        id: "old",
        actorPseudo: "bob",
        actorNiveau: "etoile",
        targetLabel: "Label ancien",
        createdAt: "2024-01-15T12:00:00.000Z",
      }),
    ];

    const result = groupActivities(items);

    expect(result).toHaveLength(1);
    expect(result[0].actorPseudo).toBe("alice");
    expect(result[0].actorNiveau).toBe("galaxie");
    expect(result[0].id).toBe("recent");
  });

  it("gère plusieurs groupes indépendants correctement", () => {
    const items: ActivityItem[] = [
      // Groupe 1 : reactions sur song-1
      makeItem({ id: "r1", type: "reaction", targetId: "song-1", createdAt: "2024-01-15T14:30:00.000Z" }),
      // Groupe 2 : votes sur battle-1
      makeItem({ id: "v1", type: "vote", targetId: "battle-1", createdAt: "2024-01-15T14:25:00.000Z" }),
      // Groupe 1 : reactions sur song-1 (dans la fenêtre)
      makeItem({ id: "r2", type: "reaction", targetId: "song-1", createdAt: "2024-01-15T14:00:00.000Z" }),
      // Groupe 2 : votes sur battle-1 (dans la fenêtre)
      makeItem({ id: "v2", type: "vote", targetId: "battle-1", createdAt: "2024-01-15T13:55:00.000Z" }),
    ];

    const result = groupActivities(items);

    expect(result).toHaveLength(2);

    const reactionGroup = result.find((g) => g.type === "reaction");
    const voteGroup = result.find((g) => g.type === "vote");

    expect(reactionGroup?.groupCount).toBe(2);
    expect(reactionGroup?.id).toBe("r1");
    expect(voteGroup?.groupCount).toBe(2);
    expect(voteGroup?.id).toBe("v1");
  });

  it("crée un nouveau groupe quand un item dépasse la fenêtre du groupe précédent", () => {
    // 3 items espacés de 40 min chacun : le premier et le dernier sont à 80 min d'écart
    const items: ActivityItem[] = [
      makeItem({ id: "a", createdAt: "2024-01-15T14:20:00.000Z" }),
      makeItem({ id: "b", createdAt: "2024-01-15T13:40:00.000Z" }), // 40 min de a → dans la fenêtre de a
      makeItem({ id: "c", createdAt: "2024-01-15T13:00:00.000Z" }), // 80 min de a → hors fenêtre de a
    ];

    const result = groupActivities(items);

    // "a" crée un groupe, "b" rejoint (40 min < 60 min), "c" est à 80 min de "a" → nouveau groupe
    expect(result).toHaveLength(2);
    expect(result[0].groupCount).toBe(2); // a + b
    expect(result[0].id).toBe("a");
    expect(result[1].groupCount).toBe(1); // c seul
    expect(result[1].id).toBe("c");
  });

  it("maintient l'ordre DESC dans le résultat", () => {
    const items: ActivityItem[] = [
      makeItem({ id: "a", type: "reaction", targetId: "s1", createdAt: "2024-01-15T15:00:00.000Z" }),
      makeItem({ id: "b", type: "vote", targetId: "b1", createdAt: "2024-01-15T14:00:00.000Z" }),
      makeItem({ id: "c", type: "comment", targetId: "t1", createdAt: "2024-01-15T13:00:00.000Z" }),
    ];

    const result = groupActivities(items);

    // Chacun est un groupe différent, l'ordre doit rester DESC
    expect(result).toHaveLength(3);
    expect(new Date(result[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(result[1].createdAt).getTime()
    );
    expect(new Date(result[1].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(result[2].createdAt).getTime()
    );
  });
});
