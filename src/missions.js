import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { unlit, mesh } from './materials.js';
import { placeCharacter } from './island.js';
import { createCrate, createGate, createRaceBuoy } from './props.js';
import { Rival, FLEET, keepApart } from './rivals.js';
import { updateCharacter } from './character.js';
import { waveHeight } from './world.js';

const WORLD_POSITION = new THREE.Vector3();

/** Balãozinho de exclamação sobre quem está esperando carona. */
function createMarker() {
  const marker = new THREE.Group();
  const bubble = mesh(new THREE.SphereGeometry(0.4, 14, 10), unlit(0xffffff));
  bubble.scale.set(1, 1.15, 0.35);
  marker.add(bubble);
  marker.add(mesh(new THREE.BoxGeometry(0.1, 0.3, 0.06), unlit(PALETTE.hullTrim), 0, 0.09, 0.2));
  marker.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), unlit(PALETTE.hullTrim), 0, -0.14, 0.2));
  const tail = mesh(new THREE.ConeGeometry(0.12, 0.22, 4), unlit(0xffffff), 0, -0.48, 0);
  tail.rotation.x = Math.PI;
  marker.add(tail);
  return marker;
}

/**
 * Base das missões. `ctx` é o que o jogo empresta para elas: a cena, o barco,
 * o painel, os sons e as ilhas já montadas.
 */
class Mission {
  constructor(ctx) {
    this.ctx = ctx;
    this.done = false;
  }

  /** O barco encostou na ilha devagar o bastante para atracar? */
  docked(island) {
    const { boat } = this.ctx;
    const distance = island.position.distanceTo(boat.position);
    return distance < island.userData.beachRadius + 5 && Math.abs(boat.speed) < 3.4;
  }

  finish() {
    this.done = true;
  }

  start() {}
  update() {}
  cleanup() {}
  chips() {
    return [];
  }
  objective() {
    return '';
  }
  markers() {
    return [];
  }
}

/**
 * Missão 1 — Carona para a festa.
 * Seis amigos esperam num cais cada um; é preciso buscá-los e levá-los para a
 * festa na ilha de casa. É a missão que apresenta o barco e o arquipélago.
 */
export class RideMission extends Mission {
  static id = 'carona';
  static title = 'Carona para a festa';
  static intro =
    'Seis amigos esperam carona, um em cada ilha. Encoste devagar para eles embarcarem e leve todos para a festa na Ilha da Enseada.';

  constructor(ctx) {
    super(ctx);
    this.characters = [];
    this.aboard = [];
    this.delivered = 0;
    this.total = 0;
  }

  start() {
    for (const island of this.ctx.islands) {
      const config = island.userData.config.passenger;
      if (!config) continue;

      const character = placeCharacter(island, config, island.userData.dockAngle, 0.82);
      const marker = createMarker();
      marker.position.y = character.userData.height + 0.85;
      character.add(marker);
      character.userData.marker = marker;
      character.userData.islandName = island.userData.name;
      island.userData.passenger = character;
      this.characters.push(character);
      this.total += 1;
    }
  }

  cleanup() {
    // Quem já chegou fica na festa: os personagens passam a ser do mundo.
    for (const character of this.characters) this.ctx.adopt(character);
    for (const island of this.ctx.islands) island.userData.passenger = null;
    this.characters = [];
  }

  chips() {
    return [`🧍 ${this.aboard.length}`, `🎉 ${this.delivered}/${this.total}`];
  }

  objective() {
    if (this.done) return 'Todos os amigos chegaram para a festa! 🎉';
    if (this.aboard.length > 0) {
      return `Leve seus amigos até a ${this.ctx.home.userData.name} (a ilha rosada do mapa).`;
    }
    const waiting = this.ctx.islands.filter(
      (island) => island.userData.passenger && !island.userData.passenger.userData.boarded
    );
    const nearest = this.ctx.nearest(waiting);
    return nearest
      ? `Navegue até a ${nearest.userData.name} e encoste devagar para pegar um amigo.`
      : 'Volte para casa!';
  }

