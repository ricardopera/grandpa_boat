import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { flat, unlit, mesh } from './materials.js';

export const WATER_SIZE = 1600;

/** Altura das ondas — a mesma fórmula roda no shader e aqui, para o barco boiar certo. */
export function waveHeight(x, z, time) {
  return (
    Math.sin(x * 0.09 + time * 0.9) * 0.26 +
    Math.sin(z * 0.13 - time * 1.05) * 0.2 +
    Math.sin((x + z) * 0.05 + time * 0.55) * 0.3
  );
}

const waterVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec2 vLocal;

  float waveHeight(float x, float z, float t) {
    return sin(x * 0.09 + t * 0.9) * 0.26
         + sin(z * 0.13 - t * 1.05) * 0.2
         + sin((x + z) * 0.05 + t * 0.55) * 0.3;
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float h = waveHeight(world.x, world.z, uTime);
    world.y += h;
    vHeight = h;
    vWorldPosition = world.xyz;
    vLocal = position.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const waterFragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uCrest;
  uniform vec3 uHorizon;
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec2 vLocal;

  void main() {
    // Manchas largas e suaves, como as variações de azul pintadas no cenário.
    float blotch = sin(vWorldPosition.x * 0.012 + uTime * 0.05)
                * cos(vWorldPosition.z * 0.015 - uTime * 0.04);
    float mixAmount = smoothstep(-0.6, 0.8, vHeight * 1.05 + blotch * 0.3);
    vec3 color = mix(uDeep, uShallow, mixAmount);

    // Cristas mais claras nas ondas altas.
    float crest = smoothstep(0.40, 0.66, vHeight);
    color = mix(color, uCrest, crest * 0.25);

    // O mar clareia perto do horizonte para encontrar o céu.
    float horizon = smoothstep(170.0, 520.0, length(vLocal));
    color = mix(color, uHorizon, horizon);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createWater() {
  const geometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, 200, 200);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(DAY.waterDeep) },
      uShallow: { value: new THREE.Color(DAY.waterShallow) },
      uCrest: { value: new THREE.Color(DAY.crest) },
      uHorizon: { value: new THREE.Color(DAY.horizon) },
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
  });
  const water = new THREE.Mesh(geometry, material);
  water.renderOrder = -1;
  water.userData.material = material;
  return water;
}

