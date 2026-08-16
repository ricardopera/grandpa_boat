import { createIsland, placeCharacter, makeRng } from './island.js';
import { updateCharacter } from './character.js';
import { updateSwing, updateLighthouse } from './props.js';
import { applyDaylight } from './world.js';
import { MISSIONS } from './missions.js';

const HOME_NAME = 'Ilha da Enseada';

/**
 * O arquipélago da Baía Dourada: cada ilha tem casa, quintal, moradores e —
 * na primeira missão — um amigo esperando carona no cais.
 */
const ISLAND_LAYOUT = [
  {
    name: HOME_NAME,
    home: true,
    position: [0, 78],
    radius: 13.5,
    houseStyle: 'coral',
    houseAngle: 0.2,
    houseOptions: { vine: true, archedDoor: true, width: 4.6, wallHeight: 5.0 },
    trees: 2,
    apples: true,
    bushes: 3,
    residents: [
      {
        species: 'capivara',
        adult: true,
        clothes: 0x2f9b9b,
        shoes: 0x217a7a,
        glasses: true,
        scale: 1.05,
        name: 'Papai Bento',
        angle: 0.8,
      },
      {
        species: 'capivara',
        adult: true,
        clothes: 0xe2603f,
        shoes: 0x2f6f8f,
        scale: 1.0,
        name: 'Mamãe Célia',
        angle: 1.15,
      },
    ],
  },
  {
    name: 'Ilha do Coqueiro',
    position: [-96, 22],
    radius: 10.5,
    houseStyle: 'areia',
    houseAngle: -0.5,
    trees: 1,
    bushes: 2,
    passenger: { species: 'capivara', clothes: 0xe2603f, shoes: 0xc44b33, scale: 0.8, name: 'Nina' },
    residents: [
      {
        species: 'capivara',
        adult: true,
        clothes: 0x5aa245,
        shoes: 0x3f8034,
        name: 'Tio Vitor',
        angle: -1.9,
      },
    ],
  },
  {
    name: 'Ilha do Balanço',
    position: [88, -36],
    radius: 11,
    houseStyle: 'lavanda',
    houseAngle: 0.1,
    houseOptions: { flowerBoxes: true, archedDoor: true },
    swing: true,
    trees: 1,
    bushes: 2,
    passenger: { species: 'lontra', clothes: 0x3f8ad6, shoes: 0x2f6aa8, scale: 0.8, name: 'Lia' },
  },
  {
    name: 'Ilha do Farol',
    position: [-52, -102],
    radius: 10.5,
    houseStyle: 'farol',
    houseAngle: 2.6,
    houseOptions: { chimney: true, wallHeight: 5.2 },
    lighthouse: true,
    trees: 2,
    bushes: 1,
    passenger: { species: 'tatu', clothes: 0xf2a23f, shoes: 0xc47a2a, scale: 0.82, name: 'Dudu' },
    residents: [
      {
        species: 'lontra',
        adult: true,
        clothes: 0x2fa58f,
        shoes: 0x1c7a69,
        hat: 'cap',
        name: 'Seu Aurélio',
        angle: 2.1,
      },
    ],
  },
  {
    name: 'Ilha da Horta',
    position: [122, 70],
    radius: 10,
    houseStyle: 'oliva',
    houseAngle: -2.2,
    trees: 2,
    apples: true,
    bushes: 3,
    passenger: { species: 'capivara', clothes: 0xa06fd0, shoes: 0x7a4fb0, scale: 0.78, name: 'Téo' },
  },
  {
    name: 'Ilha da Maré',
    position: [-132, -44],
    radius: 10.5,
    houseStyle: 'turquesa',
    houseAngle: 1.7,
    houseOptions: { chimney: true },
    trees: 1,
    bushes: 2,
    passenger: {
      species: 'lontra',
      clothes: 0xe2603f,
      shoes: 0xc44b33,
      hat: 'beanie',
      scale: 0.82,
      name: 'Bia',
    },
  },
  {
    name: 'Ilha do Pôr do Sol',
    position: [38, -125],
    radius: 10,
    houseStyle: 'terracota',
    houseAngle: 3.0,
    houseOptions: { flowerBoxes: true },
    trees: 1,
    bushes: 2,
    passenger: {
      species: 'tatu',
      clothes: 0x5aa245,
      shoes: 0x3f8034,
      hat: 'bandana',
      scale: 0.8,
      name: 'Zeca',
    },
  },
];

