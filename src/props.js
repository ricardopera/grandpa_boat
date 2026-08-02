import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { flat, flatUnique, unlit, mesh, beam } from './materials.js';

/** Árvore de tronco fino e copa cheia, cheia de frutinhas vermelhas. */
export function createTree(scale = 1, withApples = false) {
  const tree = new THREE.Group();
  tree.name = 'arvore';
  tree.add(mesh(new THREE.CylinderGeometry(0.13, 0.2, 2.5, 8), flat(PALETTE.trunk), 0, 1.25, 0));

  const branchGeometry = new THREE.CylinderGeometry(0.07, 0.1, 1.1, 6);
  const leafGeometry = new THREE.SphereGeometry(0.44, 10, 8);
  const appleGeometry = new THREE.SphereGeometry(0.16, 8, 7);

  const branches = 5;
  for (let i = 0; i < branches; i++) {
    const angle = (i / branches) * Math.PI * 2 + 0.3;
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);

    // Galho saindo do topo do tronco, inclinado para fora.
    const branch = mesh(branchGeometry, flat(PALETTE.trunk), dirX * 0.34, 2.7, dirZ * 0.34);
    branch.rotation.set(dirZ * 0.62, 0, -dirX * 0.62);
    tree.add(branch);

    // Cada galho termina num tufo de folhas, e os tufos juntos fecham a copa.
    const tips = [
      [0.95, 3.15, 1.0],
      [0.55, 3.5, 0.82],
      [1.15, 3.45, 0.74],
    ];
    tips.forEach(([spread, y, size], j) => {
      const leaf = mesh(
        leafGeometry,
        flat(j === 1 ? PALETTE.leaf : PALETTE.leafDark),
        dirX * spread,
        y,
        dirZ * spread
      );
      leaf.scale.set(size * 1.2, size * 0.92, size * 1.2);
      tree.add(leaf);
    });

    // Miolo da copa, para não aparecer buraco entre os tufos.
    if (i === 0) {
      const core = mesh(leafGeometry, flat(PALETTE.leaf), 0, 3.35, 0);
      core.scale.set(1.7, 1.15, 1.7);
      tree.add(core);
    }

    if (withApples) {
      tree.add(
        mesh(appleGeometry, flat(PALETTE.flowerRed), dirX * 1.35, 3.1, dirZ * 1.35)
      );
    }
  }

  tree.scale.setScalar(scale);
  return tree;
}

/** Arbusto: bolhas verdes achatadas. */
export function createBush(scale = 1) {
  const bush = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.5, 14, 10);
  const blobs = [
    [0, 0.3, 0, 1],
    [0.44, 0.22, 0.08, 0.76],
    [-0.42, 0.2, -0.06, 0.7],
    [0.06, 0.24, 0.34, 0.6],
  ];
  for (const [x, y, z, s] of blobs) {
    const blob = mesh(geometry, flat(x === 0 ? PALETTE.leaf : PALETTE.leafDark), x, y, z);
    blob.scale.set(s * 1.15, s * 0.9, s * 1.15);
    bush.add(blob);
  }
  bush.scale.setScalar(scale);
  return bush;
}

/**
 * Balanço amarelo do quintal: dois cavaletes em A, uma barra ligando os topos e
 * o assento pendurado por duas cordas. O assento fica num pivô para balançar.
 */
export function createSwing() {
  const swing = new THREE.Group();
  swing.name = 'balanco';
  const yellow = flat(PALETTE.flowerYellow);

  const height = 2.3;
  const halfWidth = 1.05;
  const spread = 0.85;

  // Cada perna vai do pé no chão até o topo do cavalete: assim o "A" aparece
  // tanto de frente quanto de lado, e as quatro pernas se encontram na barra.
  for (const sx of [-1, 1]) {
    const topo = new THREE.Vector3(sx * halfWidth, height, 0);
    for (const sz of [-1, 1]) {
      const pe = new THREE.Vector3(sx * (halfWidth + 0.34), 0, (sz * spread) / 2);
      swing.add(beam(pe, topo, 0.075, yellow));
    }
  }

  // Barra superior, ligando os topos dos dois cavaletes.
  const bar = mesh(
    new THREE.CylinderGeometry(0.075, 0.075, halfWidth * 2 + 0.3, 7),
    yellow,
    0,
    height,
    0
  );
  bar.rotation.z = Math.PI / 2;
  swing.add(bar);

  // Assento pendurado: fica num pivô na altura da barra para poder balançar.
  const seat = new THREE.Group();
  seat.position.set(0, height, 0);
  const ropeLength = 1.35;
  const ropeGeometry = new THREE.CylinderGeometry(0.028, 0.028, ropeLength, 5);
  for (const sx of [-1, 1]) {
    seat.add(mesh(ropeGeometry, flat(0xe6e6ec), sx * 0.3, -ropeLength / 2, 0));
  }
  seat.add(mesh(new THREE.BoxGeometry(0.78, 0.1, 0.36), flat(PALETTE.flowerRed), 0, -ropeLength, 0));
  swing.add(seat);

  swing.userData.seat = seat;
  swing.userData.phase = Math.random() * Math.PI * 2;
  return swing;
}

