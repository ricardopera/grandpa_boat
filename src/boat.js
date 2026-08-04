import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { flat, flatUnique, mesh, beam, extrude } from './materials.js';
import { flagTexture } from './textures.js';
import { createCharacter } from './character.js';
import { waveHeight } from './world.js';

const HALF_WIDTH = 1.4;
const HALF_LENGTH = 3.4;
// Linha d'água em y = 0: o casco sobe até 1.55 e mergulha até -1.35.
const GUNWALE = 1.55;
const DECK = 1.16;

/** Contorno do casco visto de cima: popa arredondada e proa levemente apontada. */
function hullOutline(segments = 15) {
  const shape = new THREE.Shape();
  const w = HALF_WIDTH;
  const l = HALF_LENGTH;
  shape.moveTo(-w, -l + 0.8);
  shape.quadraticCurveTo(-w, -l, -w + 0.6, -l);
  shape.lineTo(w - 0.6, -l);
  shape.quadraticCurveTo(w, -l, w, -l + 0.8);
  shape.lineTo(w, l - 1.7);
  shape.quadraticCurveTo(w, l, 0, l);
  shape.quadraticCurveTo(-w, l, -w, l - 1.9);
  shape.closePath();
  return shape.getPoints(segments);
}

/**
 * O casco é montado anel por anel: assim as faixas de cor (verde-mar, listra
 * creme e verde escuro) ficam retas e nítidas, sem serrilhado nas emendas.
 */
function createHull() {
  const outline = hullOutline();
  const count = outline.length;

  // [y, escalaX, escalaZ, materialDaFaixaAbaixo]
  const rings = [
    [GUNWALE, 1.0, 1.0, 0],
    [0.88, 1.0, 1.0, 0],
    [0.68, 1.0, 1.0, 1],
    [0.05, 1.0, 1.0, 2],
  ];
  const roundedRings = 6;
  for (let i = 1; i <= roundedRings; i++) {
    const angle = (i / roundedRings) * (Math.PI / 2) * 0.92;
    rings.push([
      0.05 - Math.sin(angle) * 1.4,
      Math.cos(angle),
      0.74 + 0.26 * Math.cos(angle),
      2,
    ]);
  }

  const positions = [];
  const indices = [];
  for (const [y, sx, sz] of rings) {
    for (const point of outline) {
      positions.push(point.x * sx, y, point.y * sz);
    }
  }

  const groups = [];
  for (let r = 0; r < rings.length - 1; r++) {
    const start = indices.length;
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const a = r * count + i;
      const b = r * count + next;
      const c = (r + 1) * count + i;
      const d = (r + 1) * count + next;
      indices.push(a, c, b, b, c, d);
    }
    groups.push([start, indices.length - start, rings[r + 1][3]]);
  }

  // Fundo do casco.
  const bottomCenter = positions.length / 3;
  const lastRing = rings[rings.length - 1];
  positions.push(0, lastRing[0] - 0.1, 0);
  const capStart = indices.length;
  const lastRingStart = (rings.length - 1) * count;
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    indices.push(lastRingStart + i, bottomCenter, lastRingStart + next);
  }
  groups.push([capStart, indices.length - capStart, 2]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  for (const [start, countIndices, material] of groups) {
    geometry.addGroup(start, countIndices, material);
  }
  geometry.computeVertexNormals();

  const hull = new THREE.Group();
  hull.add(
    new THREE.Mesh(geometry, [
      flat(PALETTE.hullMain, { side: THREE.DoubleSide }),
      flat(PALETTE.hullStripe, { side: THREE.DoubleSide }),
      flat(PALETTE.hullDeep, { side: THREE.DoubleSide }),
    ])
  );

  // Borda branca no alto do casco: some com a espessura zero e dá acabamento.
  const rimShape = new THREE.Shape(outline);
  rimShape.holes.push(new THREE.Path(hullOutline(28).map((p) => p.clone().multiplyScalar(0.9))));
  const rim = mesh(extrude(rimShape, 0.1), flat(PALETTE.hullStripe), 0, GUNWALE, 0);
  rim.rotation.x = -Math.PI / 2;
  hull.add(rim);

  return hull;
}

