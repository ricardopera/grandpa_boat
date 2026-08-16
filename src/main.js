import * as THREE from 'three';
import {
  createWater,
  createSky,
  createSun,
  createClouds,
  updateClouds,
  createSeagulls,
  updateSeagulls,
  createLights,
  applyDaylight,
} from './world.js';
import { Boat } from './boat.js';
import { Game, MISSIONS } from './game.js';
import { Input, CameraRig } from './controls.js';
import { Hud } from './hud.js';
import { Sound } from './audio.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3e4);
scene.fog = new THREE.Fog(0xb6e2f2, 360, 720);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 1400);
camera.position.set(0, 16, 40);

const lights = createLights();
scene.add(lights);
const sky = createSky();
scene.add(sky);

const water = createWater();
scene.add(water);

const sun = createSun();
scene.add(sun);

const clouds = createClouds(16);
scene.add(clouds);

const seagulls = createSeagulls(5);
scene.add(seagulls);

const boat = new Boat(scene);
boat.group.position.set(0, 0, 58);
boat.heading = Math.PI;

const hud = new Hud();
const sound = new Sound();
const input = new Input();
const rig = new CameraRig(camera, renderer.domElement);

// Tudo o que muda de cor quando o sol começa a se pôr, na terceira missão.
const world = { sky, water, sun, lights };

let game = new Game(scene, boat, hud, sound, world);

function setMode(mode) {
  rig.setMode(mode, boat);
  hud.setMode(mode);
  // A dica muda conforme o jogador esteja no teclado ou no analógico.
  const dicas = {
    boat: hud.touch
      ? 'Modo barco: arraste o analógico para navegar.'
      : 'Modo barco: W/S aceleram, A/D viram o leme.',
    free: hud.touch
      ? 'Modo câmera: arraste a tela para girar e o analógico para deslizar.'
      : 'Modo câmera: arraste para girar, role para aproximar, WASD desliza.',
  };
  hud.toast(dicas[mode], 3.5);
}

function resetGame() {
  game.mission?.cleanup();
  for (const island of game.islands) scene.remove(island);
  for (const character of game.characters) character.parent?.remove(character);
  boat.group.position.set(0, 0, 58);
  boat.heading = Math.PI;
  boat.speed = 0;
  applyDaylight(0, { scene, ...world });
  game = new Game(scene, boat, hud, sound, world);
  setMode('boat');
}

hud.bindHelp();
hud.bindFullscreen();
hud.bindJoystick(input);
hud.setMode('boat');
hud.onModeToggle(() => setMode(rig.mode === 'boat' ? 'free' : 'boat'));
hud.onSoundToggle((enabled) => sound.setEnabled(enabled));
hud.onStart(() => {
  sound.ensure();
  setMode('boat');
});
hud.onNextMission(() => game.nextMission());
hud.buildMissionPicker(MISSIONS, (index) => {
  sound.ensure();
  game.startMission(index);
  setMode('boat');
});
// O jogo já tinha montado o painel antes de o seletor existir: sem esta linha,
// a missão em curso só ficaria destacada depois da primeira troca.
game.updateHud();
hud.onRestart(() => resetGame());

input.on('key', (code) => {
  if (code === 'KeyC') {
    setMode(rig.mode === 'boat' ? 'free' : 'boat');
  }
  if (code === 'KeyH') {
    sound.horn();
    boat.ringBell();
  }
  if (code === 'KeyR') {
    rig.snapBehind(boat);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

rig.setMode('boat', boat);

// Acesso ao estado do jogo pelo console do navegador (útil para depurar e testar).
window.baia = {
  get game() {
    return game;
  },
  // Tempo simulado desde o início: medir movimento por segundo de parede não
  // funciona em navegador headless, onde o laço roda a poucos quadros.
  get elapsed() {
    return elapsed;
  },
  boat,
  camera,
  rig,
  scene,
  world,
};

const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  input.update(dt);
  const driving = rig.mode === 'boat';
  boat.update(dt, driving ? input : { throttle: 0, steer: 0 }, elapsed, game.islands);
  rig.update(dt, boat, input);
  game.update(dt, elapsed, camera);

  // Mar, céu e sol acompanham a câmera: o mundo nunca tem fim à vista.
  water.userData.material.uniforms.uTime.value = elapsed;
  water.position.set(camera.position.x, 0, camera.position.z);
  sky.position.set(camera.position.x, 0, camera.position.z);
  sun.position.set(camera.position.x + 60, 150, camera.position.z - 340);
  sun.lookAt(camera.position);
  sun.userData.rays.rotation.z = elapsed * 0.15;
  updateClouds(clouds, dt);
  updateSeagulls(seagulls, elapsed);

  hud.update(dt);
  hud.drawMinimap(game.islands, boat, game.home, game.markers());

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
