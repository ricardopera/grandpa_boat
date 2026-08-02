import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

const KEY_MAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyQ: 'rollLeft',
  KeyE: 'rollRight',
};

/** Teclado + analógico de toque, resumidos em acelerador e leme. */
export class Input {
  constructor() {
    this.keys = new Set();
    // Eixos do analógico: x = leme, y = acelerador (positivo é para trás).
    this.axisX = 0;
    this.axisY = 0;
    this.throttle = 0;
    this.steer = 0;
    this.listeners = {};

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      const action = KEY_MAP[event.code];
      if (action) {
        this.keys.add(action);
        event.preventDefault();
      }
      this.emit('key', event.code);
    });

    window.addEventListener('keyup', (event) => {
      const action = KEY_MAP[event.code];
      if (action) this.keys.delete(action);
    });

    window.addEventListener('blur', () => this.keys.clear());
  }

  on(event, callback) {
    (this.listeners[event] ||= []).push(callback);
  }

  emit(event, payload) {
    for (const callback of this.listeners[event] ?? []) callback(payload);
  }

  setAxis(x, y) {
    this.axisX = x;
    this.axisY = y;
  }

  active(action) {
    return this.keys.has(action);
  }

  /** Direção horizontal pedida: teclado e analógico somam, com limite em 1. */
  moveX() {
    const keys = (this.active('right') ? 1 : 0) - (this.active('left') ? 1 : 0);
    return THREE.MathUtils.clamp(keys + this.axisX, -1, 1);
  }

  /** Positivo é para trás (tecla S / analógico puxado para baixo). */
  moveY() {
    const keys = (this.active('down') ? 1 : 0) - (this.active('up') ? 1 : 0);
    return THREE.MathUtils.clamp(keys + this.axisY, -1, 1);
  }

  update(dt) {
    const targetThrottle = -this.moveY();
    const targetSteer = this.moveX();
    const rate = Math.min(1, dt * 8);
    this.throttle += (targetThrottle - this.throttle) * rate;
    this.steer += (targetSteer - this.steer) * rate;
  }
}

/**
 * Duas formas de olhar o arquipélago: seguindo o barco ou sobrevoando o cenário
 * livremente. As duas usam o mesmo OrbitControls, mudando só o alvo.
 */
export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 320;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.minPolarAngle = 0.12;
    this.controls.screenSpacePanning = false;

    this.dragging = false;
    this.controls.addEventListener('start', () => {
      this.dragging = true;
    });
    this.controls.addEventListener('end', () => {
      this.dragging = false;
      this.idleTimer = 1.6;
    });

    this.idleTimer = 0;
    this.mode = 'boat';
    this.target = new THREE.Vector3();
    this.panSpeed = 42;
  }

  setMode(mode, boat) {
    this.mode = mode;
    this.controls.enablePan = mode === 'free';
    if (mode === 'boat' && boat) {
      this.snapBehind(boat, 22, 8.5);
    } else if (mode === 'free') {
      this.controls.target.set(0, 0, -10);
      this.camera.position.set(0, 120, 195);
    }
    this.controls.update();
  }

  snapBehind(boat, distance = 22, height = 8.5) {
    const behind = new THREE.Vector3(
      Math.sin(boat.heading + Math.PI),
      0,
      Math.cos(boat.heading + Math.PI)
    );
    this.target.copy(boat.position).setY(1.6);
    this.controls.target.copy(this.target);
    this.camera.position
      .copy(this.target)
      .addScaledVector(behind, distance)
      .add(new THREE.Vector3(0, height, 0));
  }

  update(dt, boat, input) {
    if (this.mode === 'boat') {
      // O alvo persegue o barco com uma folga, para o movimento não ficar duro.
      this.target.lerp(
        new THREE.Vector3(boat.position.x, 1.6, boat.position.z),
        Math.min(1, dt * 5)
      );
      const delta = this.target.clone().sub(this.controls.target);
      this.controls.target.add(delta);
      this.camera.position.add(delta);

      this.idleTimer = Math.max(0, this.idleTimer - dt);
      const speed = Math.abs(boat.speed);
      if (!this.dragging && this.idleTimer <= 0 && speed > 1.5) {
        // Volta devagar para trás do barco, girando só na horizontal: a altura
        // e a distância escolhidas pelo jogador são preservadas.
        const offset = this.camera.position.clone().sub(this.controls.target);
        const radius = Math.hypot(offset.x, offset.z);
        const current = Math.atan2(offset.x, offset.z);
        const desired = boat.heading + Math.PI;
        let delta = ((desired - current + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (delta < -Math.PI) delta += Math.PI * 2;
        const angle = current + delta * Math.min(1, dt * 0.9 * Math.min(1, speed / 6));
        this.camera.position.set(
          this.controls.target.x + Math.sin(angle) * radius,
          this.camera.position.y,
          this.controls.target.z + Math.cos(angle) * radius
        );
      }
    } else {
      // No modo câmera, o teclado ou o analógico deslizam a vista sobre o mar.
      const move = new THREE.Vector3(input.moveX(), 0, input.moveY());
      if (move.lengthSq() > 0) {
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
        // clampLength em vez de normalize: o analógico continua proporcional.
        const step = new THREE.Vector3()
          .addScaledVector(right, move.x)
          .addScaledVector(forward, -move.z)
          .clampLength(0, 1)
          .multiplyScalar(this.panSpeed * dt);
        this.camera.position.add(step);
        this.controls.target.add(step);
      }
    }

    this.controls.update();
  }
}
