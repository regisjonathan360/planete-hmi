/* ------------------------------------------------------------
   SnakeWorld.ts — Planète redessinée avec zones sectorialisées
   Sphère plus grande + décor stratégiquement placé par districts
   pour permettre un meilleur déplacement du serpent et des corridors
   de jeu fluides. Herbe texturée, atmosphère, étoiles, soleil chaud.
   ------------------------------------------------------------ */

import * as THREE from "three";
import { CFG, COLORS } from "./config";

const R = CFG.planetRadius;

export interface Obstacle3D {
  x: number;
  y: number;
  z: number;
  radius: number;
}

/**
 * District — secteur de la planète avec obstacles regroupés
 * Permet une meilleure organisation et évitement des IA
 */
interface District {
  center: THREE.Vector3;
  obstacles: Obstacle3D[];
}

export class SnakeWorld {
  readonly group = new THREE.Group();
  private readonly disposables: Array<{ dispose: () => void }> = [];

  /** Liste publique des obstacles 3D pour l'évitement des IA. */
  readonly obstacles: Obstacle3D[] = [];

  /** Districts pour pathfinding et organisation spatiale */
  private readonly districts: District[] = [];

  constructor(scene: THREE.Scene, enableShadows: boolean) {
    scene.add(this.group);

    /* ---- Espace ---- */
    scene.background = new THREE.Color(COLORS.spaceBg);
    scene.fog = null;
    this.buildStars(scene);

    /* ---- Éclairage soleil chaud ---- */
    const hemi = new THREE.HemisphereLight(COLORS.ambientSky, COLORS.ambientGround, 0.9);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(COLORS.sunLight, 1.6);
    sun.position.set(80, 160, 60);
    sun.castShadow = enableShadows;
    if (enableShadows) {
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 400;
      sun.shadow.camera.left = -75;
      sun.shadow.camera.right = 75;
      sun.shadow.camera.top = 75;
      sun.shadow.camera.bottom = -75;
      sun.shadow.bias = -0.002;
    }
    scene.add(sun);
    scene.add(sun.target);

    this.buildPlanet(enableShadows);
    this.buildAtmosphere();
    this.buildDistrictLayout(enableShadows);
  }

  private buildStars(scene: THREE.Scene): void {
    const count = 900;
    const pos = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = 320 + Math.random() * 420;
      v.setFromSphericalCoords(r, b, a);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
    this.disposables.push(geo, mat);
  }