/** Vai e vem lento do assento. */
export function updateSwing(swing, time) {
  const seat = swing.userData.seat;
  if (seat) seat.rotation.x = Math.sin(time * 1.1 + swing.userData.phase) * 0.32;
}

/** Pequeno cais de madeira: marca onde o barco atraca. */
export function createDock(length = 2.6) {
  const dock = new THREE.Group();
  // Tábua corrida, com ripas por cima para dar textura sem virar uma escada.
  const base = mesh(
    new THREE.BoxGeometry(1.0, 0.14, length),
    flat(PALETTE.woodDark),
    0,
    0,
    length / 2 - 0.4
  );
  dock.add(base);

  const plankGeometry = new THREE.BoxGeometry(0.94, 0.07, 0.3);
  const planks = Math.round(length / 0.4);
  for (let i = 0; i < planks; i++) {
    dock.add(mesh(plankGeometry, flat(PALETTE.woodDeck), 0, 0.09, -0.2 + i * 0.4));
  }

  const postGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6);
  for (const sx of [-1, 1]) {
    dock.add(mesh(postGeometry, flat(PALETTE.woodDark), sx * 0.38, -0.7, length - 0.75));
  }
  return dock;
}

/** Flores minúsculas espalhadas na grama. */
export function createFlowerPatch(radius, count = 26, rng = Math.random) {
  const group = new THREE.Group();
  const geometry = new THREE.CircleGeometry(0.12, 6);
  const miolo = new THREE.CircleGeometry(0.045, 6);
  const colors = [PALETTE.flowerYellow, 0xffffff, 0xf6a0c8];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const distance = Math.sqrt(rng()) * radius;
    const flower = mesh(
      geometry,
      flat(colors[Math.floor(rng() * colors.length)]),
      Math.cos(angle) * distance,
      0.02,
      Math.sin(angle) * distance
    );
    flower.rotation.x = -Math.PI / 2;
    group.add(flower);
    const centro = mesh(miolo, flat(PALETTE.flowerYellow), flower.position.x, 0.025, flower.position.z);
    centro.rotation.x = -Math.PI / 2;
    group.add(centro);
  }
  return group;
}

/**
 * Farol de faixas: torre cônica creme e vermelha, varanda de metal e a lanterna
 * acesa no alto. A luz gira sozinha em `updateLighthouse`.
 */
export function createLighthouse(height = 9) {
  const farol = new THREE.Group();
  farol.name = 'farol';

  // Base de pedra, para a torre não nascer direto da grama.
  farol.add(mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.9, 16), flat(0xcfc7b4), 0, 0.45, 0));

  // Torre em faixas: cada anel é um pedaço do cone, alternando as duas cores.
  const faixas = 6;
  for (let i = 0; i < faixas; i++) {
    const y0 = 0.9 + (i / faixas) * height;
    const r0 = 1.4 - (i / faixas) * 0.55;
    const r1 = 1.4 - ((i + 1) / faixas) * 0.55;
    farol.add(
      mesh(
        new THREE.CylinderGeometry(r1, r0, height / faixas, 16),
        flat(i % 2 ? PALETTE.lighthouseBand : PALETTE.lighthouse),
        0,
        y0 + height / faixas / 2,
        0
      )
    );
  }

  const topo = 0.9 + height;
  // Varanda: piso saliente e um guarda-corpo de barrinhas em volta.
  farol.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.16, 16), flat(PALETTE.metal), 0, topo, 0));
  const barra = new THREE.CylinderGeometry(0.045, 0.045, 0.5, 5);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    farol.add(mesh(barra, flat(PALETTE.metal), Math.cos(a) * 1.12, topo + 0.3, Math.sin(a) * 1.12));
  }
  const corrimao = mesh(new THREE.TorusGeometry(1.12, 0.045, 6, 20), flat(PALETTE.metal), 0, topo + 0.55, 0);
  corrimao.rotation.x = Math.PI / 2;
  farol.add(corrimao);

  // Lanterna: vidro, lâmpada acesa e telhadinho cônico.
  farol.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.3, 14), flat(PALETTE.windowGlass, { transparent: true, opacity: 0.7 }), 0, topo + 0.8, 0));
  const lampada = mesh(new THREE.SphereGeometry(0.45, 12, 10), unlit(0xfff0a8), 0, topo + 0.8, 0);
  farol.add(lampada);
  farol.add(mesh(new THREE.ConeGeometry(1.05, 0.9, 14), flat(PALETTE.lighthouseBand), 0, topo + 1.9, 0));
  farol.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), flat(PALETTE.gold), 0, topo + 2.45, 0));

  // Facho: um cone deitado que gira em volta da lanterna.
  const facho = new THREE.Group();
  facho.position.y = topo + 0.8;
  const cone = mesh(
    new THREE.ConeGeometry(1.1, 9, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    0,
    0,
    4.5
  );
  cone.rotation.x = Math.PI / 2;
  facho.add(cone);
  farol.add(facho);

  farol.userData.facho = facho;
  farol.userData.lampada = lampada;
  return farol;
}