  markers() {
    const list = [];
    for (const island of this.ctx.islands) {
      const passenger = island.userData.passenger;
      if (passenger && !passenger.userData.boarded) {
        list.push({ x: island.position.x, z: island.position.z, ring: '#ffe45e' });
      }
    }
    return list;
  }

  seat(character) {
    const { boat } = this.ctx;
    const seat = boat.seats[this.aboard.length % boat.seats.length];
    character.parent?.remove(character);
    boat.hullPivot.add(character);
    character.position.copy(seat);
    character.rotation.y = seat.x > 0 ? -0.6 : 0.6;
    character.userData.boarded = true;
    character.userData.wantsToWave = false;
    if (character.userData.marker) {
      character.remove(character.userData.marker);
      character.userData.marker = null;
    }
  }

  unload() {
    const island = this.ctx.home;
    const { radius, surfaceHeight, dockAngle } = island.userData;
    this.aboard.forEach((character, index) => {
      const angle = dockAngle + (index - (this.aboard.length - 1) / 2) * 0.4 + this.delivered * 0.13;
      const distance = radius * (0.62 + (index % 2) * 0.16);
      character.parent?.remove(character);
      island.add(character);
      character.position.set(
        Math.sin(angle) * distance,
        surfaceHeight(Math.sin(angle) * distance, Math.cos(angle) * distance) - 0.05,
        Math.cos(angle) * distance
      );
      character.rotation.y = angle;
      character.userData.boarded = false;
      // Chegou na festa: fica acenando junto da casa.
      character.userData.wantsToWave = true;
    });
    this.delivered += this.aboard.length;
    this.aboard = [];
  }

  update(dt, time, camera) {
    const { boat, hud, sound } = this.ctx;

    for (const character of this.characters) {
      updateCharacter(character, time, dt);
      const marker = character.userData.marker;
      if (!marker) continue;
      character.getWorldPosition(WORLD_POSITION);
      marker.position.y = character.userData.height + 0.85 + Math.sin(time * 3) * 0.12;
      // O balão sempre encara a câmera.
      marker.rotation.y =
        Math.atan2(camera.position.x - WORLD_POSITION.x, camera.position.z - WORLD_POSITION.z) -
        character.rotation.y;
    }

    if (this.done) return;

    for (const island of this.ctx.islands) {
      const data = island.userData;
      const near = island.position.distanceTo(boat.position) < data.radius + 14;

      // Quem está esperando acena quando o barco se aproxima.
      if (data.passenger && !data.passenger.userData.boarded) {
        data.passenger.userData.wantsToWave = near;
      }

      if (!this.docked(island)) continue;

      if (data.passenger && !data.passenger.userData.boarded) {
        const passenger = data.passenger;
        this.seat(passenger);
        this.aboard.push(passenger);
        sound.board();
        boat.ringBell();
        hud.toast(`${passenger.userData.name} embarcou! 🎈`);
        this.ctx.refresh();
      }

      if (island === this.ctx.home && this.aboard.length > 0) {
        const count = this.aboard.length;
        this.unload();
        sound.deliver();
        hud.toast(
          count === 1 ? 'Um amigo chegou para a festa! 🥳' : `${count} amigos chegaram para a festa! 🥳`
        );
        this.ctx.refresh();
        if (this.delivered >= this.total) this.finish();
      }
    }
  }
}

// Onde os caixotes foram parar depois da ventania — longe das ilhas, para o
// jogador ter de cruzar o arquipélago inteiro atrás deles.
const CRATE_SPOTS = [
  [-40, 45],
  [30, 35],
  [-75, -8],
  [70, 15],
  [-30, -60],
  [25, -70],
  [-100, -80],
  [110, 30],
];

const CARGO_CAPACITY = 3;

/**
 * Missão 2 — Resgate das encomendas.
 * A ventania da noite espalhou pelo mar os caixotes de mantimentos do farol.
 * O barco recolhe até três de cada vez e descarrega no cais da Ilha do Farol.
 */