function createPorthole() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.RingGeometry(0.19, 0.27, 18), flat(PALETTE.hullStripe), 0, 0, 0.01));
  group.add(mesh(new THREE.CircleGeometry(0.2, 18), flat(PALETTE.porthole)));
  return group;
}

function createShipWheel() {
  const wheel = new THREE.Group();
  wheel.add(mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 18), flat(PALETTE.woodDark)));
  const spoke = new THREE.CylinderGeometry(0.045, 0.045, 1.02, 6);
  for (let i = 0; i < 4; i++) {
    const bar = mesh(spoke, flat(PALETTE.woodDeck));
    bar.rotation.z = (i / 4) * Math.PI;
    wheel.add(bar);
  }
  wheel.add(mesh(new THREE.CircleGeometry(0.1, 10), flat(PALETTE.woodDark), 0, 0, 0.05));
  return wheel;
}

function createBell() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), flat(PALETTE.metal), 0, 0.55, 0));
  const arm = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), flat(PALETTE.metal), 0.14, 1.08, 0);
  arm.rotation.z = Math.PI / 2;
  group.add(arm);
  const bell = mesh(new THREE.ConeGeometry(0.19, 0.34, 12), flat(PALETTE.gold), 0.28, 0.9, 0);
  group.add(bell);
  group.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), flat(PALETTE.gold), 0.28, 0.72, 0));
  group.userData.bell = bell;
  return group;
}

/** Pituca, a arara empoleirada perto da proa. */
function createParrot() {
  const parrot = new THREE.Group();
  parrot.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), flat(PALETTE.metal), 0, 0.65, 0));

  const bird = new THREE.Group();
  bird.position.y = 1.45;
  const azul = 0x2f7fd8;
  const body = mesh(new THREE.SphereGeometry(0.22, 10, 8), flat(azul));
  body.scale.set(0.8, 1.25, 0.8);
  bird.add(body);
  // Peito amarelo, como o das araras.
  const peito = mesh(new THREE.SphereGeometry(0.19, 10, 8), flat(PALETTE.flowerYellow), 0, -0.02, 0.08);
  peito.scale.set(0.7, 1.15, 0.7);
  bird.add(peito);
  bird.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), flat(azul), 0, 0.24, 0));
  const beak = mesh(new THREE.ConeGeometry(0.1, 0.26, 8), flat(0x3a3a44), 0, 0.24, 0.16);
  beak.rotation.x = Math.PI / 2 + 0.5;
  bird.add(beak);
  bird.add(mesh(new THREE.SphereGeometry(0.045, 6, 5), flat(PALETTE.eyeBlack), 0.07, 0.3, 0.12));
  bird.add(mesh(new THREE.SphereGeometry(0.045, 6, 5), flat(PALETTE.eyeBlack), -0.07, 0.3, 0.12));
  // Cauda comprida apontando para baixo, a marca registrada da arara.
  const cauda = mesh(new THREE.ConeGeometry(0.09, 0.5, 6), flat(azul), 0, -0.32, -0.1);
  cauda.rotation.x = -0.35;
  bird.add(cauda);
  for (const sx of [-1, 1]) {
    const wing = mesh(new THREE.SphereGeometry(0.13, 8, 6), flat(azul), sx * 0.17, -0.02, -0.05);
    wing.scale.set(0.45, 1.1, 0.7);
    bird.add(wing);
  }
  parrot.add(bird);
  parrot.userData.bird = bird;
  return parrot;
}

/** Boia salva-vidas pendurada na lateral da cabine. */
function createLifeRing() {
  const group = new THREE.Group();
  const geometry = new THREE.TorusGeometry(0.3, 0.09, 8, 18);
  group.add(mesh(geometry, flat(PALETTE.hullStripe)));
  // Quatro faixas vermelhas em volta do anel.
  const faixa = new THREE.TorusGeometry(0.3, 0.095, 6, 18, Math.PI / 5);
  for (let i = 0; i < 4; i++) {
    const parte = mesh(faixa, flat(PALETTE.hullTrim));
    parte.rotation.z = (i / 4) * Math.PI * 2;
    group.add(parte);
  }
  return group;
}

