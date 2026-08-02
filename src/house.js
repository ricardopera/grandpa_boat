import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { flat, mesh, roundedRectShape, extrude } from './materials.js';
import { roofTexture } from './textures.js';

const roofMaterials = new Map();
function roofMaterial(color) {
  let material = roofMaterials.get(color);
  if (!material) {
    const map = roofTexture(color);
    map.repeat.set(0.34, 0.3);
    material = new THREE.MeshLambertMaterial({ map });
    roofMaterials.set(color, material);
  }
  return material;
}

/** Janela de quatro vidros com moldura branca, igual às das casas das ilhas. */
function createWindow(width = 0.9, height = 1.0) {
  const group = new THREE.Group();
  const frame = mesh(
    new THREE.BoxGeometry(width, height, 0.12),
    flat(PALETTE.windowFrame)
  );
  group.add(frame);

  const paneW = (width - 0.26) / 2;
  const paneH = (height - 0.28) / 2;
  const paneGeometry = new THREE.PlaneGeometry(paneW, paneH);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const pane = mesh(
        paneGeometry,
        flat(PALETTE.windowGlass),
        sx * (paneW / 2 + 0.045),
        sy * (paneH / 2 + 0.045),
        0.07
      );
      group.add(pane);
    }
  }
  return group;
}

/** Floreira sob a janela, como na casa lilás. */
function createFlowerBox(width = 1.0) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(width, 0.24, 0.22), flat(0xf3c98a)));

  const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.28, 5);
  const petalGeometry = new THREE.CircleGeometry(0.09, 6);
  const colors = [PALETTE.flowerRed, PALETTE.flowerYellow, 0xf27ab8];
  const count = 3;
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1) - 0.5) * (width - 0.24);
    group.add(mesh(stemGeometry, flat(PALETTE.leafDark), x, 0.24, 0.02));
    const petal = mesh(petalGeometry, flat(colors[i % colors.length]), x, 0.4, 0.06);
    group.add(petal);
    group.add(mesh(new THREE.CircleGeometry(0.03, 6), flat(PALETTE.flowerYellow), x, 0.4, 0.07));
  }
  return group;
}

/** Antena de TV no telhado — detalhe presente em todas as casas das ilhas. */
function createAntenna() {
  const group = new THREE.Group();
  const rod = new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6);
  group.add(mesh(rod, flat(0x3a3a44), 0, 0.75));
  const bar = new THREE.CylinderGeometry(0.028, 0.028, 0.9, 6);
  for (let i = 0; i < 3; i++) {
    const cross = mesh(bar, flat(0x3a3a44), 0, 0.85 + i * 0.28, 0);
    cross.rotation.z = Math.PI / 2;
    group.add(cross);
  }
  return group;
}

/** Trepadeira com flores vermelhas, espalhada pela parede como na casa rosa. */
function createVine(width, height) {
  const group = new THREE.Group();
  const stemMaterial = flat(PALETTE.leafDark);
  const leafGeometry = new THREE.CircleGeometry(0.17, 7);
  const flowerGeometry = new THREE.CircleGeometry(0.13, 7);
  const petalGeometry = new THREE.CircleGeometry(0.05, 6);

  // Dois ramos que sobem serpenteando, em vez de uma haste reta.
  for (const lado of [-1, 1]) {
    const passos = 7;
    for (let i = 0; i < passos; i++) {
      const t = i / (passos - 1);
      const y = t * height;
      const x = lado * Math.sin(t * 2.4) * width * 0.5;
      const proximoY = ((i + 1) / (passos - 1)) * height;
      const proximoX = lado * Math.sin(((i + 1) / (passos - 1)) * 2.4) * width * 0.5;
      if (i < passos - 1) {
        const dx = proximoX - x;
        const dy = proximoY - y;
        const trecho = mesh(
          new THREE.CylinderGeometry(0.045, 0.045, Math.hypot(dx, dy), 5),
          stemMaterial,
          x + dx / 2,
          y + dy / 2,
          0
        );
        trecho.rotation.z = Math.atan2(-dx, dy);
        group.add(trecho);
      }

      // Folhas de um lado e outro do ramo, e uma flor a cada dois passos.
      for (const desvio of [-1, 1]) {
        const folha = mesh(leafGeometry, flat(desvio > 0 ? PALETTE.leaf : PALETTE.leafDark), x + desvio * 0.22, y + 0.08, 0.03);
        folha.rotation.z = desvio * 0.6;
        folha.scale.set(1, 0.7, 1);
        group.add(folha);
      }
      if (i % 2 === 1) {
        group.add(mesh(flowerGeometry, flat(PALETTE.flowerRed), x + lado * 0.3, y, 0.05));
        group.add(mesh(petalGeometry, flat(PALETTE.flowerYellow), x + lado * 0.3, y, 0.06));
      }
    }
  }
  return group;
}

