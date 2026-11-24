import * as THREE from 'three';

/**
 * Procedural Sky Dome, Distant Mountain Silhouette, Fog, and Dynamic Lighting
 * Includes 3 distinct atmospheric presets:
 * 1. 'dawn' (Alpine Dawn - warm sunrise over snowy peaks)
 * 2. 'overcast' (Winter Blizzard - atmospheric storm & deep fog)
 * 3. 'aurora' (Polar Aurora Night - luminescent northern lights and moonlit snow)
 */
export class SkyAndAtmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.currentTheme = 'overcast';

    this.initLighting();
    this.initSkyDome();
    this.initDistantMountains();
    this.initFog();

    this.applyTheme(this.currentTheme, true);
  }

  initLighting() {
    // Hemisphere ambient light (sky bounce + snow reflection)
    this.hemiLight = new THREE.HemisphereLight(0xdbe9f4, 0x8a9ea7, 0.75);
    this.hemiLight.position.set(0, 300, 0);
    this.group.add(this.hemiLight);

    // Directional Sun / Moon Light
    this.dirLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    this.dirLight.position.set(220, 260, 180);
    this.dirLight.castShadow = true;

    // Shadow configuration optimized for large mountain terrain
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 800;
    const d = 360;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;

    this.group.add(this.dirLight);
  }

  initFog() {
    // Exp2 fog for realistic soft atmospheric depth
    this.scene.fog = new THREE.FogExp2(0xd0dce5, 0.0032);
  }

  initSkyDome() {
    const skyGeom = new THREE.SphereGeometry(1400, 32, 24);
    // Invert geometry so faces point inward
    skyGeom.scale(-1, 1, 1);

    // Sky Dome vertex shader & gradient
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 auroraColor;
      uniform float auroraIntensity;
      uniform float time;
      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition).y;
        float factor = max(0.0, min(1.0, h * 1.5));
        vec3 baseSky = mix(horizonColor, topColor, factor);

        // Aurora borealis wave effect for night mode
        if (auroraIntensity > 0.01) {
          float wave = sin(vWorldPosition.x * 0.003 + time * 0.4) * 0.5 + 0.5;
          wave *= cos(vWorldPosition.z * 0.003 - time * 0.3) * 0.5 + 0.5;
          float auroraBand = smoothstep(0.1, 0.55, h) * smoothstep(0.9, 0.45, h);
          baseSky += auroraColor * wave * auroraBand * auroraIntensity;
        }

        gl_FragColor = vec4(baseSky, 1.0);
      }
    `;

    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x758a99) },
      horizonColor: { value: new THREE.Color(0xd2dde6) },
      auroraColor: { value: new THREE.Color(0x00f2fe) },
      auroraIntensity: { value: 0.0 },
      time: { value: 0 }
    };

    const skyMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyDome = new THREE.Mesh(skyGeom, skyMat);
    this.group.add(this.skyDome);
  }

  initDistantMountains() {
    // Ring of majestic high-altitude snowy peak silhouettes along horizon
    const segments = 64;
    const radius = 1100;
    const geom = new THREE.CylinderGeometry(radius, radius, 320, segments, 1, true);
    geom.translate(0, 140, 0);

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 10) {
        // Sculpt jagged peaks
        const theta = Math.atan2(pos.getZ(i), pos.getX(i));
        const mountainHeight =
          Math.sin(theta * 5.0) * 80 +
          Math.sin(theta * 11.0) * 45 +
          Math.cos(theta * 23.0) * 25 +
          Math.sin(theta * 37.0) * 15;
        pos.setY(i, 140 + mountainHeight);
      }
    }
    geom.computeVertexNormals();

    this.distantMat = new THREE.MeshBasicMaterial({
      color: 0x9cb0c0,
      fog: true,
      side: THREE.BackSide
    });

    this.distantPeaks = new THREE.Mesh(geom, this.distantMat);
    this.group.add(this.distantPeaks);
  }

  getThemeData(theme) {
    switch (theme) {
      case 'dawn':
        return {
          skyTop: new THREE.Color(0x2c3e50),
          skyHorizon: new THREE.Color(0xf6cd90), // Golden sunrise glow
          auroraColor: new THREE.Color(0xffaa77),
          auroraIntensity: 0.0,
          fogColor: new THREE.Color(0xecd8c6),
          fogDensity: 0.0028,
          hemiSky: new THREE.Color(0xfae5d3),
          hemiGround: new THREE.Color(0x85929e),
          hemiIntensity: 0.85,
          sunColor: new THREE.Color(0xffeedb),
          sunIntensity: 1.6,
          sunPos: new THREE.Vector3(300, 160, 260),
          peaksColor: new THREE.Color(0xb09e99)
        };

      case 'aurora':
        return {
          skyTop: new THREE.Color(0x060c1c),
          skyHorizon: new THREE.Color(0x102542),
          auroraColor: new THREE.Color(0x1dd1a1), // Northern emerald green
          auroraIntensity: 1.4,
          fogColor: new THREE.Color(0x0b1528),
          fogDensity: 0.0035,
          hemiSky: new THREE.Color(0x243b55),
          hemiGround: new THREE.Color(0x141e30),
          hemiIntensity: 0.45,
          sunColor: new THREE.Color(0xa8c0ff), // Cool moonlight
          sunIntensity: 0.75,
          sunPos: new THREE.Vector3(-180, 280, -220),
          peaksColor: new THREE.Color(0x162438)
        };

      case 'overcast':
      default:
        return {
          skyTop: new THREE.Color(0x576574),
          skyHorizon: new THREE.Color(0xc8d6e5),
          auroraColor: new THREE.Color(0x00d2d3),
          auroraIntensity: 0.0,
          fogColor: new THREE.Color(0xcbd6de),
          fogDensity: 0.0038,
          hemiSky: new THREE.Color(0xdce7f0),
          hemiGround: new THREE.Color(0x8395a7),
          hemiIntensity: 0.8,
          sunColor: new THREE.Color(0xf1f2f6),
          sunIntensity: 1.1,
          sunPos: new THREE.Vector3(150, 290, 120),
          peaksColor: new THREE.Color(0x8395a7)
        };
    }
  }

  applyTheme(theme, immediate = false) {
    this.currentTheme = theme;
    this.targetSettings = this.getThemeData(theme);

    if (immediate) {
      const s = this.targetSettings;
      this.skyUniforms.topColor.value.copy(s.skyTop);
      this.skyUniforms.horizonColor.value.copy(s.skyHorizon);
      this.skyUniforms.auroraColor.value.copy(s.auroraColor);
      this.skyUniforms.auroraIntensity.value = s.auroraIntensity;

      this.scene.fog.color.copy(s.fogColor);
      this.scene.fog.density = s.fogDensity;
      if (this.renderer) this.renderer.setClearColor(s.fogColor);

      this.hemiLight.color.copy(s.hemiSky);
      this.hemiLight.groundColor.copy(s.hemiGround);
      this.hemiLight.intensity = s.hemiIntensity;

      this.dirLight.color.copy(s.sunColor);
      this.dirLight.intensity = s.sunIntensity;
      this.dirLight.position.copy(s.sunPos);

      this.distantMat.color.copy(s.peaksColor);
    }
  }

  update(delta, time) {
    this.skyUniforms.time.value = time;

    // Smooth transition between themes
    if (this.targetSettings) {
      const s = this.targetSettings;
      const lerpSpeed = Math.min(delta * 2.5, 1.0);

      this.skyUniforms.topColor.value.lerp(s.skyTop, lerpSpeed);
      this.skyUniforms.horizonColor.value.lerp(s.skyHorizon, lerpSpeed);
      this.skyUniforms.auroraColor.value.lerp(s.auroraColor, lerpSpeed);
      this.skyUniforms.auroraIntensity.value += (s.auroraIntensity - this.skyUniforms.auroraIntensity.value) * lerpSpeed;

      this.scene.fog.color.lerp(s.fogColor, lerpSpeed);
      this.scene.fog.density += (s.fogDensity - this.scene.fog.density) * lerpSpeed;
      if (this.renderer) this.renderer.setClearColor(this.scene.fog.color);

      this.hemiLight.color.lerp(s.hemiSky, lerpSpeed);
      this.hemiLight.groundColor.lerp(s.hemiGround, lerpSpeed);
      this.hemiLight.intensity += (s.hemiIntensity - this.hemiLight.intensity) * lerpSpeed;

      this.dirLight.color.lerp(s.sunColor, lerpSpeed);
      this.dirLight.intensity += (s.sunIntensity - this.dirLight.intensity) * lerpSpeed;
      this.dirLight.position.lerp(s.sunPos, lerpSpeed);

      this.distantMat.color.lerp(s.peaksColor, lerpSpeed);
    }
  }
}