/**
 * Guarda-corpo da proa: em vez de uma grade reta solta no meio do convés, os
 * postes nascem no próprio contorno do casco e as barras ligam um poste ao
 * seguinte — assim a grade acompanha a curva da proa e encosta nas amuradas.
 */
function createRailing() {
  const railing = new THREE.Group();
  const material = flat(PALETTE.metal);
  const post = new THREE.CylinderGeometry(0.035, 0.035, 0.72, 6);

  // Pontos do contorno na metade da frente do barco, de bombordo a boreste.
  const outline = hullOutline(24)
    .filter((p) => p.y > HALF_LENGTH * 0.42)
    .sort((a, b) => Math.atan2(a.x, a.y) - Math.atan2(b.x, b.y))
    .map((p) => new THREE.Vector3(p.x * 0.86, 0, p.y * 0.9));

  // Um poste sim, um não: com um poste por vértice a grade vira uma serra.
  outline.forEach((ponto, i) => {
    if (i % 2 === 0 || i === outline.length - 1) {
      railing.add(mesh(post, material, ponto.x, 0.36, ponto.z));
    }
  });
  for (let i = 0; i < outline.length - 1; i++) {
    for (const y of [0.36, 0.66]) {
      const de = outline[i].clone().setY(y);
      const para = outline[i + 1].clone().setY(y);
      railing.add(beam(de, para, 0.035, material, 6));
    }
  }
  return railing;
}

/** Espuma deixada pelo barco: discos brancos que somem aos poucos. */
class Wake {
  constructor(scene, size = 26) {
    this.items = [];
    const geometry = new THREE.CircleGeometry(1, 12);
    for (let i = 0; i < size; i++) {
      const material = flatUnique(PALETTE.waterFoam, { transparent: true, opacity: 0 });
      const foam = new THREE.Mesh(geometry, material);
      foam.rotation.x = -Math.PI / 2;
      foam.visible = false;
      scene.add(foam);
      this.items.push({ mesh: foam, life: 0 });
    }
    this.cursor = 0;
    this.cooldown = 0;
  }

  spawn(x, z, scale) {
    const item = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    item.mesh.position.set(x, 0.12, z);
    item.mesh.scale.setScalar(scale);
    item.mesh.visible = true;
    item.life = 1;
  }

  update(dt, boat, speed, time) {
    this.cooldown -= dt;
    if (speed > 0.6 && this.cooldown <= 0) {
      this.cooldown = 0.12;
      const back = new THREE.Vector3(0, 0, -HALF_LENGTH * 0.95).applyQuaternion(boat.quaternion);
      for (const side of [-1, 1]) {
        const offset = new THREE.Vector3(side * 0.9, 0, 0).applyQuaternion(boat.quaternion);
        this.spawn(
          boat.position.x + back.x + offset.x,
          boat.position.z + back.z + offset.z,
          0.28 + Math.random() * 0.16
        );
      }
    }
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt * 0.9;
      if (item.life <= 0) {
        item.mesh.visible = false;
        continue;
      }
      item.mesh.material.opacity = item.life * 0.42;
      item.mesh.scale.setScalar(item.mesh.scale.x + dt * 0.45);
      item.mesh.position.y = 0.12 + waveHeight(item.mesh.position.x, item.mesh.position.z, time);
    }
  }
}

/** O barco do Vovô: casco verde-mar, cabine de madeira, bandeira do sol e tripulação. */
export class Boat {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'barco';
    this.hullPivot = new THREE.Group();
    this.group.add(this.hullPivot);
    scene.add(this.group);

    this.hullPivot.add(createHull());

    // Convés de madeira, um pouco abaixo da borda do casco.
    const deckShape = new THREE.Shape(hullOutline(28).map((p) => p.clone().multiplyScalar(0.9)));
    const deck = mesh(extrude(deckShape, 0.16), flat(PALETTE.woodDeck), 0, DECK, 0);
    deck.rotation.x = Math.PI / 2;
    this.hullPivot.add(deck);

