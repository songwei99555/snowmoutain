import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { ValleyTerrain } from './terrain.js';
import { VegetationSystem } from './vegetation.js';
import { SnowSystem } from './snow.js';
import { SkyAndAtmosphere } from './sky.js';
import { BlizzardAudio } from './audio.js';
import { CinematicController } from './cinematic.js';

class SnowValleyApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    // Stats
    this.fpsCount = 0;
    this.fpsTimer = 0;
    this.fpsDisplay = document.getElementById('fps-val');
    this.particlesDisplay = document.getElementById('particles-val');

    this.initScene();
    this.initWorld();
    this.initUI();
    this.initEvents();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    // Hide loader
    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 700);
      }
    }, 400);
  }

  initScene() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      1,
      2500
    );
    this.camera.position.set(240, 140, 280);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03; // Don't allow camera below horizon
    this.controls.minDistance = 15;
    this.controls.maxDistance = 850;
    this.controls.target.set(0, 20, 0);
  }

  initWorld() {
    // Atmosphere & Sky
    this.atmosphere = new SkyAndAtmosphere(this.scene, this.renderer);

    // Terrain & Frozen River
    this.terrain = new ValleyTerrain();
    this.scene.add(this.terrain.group);

    // Vegetation (Pine Trees & Snowy Boulders)
    this.vegetation = new VegetationSystem(this.terrain, 2200);
    this.scene.add(this.vegetation.group);

    // Snow System
    this.snow = new SnowSystem(this.scene, this.terrain, {
      flakeCount: 18000,
      mistCount: 4000
    });

    // Audio
    this.audio = new BlizzardAudio();

    // Cinematic Controller
    this.cinematic = new CinematicController(this.camera, this.controls, this.terrain);

    if (this.particlesDisplay) {
      this.particlesDisplay.textContent = (18000 + 4000).toLocaleString();
    }
  }

  initUI() {
    // Snow intensity buttons
    const snowButtons = document.querySelectorAll('[data-snow]');
    snowButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        snowButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const level = parseInt(btn.dataset.snow, 10);
        this.snow.setBlizzardLevel(level);
        this.audio.setIntensity(level);
      });
    });

    // Atmosphere theme buttons
    const themeButtons = document.querySelectorAll('[data-theme]');
    themeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        themeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.atmosphere.applyTheme(btn.dataset.theme);
      });
    });

    // Preset view buttons
    const viewButtons = document.querySelectorAll('[data-view]');
    viewButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        viewButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.cinematic.setPreset(btn.dataset.view);
      });
    });

    // Fly-through toggle
    const cinematicBtn = document.getElementById('btn-cinematic');
    if (cinematicBtn) {
      cinematicBtn.addEventListener('click', () => {
        const isRunning = this.cinematic.toggleCinematic();
        cinematicBtn.classList.toggle('active', isRunning);
        cinematicBtn.querySelector('.btn-label').textContent = isRunning ? '暂停漫游' : '电影运镜漫游';
      });
    }

    // Sound toggle
    const audioBtn = document.getElementById('btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isPlaying = this.audio.toggle();
        audioBtn.classList.toggle('active', isPlaying);
        audioBtn.querySelector('.audio-status').textContent = isPlaying ? '开启中' : '静音';
      });
    }

    // Wind speed slider
    const windSpeedSlider = document.getElementById('slider-wind-speed');
    const windDirSlider = document.getElementById('slider-wind-dir');

    const updateWind = () => {
      const speed = parseFloat(windSpeedSlider.value);
      const angle = (parseFloat(windDirSlider.value) * Math.PI) / 180;
      const wx = Math.cos(angle) * speed;
      const wz = Math.sin(angle) * speed;
      this.snow.setWind(wx, wz);
    };

    if (windSpeedSlider) windSpeedSlider.addEventListener('input', updateWind);
    if (windDirSlider) windDirSlider.addEventListener('input', updateWind);

    // Panel collapse toggle
    const togglePanelBtn = document.getElementById('btn-toggle-panel');
    const controlPanel = document.getElementById('control-panel');
    if (togglePanelBtn && controlPanel) {
      togglePanelBtn.addEventListener('click', () => {
        controlPanel.classList.toggle('collapsed');
      });
    }
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // Prevent camera from clipping through mountain terrain
    if (!this.cinematic.isCinematic) {
      const minCamHeight = this.terrain.getHeight(this.camera.position.x, this.camera.position.z) + 3.0;
      if (this.camera.position.y < minCamHeight) {
        this.camera.position.y = minCamHeight;
      }
    }

    // Update systems
    this.cinematic.update(delta);
    if (!this.cinematic.isCinematic && !this.cinematic.isTransitioning) {
      this.controls.update();
    }

    this.snow.update(delta, time, this.camera.position);
    this.atmosphere.update(delta, time);

    // Render
    this.renderer.render(this.scene, this.camera);

    // FPS Meter
    this.fpsCount++;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      const currentFps = Math.round(this.fpsCount / this.fpsTimer);
      if (this.fpsDisplay) this.fpsDisplay.textContent = currentFps;
      this.fpsCount = 0;
      this.fpsTimer = 0;
    }
  }
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SnowValleyApp();
});