export class CargoMission extends Mission {
  static id = 'encomendas';
  static title = 'Resgate das encomendas';
  static intro =
    'A ventania espalhou pelo mar os caixotes de mantimentos do farol. Passe por cima deles para recolher (cabem três no convés) e descarregue na Ilha do Farol.';

  constructor(ctx) {
    super(ctx);
    this.crates = [];
    this.carried = [];
    this.delivered = 0;
    this.pile = [];
    this.depot = ctx.byName('Ilha do Farol') ?? ctx.home;
  }

  start() {
    for (const [x, z] of CRATE_SPOTS) {
      const crate = createCrate();
      crate.position.set(x, 0, z);
      crate.userData.phase = Math.random() * Math.PI * 2;
      this.ctx.scene.add(crate);
      this.crates.push(crate);
    }
  }

  cleanup() {
    for (const crate of [...this.crates, ...this.carried, ...this.pile]) {
      crate.parent?.remove(crate);
    }
    this.crates = [];
    this.carried = [];
    this.pile = [];
  }

  get total() {
    return CRATE_SPOTS.length;
  }

  chips() {
    return [`📦 ${this.carried.length}/${CARGO_CAPACITY}`, `🏮 ${this.delivered}/${this.total}`];
  }

  objective() {
    if (this.done) return 'Todas as encomendas estão no farol! 🏮';
    if (this.carried.length >= CARGO_CAPACITY || (this.crates.length === 0 && this.carried.length > 0)) {
      return `O convés está cheio: descarregue na ${this.depot.userData.name} (o círculo laranja do mapa).`;
    }
    if (this.crates.length === 0) {
      return `Último caixote entregue — volte à ${this.depot.userData.name}.`;
    }
    return 'Passe por cima dos caixotes boiando para recolhê-los (bandeirinha amarela no mapa).';
  }

  markers() {
    const list = this.crates.map((crate) => ({
      x: crate.position.x,
      z: crate.position.z,
      color: '#ffe45e',
      radius: 3,
    }));
    if (this.carried.length > 0) {
      list.push({ x: this.depot.position.x, z: this.depot.position.z, ring: '#f2a23f' });
    }
    return list;
  }

  /** Empilha o caixote recolhido no convés, atrás da cabine. */
  stow(crate) {
    const slots = [
      [-0.7, 1.9],
      [0.7, 1.9],
      [0, 2.6],
    ];
    const [x, z] = slots[this.carried.length % slots.length];
    crate.parent?.remove(crate);
    this.ctx.boat.hullPivot.add(crate);
    crate.scale.setScalar(0.62);
    crate.position.set(x, 1.16, z);
    crate.rotation.y = (Math.random() - 0.5) * 0.4;
    this.carried.push(crate);
  }

  /** Descarrega tudo o que está no convés, em pilha na praia do farol. */
  unload() {
    const island = this.depot;
    const { beachRadius, dockAngle } = island.userData;
    for (const crate of this.carried) {
      const index = this.pile.length;
      const angle = dockAngle + 0.55 + (index % 4) * 0.16;
      const distance = beachRadius - 1.1;
      crate.parent?.remove(crate);
      island.add(crate);
      crate.scale.setScalar(0.62);
      crate.position.set(
        Math.sin(angle) * distance,
        0.14 + Math.floor(index / 4) * 0.62,
        Math.cos(angle) * distance
      );
      crate.rotation.y = angle + (index % 2) * 0.3;
      this.pile.push(crate);
    }
    this.delivered += this.carried.length;
    this.carried = [];
  }

