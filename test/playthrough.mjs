/**
 * Regressão funcional: joga as três missões teleportando o barco pelos alvos e
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
let s = await estado();
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
checa(s.vitoria, 'tela de vitória apareceu');
const luz = await page.evaluate(() => window.baia.game.daylight);
checa(luz > 0, `o sol se pôs durante a regata (daylight = ${luz.toFixed(2)})`);

// Recomeçar volta tudo ao dia e à missão 1.
await page.click('#restart-button');
await tick(6);
s = await estado();
checa(s.missao === 0, 'recomeçar volta para a missão 1');
const luzDepois = await page.evaluate(() => window.baia.game.daylight);
checa(luzDepois === 0, 'recomeçar traz o dia de volta');

checa(erros.length === 0, `sem erros de console${erros.length ? ': ' + erros.join(' | ') : ''}`);
await browser.close();
