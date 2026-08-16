import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { flat, flatUnique, mesh, extrude } from './materials.js';
import { createCharacter } from './character.js';
import { waveHeight } from './world.js';

const WORLD = new THREE.Vector3();

/**
 * Casco simples no mesmo espírito do barco do Vovô: um contorno com popa
 * arredondada e proa apontada, extrudado para baixo, com uma borda saliente por
 * cima. Meia esfera vira tigela e não lê como barco — este contorno lê.
 */
function simpleHull(halfWidth, halfLength, depth, color, rimColor) {
  const grupo = new THREE.Group();
  const w = halfWidth;
  const l = halfLength;

  const contorno = (escala = 1) => {
    const forma = new THREE.Shape();
    const cw = w * escala;
    const cl = l * escala;
    forma.moveTo(-cw, -cl + cw * 0.5);
    forma.quadraticCurveTo(-cw, -cl, -cw * 0.55, -cl);
    forma.lineTo(cw * 0.55, -cl);
    forma.quadraticCurveTo(cw, -cl, cw, -cl + cw * 0.5);
    forma.lineTo(cw, cl - cw * 1.4);
    forma.quadraticCurveTo(cw, cl, 0, cl);
    forma.quadraticCurveTo(-cw, cl, -cw, cl - cw * 1.4);
    forma.closePath();
    return forma;
  };

  const corpo = mesh(extrude(contorno(), depth), flat(color), 0, 0, 0);
  corpo.rotation.x = Math.PI / 2;
  grupo.add(corpo);

  const aro = new THREE.Shape(contorno(1.06).getPoints(32));
  aro.holes.push(new THREE.Path(contorno(0.86).getPoints(32)));
  const borda = mesh(extrude(aro, 0.16), flat(rimColor), 0, 0.16, 0);
  borda.rotation.x = Math.PI / 2;
  grupo.add(borda);

  return grupo;
}

/**
 * Pedalinho: casco raso, duas rodas de pás que giram enquanto ele anda e um
 * guarda-sol listrado. É o mais lento da corrida, mas o mais constante.
 */
function createPedalBoat() {
  const barco = new THREE.Group();
  barco.name = 'pedalinho';

  const casco = simpleHull(1.25, 2.0, 0.85, PALETTE.flowerYellow, PALETTE.hullStripe);
  casco.position.y = 0.5;
  barco.add(casco);

  // Assento com encosto, virado para a proa.
  barco.add(mesh(new THREE.BoxGeometry(1.1, 0.14, 0.7), flat(PALETTE.hullTrim), 0, 0.62, -0.3));
  barco.add(mesh(new THREE.BoxGeometry(1.1, 0.6, 0.14), flat(PALETTE.hullTrim), 0, 0.9, -0.62));

  // Rodas de pás, uma de cada lado da popa.
  const pas = [];
  for (const sx of [-1, 1]) {
    const roda = new THREE.Group();
    roda.position.set(sx * 1.5, 0.42, -0.95);
    const cubo = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.09, 14), flat(PALETTE.hullTrim));
    cubo.rotation.z = Math.PI / 2;
    roda.add(cubo);
    for (let i = 0; i < 6; i++) {
      const angulo = (i / 6) * Math.PI * 2;
      const pa = mesh(new THREE.BoxGeometry(0.14, 0.42, 0.3), flat(PALETTE.hullMain));
      pa.position.set(0, Math.sin(angulo) * 0.44, Math.cos(angulo) * 0.44);
      pa.rotation.x = -angulo;
      roda.add(pa);
    }
    barco.add(roda);
    pas.push(roda);
  }

  // Guarda-sol listrado, alto o bastante para não virar chapéu do piloto.
  barco.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), flat(PALETTE.metal), 0, 1.9, -0.3));
  for (let i = 0; i < 8; i++) {
    barco.add(
      mesh(
        new THREE.ConeGeometry(0.95, 0.4, 3, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4),
        flat(i % 2 ? PALETTE.hullTrim : PALETTE.hullStripe, { side: THREE.DoubleSide }),
        0,
        3.1,
        -0.3
      )
    );
  }

  const piloto = createCharacter({
    species: 'lontra',
    clothes: 0x2f9b9b,
    shoes: 0x217a7a,
    scale: 0.8,
    name: 'Dona Zilda',
  });
  piloto.position.set(0, 0.66, -0.3);
  barco.add(piloto);

  barco.userData.pas = pas;
  return barco;
}

