/* ------------------------------------------------------------
   CollisionSystem.ts — Détection de collision Spatial Hash Grid 3D
   Partitionne l'espace en cellules cubiques pour exécuter des
   tests de proximité en O(1)/O(k) au lieu d'un calcul O(N^2).
   ------------------------------------------------------------ */

export interface SpatialItem {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export class CollisionSystem {
  private readonly cellSize: number;
  private readonly grid = new Map<string, SpatialItem[]>();

  constructor(cellSize = 2.0) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.grid.clear();
  }

  private getKey(x: number, y: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx}:${cy}:${cz}`;
  }

  insert(item: SpatialItem): void {
    const key = this.getKey(item.x, item.y, item.z);
    let list = this.grid.get(key);
    if (!list) {
      list = [];
      this.grid.set(key, list);
    }
    list.push(item);
  }

  /**
   * Retourne tous les objets situés à une distance inférieure à `radius`
   * du point (x, y, z).
   */
  querySphere(x: number, y: number, z: number, radius: number): SpatialItem[] {
    const results: SpatialItem[] = [];
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);
    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const key = `${cx}:${cy}:${cz}`;
          const items = this.grid.get(key);
          if (!items) continue;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const dx = item.x - x;
            const dy = item.y - y;
            const dz = item.z - z;
            if (dx * dx + dy * dy + dz * dz <= rSq) {
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }
}