const skyVertexShader = /* glsl */ `
  varying vec3 vPosition;
  void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  varying vec3 vPosition;
  void main() {
    float h = clamp(vPosition.y / 400.0, -1.0, 1.0);
    vec3 color = mix(uBottom, uTop, smoothstep(-0.05, 0.75, h));
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createSky() {
  const geometry = new THREE.SphereGeometry(700, 40, 24);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(DAY.skyTop) },
      uBottom: { value: new THREE.Color(DAY.skyBottom) },
    },
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.renderOrder = -2;
  return sky;
}

/** Sol amarelo com raios em volta, desenhado sempre de frente para a câmera. */
export function createSun() {
  const sun = new THREE.Group();
  // Material próprio (e não o do cache): a cor do sol muda no fim de tarde.
  const material = new THREE.MeshBasicMaterial({ color: PALETTE.sun });
  const disc = mesh(new THREE.CircleGeometry(14, 24), material);
  sun.add(disc);

  const rays = new THREE.Group();
  const rayGeometry = new THREE.CapsuleGeometry(1.1, 5, 3, 6);
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const ray = mesh(
      rayGeometry,
      material,
      Math.cos(angle) * 21,
      Math.sin(angle) * 21,
      0
    );
    ray.rotation.z = angle - Math.PI / 2;
    rays.add(ray);
  }
  sun.add(rays);
  sun.userData.rays = rays;
  sun.userData.material = material;
  sun.position.set(150, 130, -320);
  return sun;
}

/** Nuvens de bolhas brancas que deslizam devagar pelo céu. */
export function createClouds(count = 14, rng = Math.random) {
  const clouds = new THREE.Group();
  const geometry = new THREE.SphereGeometry(1, 10, 8);
  const material = unlit(PALETTE.cloud);

  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = mesh(
        geometry,
        material,
        (p - (puffs - 1) / 2) * 7 + (rng() - 0.5) * 2,
        rng() * 2.2,
        (rng() - 0.5) * 1.5
      );
      const size = 6 + rng() * 4;
      puff.scale.set(size, size * 0.68, size * 0.7);
      cloud.add(puff);
    }
    const angle = rng() * Math.PI * 2;
    const distance = 160 + rng() * 220;
    cloud.position.set(
      Math.cos(angle) * distance,
      130 + rng() * 70,
      Math.sin(angle) * distance
    );
    cloud.userData.speed = 0.7 + rng() * 0.9;
    clouds.add(cloud);
  }
  return clouds;
}

export function updateClouds(clouds, dt) {
  for (const cloud of clouds.children) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 420) cloud.position.x = -420;
  }
}

/** Gaivotas em círculos lentos, para o céu não ficar parado. */
export function createSeagulls(count = 5, rng = Math.random) {
  const flock = new THREE.Group();
  const material = flat(0xffffff);
  const wingGeometry = new THREE.CapsuleGeometry(0.18, 1.5, 2, 6);

  for (let i = 0; i < count; i++) {
    const bird = new THREE.Group();
    bird.add(mesh(new THREE.SphereGeometry(0.4, 8, 6), material));
    for (const sx of [-1, 1]) {
      const wing = mesh(wingGeometry, material, sx * 0.85, 0, 0);
      wing.rotation.z = Math.PI / 2;
      const pivot = new THREE.Group();
      pivot.add(wing);
      bird.add(pivot);
      bird.userData[sx < 0 ? 'leftWing' : 'rightWing'] = pivot;
    }
    bird.userData.radius = 60 + rng() * 90;
    bird.userData.height = 34 + rng() * 26;
    bird.userData.speed = 0.1 + rng() * 0.12;
    bird.userData.phase = rng() * Math.PI * 2;
    bird.userData.center = new THREE.Vector3((rng() - 0.5) * 200, 0, (rng() - 0.5) * 200);
    flock.add(bird);
  }
  return flock;
}

export function updateSeagulls(flock, time) {
  for (const bird of flock.children) {
    const data = bird.userData;
    const angle = time * data.speed + data.phase;
    bird.position.set(
      data.center.x + Math.cos(angle) * data.radius,
      data.height + Math.sin(time * 0.8 + data.phase) * 2.5,
      data.center.z + Math.sin(angle) * data.radius
    );
    bird.rotation.y = -angle + Math.PI / 2;
    const flap = Math.sin(time * 6 + data.phase) * 0.6;
    data.leftWing.rotation.z = flap;
    data.rightWing.rotation.z = -flap;
  }
}

export function createLights() {
  const group = new THREE.Group();
  // Luz forte e difusa: mantém as cores chapadas, com só uma sombra suave.
  const ambient = new THREE.AmbientLight(0xffffff, 1.45);
  group.add(ambient);
  const hemisphere = new THREE.HemisphereLight(0xcdefff, 0x3fa7c4, 0.6);
  group.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xfff6dd, 1.1);
  sun.position.set(60, 120, 40);
  group.add(sun);
  group.userData = { ambient, hemisphere, sun };
  return group;
}

/**
 * As duas horas do dia que o jogo usa: o meio-dia de sempre e o pôr do sol da
 * regata. `applyDaylight` mistura as duas, então dá para virar o dia devagar.
 *
 * Atenção às cores de céu e mar: elas são uniformes de `ShaderMaterial`, que
 * escreve direto no framebuffer sem a conversão de espaço de cor que os outros
 * materiais recebem. Por isso saem na tela mais escuras do que o hexadecimal
 * sugere, e os valores aqui já vêm compensados (mais claros) para cair no tom
 * pretendido. Fundo, névoa e luzes, esses sim, são o que dizem ser.
 */
const DAY = {
  background: 0x8fd3e4,
  fog: 0xb6e2f2,
  skyTop: PALETTE.skyTop,
  skyBottom: PALETTE.skyBottom,
  waterDeep: PALETTE.waterDeep,
  waterShallow: PALETTE.waterShallow,
  crest: 0xe6f4fe,
  horizon: 0xc6e6f4,
  sun: PALETTE.sun,
  ambient: 0xffffff,
  ambientIntensity: 1.45,
  hemiSky: 0xcdefff,
  hemiGround: 0x3fa7c4,
  dir: 0xfff6dd,
  dirIntensity: 1.1,
};

const EVENING = {
  background: 0xf7b477,
  fog: 0xf9c79a,
  skyTop: 0xa3bbe0,
  skyBottom: 0xffdfb1,
  waterDeep: 0x7696b3,
  waterShallow: 0xe0b691,
  crest: 0xffeccf,
  horizon: 0xffd3a4,
  sun: 0xff9a4f,
  ambient: 0xffe3c8,
  ambientIntensity: 1.4,
  hemiSky: 0xffd9b0,
  hemiGround: 0x8f7f9f,
  dir: 0xffc98a,
  dirIntensity: 1.1,
};

const MIX = new THREE.Color();
function lerpInto(target, from, to, t) {
  MIX.setHex(to);
  target.setHex(from).lerp(MIX, t);
}

/**
 * Mistura o dia (t = 0) com o pôr do sol (t = 1) em tudo o que dá cor à cena:
 * fundo, névoa, céu, mar, disco do sol e as três luzes.
 */
export function applyDaylight(t, { scene, sky, water, sun, lights }) {
  const amount = THREE.MathUtils.clamp(t, 0, 1);
  lerpInto(scene.background, DAY.background, EVENING.background, amount);
  if (scene.fog) lerpInto(scene.fog.color, DAY.fog, EVENING.fog, amount);

  lerpInto(sky.material.uniforms.uTop.value, DAY.skyTop, EVENING.skyTop, amount);
  lerpInto(sky.material.uniforms.uBottom.value, DAY.skyBottom, EVENING.skyBottom, amount);

  const uniforms = water.userData.material.uniforms;
  lerpInto(uniforms.uDeep.value, DAY.waterDeep, EVENING.waterDeep, amount);
  lerpInto(uniforms.uShallow.value, DAY.waterShallow, EVENING.waterShallow, amount);
  lerpInto(uniforms.uCrest.value, DAY.crest, EVENING.crest, amount);
  lerpInto(uniforms.uHorizon.value, DAY.horizon, EVENING.horizon, amount);

  lerpInto(sun.userData.material.color, DAY.sun, EVENING.sun, amount);

  const { ambient, hemisphere, sun: dirLight } = lights.userData;
  lerpInto(ambient.color, DAY.ambient, EVENING.ambient, amount);
  ambient.intensity = THREE.MathUtils.lerp(DAY.ambientIntensity, EVENING.ambientIntensity, amount);
  lerpInto(hemisphere.color, DAY.hemiSky, EVENING.hemiSky, amount);
  lerpInto(hemisphere.groundColor, DAY.hemiGround, EVENING.hemiGround, amount);
  lerpInto(dirLight.color, DAY.dir, EVENING.dir, amount);
  dirLight.intensity = THREE.MathUtils.lerp(DAY.dirIntensity, EVENING.dirIntensity, amount);
}