  private buildPlanet(enableShadows: boolean): void {
    const tex = this.createGrassTexture();
    const geo = new THREE.SphereGeometry(R, 48, 32);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.95,
      metalness: 0.0,
    });
    const planet = new THREE.Mesh(geo, mat);
    planet.receiveShadow = enableShadows;
    this.group.add(planet);
    this.disposables.push(geo, mat, tex);
  }

  private buildAtmosphere(): void {
    const geo = new THREE.SphereGeometry(R * 1.035, 48, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.atmosphere,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.group.add(new THREE.Mesh(geo, mat));
    this.disposables.push(geo, mat);
  }

  private buildDistrictLayout(enableShadows: boolean): void {
    /* Créer 6 districts sur la sphère (positionnés aux 6 faces d'un cube)
       Mais espacés plus généreusement pour laisser des corridors de jeu fluides */
    const districtPositions = [
      new THREE.Vector3(1, 0, 0),   // Est
      new THREE.Vector3(-1, 0, 0),  // Ouest
      new THREE.Vector3(0, 1, 0),   // Nord
      new THREE.Vector3(0, -1, 0),  // Sud
      new THREE.Vector3(0, 0, 1),   // Avant
      new THREE.Vector3(0, 0, -1),  // Arrière
    ].map(v => v.normalize().multiplyScalar(R));

    for (let d = 0; d < districtPositions.length; d++) {
      const districtCenter = districtPositions[d];
      const district: District = { center: districtCenter, obstacles: [] };

      /* Petit groupe d'arbres au centre du district - réduit pour meilleur gameplay */
      this.buildDistrictTrees(districtCenter, enableShadows, district, 2);

      /* Rochers parsemés autour du district - aussi réduit */
      this.buildDistrictRocks(districtCenter, enableShadows, district, 3);

      /* Fleurs en groupes - plutôt décoratives */
      this.buildDistrictFlowers(districtCenter, district, 10);

      this.districts.push(district);
    }
    
    /* Ajouter des décors neutres supplémentaires entre les districts (petites pierres) */
    this.buildNeutralDecor(enableShadows);
  }

  private buildNeutralDecor(enableShadows: boolean): void {
    /* Petites pierres décoratives entre les districts pour ambiance mais sans bloquer */
    const smallRockGeo = new THREE.TetrahedronGeometry(0.3, 0);
    const smallRockMat = new THREE.MeshStandardMaterial({
      color: COLORS.rock,
      roughness: 0.95,
      metalness: 0.05,
    });

    const up = new THREE.Vector3(0, 1, 0);
    const qAlign = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const qYaw = new THREE.Quaternion();
    const tmpVec = new THREE.Vector3();

    /* Semer 30 petites pierres aléatoires mais éloignées des districts (corridor spacing) */
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      tmpVec.setFromSphericalCoords(R, phi, angle);
      const n = tmpVec.clone().normalize();
      const p = n.clone().multiplyScalar(R + 0.2);

      const rock = new THREE.Mesh(smallRockGeo, smallRockMat);
      qAlign.setFromUnitVectors(up, n);
      qYaw.setFromAxisAngle(yAxis, Math.random() * Math.PI * 2);
      qAlign.multiply(qYaw);
      rock.quaternion.copy(qAlign);
      rock.position.copy(p);
      rock.scale.setScalar(0.4 + Math.random() * 0.3);
      rock.castShadow = enableShadows;
      this.group.add(rock);
    }

    this.disposables.push(smallRockGeo, smallRockMat);
  }

  private buildDistrictTrees(
    centerWorld: THREE.Vector3,
    enableShadows: boolean,
    district: District,
    count: number
  ): void {
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6);
    trunkGeo.translate(0, 0.8, 0);
    const leafGeo = new THREE.IcosahedronGeometry(1.4, 0);
    leafGeo.translate(0, 2.2, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.treeTrunk, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: COLORS.treeLeaves, roughness: 0.8 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: COLORS.treeLeavesAlt, roughness: 0.8 });

    const up = new THREE.Vector3(0, 1, 0);
    const qAlign = new THREE.Quaternion();
    const qYaw = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const tmpVec = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      /* Petite graine aléatoire près du centre du district */
      const angle = Math.random() * Math.PI * 2;
      const distance = 3 + Math.random() * 4;
      const theta = Math.random() * 0.4 - 0.2; /* petits angles pour rester proche du district */

      tmpVec.copy(centerWorld).normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tmpVec).normalize();
      const up2 = tmpVec.clone();

      tmpVec.copy(right).multiplyScalar(Math.cos(angle) * distance);
      tmpVec.addScaledVector(up2, Math.sin(theta) * distance);
      tmpVec.addScaledVector(centerWorld, 0.95);
      const p = tmpVec.normalize().multiplyScalar(R + 1.3);
      const n = p.clone().normalize();

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      const crown = new THREE.Mesh(leafGeo, i % 2 ? leafMat2 : leafMat);
      tree.add(trunk, crown);

      qAlign.setFromUnitVectors(up, n);
      qYaw.setFromAxisAngle(yAxis, Math.random() * Math.PI * 2);
      qAlign.multiply(qYaw);
      tree.quaternion.copy(qAlign);
      tree.position.copy(p);
      tree.scale.setScalar(0.8 + Math.random() * 0.5);
      tree.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = enableShadows;
      });
      this.group.add(tree);
      
      const obstacle: Obstacle3D = { x: p.x, y: p.y, z: p.z, radius: 1.4 };
      this.obstacles.push(obstacle);
      district.obstacles.push(obstacle);
    }

    this.disposables.push(trunkGeo, leafGeo, trunkMat, leafMat, leafMat2);
  }

  private buildDistrictRocks(
    centerWorld: THREE.Vector3,
    enableShadows: boolean,
    district: District,
    count: number
  ): void {
    const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: COLORS.rock,
      roughness: 0.95,
      metalness: 0.05,
    });

    const up = new THREE.Vector3(0, 1, 0);
    const qAlign = new THREE.Quaternion();
    const qYaw = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const tmpVec = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 6;
      const theta = Math.random() * 0.3 - 0.15;

      tmpVec.copy(centerWorld).normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tmpVec).normalize();
      const up2 = tmpVec.clone();

      tmpVec.copy(right).multiplyScalar(Math.cos(angle) * distance);
      tmpVec.addScaledVector(up2, Math.sin(theta) * distance);
      tmpVec.addScaledVector(centerWorld, 0.9);
      const p = tmpVec.normalize().multiplyScalar(R + 0.35);
      const n = p.clone().normalize();

      const rock = new THREE.Mesh(rockGeo, rockMat);
      qAlign.setFromUnitVectors(up, n);
      qYaw.setFromAxisAngle(yAxis, Math.random() * Math.PI * 2);
      qAlign.multiply(qYaw);
      rock.quaternion.copy(qAlign);
      rock.position.copy(p);
      rock.scale.setScalar(0.7 + Math.random() * 0.9);
      rock.castShadow = enableShadows;
      this.group.add(rock);

      const obstacle: Obstacle3D = { x: p.x, y: p.y, z: p.z, radius: 0.9 };
      this.obstacles.push(obstacle);
      district.obstacles.push(obstacle);
    }

    this.disposables.push(rockGeo, rockMat);
  }

  private buildDistrictFlowers(
    centerWorld: THREE.Vector3,
    district: District,
    count: number
  ): void {
    const geo = new THREE.SphereGeometry(0.12, 6, 4);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const flowers = new THREE.InstancedMesh(geo, mat, count);

    const up = new THREE.Vector3(0, 1, 0);
    const qAlign = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const tmpVec = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * 5;
      const theta = Math.random() * 0.25 - 0.125;

      tmpVec.copy(centerWorld).normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tmpVec).normalize();
      const up2 = tmpVec.clone();

      tmpVec.copy(right).multiplyScalar(Math.cos(angle) * distance);
      tmpVec.addScaledVector(up2, Math.sin(theta) * distance);
      tmpVec.addScaledVector(centerWorld, 0.95);
      p.copy(tmpVec).normalize().multiplyScalar(R + 0.1);

      const n = p.clone().normalize();
      qAlign.setFromUnitVectors(up, n);
      q.copy(qAlign);
      s.setScalar(0.5 + Math.random() * 0.8);
      m.compose(p, q, s);
      flowers.setMatrixAt(i, m);
    }

    flowers.instanceMatrix.needsUpdate = true;
    flowers.count = count;
    flowers.castShadow = false;
    flowers.receiveShadow = true;
    this.group.add(flowers);
    this.disposables.push(geo, mat);
  }

  private createGrassTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas 2d");

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, COLORS.grassA);
    grad.addColorStop(1, COLORS.grassB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(61, 117, 34, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 2 + Math.random() * 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 3, y - len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(10, 10);
    tex.anisotropy = 4;
    return tex;
  }

  update(): void {
    // Monde statique (la planète ne tourne pas)
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.group.clear();
  }
}