    // Vigias nas laterais, logo abaixo da listra branca.
    for (const side of [-1, 1]) {
      for (const z of [-2.1, -0.9, 0.3, 1.5]) {
        const porthole = createPorthole();
        porthole.position.set(side * (HALF_WIDTH + 0.01), 0.3, z);
        porthole.rotation.y = (side * Math.PI) / 2;
        this.hullPivot.add(porthole);
      }
    }

    // Cabine.
    const cabin = new THREE.Group();
    cabin.name = 'cabine';
    cabin.position.set(0, DECK, 0.1);
    cabin.add(mesh(new THREE.BoxGeometry(1.55, 1.15, 1.35), flat(PALETTE.woodDeck), 0, 0.58, 0));
    cabin.add(mesh(new THREE.BoxGeometry(1.75, 0.14, 1.55), flat(PALETTE.woodDark), 0, 1.22, 0));
    for (const sx of [-1, 1]) {
      const window = createPorthole();
      window.scale.setScalar(0.72);
      window.position.set(sx * 0.38, 0.6, 0.69);
      cabin.add(window);
      const side = createPorthole();
      side.scale.setScalar(0.72);
      side.position.set(sx * 0.79, 0.6, 0);
      side.rotation.y = (sx * Math.PI) / 2;
      cabin.add(side);
    }
    // Boia pendurada na parede de trás da cabine, de frente para o leme.
    const boia = createLifeRing();
    boia.name = 'boia';
    boia.position.set(0, 0.62, -0.7);
    cabin.add(boia);
    this.hullPivot.add(cabin);