/**
 * Veleiro: casco fino, vela grande de pano presa ao mastro e à retranca, e uma
 * bandeirola no topo. É o mais rápido nas retas.
 */
function createSailBoat() {
  const barco = new THREE.Group();
  barco.name = 'veleiro';

  const casco = simpleHull(0.95, 2.5, 0.9, PALETTE.hullStripe, 0x2f6f8f);
  casco.position.y = 0.55;
  barco.add(casco);
  barco.add(mesh(new THREE.BoxGeometry(1.4, 0.1, 3.4), flat(PALETTE.woodDeck), 0, 0.6, 0));

  // Mastro, vela e retranca. A vela é um triângulo com o lado reto no mastro.
  barco.add(mesh(new THREE.CylinderGeometry(0.06, 0.075, 4.2, 8), flat(0xf7f9fc), 0, 2.7, 0.1));
  const perfil = new THREE.Shape();
  perfil.moveTo(0, 0);
  perfil.lineTo(0, 3.7);
  perfil.quadraticCurveTo(-1.0, 1.7, -2.0, -0.05);
  perfil.closePath();
  const vela = new THREE.Mesh(
    new THREE.ShapeGeometry(perfil, 12),
    flatUnique(0xfff6e2, { side: THREE.DoubleSide })
  );
  vela.position.set(0, 0.75, 0.1);
  vela.rotation.y = -Math.PI / 2;
  barco.add(vela);
  const retranca = mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.0, 6), flat(PALETTE.woodDark), 0, 0.78, -0.9);
  retranca.rotation.x = Math.PI / 2;
  barco.add(retranca);
  const galhardete = mesh(
    new THREE.PlaneGeometry(0.5, 0.24),
    flatUnique(PALETTE.hullTrim, { side: THREE.DoubleSide }),
    0,
    4.7,
    -0.15
  );
  galhardete.rotation.y = Math.PI / 2;
  barco.add(galhardete);

  const piloto = createCharacter({
    species: 'tatu',
    clothes: 0xe2603f,
    shoes: 0xc44b33,
    hat: 'bandana',
    scale: 0.85,
    name: 'Bruno',
  });
  piloto.position.set(0, 0.65, -1.5);
  barco.add(piloto);

  barco.userData.vela = vela;
  return barco;
}

/**
 * Submarino de estaleiro: um charuto rebitado com torre, periscópio e hélice.
 * Ele mergulha e volta à tona no meio da corrida — é a graça dele.
 */
function createSubmarine() {
  const submarino = new THREE.Group();
  submarino.name = 'submarino';

  const corpo = mesh(new THREE.CapsuleGeometry(1.0, 2.6, 6, 14), flat(0xe2733f), 0, 0.55, 0);
  corpo.rotation.x = Math.PI / 2;
  submarino.add(corpo);

  // Rebites: anéis mais escuros ao longo do casco.
  for (const z of [-1.1, 0, 1.1]) {
    const anel = mesh(new THREE.TorusGeometry(1.01, 0.07, 6, 18), flat(0xb4552a), 0, 0.55, z);
    submarino.add(anel);
  }
  for (const sx of [-1, 1]) {
    for (const z of [-0.55, 0.55]) {
      const vigia = mesh(new THREE.CircleGeometry(0.22, 12), flat(PALETTE.porthole), sx * 0.99, 0.6, z);
      vigia.rotation.y = (sx * Math.PI) / 2;
      submarino.add(vigia);
    }
  }

  // Torre com escotilha e periscópio.
  submarino.add(mesh(new THREE.BoxGeometry(0.92, 1.0, 1.25), flat(0xb4552a), 0, 1.3, -0.2));
  submarino.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), flat(PALETTE.metal), 0, 2.2, -0.45));
  const olho = mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), flat(PALETTE.metal), 0, 2.6, -0.32);
  submarino.add(olho);

  // Lemes de profundidade e hélice.
  for (const sx of [-1, 1]) {
    submarino.add(mesh(new THREE.BoxGeometry(0.9, 0.09, 0.5), flat(0xb4552a), sx * 1.1, 0.55, -1.6));
  }
  submarino.add(mesh(new THREE.BoxGeometry(0.1, 1.1, 0.5), flat(0xb4552a), 0, 1.0, -1.75));
  const helice = new THREE.Group();
  helice.position.set(0, 0.55, -2.05);
  for (let i = 0; i < 3; i++) {
    const pa = mesh(new THREE.BoxGeometry(0.12, 0.6, 0.1), flat(PALETTE.metal));
    pa.rotation.z = (i / 3) * Math.PI * 2;
    pa.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.3, Math.cos((i / 3) * Math.PI * 2) * 0.3, 0);
    helice.add(pa);
  }
  submarino.add(helice);

  // Escotilha fechada: quem pilota o Sardinha vai por dentro. Tentar pôr um
  // personagem na torre só o deixava montado no casco, com o corpo de fora.
  submarino.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), flat(PALETTE.metal), 0, 1.83, -0.2));

  // Bolhas do mergulho, recicladas a cada vez.
  const bolhas = [];
  for (let i = 0; i < 8; i++) {
    const bolha = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      flatUnique(0xdff4ff, { transparent: true, opacity: 0 })
    );
    bolha.visible = false;
    submarino.add(bolha);
    bolhas.push({ mesh: bolha, vida: 0 });
  }

  submarino.userData = { helice, bolhas };
  return submarino;
}

