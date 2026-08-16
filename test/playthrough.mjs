/**
 * Regressão funcional: joga as quatro missões teleportando o barco pelos alvos e
 * confere os contadores, as telas de fim de missão e a vitória.
 *
 *   npm start                 # noutro terminal, servindo em :5173
 *   npm i playwright && npm test
 */
import { chromium } from 'playwright';

// Em servidor headless a GPU não existe: sem estes flags o canvas WebGL abre
// preto e nada do jogo roda. CHROMIUM_PATH serve quando o Chromium instalado
// não é o que o Playwright baixaria.
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const erros = [];
page.on('pageerror', (e) => erros.push(`exceção: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && erros.push(`console: ${m.text().slice(0, 200)}`));

const URL = process.env.URL ?? 'http://localhost:5173/';
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.click('#start-button');
await page.waitForTimeout(500);

const tick = (n = 4) => page.waitForTimeout(n * 40);
const teleport = (x, z) =>
  page.evaluate(([px, pz]) => {
    const { boat } = window.baia;
    boat.group.position.set(px, 0, pz);
    boat.speed = 0;
  }, [x, z]);
const estado = () =>
  page.evaluate(() => {
    const g = window.baia.game;
    return {
      missao: g.missionIndex,
      done: g.mission.done,
      chips: g.mission.chips(),
      objetivo: g.mission.objective(),
      overlay: !document.getElementById('mission-done').classList.contains('hidden'),
      vitoria: !document.getElementById('victory').classList.contains('hidden'),
    };
  });

function checa(condicao, mensagem) {
  console.log(`${condicao ? '✅' : '❌'} ${mensagem}`);
  if (!condicao) process.exitCode = 1;
}

// ---------- Peças que precisam estar encostadas ----------
// A bandeira já ficou pendurada no ar duas vezes, e foto de perto não resolveu:
// dependendo da fase do balanço ela PARECE encostada. Isto mede.
const bandeira = await page.evaluate(() => {
  const { boat } = window.baia;
  const V = boat.position.constructor;
  const mastro = boat.flag.parent;
  const pano = boat.flag.children[0];
  const eixo = mastro.getWorldPosition(new V());
  // Os dois cantos verticais do pano: um deles tem de tocar o mastro.
  return [-0.525, 0.525]
    .map((x) => pano.localToWorld(new V(x, 0, 0)))
    .reduce((menor, c) => Math.min(menor, Math.hypot(c.x - eixo.x, c.z - eixo.z)), Infinity);
});
checa(bandeira < 0.15, `bandeira encostada no mastro (borda a ${bandeira.toFixed(2)} do eixo)`);

// ---------- Seletor de missões ----------
const botoes = await page.evaluate(() => document.querySelectorAll('#mission-list button').length);
checa(botoes === 4, `o seletor lista as 4 missões (listou ${botoes})`);

await page.click('#missions-button');
await page.click('#mission-list button:nth-child(3)');
await tick(6);
let s = await estado();
checa(s.missao === 2, 'o seletor pula direto para a missão 3');

await page.click('#missions-button');
await page.click('#mission-list button:nth-child(1)');
await tick(6);
s = await estado();
checa(s.missao === 0, 'o seletor volta para a missão 1');

// Repetir a carona não pode deixar dois passageiros em cada ilha.
const passageiros = await page.evaluate(() => window.baia.game.mission.characters.length);
checa(passageiros === 6, `a carona repetida tem 6 passageiros, não o dobro (tem ${passageiros})`);
const daylightAposPular = await page.evaluate(() => window.baia.game.daylight);
checa(daylightAposPular === 0, 'sair da regata pelo seletor devolve o dia');

// ---------- Missão 1: carona ----------
const paradas = await page.evaluate(() =>
  window.baia.game.islands
    .filter((i) => i.userData.passenger)
    .map((i) => ({
      nome: i.userData.name,
      x: i.userData.dockPoint.x,
      z: i.userData.dockPoint.z,
    }))
);
const casa = await page.evaluate(() => ({
  x: window.baia.game.home.userData.dockPoint.x,
  z: window.baia.game.home.userData.dockPoint.z,
}));
console.log(`passageiros esperando: ${paradas.length}`);

for (let i = 0; i < paradas.length; i++) {
  await teleport(paradas[i].x, paradas[i].z);
  await tick(6);
  if ((i + 1) % 3 === 0 || i === paradas.length - 1) {
    await teleport(casa.x, casa.z);
    await tick(6);
  }
}
s = await estado();
console.log('  missão 1:', s.chips.join(' '), s.objetivo);
checa(s.done, 'missão 1 concluída');
checa(s.overlay, 'tela de fim de missão 1 apareceu');

await page.click('#next-mission-button');
await tick(4);

// ---------- Missão 2: encomendas ----------
s = await estado();
checa(s.missao === 1, 'missão 2 começou');
const deposito = await page.evaluate(() => {
  const ilha = window.baia.game.mission.depot;
  return { nome: ilha.userData.name, x: ilha.userData.dockPoint.x, z: ilha.userData.dockPoint.z };
});
console.log(`  depósito: ${deposito.nome}`);

for (let volta = 0; volta < 6; volta += 1) {
  const soltos = await page.evaluate(() =>
    window.baia.game.mission.crates.map((c) => ({ x: c.position.x, z: c.position.z }))
  );
  if (soltos.length === 0 && (await page.evaluate(() => window.baia.game.mission.carried.length)) === 0) break;
  for (const caixote of soltos.slice(0, 3)) {
    await teleport(caixote.x, caixote.z);
    await tick(4);
  }
  await teleport(deposito.x, deposito.z);
  await tick(6);
  if ((await estado()).done) break;
}
s = await estado();
console.log('  missão 2:', s.chips.join(' '), s.objetivo);
checa(s.done, 'missão 2 concluída');
checa(s.overlay, 'tela de fim de missão 2 apareceu');

await page.click('#next-mission-button');
await tick(4);

// ---------- Missão 3: regata ----------
s = await estado();
checa(s.missao === 2, 'missão 3 começou');
const portoes = await page.evaluate(() =>
  window.baia.game.mission.gates.map((g) => ({
    x: g.position.x,
    z: g.position.z,
    heading: g.userData.heading,
  }))
);
for (const portao of portoes) {
  const fx = Math.sin(portao.heading);
  const fz = Math.cos(portao.heading);
  await teleport(portao.x - fx * 12, portao.z - fz * 12);
  await tick(3);
  await teleport(portao.x + fx * 4, portao.z + fz * 4);
  await tick(3);
}
s = await estado();
console.log('  missão 3:', s.chips.join(' '), s.objetivo);
checa(s.done, 'missão 3 concluída');
checa(s.overlay, 'tela de fim de missão 3 apareceu');
const luz = await page.evaluate(() => window.baia.game.daylight);
checa(luz > 0, `o sol se pôs durante a regata (daylight = ${luz.toFixed(2)})`);

// ---------- Missão 4: corrida ----------
await page.click('#next-mission-button');
await tick(6);
s = await estado();
checa(s.missao === 3, 'missão 4 começou');

const circuito = await page.evaluate(() =>
  window.baia.game.mission.marks.map((m) => ({ x: m.position.x, z: m.position.z }))
);
const rivaisAntes = await page.evaluate(() =>
  window.baia.game.mission.rivals.map((r) => ({ nome: r.name, x: r.group.position.x, z: r.group.position.z }))
);
console.log(`  circuito: ${circuito.length} boias, ${rivaisAntes.length} adversários`);

// Antes de o jogador sair, deixa os adversários correrem sozinhos: é a única
// janela do teste em que a navegação deles roda em tempo de jogo de verdade.
const tempo0 = await page.evaluate(() => window.baia.elapsed);
await page.waitForTimeout(4000);
const decorrido = (await page.evaluate(() => window.baia.elapsed)) - tempo0;
const avanco = await page.evaluate(
  (antes) =>
    window.baia.game.mission.rivals.map((r, i) => ({
      nome: r.name,
      andou: Math.hypot(r.group.position.x - antes[i].x, r.group.position.z - antes[i].z),
      marca: r.waypoint,
    })),
  rivaisAntes
);
// Velocidade média em tempo de jogo: o mais lento do trio anda 7 nominais, e as
// curvas tiram um pedaço — abaixo de 4 é adversário parado ou andando de lado.
const velocidades = avanco.map((a) => a.andou / decorrido);
checa(
  velocidades.every((v) => v > 4),
  `os três adversários navegaram sozinhos (${avanco
    .map((a, i) => `${a.nome} ${velocidades[i].toFixed(1)} u/s`)
    .join(', ')} em ${decorrido.toFixed(1)}s de jogo)`
);

// E navegaram pela água: nenhum deles pode ter entrado numa ilha.
const encalhe = await page.evaluate(() => {
  const { rivals } = window.baia.game.mission;
  let pior = Infinity;
  for (const r of rivals) {
    for (const ilha of window.baia.game.islands) {
      const folga =
        Math.hypot(r.group.position.x - ilha.position.x, r.group.position.z - ilha.position.z) -
        ilha.userData.beachRadius;
      pior = Math.min(pior, folga);
    }
  }
  return pior;
});
checa(encalhe > 0, `nenhum adversário encalhou (folga mínima ${encalhe.toFixed(1)})`);

// Duas voltas contornando cada boia.
for (let volta = 0; volta < 2; volta += 1) {
  for (const boia of circuito) {
    await teleport(boia.x, boia.z);
    await tick(3);
  }
}
s = await estado();
console.log('  missão 4:', s.chips.join(' '), s.objetivo);
checa(s.done, 'missão 4 concluída');
checa(s.vitoria, 'tela de vitória apareceu no fim da corrida');

const corrida = await page.evaluate(() => {
  const m = window.baia.game.mission;
  return { lugar: m.finalPlace, voltas: m.lap, rivais: m.rivals.map((r) => ({ nome: r.name, volta: r.lap, marca: r.waypoint })) };
});
checa(corrida.lugar === 1, `chegada em 1º lugar (foi ${corrida.lugar}º)`);
checa(corrida.voltas === 2, `duas voltas completadas (foram ${corrida.voltas})`);

const marcasFeitas = corrida.rivais.map((r) => `${r.nome}: volta ${r.volta}, marca ${r.marca}`).join(' | ');
console.log(`  adversários: ${marcasFeitas}`);

// Recomeçar volta tudo ao dia e à missão 1.
await page.click('#restart-button');
await tick(6);
s = await estado();
checa(s.missao === 0, 'recomeçar volta para a missão 1');
const luzDepois = await page.evaluate(() => window.baia.game.daylight);
checa(luzDepois === 0, 'recomeçar traz o dia de volta');

checa(erros.length === 0, `sem erros de console${erros.length ? ': ' + erros.join(' | ') : ''}`);
await browser.close();