    // Mastro com a bandeira do sol e da onda.
    const mast = new THREE.Group();
    mast.name = 'mastro';
    mast.position.set(0, DECK, 1.15);
    mast.add(mesh(new THREE.CylinderGeometry(0.075, 0.09, 3.6, 8), flat(0xf7f9fc), 0, 1.8, 0));
    mast.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), flat(PALETTE.hullTrim), 0, 3.66, 0));
    const flagMaterial = new THREE.MeshLambertMaterial({
      map: flagTexture(),
      side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.8, 6, 1), flagMaterial);
    flag.position.set(0.55, 3.0, 0);
    flag.rotation.y = Math.PI / 2;
    mast.add(flag);
    this.hullPivot.add(mast);
    this.flag = flag;

    // Leme numa coluna, sino, papagaia e guarda-corpo da proa.
    this.hullPivot.add(
      mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), flat(PALETTE.woodDark), 0, DECK + 0.45, -1.35)
    );
    const wheel = createShipWheel();
    wheel.name = 'leme';
    wheel.position.set(0, DECK + 1.0, -1.35);
    this.hullPivot.add(wheel);
    this.wheel = wheel;

    const bell = createBell();
    bell.name = 'sino';
    bell.position.set(0.5, DECK, 1.95);
    this.hullPivot.add(bell);
    this.bell = bell.userData.bell;

    const parrot = createParrot();
    parrot.name = 'arara';
    parrot.position.set(-0.5, DECK, 2.1);
    this.hullPivot.add(parrot);
    this.parrot = parrot.userData.bird;

    const railing = createRailing();
    railing.name = 'guarda-corpo';
    railing.position.set(0, DECK, 0);
    this.hullPivot.add(railing);

    // Tripulação fixa: o Vovô Tonico no leme e a Vovó Marina no convés.
    this.crew = [];
    const grandpa = createCharacter({
      species: 'capivara',
      clothes: 0x2f6f8f,
      shoes: 0x1f4f66,
      adult: true,
      scale: 1.15,
      hat: 'captain',
      name: 'Vovô Tonico',
    });
    grandpa.position.set(0, DECK, -2.15);
    this.hullPivot.add(grandpa);
    this.crew.push(grandpa);

    const grandma = createCharacter({
      species: 'capivara',
      clothes: 0xe2733f,
      shoes: 0xc4552f,
      adult: true,
      scale: 1.1,
      hat: 'sun',
      name: 'Vovó Marina',
    });
    grandma.position.set(0.1, DECK, 1.25);
    grandma.rotation.y = -2.4;
    this.hullPivot.add(grandma);
    this.crew.push(grandma);

    // Lugares livres para os passageiros que embarcarem.
    this.seats = [
      new THREE.Vector3(-0.72, DECK, -2.3),
      new THREE.Vector3(0.72, DECK, -2.3),
      new THREE.Vector3(-0.75, DECK, 0.6),
      new THREE.Vector3(0.75, DECK, 0.6),
      new THREE.Vector3(-0.72, DECK, -0.6),
      new THREE.Vector3(0.72, DECK, -0.6),
      new THREE.Vector3(-0.6, DECK, 1.75),
    ];

    this.wake = new Wake(scene);
    this.speed = 0;
    this.heading = Math.PI;
    this.turn = 0;
    this.bellRing = 0;
  }

  get position() {
    return this.group.position;
  }

  ringBell() {
    this.bellRing = 1;
  }

  update(dt, input, time, islands) {
    const maxSpeed = 11;
    const acceleration = input.throttle > 0 ? 9 : 7;
    this.speed += input.throttle * acceleration * dt;
    this.speed *= 1 - Math.min(0.9, dt * 1.1);
    this.speed = THREE.MathUtils.clamp(this.speed, -maxSpeed * 0.45, maxSpeed);

    // Só vira quando há alguma velocidade, como um barco de verdade.
    const steerAuthority = THREE.MathUtils.clamp(Math.abs(this.speed) / 4, 0, 1);
    const steer = -input.steer * 1.5 * steerAuthority * Math.sign(this.speed || 1);
    this.turn += (steer - this.turn) * Math.min(1, dt * 4);
    this.heading += this.turn * dt;

    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const next = this.group.position.clone().addScaledVector(forward, this.speed * dt);

    // Colisão: o barco encosta na ilha e perde velocidade em vez de atravessar.
    for (const island of islands) {
      const data = island.userData;
      const dx = next.x - island.position.x;
      const dz = next.z - island.position.z;
      const distance = Math.hypot(dx, dz);
      // A praia conta como parte da ilha: o barco encosta na areia, não na grama.
      const minDistance = (data.beachRadius ?? data.radius) + 1.6;
      if (distance < minDistance) {
        const push = (minDistance - distance) / distance;
        next.x += dx * push;
        next.z += dz * push;
        this.speed *= 0.35;
      }
    }

    // Limite do mundo.
    const limit = 250;
    const fromCenter = Math.hypot(next.x, next.z);
    if (fromCenter > limit) {
      next.x *= limit / fromCenter;
      next.z *= limit / fromCenter;
      this.speed *= 0.5;
    }

    this.group.position.set(next.x, 0, next.z);
    this.group.rotation.y = this.heading;

    // Flutuação: sobe e desce com a onda e inclina na curva.
    const y = waveHeight(next.x, next.z, time);
    this.hullPivot.position.y = y * 0.85;
    this.hullPivot.rotation.z = -this.turn * 0.22 + Math.sin(time * 1.3) * 0.02;
    this.hullPivot.rotation.x =
      Math.sin(time * 1.7 + next.x * 0.05) * 0.03 - this.speed * 0.006;

    // Detalhes vivos: bandeira, papagaia e sino.
    this.flag.rotation.z = Math.sin(time * 4) * 0.12;
    this.flag.scale.x = 1 + Math.sin(time * 6) * 0.05;
    this.parrot.rotation.z = Math.sin(time * 3) * 0.12;
    this.parrot.position.y = 1.45 + Math.sin(time * 2.5) * 0.03;
    this.wheel.rotation.z = -this.turn * 1.6;

    if (this.bellRing > 0) {
      this.bellRing = Math.max(0, this.bellRing - dt * 1.6);
      this.bell.rotation.z = Math.sin(time * 26) * 0.4 * this.bellRing;
    }

    this.wake.update(dt, this.group, Math.abs(this.speed), time);
  }
}

export { HALF_LENGTH as BOAT_HALF_LENGTH };