// Os três adversários da corrida, na ordem em que largam.
const FLEET = [
  { id: 'veleiro', build: createSailBoat, name: 'Vento Sul', speed: 8.4, turn: 1.5, flair: 0.8 },
  { id: 'submarino', build: createSubmarine, name: 'Sardinha', speed: 7.8, turn: 1.9, flair: 1.0 },
  { id: 'pedalinho', build: createPedalBoat, name: 'Pé-de-Pato', speed: 7.0, turn: 2.2, flair: 0.6 },
];

/**
 * Um adversário de corrida: seguidor de boias com um pouco de personalidade.
 * Ele mira sempre a próxima marca, vira com limite de raio e oscila a
 * velocidade, para as posições trocarem durante a prova em vez de a corrida
 * virar um desfile em fila indiana.
 */
export class Rival {
  constructor(config, waypoints, index, largada) {
    this.config = config;
    this.name = config.name;
    this.waypoints = waypoints;
    this.group = config.build();
    this.group.userData.rival = this;

    // Largada lado a lado, cada um numa raia, todos apontando para a 1ª marca.
    const raia = (index - 1) * 11;
    this.group.position.set(
      largada.x + Math.cos(largada.heading) * raia,
      0,
      largada.z - Math.sin(largada.heading) * raia
    );
    this.heading = largada.heading;
    this.speed = 0;
    this.waypoint = 0;
    this.lap = 0;
    this.phase = index * 2.1;
    this.dive = 0;
    this.finished = false;
  }

  /** Quanto do percurso já foi cumprido — é isto que ordena o pelotão. */
  progress(totalLaps) {
    const alvo = this.waypoints[this.waypoint];
    const distancia = Math.hypot(alvo.x - this.group.position.x, alvo.z - this.group.position.z);
    const feito = this.lap * this.waypoints.length + this.waypoint;
    return Math.min(feito + 1 / (1 + distancia / 40), totalLaps * this.waypoints.length + 1);
  }

