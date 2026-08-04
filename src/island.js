import * as THREE from 'three';
import { PALETTE, HOUSE_STYLES } from './palette.js';
import { flat, mesh } from './materials.js';
import { createHouse } from './house.js';
import {
  createTree,
  createBush,
  createSwing,
  createDock,
  createFlowerPatch,
  createLighthouse,
} from './props.js';
import { createCharacter } from './character.js';

/** Gerador determinístico: o arquipélago é sempre o mesmo a cada partida. */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Largura da faixa de areia em volta de cada ilha.
export const BEACH_WIDTH = 2.4;

function domeHeight(radius, height, distance) {
  const t = Math.min(1, distance / radius);
  return height * Math.sqrt(Math.max(0, 1 - t * t));
}

/**
 * Ilha em forma de calota verde sobre o mar, com casa, quintal e moradores.
 * `config` descreve tudo o que a ilha tem; a posição fica em `config.position`.
 */
export function createIsland(config) {
  const {
    position,
    radius = 11,
    height = 1.7,
    houseStyle = 'areia',
    houseOptions = {},
    houseAngle = 0,
    trees = 1,
    apples = false,
    bushes = 1,
    swing = false,
    lighthouse = false,
    seed = 1,
  } = config;

  const rng = makeRng(seed);
  const island = new THREE.Group();
  island.name = config.name ?? 'ilha';
  island.position.set(position[0], 0, position[1]);

  // Calota de grama.
  const domeGeometry = new THREE.SphereGeometry(radius, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeometry.scale(1, height / radius, 1);
  const dome = mesh(domeGeometry, flat(PALETTE.grass));
  dome.receiveShadow = true;
  island.add(dome);

  // Praia: uma rampa de areia em volta da grama. Ela desce em direção ao mar,
  // e não fica deitada na linha d'água — assim a onda quebra numa linha, em vez
  // de brigar pixel a pixel com um anel plano quase à mesma altura.
  const beachRadius = radius + BEACH_WIDTH;
  const beach = mesh(
    new THREE.CylinderGeometry(radius * 0.9, beachRadius, 0.32, 44, 1, true),
    flat(PALETTE.sand),
    0,
    0.46,
    0
  );
  island.add(beach);

  // Faixa submersa logo abaixo da praia: quando a onda baixa, o que aparece
  // continua sendo areia molhada, e não a base escura.
  island.add(
    mesh(
      new THREE.CylinderGeometry(beachRadius, beachRadius * 0.98, 1.9, 44),
      flat(PALETTE.sandDark),
      0,
      -0.65,
      0
    )
  );

  // Base submersa, para a ilha não parecer um adesivo sobre a água.
  island.add(
    mesh(
      new THREE.CylinderGeometry(beachRadius * 0.98, radius * 0.8, 6, 44),
      flat(PALETTE.grassDark),
      0,
      -4.4,
      0
    )
  );

  island.add(createFlowerPatch(radius * 0.85, 30, rng));

  // Casa.
  const style = HOUSE_STYLES[houseStyle] ?? HOUSE_STYLES.areia;
  const house = createHouse(style, houseOptions);
  const houseDistance = radius * 0.3;
  const houseX = Math.sin(houseAngle) * houseDistance;
  const houseZ = Math.cos(houseAngle) * houseDistance;
  house.position.set(houseX, domeHeight(radius, height, houseDistance) - 0.15, houseZ);
  house.name = 'casa';
  house.rotation.y = houseAngle;
  island.add(house);

  // Quintal.
  for (let i = 0; i < trees; i++) {
    const angle = houseAngle + Math.PI * (0.55 + rng() * 0.5) * (i % 2 ? 1 : -1);
    const distance = radius * (0.42 + rng() * 0.22);
    const tree = createTree(0.85 + rng() * 0.4, apples);
    tree.position.set(
      Math.sin(angle) * distance,
      domeHeight(radius, height, distance) - 0.1,
      Math.cos(angle) * distance
    );
    island.add(tree);
  }

  const dockAngle = Math.atan2(-position[0], -position[1]);

  for (let i = 0; i < bushes; i++) {
    // Longe do cais: é onde ficam o passageiro e o embarque.
    const angle = dockAngle + 0.8 + rng() * (Math.PI * 2 - 1.6);
    const distance = radius * (0.64 + rng() * 0.24);
    const bush = createBush(0.8 + rng() * 0.5);
    bush.position.set(
      Math.sin(angle) * distance,
      domeHeight(radius, height, distance) - 0.05,
      Math.cos(angle) * distance
    );
    island.add(bush);
  }

  if (swing) {
    const angle = houseAngle - 0.9;
    const distance = radius * 0.5;
    const swingSet = createSwing();
    swingSet.position.set(
      Math.sin(angle) * distance,
      domeHeight(radius, height, distance) - 0.1,
      Math.cos(angle) * distance
    );
    swingSet.rotation.y = angle + Math.PI / 2;
    island.add(swingSet);
    island.userData.swing = swingSet;
  }

  if (lighthouse) {
    // O farol fica do lado oposto ao cais, para ser o primeiro a aparecer no
    // horizonte quando o barco vem de longe.
    const angle = dockAngle + Math.PI;
    const distance = radius * 0.55;
    const tower = createLighthouse(9);
    tower.name = 'farol';
    tower.position.set(
      Math.sin(angle) * distance,
      domeHeight(radius, height, distance) - 0.2,
      Math.cos(angle) * distance
    );
    island.add(tower);
    island.userData.lighthouse = tower;
  }

  // Cais: fica na borda voltada para o centro do arquipélago.
  const dock = createDock(BEACH_WIDTH + 4.4);
  dock.name = 'cais';
  const dockDistance = radius - 1.0;
  dock.position.set(
    Math.sin(dockAngle) * dockDistance,
    domeHeight(radius, height, dockDistance) + 0.05,
    Math.cos(dockAngle) * dockDistance
  );
  dock.rotation.y = dockAngle;
  island.add(dock);

  island.userData = {
    ...island.userData,
    config,
    radius,
    height,
    house,
    dockAngle,
    beachRadius,
    dockPoint: new THREE.Vector3(
      position[0] + Math.sin(dockAngle) * (beachRadius + 2.0),
      0,
      position[1] + Math.cos(dockAngle) * (beachRadius + 2.0)
    ),
    surfaceHeight: (localX, localZ) => domeHeight(radius, height, Math.hypot(localX, localZ)),
  };

  return island;
}

/** Coloca um morador na ilha, virado para a água. */
export function placeCharacter(island, options, angle, distanceFactor = 0.72) {
  const { radius, height } = island.userData;
  const distance = radius * distanceFactor;
  const character = createCharacter(options);
  character.position.set(
    Math.sin(angle) * distance,
    domeHeight(radius, height, distance) - 0.05,
    Math.cos(angle) * distance
  );
  character.rotation.y = angle;
  island.add(character);
  return character;
}
