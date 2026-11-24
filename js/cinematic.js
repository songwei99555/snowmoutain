import * as THREE from 'three';

/**
 * Cinematic Camera Paths and Smooth Preset Transitions
 */
export class CinematicController {
  constructor(camera, controls, terrain) {
    this.camera = camera;
    this.controls = controls;
    this.terrain = terrain;

    this.isCinematic = false;
    this.pathProgress = 0;
    this.flySpeed = 0.018;

    // Transition state
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 1.6;
    this.startPos = new THREE.Vector3();
    this.startTarget = new THREE.Vector3();
    this.endPos = new THREE.Vector3();
    this.endTarget = new THREE.Vector3();

    // Define 3D Fly-through Path winding through the snowy canyon
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 48, -480),
      new THREE.Vector3(70, 36, -260),
      new THREE.Vector3(-45, 24, -60),
      new THREE.Vector3(30, 28, 140),
      new THREE.Vector3(-60, 42, 350),
      new THREE.Vector3(120, 85, 460),
      new THREE.Vector3(220, 140, 220),
      new THREE.Vector3(160, 110, -180),
      new THREE.Vector3(0, 75, -420)
    ]);
    this.curve.closed = true;

    // Presets
    this.presets = {
      panorama: {
        pos: new THREE.Vector3(260, 160, 320),
        target: new THREE.Vector3(0, 25, 0)
      },
      canyon: {
        pos: new THREE.Vector3(15, 12, -220),
        target: new THREE.Vector3(5, 14, -50)
      },
      forest: {
        pos: new THREE.Vector3(-140, 52, 60),
        target: new THREE.Vector3(-40, 20, 20)
      },
      peak: {
        pos: new THREE.Vector3(-280, 210, -260),
        target: new THREE.Vector3(20, 30, 80)
      }
    };
  }

  setPreset(name) {
    const preset = this.presets[name];
    if (!preset) return;

    this.isCinematic = false;
    this.startTransition(preset.pos, preset.target);
  }

  toggleCinematic() {
    this.isCinematic = !this.isCinematic;
    if (this.isCinematic) {
      this.controls.enabled = false;
    } else {
      this.controls.enabled = true;
    }
    return this.isCinematic;
  }

  startTransition(targetPos, targetLookAt) {
    this.isTransitioning = true;
    this.transitionProgress = 0;
    this.startPos.copy(this.camera.position);
    this.startTarget.copy(this.controls.target);
    this.endPos.copy(targetPos);
    this.endTarget.copy(targetLookAt);
  }

  update(delta) {
    // 1. Camera Fly-through along curve
    if (this.isCinematic) {
      this.pathProgress = (this.pathProgress + this.flySpeed * delta) % 1.0;

      const currentPoint = this.curve.getPointAt(this.pathProgress);
      const lookAtPoint = this.curve.getPointAt((this.pathProgress + 0.04) % 1.0);

      // Adjust height to stay comfortably above terrain
      const terrainY = this.terrain.getHeight(currentPoint.x, currentPoint.z);
      currentPoint.y = Math.max(currentPoint.y, terrainY + 12);

      this.camera.position.lerp(currentPoint, Math.min(delta * 4.0, 1.0));
      this.controls.target.lerp(lookAtPoint, Math.min(delta * 4.0, 1.0));
      this.camera.lookAt(this.controls.target);
      return;
    }

    // 2. Smooth preset transition animation
    if (this.isTransitioning) {
      this.transitionProgress += delta / this.transitionDuration;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.isTransitioning = false;
      }

      // Smooth step easing
      const t = this.transitionProgress;
      const ease = t * t * (3 - 2 * t);

      this.camera.position.lerpVectors(this.startPos, this.endPos, ease);
      this.controls.target.lerpVectors(this.startTarget, this.endTarget, ease);
      this.controls.update();
    }
  }
}