/**
 * A luz do farol dá uma volta lenta e a lâmpada pulsa junto. De dia o facho
 * quase não aparece; quando o sol se põe (`escuridao` indo a 1) ele acende.
 */
export function updateLighthouse(farol, time, escuridao = 0) {
  const { facho, lampada } = farol.userData;
  if (facho) {
    facho.rotation.y = time * 0.7;
    facho.children[0].material.opacity = 0.04 + escuridao * 0.26;
  }
  if (lampada) lampada.scale.setScalar(1 + Math.sin(time * 3) * 0.06);
}

/**
 * Caixote de mantimentos boiando: madeira com cantoneiras, uma boia de cortiça
 * em volta para não afundar e uma bandeirinha para ser visto de longe.
 */
export function createCrate() {
  const caixote = new THREE.Group();
  caixote.name = 'caixote';

  const corpo = mesh(new THREE.BoxGeometry(1.3, 1.0, 1.3), flat(PALETTE.crate), 0, 0.5, 0);
  caixote.add(corpo);

  // Ripas cruzadas nas quatro faces.
  const ripa = new THREE.BoxGeometry(1.36, 0.14, 0.06);
  for (const [rot, x, z] of [
    [0, 0, 0.66],
    [0, 0, -0.66],
    [Math.PI / 2, 0.66, 0],
    [Math.PI / 2, -0.66, 0],
  ]) {
    for (const y of [0.22, 0.78]) {
      const barra = mesh(ripa, flat(PALETTE.crateDark), x, y, z);
      barra.rotation.y = rot;
      caixote.add(barra);
    }
  }
  caixote.add(mesh(new THREE.BoxGeometry(1.38, 0.12, 1.38), flat(PALETTE.crateDark), 0, 1.0, 0));

  // Anel de flutuação vermelho na linha d'água.
  const anel = mesh(new THREE.TorusGeometry(0.92, 0.16, 8, 18), flat(PALETTE.buoy), 0, 0.2, 0);
  anel.rotation.x = Math.PI / 2;
  caixote.add(anel);

  // Bandeirinha para achar o caixote de longe.
  caixote.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), flat(PALETTE.metal), 0.4, 1.7, 0.4));
  const bandeira = mesh(new THREE.PlaneGeometry(0.6, 0.36), flatUnique(PALETTE.flowerYellow, { side: THREE.DoubleSide }), 0.7, 2.25, 0.4);
  caixote.add(bandeira);
  caixote.userData.bandeira = bandeira;

  return caixote;
}

/** Boia cônica de regata: base flutuante, mastro e galhardete. */
function createRaceBuoy(color) {
  const boia = new THREE.Group();
  const flutuador = mesh(new THREE.SphereGeometry(0.75, 14, 10), flatUnique(color), 0, 0, 0);
  flutuador.scale.set(1, 0.7, 1);
  boia.add(flutuador);
  const cone = mesh(new THREE.ConeGeometry(0.62, 1.5, 12), flatUnique(color), 0, 0.9, 0);
  boia.add(cone);
  boia.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), flat(PALETTE.metal), 0, 2.1, 0));
  const galhardete = mesh(
    new THREE.PlaneGeometry(0.7, 0.4),
    flatUnique(color, { side: THREE.DoubleSide }),
    0.35,
    3.15,
    0
  );
  boia.add(galhardete);
  boia.userData.pintaveis = [flutuador.material, cone.material, galhardete.material];
  boia.userData.galhardete = galhardete;
  return boia;
}

/**
 * Portão de regata: duas boias afastadas marcando por onde o barco tem de passar.
 * `setActive` acende as duas de amarelo quando é a vez daquele portão.
 */
export function createGate(width = 16) {
  const portao = new THREE.Group();
  portao.name = 'portao';
  const boias = [];
  for (const sx of [-1, 1]) {
    const boia = createRaceBuoy(0xdfe6ea);
    boia.position.x = (sx * width) / 2;
    portao.add(boia);
    boias.push(boia);
  }
  portao.userData.boias = boias;
  portao.userData.width = width;
  portao.userData.setActive = (ativo) => {
    const cor = new THREE.Color(ativo ? PALETTE.flowerYellow : 0xdfe6ea);
    for (const boia of boias) {
      for (const material of boia.userData.pintaveis) material.color.copy(cor);
    }
  };
  portao.userData.setActive(false);
  return portao;
}