  update(dt, time, totalLaps, islands) {
    const pos = this.group.position;
    const alvo = this.waypoints[this.waypoint];

    // Mira na marca; se uma ilha estiver no caminho, contorna por fora.
    let mira = Math.atan2(alvo.x - pos.x, alvo.z - pos.z);
    for (const island of islands) {
      const dx = island.position.x - pos.x;
      const dz = island.position.z - pos.z;
      const distancia = Math.hypot(dx, dz);
      const raio = island.userData.beachRadius + 6;
      if (distancia > 42 || distancia < 0.001) continue;
      const paraIlha = Math.atan2(dx, dz);
      let desvio = ((mira - paraIlha + Math.PI) % (Math.PI * 2)) - Math.PI;
      const abertura = Math.asin(Math.min(1, raio / Math.max(raio, distancia)));
      if (Math.abs(desvio) < abertura) {
        mira = paraIlha + Math.sign(desvio || 1) * abertura;
      }
    }

    let delta = ((mira - this.heading + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const giro = THREE.MathUtils.clamp(delta, -this.config.turn * dt, this.config.turn * dt);
    this.heading += giro;

    // Velocidade: base + respiração, e um freio nas curvas fechadas.
    const alvoVel =
      this.config.speed * (1 + Math.sin(time * 0.6 + this.phase) * 0.07) * (1 - Math.min(0.35, Math.abs(delta) * 0.3));
    this.speed += (alvoVel - this.speed) * Math.min(1, dt * 1.5);
    if (!this.finished) {
      pos.x += Math.sin(this.heading) * this.speed * dt;
      pos.z += Math.cos(this.heading) * this.speed * dt;
    }

    // Marca cumprida?
    const distancia = Math.hypot(alvo.x - pos.x, alvo.z - pos.z);
    if (distancia < 15) {
      this.waypoint += 1;
      if (this.waypoint >= this.waypoints.length) {
        this.waypoint = 0;
        this.lap += 1;
        if (this.lap >= totalLaps) this.finished = true;
      }
    }

    // Flutuação e enfeites de cada casco.
    const onda = waveHeight(pos.x, pos.z, time);
    this.group.rotation.y = this.heading;
    this.group.rotation.z = -giro * 6 + Math.sin(time * 1.2 + this.phase) * 0.03;
    this.group.rotation.x = Math.sin(time * 1.6 + this.phase) * 0.03;

    const data = this.group.userData;
    if (data.pas) {
      for (const roda of data.pas) roda.rotation.x -= this.speed * dt * 1.6;
    }
    if (data.vela) {
      data.vela.rotation.y = -Math.PI / 2 + Math.sin(time * 1.4 + this.phase) * 0.12;
    }
    if (data.helice) {
      data.helice.rotation.z += this.speed * dt * 2.4;
      this.updateDive(dt, time, onda);
      return;
    }

    pos.y = onda * 0.85;
  }

  /** O submarino mergulha de tempos em tempos e volta soltando bolhas. */
  updateDive(dt, time, onda) {
    const ciclo = (time * 0.09 + this.phase) % 1;
    const querMergulhar = ciclo > 0.55 && ciclo < 0.85;
    this.dive += ((querMergulhar ? 1 : 0) - this.dive) * Math.min(1, dt * 0.9);
    this.group.position.y = onda * 0.85 - this.dive * 3.2;

    const { bolhas } = this.group.userData;

    for (const bolha of bolhas) {
      if (bolha.vida > 0) {
        bolha.vida -= dt * 0.8;
        bolha.mesh.position.y += dt * 1.6;
        bolha.mesh.material.opacity = Math.max(0, bolha.vida) * 0.6;
        bolha.mesh.visible = bolha.vida > 0;
      } else if (this.dive > 0.15 && Math.random() < dt * 3) {
        bolha.vida = 1;
        bolha.mesh.position.set((Math.random() - 0.5) * 1.2, 1.2, (Math.random() - 0.5) * 2);
        bolha.mesh.scale.setScalar(0.5 + Math.random() * 0.7);
        bolha.mesh.visible = true;
      }
    }
  }

  /** Empurrão suave quando o jogador encosta: ninguém atravessa ninguém. */
  pushAway(boat) {
    const dx = this.group.position.x - boat.position.x;
    const dz = this.group.position.z - boat.position.z;
    const distancia = Math.hypot(dx, dz);
    const minimo = 4.4;
    if (distancia > minimo || distancia < 0.001) return false;
    const empurrao = (minimo - distancia) / distancia;
    this.group.position.x += dx * empurrao * 0.6;
    this.group.position.z += dz * empurrao * 0.6;
    boat.position.x -= dx * empurrao * 0.4;
    boat.position.z -= dz * empurrao * 0.4;
    boat.speed *= 0.82;
    return true;
  }

  worldPosition() {
    return this.group.getWorldPosition(WORLD);
  }
}

/** Dois adversários lado a lado não podem ocupar o mesmo pedaço de mar. */
export function keepApart(a, b, minimo = 5.2) {
  const dx = b.group.position.x - a.group.position.x;
  const dz = b.group.position.z - a.group.position.z;
  const distancia = Math.hypot(dx, dz);
  if (distancia > minimo || distancia < 0.001) return;
  const empurrao = ((minimo - distancia) / distancia) * 0.5;
  a.group.position.x -= dx * empurrao;
  a.group.position.z -= dz * empurrao;
  b.group.position.x += dx * empurrao;
  b.group.position.z += dz * empurrao;
}

export { FLEET };
