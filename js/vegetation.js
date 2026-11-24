import * as THREE from 'three';
import { noise } from './simplex.js';

/**
 * Procedural Vegetation: Thousands of Snowy Pine Trees & Mountain Boulders
 * Rendered using InstancedMesh for maximum 60fps performance.
 */
export class VegetationSystem {
  constructor(terrain, count = 2200) {
    this.terrain = terrain;
    this.treeCount = count;
    this.boulderCount = 350;

    this.group = new THREE.Group();

    this.initTrees();
    this.initBoulders();
  }

  initTrees() {
    // Pine Foliage Geometry (3 tiered cones)
    const foliageGeometries = [];
    const snowCapGeometries = [];

    const tierCount = 3;
    const baseRadius = 2.4;
    const tierHeight = 3.6;

    for (let t = 0; t < tierCount; t++) {
      const radius = baseRadius * (1 - t * 0.22);
      const height = tierHeight * (1 - t * 0.15);
      const yOffset = 2.0 + t * 2.2;

      // Dark evergreen pine branches
      const cone = new THREE.ConeGeometry(radius, height, 7);
      cone.translate(0, yOffset, 0);
      foliageGeometries.push(cone);

      // Heavy snow caps perched on top of each tier
      const snowCone = new THREE.ConeGeometry(radius * 0.95, height * 0.52, 7);
      snowCone.translate(0, yOffset + height * 0.25, 0);
      snowCapGeometries.push(snowCone);
    }

    // Merge foliage cones
    const mergedFoliageGeom = this.mergeGeometries(foliageGeometries);
    const mergedSnowGeom = this.mergeGeometries(snowCapGeometries);

    // Trunk Geometry
    const trunkGeom = new THREE.CylinderGeometry(0.35, 0.55, 3.2, 6);
    trunkGeom.translate(0, 1.6, 0);

    // Materials
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b382b, // Deep alpine evergreen pine green
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true
    });

    const snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5faff, // Fluffy fresh white snow
      roughness: 0.75,
      metalness: 0.05,
      flatShading: true
    });

    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d271d, // Dark woody bark
      roughness: 0.9,
      metalness: 0.05
    });

    this.foliageMesh = new THREE.InstancedMesh(mergedFoliageGeom, foliageMaterial, this.treeCount);
    this.snowMesh = new THREE.InstancedMesh(mergedSnowGeom, snowMaterial, this.treeCount);
    this.trunkMesh = new THREE.InstancedMesh(trunkGeom, trunkMaterial, this.treeCount);

    this.foliageMesh.castShadow = true;
    this.foliageMesh.receiveShadow = true;
    this.snowMesh.castShadow = true;
    this.snowMesh.receiveShadow = true;
    this.trunkMesh.castShadow = true;
    this.trunkMesh.receiveShadow = true;

    // Distribute trees naturally along the valley floor and mid slopes
    const dummy = new THREE.Object3D();
    let placed = 0;
    const maxAttempts = this.treeCount * 4;
    let attempts = 0;

    const halfW = (this.terrain.width / 2) * 0.85;
    const halfL = (this.terrain.length / 2) * 0.85;

    while (placed < this.treeCount && attempts < maxAttempts) {
      attempts++;

      const x = (Math.random() - 0.5) * halfW * 2;
      const z = (Math.random() - 0.5) * halfL * 2;

      const center = this.terrain.getValleyCenterX(z);
      const dist = Math.abs(x - center);

      // Avoid riverbed (too low/wet) and high rocky crags
      if (dist < 26) continue;

      const y = this.terrain.getHeight(x, z);
      // Trees thrive between valley banks and tree-line
      if (y < 2.0 || y > 72) continue;

      // Estimate slope
      const delta = 1.5;
      const hRight = this.terrain.getHeight(x + delta, z);
      const hLeft = this.terrain.getHeight(x - delta, z);
      const hDown = this.terrain.getHeight(x, z + delta);
      const hUp = this.terrain.getHeight(x, z - delta);
      const slope = Math.hypot((hRight - hLeft) / (2 * delta), (hDown - hUp) / (2 * delta));

      // Don't grow on steep sheer rock faces
      if (slope > 0.85) continue;

      // Use noise for natural clustering (groves)
      const groveNoise = noise.noise2D(x * 0.015, z * 0.015);
      if (groveNoise < -0.15) continue;

      // Scale variation
      const scale = 0.75 + Math.random() * 0.7;
      dummy.position.set(x, y - 0.2, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      // Slight tilt on hillside
      dummy.rotation.x = (Math.random() - 0.5) * 0.15;
      dummy.rotation.z = (Math.random() - 0.5) * 0.15;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      this.foliageMesh.setMatrixAt(placed, dummy.matrix);
      this.snowMesh.setMatrixAt(placed, dummy.matrix);
      this.trunkMesh.setMatrixAt(placed, dummy.matrix);

      placed++;
    }

    this.foliageMesh.count = placed;
    this.snowMesh.count = placed;
    this.trunkMesh.count = placed;

    this.foliageMesh.instanceMatrix.needsUpdate = true;
    this.snowMesh.instanceMatrix.needsUpdate = true;
    this.trunkMesh.instanceMatrix.needsUpdate = true;

    this.group.add(this.foliageMesh);
    this.group.add(this.snowMesh);
    this.group.add(this.trunkMesh);
  }

  initBoulders() {
    // Snowy Boulders scattered on the valley floor & base of cliffs
    const boulderGeom = new THREE.DodecahedronGeometry(1.5, 1);
    
    // Add snow color gradient to boulders (snow on top, stone on bottom)
    const pos = boulderGeom.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const rockColor = new THREE.Color(0x383e42);
    const snowColor = new THREE.Color(0xf0f6fa);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const ny = pos.getY(i) / 1.5;
      if (ny > 0.15) {
        c.copy(rockColor).lerp(snowColor, Math.min(1, (ny - 0.15) / 0.65));
      } else {
        c.copy(rockColor);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    boulderGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    boulderGeom.computeVertexNormals();

    const boulderMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true
    });

    this.boulderMesh = new THREE.InstancedMesh(boulderGeom, boulderMat, this.boulderCount);
    this.boulderMesh.castShadow = true;
    this.boulderMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const halfW = (this.terrain.width / 2) * 0.8;
    const halfL = (this.terrain.length / 2) * 0.8;
    let placed = 0;

    for (let i = 0; i < this.boulderCount; i++) {
      const x = (Math.random() - 0.5) * halfW * 2;
      const z = (Math.random() - 0.5) * halfL * 2;
      const y = this.terrain.getHeight(x, z);

      if (y > 90) continue;

      const scaleX = 0.8 + Math.random() * 1.6;
      const scaleY = 0.5 + Math.random() * 1.1;
      const scaleZ = 0.8 + Math.random() * 1.6;

      dummy.position.set(x, y + scaleY * 0.45, z);
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();

      this.boulderMesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }

    this.boulderMesh.count = placed;
    this.boulderMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.boulderMesh);
  }

  /**
   * Helper to merge multiple simple BufferGeometries without extra external dependencies
   */
  mergeGeometries(geometries) {
    let totalVertices = 0;
    let totalIndices = 0;

    for (const g of geometries) {
      totalVertices += g.attributes.position.count;
      if (g.index) totalIndices += g.index.count;
    }

    const posArray = new Float32Array(totalVertices * 3);
    const normArray = new Float32Array(totalVertices * 3);
    const indices = totalIndices > 0 ? new (totalVertices > 65535 ? Uint32Array : Uint16Array)(totalIndices) : null;

    let vOffset = 0;
    let iOffset = 0;

    for (const g of geometries) {
      const pos = g.attributes.position;
      const norm = g.attributes.normal;

      posArray.set(pos.array, vOffset * 3);
      normArray.set(norm.array, vOffset * 3);

      if (g.index) {
        for (let j = 0; j < g.index.count; j++) {
          indices[iOffset + j] = g.index.array[j] + vOffset;
        }
        iOffset += g.index.count;
      }

      vOffset += pos.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
    if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));

    return merged;
  }
}
