/**
 * Regroupement des activités du mur d'activité.
 * Fusionne les activités de même type et même cible survenues dans une fenêtre de 60 minutes.
 */

export interface ActivityItem {
  id: string;
  type: string; // 'reaction' | 'comment' | 'vote' | 'badge_earned' | 'new_member' | 'new_chart' | 'challenge_complete'
  actorPseudo: string;
  actorNiveau: string;
  targetType?: string;
  targetId?: string;
  targetLabel: string;
  targetUrl?: string;
  createdAt: string; // ISO timestamp
}

export interface GroupedActivityItem {
  id: string; // ID of the most recent item in the group
  type: string;
  actorPseudo: string; // of the most recent actor
  actorNiveau: string;
  targetType?: string;
  targetId?: string;
  targetLabel: string;
  targetUrl?: string;
  createdAt: string; // most recent timestamp
  groupCount: number; // number of items in the group (1 = ungrouped)
}

/** Fenêtre de regroupement en millisecondes (60 minutes). */
const GROUPING_WINDOW_MS = 60 * 60 * 1000;

/**
 * Regroupe les activités de même type et même cible (targetId) survenues
 * dans une fenêtre de 60 minutes.
 *
 * Algorithme :
 * 1. Les items sont attendus triés par createdAt DESC (plus récent en premier).
 * 2. Pour chaque item, on cherche un groupe existant avec le même type + même targetId
 *    dont le timestamp le plus ancien du groupe est à ≤ 60 min de l'item courant.
 * 3. Si trouvé, on incrémente le groupCount du groupe.
 * 4. Sinon, on crée un nouveau groupe.
 * 5. On retourne la liste groupée en ordre DESC (par createdAt du groupe).
 *
 * @param items - Liste d'activités triées par createdAt DESC
 * @returns Liste groupée triée par createdAt DESC
 */
export function groupActivities(items: ActivityItem[]): GroupedActivityItem[] {
  if (items.length === 0) return [];

  const groups: GroupedActivityItem[] = [];

  for (const item of items) {
    const itemTime = new Date(item.createdAt).getTime();

    // Chercher un groupe existant compatible
    const existingGroup = groups.find((group) => {
      if (group.type !== item.type) return false;
      if (group.targetId !== item.targetId) return false;
      // Les items sans targetId ne sont pas regroupés entre eux
      if (!item.targetId) return false;

      // Le groupe contient le timestamp le plus récent (createdAt du groupe).
      // L'item courant est plus ancien (items triés DESC).
      // On vérifie que la différence entre le plus récent du groupe et l'item courant est ≤ 60 min.
      const groupTime = new Date(group.createdAt).getTime();
      return groupTime - itemTime <= GROUPING_WINDOW_MS;
    });

    if (existingGroup) {
      existingGroup.groupCount++;
    } else {
      groups.push({
        id: item.id,
        type: item.type,
        actorPseudo: item.actorPseudo,
        actorNiveau: item.actorNiveau,
        targetType: item.targetType,
        targetId: item.targetId,
        targetLabel: item.targetLabel,
        targetUrl: item.targetUrl,
        createdAt: item.createdAt,
        groupCount: 1,
      });
    }
  }

  return groups;
}
