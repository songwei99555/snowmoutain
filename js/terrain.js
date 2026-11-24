import * as THREE from 'three';
import { noise } from './simplex.js';

/**
 * Procedural Mountain Valley Terrain with Frozen River
 */
export class ValleyTerrain {
  constructor(options = {}) {
    this.width = options.width || 1200;
    this.length = options.length || 1200;
    this.segments = options.segments || 200;

    this.group = new THREE.Group();
    this.riverGroup = new THREE.Group();
    this.group.add(this.riverGroup);

    this.mesh = null;
    this.riverMesh = null;

    this.init();
  }

  /**
   * Get canyon center X at position Z
   */
  getValleyCenterX(z) {
    return Math.sin(z * 0.0035) * 110 + Math.cos(z * 0.007) * 45;
  }

  /**
   * Compute exact terrain height at (x, z)
   */
  getHeight(x, z) {
    const center = this.getValleyCenterX(z);
    const dist = Math.abs(x - center);

    // Canyon profile: flat bottom valley with steep flanking mountain ridges
    const valleyFactor = Math.min(Math.max((dist - 35) / 280, 0), 1.0);
    const valleyCurve = Math.pow(valleyFactor, 1.8);

    const baseHeight = valleyCurve * 175;

    // Mountain ridges and rock crags
    const ridged = noise.ridgedNoise(x * 0.0028, z * 0.0028, 4);
    const detail = noise.fbm(x * 0.0075, z * 0.0075, 4);
    const micro = noise.noise2D(x * 0.035, z * 0.035) * 1.8;

    // Valley floor riverbed depression
    let riverDip = 0;
    if (dist < 32) {
      riverDip = (1.0 - Math.pow(dist / 32, 2)) * 3.5;
    }

    const mountainLift = valleyCurve * (ridged * 135 + detail * 45);
    const height = baseHeight + mountainLift + micro - riverDip;

    return height;
  }

  init() {
    const geom = new THREE.PlaneGeometry(
      this.width,
      this.length,
      this.segments,
      this.segments
    );
    // Rotate so it lays on X-Z plane
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const vertexCount = pos.count;

    // Apply height
    for (let i = 0; i < vertexCount; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = this.getHeight(vx, vz);
      pos.setY(i, vy);
    }

    geom.computeVertexNormals();

    // Generate procedural vertex colors based on height, slope, and noise
    const colors = new Float32Array(vertexCount * 3);
    const normals = geom.attributes.normal;

    // Color definitions
    const colorSnowFresh = new THREE.Color(0xf6fbff); // Bright powdery snow
    const colorSnowShadow = new THREE.Color(0xcbd9e8); // Cold blue-tinted snow
    const colorRockDark = new THREE.Color(0x2d3436); // Steep slate / granite cliff
    const colorRockWarm = new THREE.Color(0x4b4b4b); // Weathered mountain stone
    const colorValleyMoss = new THREE.Color(0x3d4b3b); // Sub-alpine tundra moss

    const tempColor = new THREE.Color();

    for (let i = 0; i < vertexCount; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      const ny = normals.getY(i); // 1 = flat horizontal, 0 = vertical cliff
      const center = this.getValleyCenterX(vz);
      const dist = Math.abs(vx - center);

      // Noise perturbation for natural cliff boundaries
      const rockNoise = noise.noise2D(vx * 0.04, vz * 0.04) * 0.12;
      const slope = ny + rockNoise;

      if (slope < 0.62) {
        // Steep vertical cliff -> Bare dark mountain rocks
        const cliffMix = (0.62 - slope) / 0.35;
        tempColor.copy(colorRockDark).lerp(colorRockWarm, Math.min(Math.max(cliffMix, 0), 1));
      } else if (slope < 0.74) {
        // Transition zone -> Wind-blown patchy snow over rugged crags
        const t = (slope - 0.62) / (0.74 - 0.62);
        tempColor.copy(colorRockWarm).lerp(colorSnowShadow, t);
      } else {
        // Flat ridge & gentle valley slopes -> Deep pristine snowpack
        const snowT = Math.min(Math.max((vy - 20) / 200, 0), 1);
        tempColor.copy(colorSnowShadow).lerp(colorSnowFresh, snowT * 0.8 + 0.2);

        // Low valley ground subtle tundra undertone
        if (vy < 15 && dist > 25) {
          const tundraFactor = Math.max(0, (15 - vy) / 15) * 0.3;
          tempColor.lerp(colorValleyMoss, tundraFactor);
        }
      }

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Ground Material with realistic snow roughness and soft specular highlight
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.08,
      flatShading: false
    });

    this.mesh = new THREE.Mesh(geom, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);

    // Build the frozen glacial river flowing along the valley center
    this.createFrozenRiver();
  }

  /**
   * Frozen Glacial River with ice sheen and cracks
   */
  createFrozenRiver() {
    const riverSegments = 160;
    const riverGeom = new THREE.PlaneGeometry(42, this.length * 0.96, 12, riverSegments);
    riverGeom.rotateX(-Math.PI / 2);

    const pos = riverGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const center = this.getValleyCenterX(z);
      const originalX = pos.getX(i);

      // Curve river to follow valley center
      pos.setX(i, center + originalX);

      // Set river level just above canyon dip
      const valleyHeight = this.getHeight(center + originalX, z);
      pos.setY(i, Math.min(valleyHeight + 0.35, 1.2));
    }

    riverGeom.computeVertexNormals();

    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x98d5e8, // Translucent glacial cyan
      roughness: 0.15,
      metalness: 0.55,
      transparent: true,
      opacity: 0.88
    });

    this.riverMesh = new THREE.Mesh(riverGeom, riverMat);
    this.riverMesh.receiveShadow = true;
    this.riverGroup.add(this.riverMesh);
  }
}