  update(dt, time) {
    const { boat, hud, sound } = this.ctx;

    // Os caixotes soltos sobem e descem com a onda e giram devagar.
    for (const crate of this.crates) {
      crate.position.y = waveHeight(crate.position.x, crate.position.z, time) - 0.24;
      crate.rotation.y = Math.sin(time * 0.5 + crate.userData.phase) * 0.35;
      crate.rotation.z = Math.sin(time * 1.4 + crate.userData.phase) * 0.05;
    }

    if (this.done) return;

    // Recolher: basta passar por cima com o convés ainda com lugar.
    if (this.carried.length < CARGO_CAPACITY) {
      for (let i = this.crates.length - 1; i >= 0; i--) {
        const crate = this.crates[i];
        const distance = Math.hypot(
          crate.position.x - boat.position.x,
          crate.position.z - boat.position.z
        );
        if (distance > 6.5) continue;
        this.crates.splice(i, 1);
        this.stow(crate);
        sound.board();
        hud.toast(
          this.carried.length >= CARGO_CAPACITY
            ? 'Convés cheio! Rume para a Ilha do Farol 🏮'
            : `Caixote a bordo! Faltam ${this.crates.length} no mar 📦`
        );
        this.ctx.refresh();
        if (this.carried.length >= CARGO_CAPACITY) break;
      }
    }

    if (this.carried.length > 0 && this.docked(this.depot)) {
      const count = this.carried.length;
      this.unload();
      sound.deliver();
      boat.ringBell();
      hud.toast(`${count} caixote${count > 1 ? 's' : ''} entregue${count > 1 ? 's' : ''} no farol! 🏮`);
      this.ctx.refresh();
      if (this.delivered >= this.total) this.finish();
    }
  }
}

// A volta completa ao arquipélago: cada portão tem o centro e a direção em que
// o barco precisa cruzá-lo.
const GATES = [
  { position: [-50, 60], heading: -Math.PI / 2 },
  { position: [-115, -10], heading: Math.PI },
  { position: [-70, -80], heading: Math.PI * 0.75 },
  { position: [10, -95], heading: Math.PI / 2 },
  { position: [105, -8], heading: 0.46 },
  { position: [60, 60], heading: -0.64 },
];

const GATE_WIDTH = 18;
const RACE_TIME = 170;

/**
 * Missão 3 — Regata do pôr do sol.
 * O sol começa a se pôr e o barco precisa dar a volta no arquipélago passando
 * pelos seis portões de boias, na ordem, antes que a luz acabe.
 */
export class RaceMission extends Mission {
  static id = 'regata';
  static title = 'Regata do pôr do sol';
  static intro =
    'O sol está se pondo na Baía Dourada. Cruze os seis portões de boias na ordem — sempre pelo lado que a boia acesa marca — antes que o tempo acabe.';

  constructor(ctx) {
    super(ctx);
    this.gates = [];
    this.index = 0;
    this.timeLeft = RACE_TIME;
    this.daylight = 0;
    this.previousSide = null;
  }

  start() {
    GATES.forEach((config, i) => {
      const gate = createGate(GATE_WIDTH);
      gate.position.set(config.position[0], 0, config.position[1]);
      gate.rotation.y = config.heading;
      gate.userData.heading = config.heading;
      gate.userData.order = i;
      this.ctx.scene.add(gate);
      this.gates.push(gate);
    });
    this.gates[0].userData.setActive(true);
  }

  cleanup() {
    for (const gate of this.gates) gate.parent?.remove(gate);
    this.gates = [];
    this.ctx.setDaylight(0);
  }

  chips() {
    const seconds = Math.max(0, Math.ceil(this.timeLeft));
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return [`🚩 ${this.index}/${this.gates.length}`, `⏱ ${clock}`];
  }

  objective() {
    if (this.done) return 'Regata vencida antes do sol sumir! 🌅';
    return `Cruze o portão aceso — faltam ${this.gates.length - this.index} de ${this.gates.length}.`;
  }

  markers() {
    return this.gates.map((gate, i) => ({
      x: gate.position.x,
      z: gate.position.z,
      color: i === this.index ? '#ffe45e' : i < this.index ? '#8fdc7a' : '#ffffff',
      radius: i === this.index ? 4 : 2.5,
    }));
  }

  restart(message) {
    this.index = 0;
    this.timeLeft = RACE_TIME;
    this.previousSide = null;
    this.gates.forEach((gate, i) => gate.userData.setActive(i === 0));
    this.ctx.hud.toast(message, 4);
    this.ctx.refresh();
  }

