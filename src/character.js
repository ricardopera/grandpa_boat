import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { flat, mesh } from './materials.js';

/**
 * Os bichos da Baía Dourada: capivaras (focinho quadrado e orelhinhas redondas),
 * lontras (cabeça achatada, barriga clara e cauda de remo) e tatus (focinho
 * pontudo, orelhas compridas e casco de faixas nas costas).
 */
const SPECIES = {
  capivara: { skin: PALETTE.capySkin, snout: 'blunt', ears: 'round', tail: 'none' },
  lontra: { skin: PALETTE.otterSkin, snout: 'sleek', ears: 'tiny', tail: 'paddle' },
  tatu: { skin: PALETTE.armadilloSkin, snout: 'point', ears: 'long', tail: 'taper' },
};

function createEars(kind, skin) {
  const group = new THREE.Group();
  if (kind === 'round') {
    // Capivara: duas orelhinhas redondas bem no alto da cabeça.
    const geometry = new THREE.SphereGeometry(0.12, 8, 6);
    for (const sx of [-1, 1]) {
      const ear = mesh(geometry, flat(skin), sx * 0.3, 0.34, -0.04);
      ear.scale.set(1, 0.95, 0.55);
      group.add(ear);
      group.add(mesh(new THREE.CircleGeometry(0.06, 8), flat(PALETTE.capySkinDark), sx * 0.3, 0.34, 0.03));
    }
  } else if (kind === 'tiny') {
    // Lontra: orelhas quase coladas, pequenas e laterais.
    const geometry = new THREE.SphereGeometry(0.1, 8, 6);
    for (const sx of [-1, 1]) {
      const ear = mesh(geometry, flat(skin), sx * 0.42, 0.24, -0.02);
      ear.scale.set(0.55, 0.9, 0.7);
      group.add(ear);
    }
  } else {
    // Tatu: orelhas compridas e finas, viradas para fora.
    const geometry = new THREE.SphereGeometry(0.11, 7, 6);
    for (const sx of [-1, 1]) {
      const ear = mesh(geometry, flat(skin), sx * 0.26, 0.56, -0.04);
      ear.scale.set(0.6, 2.6, 0.45);
      ear.rotation.z = sx * 0.22;
      group.add(ear);
    }
  }
  return group;
}

function createSnout(kind, skin) {
  const group = new THREE.Group();
  if (kind === 'blunt') {
    // Focinho quadradão da capivara, com o lábio mais claro e dois pontinhos.
    const muzzle = mesh(new THREE.BoxGeometry(0.34, 0.24, 0.28), flat(skin), 0, -0.02, 0.42);
    group.add(muzzle);
    group.add(mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), flat(PALETTE.capySkinDark), 0, 0.05, 0.57));
    for (const sx of [-1, 1]) {
      group.add(mesh(new THREE.CircleGeometry(0.032, 6), flat(PALETTE.eyeBlack), sx * 0.08, 0.06, 0.575));
    }
  } else if (kind === 'sleek') {
    // Lontra: focinho curto e arredondado, com narizinho escuro.
    const muzzle = mesh(new THREE.SphereGeometry(0.2, 10, 8), flat(PALETTE.otterBelly), 0, -0.04, 0.38);
    muzzle.scale.set(1.15, 0.85, 0.9);
    group.add(muzzle);
    group.add(mesh(new THREE.SphereGeometry(0.075, 8, 6), flat(PALETTE.eyeBlack), 0, 0.03, 0.52));
    // Bigodes: três fios finos de cada lado.
    const whisker = new THREE.CylinderGeometry(0.008, 0.008, 0.26, 4);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const fio = mesh(whisker, flat(0x4a4a52), sx * 0.22, -0.04 + i * 0.055, 0.44);
        fio.rotation.z = Math.PI / 2 + sx * (0.1 - i * 0.12);
        group.add(fio);
      }
    }
  } else {
    // Tatu: focinho cônico, comprido e fininho.
    const cone = mesh(new THREE.ConeGeometry(0.15, 0.42, 10), flat(skin), 0, -0.04, 0.5);
    cone.rotation.x = Math.PI / 2;
    group.add(cone);
    group.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), flat(PALETTE.eyeBlack), 0, -0.04, 0.71));
  }
  return group;
}

function createTail(kind, skin) {
  if (kind === 'paddle') {
    // Cauda achatada da lontra, saindo para trás e para baixo.
    const tail = mesh(new THREE.SphereGeometry(0.2, 10, 8), flat(skin));
    tail.scale.set(0.55, 0.3, 1.5);
    tail.rotation.x = 0.5;
    return tail;
  }
  if (kind === 'taper') {
    const tail = mesh(new THREE.ConeGeometry(0.09, 0.7, 8), flat(PALETTE.armadilloShell));
    tail.rotation.x = -Math.PI / 2 + 0.5;
    return tail;
  }
  return null;
}