/**
 * O jogo em si: monta o arquipélago uma vez e vai passando as missões, uma
 * atrás da outra. Cada missão cuida do que é dela (passageiros, caixotes,
 * portões) e usa este objeto como ponte para a cena, o barco e o painel.
 */
export class Game {
  constructor(scene, boat, hud, sound, world) {
    this.scene = scene;
    this.boat = boat;
    this.hud = hud;
    this.sound = sound;
    this.world = world;
    this.islands = [];
    this.characters = [];
    this.home = null;
    this.missionIndex = 0;
    this.mission = null;
    this.waiting = false;
    this.finished = false;
    this.daylight = 0;
    this.build();
    this.startMission(0);
  }

  build() {
    const rng = makeRng(20240801);
    ISLAND_LAYOUT.forEach((config, index) => {
      const island = createIsland({ ...config, seed: 1000 + index * 37 });
      island.userData.name = config.name;
      island.userData.passenger = null;
      this.scene.add(island);
      this.islands.push(island);
      if (config.home) this.home = island;

      for (const resident of config.residents ?? []) {
        this.characters.push(
          placeCharacter(island, resident, resident.angle ?? rng() * Math.PI * 2, 0.6)
        );
      }
    });
  }

  /** O que as missões podem usar do jogo. */
  get context() {
    return {
      scene: this.scene,
      boat: this.boat,
      hud: this.hud,
      sound: this.sound,
      islands: this.islands,
      home: this.home,
      byName: (name) => this.islands.find((island) => island.userData.name === name),
      nearest: (list) => this.nearest(list),
      adopt: (character) => this.characters.push(character),
      refresh: () => this.updateHud(),
      setDaylight: (t) => {
        this.daylight = t;
        applyDaylight(t, { scene: this.scene, ...this.world });
      },
    };
  }

  startMission(index) {
    this.mission?.cleanup();
    this.missionIndex = index;
    const MissionClass = MISSIONS[index];
    this.mission = new MissionClass(this.context);
    this.mission.start();
    this.waiting = false;
    // Escolher uma missão depois de zerar o jogo recomeça a contagem: sem isto
    // o painel continuaria dizendo que está tudo cumprido.
    this.finished = false;
    this.updateHud();
    this.hud.toast(`Missão ${index + 1}: ${MissionClass.title}`, 4.5);
  }

  nextMission() {
    if (this.missionIndex + 1 < MISSIONS.length) {
      this.startMission(this.missionIndex + 1);
    }
  }

  updateHud() {
    const MissionClass = MISSIONS[this.missionIndex];
    this.hud.setMission(this.missionIndex + 1, MISSIONS.length, MissionClass.title);
    this.hud.setChips(this.mission.chips());
    this.hud.setObjective(this.finished ? 'Todas as missões cumpridas! 🎉' : this.mission.objective());
  }

  nearest(list) {
    let best = null;
    let bestDistance = Infinity;
    for (const island of list) {
      const distance = island.position.distanceTo(this.boat.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = island;
      }
    }
    return best;
  }

  /** Marcadores extras que a missão atual quer ver no minimapa. */
  markers() {
    return this.mission?.markers() ?? [];
  }

  update(dt, time, camera) {
    for (const character of this.characters) updateCharacter(character, time, dt);
    for (const island of this.islands) {
      if (island.userData.swing) updateSwing(island.userData.swing, time);
      if (island.userData.lighthouse) {
        updateLighthouse(island.userData.lighthouse, time, this.daylight);
      }
    }

    this.mission.update(dt, time, camera);
    this.hud.setChips(this.mission.chips());

    if (this.mission.done && !this.waiting) {
      this.waiting = true;
      const last = this.missionIndex + 1 >= MISSIONS.length;
      this.updateHud();
      if (last) {
        this.finished = true;
        this.sound.victory();
        this.hud.showVictory();
      } else {
        this.sound.victory();
        const next = MISSIONS[this.missionIndex + 1];
        this.hud.showMissionComplete({
          title: MISSIONS[this.missionIndex].title,
          nextTitle: `Missão ${this.missionIndex + 2}: ${next.title}`,
          text: next.intro,
        });
      }
    }
  }
}

export { HOME_NAME, MISSIONS };