  update(dt, time) {
    const { boat, hud, sound } = this.ctx;

    // O sol se põe nos primeiros segundos da missão.
    if (this.daylight < 1) {
      this.daylight = Math.min(1, this.daylight + dt * 0.2);
      this.ctx.setDaylight(this.daylight);
    }

    // As boias boiam de verdade: sobem e descem com a onda.
    for (const gate of this.gates) {
      for (const boia of gate.userData.boias) {
        boia.getWorldPosition(WORLD_POSITION);
        boia.position.y = waveHeight(WORLD_POSITION.x, WORLD_POSITION.z, time) - 0.1;
        boia.userData.galhardete.rotation.z = Math.sin(time * 4 + gate.userData.order) * 0.15;
      }
    }

    if (this.done) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.restart('O sol sumiu antes do fim da volta — a regata recomeça! 🌇');
      return;
    }

    const gate = this.gates[this.index];
    const heading = gate.userData.heading;
    const dx = boat.position.x - gate.position.x;
    const dz = boat.position.z - gate.position.z;
    // Quanto o barco já passou do plano do portão, e o quanto está desviado
    // do meio dele.
    const along = dx * Math.sin(heading) + dz * Math.cos(heading);
    const lateral = dx * Math.cos(heading) - dz * Math.sin(heading);

    if (
      this.previousSide !== null &&
      this.previousSide < 0 &&
      along >= 0 &&
      Math.abs(lateral) < GATE_WIDTH / 2
    ) {
      gate.userData.setActive(false);
      this.index += 1;
      this.previousSide = null;
      sound.board();
      boat.ringBell();
      if (this.index >= this.gates.length) {
        this.finish();
        return;
      }
      this.gates[this.index].userData.setActive(true);
      hud.toast(`Portão ${this.index} de ${this.gates.length}! ⛵`);
      this.ctx.refresh();
      return;
    }

    this.previousSide = along;
  }
}


// O circuito da corrida: um oval no meio do arquipélago, com as marcas longe
// o bastante das ilhas para as retas entre elas nunca cortarem terra.
const CIRCUIT = [
  { x: 0, z: 45 },
  { x: 55, z: 10 },
  { x: 40, z: -60 },
  { x: -30, z: -70 },
  { x: -65, z: -15 },
  { x: -45, z: 35 },
];

const LAPS = 2;
const MARK_RADIUS = 15;

// Onde todo mundo larga: pouco antes da primeira marca, de proa para ela.
const START = { x: -17.5, z: 41, heading: 1.35 };

/**
 * Missão 4 — Corrida da Baía.
 * Três adversários, duas voltas no circuito de boias. O veleiro corre mais nas
 * retas, o pedalinho é lento mas nunca erra a curva, e o submarino mergulha no
 * meio do caminho. Terminar já fecha a missão; chegar em primeiro é a graça.
 */
export class CupMission extends Mission {
  static id = 'corrida';
  static title = 'Corrida da Baía';
  static intro =
    'Três barcos da baía desafiaram o Vovô Tonico: o veleiro Vento Sul, o submarino Sardinha e o pedalinho Pé-de-Pato. São duas voltas pelas boias do circuito — passe perto de cada marca, na ordem.';

  constructor(ctx) {
    super(ctx);
    this.marks = [];
    this.rivals = [];
    this.waypoint = 0;
    this.lap = 0;
    this.place = 1;
    this.finalPlace = 0;
  }

  start() {
    const { scene, boat } = this.ctx;

    CIRCUIT.forEach((ponto, i) => {
      const boia = createRaceBuoy(i === 0 ? PALETTE.flowerYellow : 0xdfe6ea);
      boia.name = `marca-${i + 1}`;
      boia.position.set(ponto.x, 0, ponto.z);
      scene.add(boia);
      this.marks.push(boia);
    });

    FLEET.forEach((config, i) => {
      const rival = new Rival(config, CIRCUIT, i, START);
      scene.add(rival.group);
      this.rivals.push(rival);
    });

    // Todo mundo na linha: o jogador larga na raia de fora, à direita.
    boat.group.position.set(START.x + Math.cos(START.heading) * 22, 0, START.z - Math.sin(START.heading) * 22);
    boat.heading = START.heading;
    boat.speed = 0;
  }