/** Casco de faixas do tatu, encaixado sobre as costas. */
function createShell(radius, height) {
  const group = new THREE.Group();
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const band = mesh(
      new THREE.SphereGeometry(radius * (1.04 - t * 0.06), 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      flat(i % 2 ? PALETTE.armadilloShell : 0x8a745a),
      0,
      -height * 0.28 + t * height * 0.5,
      -radius * 0.12
    );
    band.scale.set(1, 0.42, 0.92);
    group.add(band);
  }
  return group;
}

function createHat(kind, color) {
  const group = new THREE.Group();
  if (kind === 'captain') {
    group.add(mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.22, 14), flat(color ?? 0x2f6f8f), 0, 0.62, 0));
    const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), flat(color ?? 0x2f6f8f), 0, 0.52, 0.06);
    group.add(brim);
    group.add(mesh(new THREE.CircleGeometry(0.07, 8), flat(PALETTE.gold), 0, 0.64, 0.31));
  } else if (kind === 'cap') {
    group.add(mesh(new THREE.SphereGeometry(0.33, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), flat(color ?? 0xe2603f), 0, 0.4, 0));
    const visor = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14, 1, false, 0, Math.PI), flat(color ?? 0xe2603f), 0, 0.4, 0.12);
    visor.rotation.y = -Math.PI / 2;
    group.add(visor);
  } else if (kind === 'sun') {
    group.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.2, 14), flat(color ?? 0xfdf3e0), 0, 0.56, 0));
    group.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.045, 18), flat(color ?? 0xfdf3e0), 0, 0.47, 0));
    const band = mesh(new THREE.CylinderGeometry(0.295, 0.305, 0.07, 14), flat(0x2fa58f), 0, 0.5, 0);
    group.add(band);
  } else if (kind === 'beanie') {
    group.add(mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), flat(color ?? 0x2f9b9b), 0, 0.44, 0));
    group.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 14), flat(color ?? 0x2f9b9b), 0, 0.44, 0));
    group.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), flat(color ?? 0x2f9b9b), 0, 0.78, 0));
  } else if (kind === 'bandana') {
    // Lenço de marinheiro amarrado na cabeça, com as pontas para trás.
    const pano = mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), flat(color ?? 0xe2603f), 0, 0.3, 0);
    pano.scale.set(1, 0.7, 1);
    group.add(pano);
    for (const sx of [-1, 1]) {
      const ponta = mesh(new THREE.ConeGeometry(0.09, 0.3, 6), flat(color ?? 0xe2603f), sx * 0.14, 0.28, -0.32);
      ponta.rotation.x = -1.9;
      group.add(ponta);
    }
  }
  return group;
}

function createGlasses() {
  const group = new THREE.Group();
  const ring = new THREE.TorusGeometry(0.14, 0.025, 6, 14);
  const material = flat(0x3a3a44);
  for (const sx of [-1, 1]) {
    group.add(mesh(ring, material, sx * 0.19, 0.19, 0.4));
  }
  const bridge = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 5), material, 0, 0.19, 0.4);
  bridge.rotation.z = Math.PI / 2;
  group.add(bridge);
  return group;
}

function createBeard() {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.13, 8, 6);
  const material = flat(0xfdf6ee);
  const blobs = [
    [0, -0.16, 0.38, 1.2],
    [-0.2, -0.06, 0.34, 0.9],
    [0.2, -0.06, 0.34, 0.9],
    [-0.13, -0.3, 0.3, 0.8],
    [0.13, -0.3, 0.3, 0.8],
  ];
  for (const [x, y, z, s] of blobs) {
    const blob = mesh(geometry, material, x, y, z);
    blob.scale.setScalar(s);
    group.add(blob);
  }
  return group;
}

/**
 * Personagem chapado do jogo: cabeça grande, corpo em bolha colorida, bracinhos
 * finos e sapatos. O personagem olha para +Z.
 */
