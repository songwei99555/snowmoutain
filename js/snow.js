import * as THREE from 'three';

/**
 * High-performance Dual-layer Snow Particle System
 * Features:
 * - 18,000 fluttering 3D snowflakes
 * - 4,000 swirling blizzard mist particles
 * - Procedural radial glow texture (100% self-contained)
 * - Dynamic wind, turbulence, and seamless volume wrap-around
 */
export class SnowSystem {
  constructor(scene, terrain, options = {}) {
    this.scene = scene;
    this.terrain = terrain;

    this.flakeCount = options.flakeCount || 18000;
    this.mistCount = options.mistCount || 4000;

    // Bounds for snowfall
    this.rangeX = 650;
    this.rangeZ = 650;
    this.minY = -5;
    this.maxY = 220;

    // Wind parameters
    this.wind = new THREE.Vector3(12.0, -1.0, 6.0);
    this.targetWind = new THREE.Vector3(12.0, -1.0, 6.0);
    this.blizzardFactor = 1.0; // 0.4: calm flurries, 1.0: normal snow, 2.5: severe blizzard

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.texture = this.createSnowTexture();
    this.mistTexture = this.createMistTexture();

    this.initFlakes();
    this.initMist();
  }

  /**
   * Procedural snowflake texture with soft luminous core and feathered falloff
   */
  createSnowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.2, 'rgba(245, 250, 255, 0.95)');
    grad.addColorStop(0.5, 'rgba(220, 235, 255, 0.5)');
    grad.addColorStop(0.8, 'rgba(200, 225, 255, 0.15)');
    grad.addColorStop(1, 'rgba(200, 225, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    return texture;
  }

  /**
   * Procedural soft mist smoke texture for ground blizzard dust
   */
  createMistTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(235, 245, 255, 0.35)');
    grad.addColorStop(0.35, 'rgba(215, 230, 245, 0.18)');
    grad.addColorStop(0.7, 'rgba(200, 220, 240, 0.06)');
    grad.addColorStop(1, 'rgba(200, 220, 240, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    return texture;
  }

  initFlakes() {
    const geom = new THREE.BufferGeometry();

    const positions = new Float32Array(this.flakeCount * 3);
    const velocities = new Float32Array(this.flakeCount * 3);
    const extraData = new Float32Array(this.flakeCount * 3); // [swayFreq, swayAmp, phase]

    for (let i = 0; i < this.flakeCount; i++) {
      // Position
      positions[i * 3] = (Math.random() - 0.5) * this.rangeX * 2;
      positions[i * 3 + 1] = Math.random() * (this.maxY - this.minY) + this.minY;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.rangeZ * 2;

      // Base falling speed (m/s)
      const baseFallSpeed = 10.0 + Math.random() * 12.0;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = -baseFallSpeed;
      velocities[i * 3 + 2] = 0;

      // Flake flutter sway parameters
      extraData[i * 3] = 1.2 + Math.random() * 2.8;     // frequency
      extraData[i * 3 + 1] = 0.6 + Math.random() * 1.8; // amplitude
      extraData[i * 3 + 2] = Math.random() * Math.PI * 2; // phase
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.flakeVelocities = velocities;
    this.flakeExtraData = extraData;

    const mat = new THREE.PointsMaterial({
      map: this.texture,
      size: 1.85,
      transparent: true,
      opacity: 0.9,
      blending: THREE.NormalBlending,
      depthWrite: false,
      color: 0xffffff
    });

    this.flakePoints = new THREE.Points(geom, mat);
    this.group.add(this.flakePoints);
  }

  initMist() {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.mistCount * 3);
    const speeds = new Float32Array(this.mistCount);

    for (let i = 0; i < this.mistCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.rangeX * 2.2;
      positions[i * 3 + 1] = 2.0 + Math.random() * 75.0; // Stay near ground / lower slopes
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.rangeZ * 2.2;

      speeds[i] = 18.0 + Math.random() * 25.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mistSpeeds = speeds;

    const mat = new THREE.PointsMaterial({
      map: this.mistTexture,
      size: 26.0,
      transparent: true,
      opacity: 0.22,
      blending: THREE.NormalBlending,
      depthWrite: false,
      color: 0xe8f2fa
    });

    this.mistPoints = new THREE.Points(geom, mat);
    this.group.add(this.mistPoints);
  }

  setBlizzardLevel(level) {
    // 0: Light Flurries, 1: Moderate Snow, 2: Heavy Blizzard
    if (level === 0) {
      this.blizzardFactor = 0.45;
      this.targetWind.set(5.0, -0.5, 2.0);
      this.flakePoints.material.size = 1.4;
      this.flakePoints.material.opacity = 0.75;
      this.mistPoints.material.opacity = 0.08;
    } else if (level === 1) {
      this.blizzardFactor = 1.0;
      this.targetWind.set(14.0, -1.0, 7.0);
      this.flakePoints.material.size = 1.85;
      this.flakePoints.material.opacity = 0.9;
      this.mistPoints.material.opacity = 0.22;
    } else {
      this.blizzardFactor = 2.4;
      this.targetWind.set(38.0, -3.0, 18.0);
      this.flakePoints.material.size = 2.5;
      this.flakePoints.material.opacity = 1.0;
      this.mistPoints.material.opacity = 0.45;
    }
  }

  setWind(x, z) {
    this.targetWind.x = x;
    this.targetWind.z = z;
  }

  update(delta, time, cameraPosition) {
    // Smoothly interpolate wind toward target
    this.wind.lerp(this.targetWind, Math.min(delta * 2.0, 1.0));

    // Dynamic wind gust oscillation
    const gust = 1.0 + Math.sin(time * 0.8) * 0.25 + Math.sin(time * 2.1) * 0.15;
    const currentWindX = this.wind.x * gust;
    const currentWindZ = this.wind.z * gust;

    // Follow camera slightly so snow follows the viewer
    const cx = cameraPosition ? cameraPosition.x * 0.6 : 0;
    const cz = cameraPosition ? cameraPosition.z * 0.6 : 0;

    // 1. Update Snowflakes
    const fPos = this.flakePoints.geometry.attributes.position.array;
    const count = this.flakeCount;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const vy = this.flakeVelocities[idx + 1] * (0.8 + this.blizzardFactor * 0.4);
      const freq = this.flakeExtraData[idx];
      const amp = this.flakeExtraData[idx + 1];
      const phase = this.flakeExtraData[idx + 2];

      // Vertical falling
      fPos[idx + 1] += vy * delta;

      // Horizontal flutter + wind
      const sway = Math.sin(time * freq + phase) * amp;
      fPos[idx] += (currentWindX + sway * 8.0) * delta;
      fPos[idx + 2] += (currentWindZ + Math.cos(time * freq + phase) * amp * 5.0) * delta;

      // Boundary wrap around
      const halfX = this.rangeX;
      const halfZ = this.rangeZ;

      if (fPos[idx + 1] < this.minY) {
        fPos[idx + 1] = this.maxY;
        fPos[idx] = cx + (Math.random() - 0.5) * halfX * 2 - currentWindX * 3.0;
        fPos[idx + 2] = cz + (Math.random() - 0.5) * halfZ * 2 - currentWindZ * 3.0;
      }

      if (fPos[idx] > cx + halfX) fPos[idx] -= halfX * 2;
      else if (fPos[idx] < cx - halfX) fPos[idx] += halfX * 2;

      if (fPos[idx + 2] > cz + halfZ) fPos[idx + 2] -= halfZ * 2;
      else if (fPos[idx + 2] < cz - halfZ) fPos[idx + 2] += halfZ * 2;
    }

    this.flakePoints.geometry.attributes.position.needsUpdate = true;

    // 2. Update Ground Snow Mist
    const mPos = this.mistPoints.geometry.attributes.position.array;
    const mCount = this.mistCount;

    for (let i = 0; i < mCount; i++) {
      const idx = i * 3;
      const speed = this.mistSpeeds[i] * (0.8 + this.blizzardFactor * 0.6);

      mPos[idx] += (currentWindX * 1.5 + Math.sin(time + i) * 3.0) * delta;
      mPos[idx + 2] += (currentWindZ * 1.5 + Math.cos(time + i) * 3.0) * delta;
      mPos[idx + 1] += Math.sin(time * 0.5 + i) * 0.8 * delta;

      const halfX = this.rangeX * 1.1;
      const halfZ = this.rangeZ * 1.1;

      if (mPos[idx] > cx + halfX) mPos[idx] -= halfX * 2;
      else if (mPos[idx] < cx - halfX) mPos[idx] += halfX * 2;

      if (mPos[idx + 2] > cz + halfZ) mPos[idx + 2] -= halfZ * 2;
      else if (mPos[idx + 2] < cz - halfZ) mPos[idx + 2] += halfZ * 2;
    }

    this.mistPoints.geometry.attributes.position.needsUpdate = true;
  }
}