  cleanup() {
    for (const boia of this.marks) boia.parent?.remove(boia);
    for (const rival of this.rivals) rival.group.parent?.remove(rival.group);
    this.marks = [];
    this.rivals = [];
  }

  /** Progresso do jogador na mesma escala usada pelos rivais. */
  progress() {
    const { boat } = this.ctx;
    const alvo = CIRCUIT[this.waypoint];
    const distancia = Math.hypot(alvo.x - boat.position.x, alvo.z - boat.position.z);
    return this.lap * CIRCUIT.length + this.waypoint + 1 / (1 + distancia / 40);
  }

  chips() {
    const lugar = ['1º', '2º', '3º', '4º'][Math.min(3, this.place - 1)];
    const volta = Math.min(this.lap + 1, LAPS);
    return [`🏁 ${lugar}`, `🔄 volta ${volta}/${LAPS}`];
  }

  objective() {
    if (this.done) {
      return this.finalPlace === 1
        ? 'Primeiro lugar na Corrida da Baía! 🏆'
        : `Corrida terminada em ${this.finalPlace}º lugar. 🏁`;
    }
    return `Contorne a boia ${this.waypoint + 1} de ${CIRCUIT.length} — volta ${Math.min(this.lap + 1, LAPS)} de ${LAPS}.`;
  }

  markers() {
    const lista = this.marks.map((boia, i) => ({
      x: boia.position.x,
      z: boia.position.z,
      color: i === this.waypoint ? '#ffe45e' : '#ffffff',
      radius: i === this.waypoint ? 4 : 2,
    }));
    for (const rival of this.rivals) {
      lista.push({ x: rival.group.position.x, z: rival.group.position.z, color: '#e2603f', radius: 3 });
    }
    return lista;
  }

  update(dt, time) {
    const { boat, hud, sound, islands } = this.ctx;

    for (const rival of this.rivals) {
      rival.update(dt, time, LAPS, islands);
      rival.pushAway(boat);
    }
    // Os adversários também não se atravessam entre si.
    for (let i = 0; i < this.rivals.length; i += 1) {
      for (let j = i + 1; j < this.rivals.length; j += 1) {
        keepApart(this.rivals[i], this.rivals[j]);
      }
    }

    // As marcas boiam de verdade, e a da vez acende de amarelo.
    this.marks.forEach((boia, i) => {
      boia.position.y = waveHeight(boia.position.x, boia.position.z, time) - 0.1;
      boia.userData.galhardete.rotation.z = Math.sin(time * 4 + i) * 0.15;
      boia.userData.setActive(i === this.waypoint);
    });

    // Classificação: quem andou mais do percurso vai na frente.
    const tabela = [
      { nome: 'você', jogador: true, valor: this.progress() },
      ...this.rivals.map((r) => ({ nome: r.name, jogador: false, valor: r.progress(LAPS) })),
    ].sort((a, b) => b.valor - a.valor);
    this.place = tabela.findIndex((linha) => linha.jogador) + 1;

    if (this.done) return;

    const alvo = CIRCUIT[this.waypoint];
    const distancia = Math.hypot(alvo.x - boat.position.x, alvo.z - boat.position.z);
    if (distancia >= MARK_RADIUS) return;

    this.waypoint += 1;
    if (this.waypoint < CIRCUIT.length) {
      sound.board();
      this.ctx.refresh();
      return;
    }

    this.waypoint = 0;
    this.lap += 1;
    boat.ringBell();
    if (this.lap < LAPS) {
      sound.deliver();
      hud.toast(`Volta ${this.lap + 1} de ${LAPS}! Você está em ${this.place}º 🏁`, 4);
      this.ctx.refresh();
      return;
    }

    this.finalPlace = this.place;
    hud.toast(
      this.finalPlace === 1 ? 'Bandeirada em primeiro lugar! 🏆' : `Chegada em ${this.finalPlace}º lugar! 🏁`,
      5
    );
    this.finish();
  }
}

export const MISSIONS = [RideMission, CargoMission, RaceMission, CupMission];