export function createCharacter(options = {}) {
  const {
    species = 'capivara',
    skin,
    clothes = 0xe2603f,
    shoes = 0xc44b33,
    scale = 1,
    adult = false,
    hat = null,
    hatColor = null,
    glasses = false,
    beard = false,
    name = '',
  } = options;

  const config = SPECIES[species] ?? SPECIES.capivara;
  const skinColor = skin ?? config.skin;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Proporções de desenho: cabeça grande, corpo curto e pernas curtinhas — mas
  // com braços e pernas para fora da silhueta, senão a bolha do corpo os engole.
  const legHeight = adult ? 0.36 : 0.3;
  const bodyRadius = adult ? 0.6 : 0.42;
  const torsoHeight = adult ? 1.12 : 0.8;
  const torsoY = legHeight + torsoHeight / 2;
  const headRadius = adult ? 0.5 : 0.46;

  const torso = adult
    ? mesh(new THREE.SphereGeometry(bodyRadius, 16, 12), flat(clothes), 0, torsoY, 0)
    : mesh(
        new THREE.CylinderGeometry(bodyRadius * 0.6, bodyRadius, torsoHeight, 16),
        flat(clothes),
        0,
        torsoY,
        0
      );
  if (adult) torso.scale.set(1.04, torsoHeight / (bodyRadius * 2), 0.86);
  body.add(torso);

  // Pernas e sapatos, abaixo do corpo.
  const legGeometry = new THREE.CylinderGeometry(0.08, 0.08, legHeight, 7);
  const shoeGeometry = new THREE.SphereGeometry(0.16, 9, 7);
  for (const sx of [-1, 1]) {
    const legX = sx * bodyRadius * 0.4;
    body.add(mesh(legGeometry, flat(skinColor), legX, legHeight / 2, 0));
    const shoe = mesh(shoeGeometry, flat(shoes), legX, 0.09, 0.06);
    shoe.scale.set(0.85, 0.62, 1.3);
    body.add(shoe);
  }

  // Braços: pivô no ombro, abertos o bastante para aparecerem de qualquer ângulo.
  const armGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 7);
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * bodyRadius * 1.06, torsoY + torsoHeight * 0.2, 0.04);
    const arm = mesh(armGeometry, flat(skinColor), 0, -0.25, 0);
    pivot.add(arm);
    pivot.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), flat(skinColor), 0, -0.5, 0));
    pivot.rotation.z = sx * -0.72;
    body.add(pivot);
    arms.push(pivot);
  }

  // Casco do tatu por cima das costas.
  if (species === 'tatu') {
    const shell = createShell(bodyRadius * 1.02, torsoHeight);
    shell.position.set(0, torsoY, -bodyRadius * 0.1);
    body.add(shell);
  }

  // Cauda, quando a espécie tem uma.
  const tail = createTail(config.tail, species === 'lontra' ? PALETTE.otterSkin : skinColor);
  if (tail) {
    tail.position.set(0, torsoY - torsoHeight * 0.25, -bodyRadius * 0.95);
    body.add(tail);
  }

  // Cabeça.
  const head = new THREE.Group();
  head.position.set(0, legHeight + torsoHeight + headRadius * 0.66, 0);
  head.scale.setScalar(headRadius / 0.46);
  body.add(head);

  const skull = mesh(new THREE.SphereGeometry(0.46, 18, 14), flat(skinColor));
  // A silhueta muda com a espécie: capivara tem cabeça larga e quadradona,
  // lontra tem cabeça achatada e tatu tem cabeça estreita e comprida.
  if (species === 'capivara') skull.scale.set(1.18, 0.98, 0.96);
  else if (species === 'lontra') skull.scale.set(1.1, 0.86, 1.02);
  else skull.scale.set(0.96, 1.0, 1.02);
  head.add(skull);

  if (species === 'lontra') {
    // Mancha clara do queixo até o peito.
    const patch = mesh(new THREE.SphereGeometry(0.4, 12, 10), flat(PALETTE.otterBelly), 0, -0.14, 0.12);
    patch.scale.set(0.72, 0.5, 0.9);
    head.add(patch);
  }

  head.add(createSnout(config.snout, skinColor));
  head.add(createEars(config.ears, skinColor));

  // Olhos.
  const eyeGeometry = new THREE.SphereGeometry(0.105, 10, 8);
  const pupilGeometry = new THREE.SphereGeometry(0.05, 8, 6);
  for (const sx of [-1, 1]) {
    head.add(mesh(eyeGeometry, flat(PALETTE.eyeWhite), sx * 0.17, 0.19, 0.36));
    head.add(mesh(pupilGeometry, flat(PALETTE.eyeBlack), sx * 0.17, 0.19, 0.42));
  }

  // Bochechas coradas e sorriso.
  const blush = new THREE.CircleGeometry(0.11, 10);
  for (const sx of [-1, 1]) {
    const cheek = mesh(blush, flat(PALETTE.blush), sx * 0.33, -0.08, 0.31);
    cheek.rotation.y = sx * 0.5;
    head.add(cheek);
  }
  const smile = mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI), flat(0x2b2b2b), 0, -0.17, 0.4);
  smile.rotation.z = Math.PI;
  head.add(smile);

  if (glasses) head.add(createGlasses());
  if (beard) head.add(createBeard());
  if (hat) head.add(createHat(hat, hatColor));

  root.name = name || species;
  root.scale.setScalar(scale);
  root.userData = {
    name,
    species,
    arms,
    head,
    body,
    phase: Math.random() * Math.PI * 2,
    waving: 0,
    height: (legHeight + torsoHeight + headRadius * 1.7) * scale,
  };

  return root;
}

/** Balanço de respiração + aceno quando o barco chega perto. */
export function updateCharacter(character, time, dt) {
  const data = character.userData;
  const bob = Math.sin(time * 2.4 + data.phase) * 0.03;
  data.body.position.y = bob;
  data.head.rotation.z = Math.sin(time * 1.6 + data.phase) * 0.05;

  const target = data.wantsToWave ? 1 : 0;
  data.waving += (target - data.waving) * Math.min(1, dt * 6);

  const wave = data.waving;
  const swing = Math.sin(time * 9) * 0.6;
  data.arms[1].rotation.z = -0.35 - wave * (2.4 + swing * 0.3);
  data.arms[1].rotation.x = wave * swing * 0.2;
  data.arms[0].rotation.z = 0.35 + Math.sin(time * 2 + data.phase) * 0.05;
}
