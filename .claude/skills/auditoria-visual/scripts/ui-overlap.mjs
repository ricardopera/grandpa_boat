#!/usr/bin/env node
/**
 * Diz quais elementos de interface se cobrem, em cada tamanho de tela.
 *
 *   node ui-overlap.mjs http://localhost:5173 "#hud,#buttons,#minimap" \
 *     --viewport 900x414 --viewport 412x915 --click "#start-button"
 *
 * Sobreposição é o defeito de interface que mais escapa: numa resolução só, no
 * monitor de quem programou, está tudo certo — e no celular deitado o mapa cobre
 * o botão.
 */
import { createRequire } from 'node:module';

/** Playwright pode estar instalado no projeto, não junto da skill. */
async function carregarPlaywright() {
  try {
    return await import('playwright');
  } catch {
    try {
      return createRequire(`${process.cwd()}/`)('playwright');
    } catch {
      console.error('Playwright não encontrado. No projeto, rode:  npm i -D playwright');
      process.exit(1);
    }
  }
}

const { chromium } = await carregarPlaywright();

const url = process.argv[2];
const seletores = (process.argv[3] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!url || !seletores.length) {
  console.error('uso: node ui-overlap.mjs <url> "<sel1,sel2,...>" [--viewport 900x414] [--click "#sel"]');
  process.exit(1);
}

const viewports = [];
process.argv.forEach((a, i) => {
  if (a === '--viewport') {
    const [w, h] = (process.argv[i + 1] ?? '').split('x').map(Number);
    if (w && h) viewports.push({ width: w, height: h });
  }
});
if (!viewports.length) viewports.push({ width: 1280, height: 720 });

const cliques = [];
process.argv.forEach((a, i) => {
  if (a === '--click' && process.argv[i + 1]) cliques.push(process.argv[i + 1]);
});

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});

let problemas = 0;

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, hasTouch: true });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  for (const seletor of cliques) {
    await page.click(seletor, { timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(600);

  const pares = await page.evaluate((lista) => {
    // offsetParent não serve aqui: elemento `position: fixed` — que é o caso de
    // quase todo HUD — sempre reporta offsetParent nulo, mesmo bem visível.
    const visivel = (el) => {
      const estilo = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        estilo.display !== 'none' &&
        estilo.visibility !== 'hidden' &&
        Number(estilo.opacity) !== 0 &&
        r.width > 0 &&
        r.height > 0
      );
    };

    const caixas = lista
      .map((s) => [s, document.querySelector(s)])
      .filter(([, el]) => el && visivel(el))
      .map(([s, el]) => [s, el.getBoundingClientRect()]);

    const hits = [];
    for (let i = 0; i < caixas.length; i++) {
      for (let j = i + 1; j < caixas.length; j++) {
        const [na, a] = caixas[i];
        const [nb, b] = caixas[j];
        const largura = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const altura = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (largura > 0 && altura > 0) {
          hits.push({ par: `${na} × ${nb}`, area: Math.round(largura * altura) });
        }
      }
    }
    // Fora da tela também é defeito: elemento que não dá para tocar.
    const fora = caixas
      .filter(([, r]) => r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1)
      .map(([s]) => s);
    return { hits, fora, visiveis: caixas.map(([s]) => s) };
  }, seletores);

  const nome = `${viewport.width}x${viewport.height}`;
  console.log(`\n▸ ${nome}  (visíveis: ${pares.visiveis.join(', ') || 'nenhum'})`);
  if (pares.hits.length) {
    problemas += pares.hits.length;
    for (const h of pares.hits) console.log(`   ✗ sobrepõe: ${h.par} (${h.area}px²)`);
  } else {
    console.log('   ✓ nenhuma sobreposição');
  }
  if (pares.fora.length) {
    problemas += pares.fora.length;
    console.log(`   ✗ fora da tela: ${pares.fora.join(', ')}`);
  }

  await context.close();
}

await browser.close();
process.exit(problemas ? 1 : 0);