/**
 * Casa de duas águas com paredes chapadas, telhado de telhas e janelinhas brancas.
 * A frente da casa aponta para +Z.
 */
export function createHouse(style, options = {}) {
  const {
    width = 4.2,
    depth = 3.4,
    wallHeight = 4.6,
    roofHeight = 2.4,
    antenna = true,
    chimney = false,
    flowerBoxes = false,
    vine = false,
    archedDoor = false,
  } = options;

  const house = new THREE.Group();
  const halfW = width / 2;
  const halfD = depth / 2;

  const walls = mesh(
    new THREE.BoxGeometry(width, wallHeight, depth),
    flat(style.wall),
    0,
    wallHeight / 2,
    0
  );
  walls.castShadow = true;
  house.add(walls);

  // Telhado: prisma triangular com beiral saliente nos quatro lados.
  const overhang = 0.32;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-halfW - overhang, 0);
  roofShape.lineTo(halfW + overhang, 0);
  roofShape.lineTo(0, roofHeight);
  roofShape.closePath();
  const roofGeometry = extrude(roofShape, depth + overhang * 2);
  roofGeometry.translate(0, 0, -halfD - overhang);
  const roof = mesh(roofGeometry, roofMaterial(style.roof), 0, wallHeight, 0);
  roof.castShadow = true;
  house.add(roof);

  // Frontão: fecha o triângulo entre parede e telhado.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfW, 0);
  gableShape.lineTo(halfW, 0);
  gableShape.lineTo(0, roofHeight);
  gableShape.closePath();
  const gable = extrude(gableShape, depth);
  gable.translate(0, 0, -halfD);
  house.add(mesh(gable, flat(style.wall), 0, wallHeight, 0));

  // Janelas: duas no andar de cima, duas embaixo, ao lado da porta.
  const windowY = [wallHeight * 0.72, wallHeight * 0.3];
  const windowX = [-width * 0.24, width * 0.24];
  for (const y of windowY) {
    for (const x of windowX) {
      const isGroundDoorSide = y === windowY[1] && x > 0;
      if (isGroundDoorSide) continue;
      const win = createWindow(width * 0.24, wallHeight * 0.2);
      win.position.set(x, y, halfD + 0.01);
      house.add(win);
      if (flowerBoxes) {
        const box = createFlowerBox(width * 0.3);
        box.position.set(x, y - wallHeight * 0.12, halfD + 0.06);
        house.add(box);
      }
    }
  }

  // Janelas laterais e dos fundos: nenhuma parede fica vazia.
  const sideWindow = createWindow(depth * 0.26, wallHeight * 0.2);
  sideWindow.rotation.y = -Math.PI / 2;
  sideWindow.position.set(-halfW - 0.01, wallHeight * 0.55, 0);
  house.add(sideWindow);

  for (const y of windowY) {
    const back = createWindow(width * 0.24, wallHeight * 0.2);
    back.rotation.y = Math.PI;
    back.position.set(y === windowY[0] ? 0 : width * 0.24, y, -halfD - 0.01);
    house.add(back);
  }

  // Porta.
  const doorW = width * 0.22;
  const doorH = wallHeight * 0.38;
  const doorGroup = new THREE.Group();
  const doorShape = archedDoor
    ? roundedRectShape(doorW, doorH, doorW * 0.34)
    : roundedRectShape(doorW, doorH, 0.04);
  const doorGeometry = extrude(doorShape, 0.12);
  doorGroup.add(mesh(doorGeometry, flat(style.door), 0, 0, -0.02));
  doorGroup.add(
    mesh(new THREE.SphereGeometry(0.07, 8, 6), flat(PALETTE.gold), doorW * 0.3, 0, 0.12)
  );
  doorGroup.position.set(width * 0.26, doorH / 2, halfD + 0.02);
  house.add(doorGroup);

  if (antenna) {
    const ant = createAntenna();
    ant.position.set(0, wallHeight + roofHeight, 0);
    house.add(ant);
  }

  if (chimney) {
    const stack = mesh(
      new THREE.BoxGeometry(0.5, 1.5, 0.5),
      flat(style.trim === 0xffffff ? 0xe0e0e8 : style.trim),
      -width * 0.28,
      wallHeight + roofHeight * 0.55,
      0
    );
    house.add(stack);
    house.add(
      mesh(new THREE.BoxGeometry(0.62, 0.16, 0.62), flat(0xc8c8d2), -width * 0.28, wallHeight + roofHeight * 0.55 + 0.8, 0)
    );
  }

  if (vine) {
    const v = createVine(width * 0.5, wallHeight * 0.8);
    v.position.set(-width * 0.12, 0, halfD + 0.05);
    house.add(v);
  }

  house.userData.totalHeight = wallHeight + roofHeight;
  return house;
}
