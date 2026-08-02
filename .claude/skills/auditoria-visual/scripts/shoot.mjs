#!/usr/bin/env node
/**
 * Tira uma foto por elemento, a partir de um arquivo de configuração.
 *
 *   node shoot.mjs config.json --label antes --out ./fotos
 *
 * A ideia é que "antes" e "depois" usem o mesmo config, mudando só o rótulo:
 * enquadramento idêntico é o que torna a comparação honesta.
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

import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = await carregarPlaywright();

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

const configPath = process.argv[2];
if (!configPath || configPath.startsWith('--')) {
  console.error('uso: node shoot.mjs <config.json> [--label antes] [--out ./fotos]');
  process.exit(1);
}

const config = JSON.parse(await readFile(configPath, 'utf8'));
const label = arg('label', 'foto');
const outDir = resolve(arg('out', './fotos'));
await mkdir(outDir, { recursive: true });

// Em servidor headless a GPU não existe: sem estes flags, qualquer canvas WebGL
// (three.js, babylon, pixi com webgl) abre em preto e a auditoria não vê nada.
const launchOptions = {
  args: [
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
};
const chromiumPath = arg('chromium', process.env.CHROMIUM_PATH);
if (chromiumPath) launchOptions.executablePath = chromiumPath;

const browser = await chromium.launch(launchOptions);

function contextOptions(shot = {}) {
  const nomeDispositivo = shot.device ?? config.device;
  const base = nomeDispositivo ? { ...devices[nomeDispositivo] } : {};
  const viewport = shot.viewport ?? config.viewport;
  if (viewport) base.viewport = viewport;
  return base;
}

const erros = [];

// Para cenas three.js: injeta o ajudante antes dos scripts do projeto, o que
// permite enquadrar objetos sem alterar o código auditado.
const ajudante3d = config.three
  ? await readFile(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'auditoria-3d.js'),
      'utf8'
    )
  : null;

async function novaPagina(shot) {
  const context = await browser.newContext(contextOptions(shot));
  if (ajudante3d) await context.addInitScript(ajudante3d);
  const page = await context.newPage();
  page.on('pageerror', (e) => erros.push(`exceção: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(`console: ${m.text().slice(0, 300)}`);
  });
  await page.goto(config.url, { waitUntil: 'networkidle', timeout: 60000 });
  // Shader compila, textura carrega, animação assenta: a primeira foto sempre mente.
  await page.waitForTimeout(config.settle ?? 2500);
  for (const passo of config.prepare ?? []) {
    await aplicar(page, passo);
  }
  return { context, page };
}

async function aplicar(page, passo) {
  if (passo.click) await page.click(passo.click, { timeout: 10000 }).catch(() => {});
  if (passo.tap) await page.tap(passo.tap, { timeout: 10000 }).catch(() => {});
  if (passo.press) await page.keyboard.press(passo.press);
  if (passo.hide) {
    await page.evaluate((seletores) => {
      for (const s of seletores) {
        for (const el of document.querySelectorAll(s)) el.style.display = 'none';
      }
    }, passo.hide);
  }
  if (passo.eval) await page.evaluate(passo.eval);
  if (passo.wait) await page.waitForTimeout(passo.wait);
}

// Fotos que só mudam a câmera podem reaproveitar a mesma página; as que mudam o
// tamanho da tela precisam de contexto novo, porque viewport é do contexto.
let atual = null;
let assinaturaAtual = null;

for (const shot of config.shots ?? []) {
  const assinatura = JSON.stringify(contextOptions(shot));
  if (assinatura !== assinaturaAtual) {
    if (atual) await atual.context.close();
    atual = await novaPagina(shot);
    assinaturaAtual = assinatura;
  }
  const { page } = atual;

  if (shot.frame) {
    const resultado = await page.evaluate(
      ({ alvo, opcoes }) => window.__auditoria?.enquadrar(alvo, opcoes) ?? { erro: 'ajudante 3D ausente (falta "three": true no config?)' },
      { alvo: shot.frame.objeto, opcoes: shot.frame }
    );
    if (resultado?.erro) erros.push(`frame de "${shot.name}": ${resultado.erro}`);
    else console.log(`   ↳ ${resultado.nome} (raio ${resultado.raio}, dist ${resultado.distancia})`);
  }

  if (shot.eval) {
    try {
      await page.evaluate(shot.eval);
    } catch (e) {
      erros.push(`eval de "${shot.name}": ${e.message}`);
    }
  }
  await page.waitForTimeout(shot.wait ?? 600);

  const arquivo = `${outDir}/${shot.name}-${label}.png`;
  if (shot.selector) {
    const alvo = page.locator(shot.selector).first();
    await alvo.screenshot({ path: arquivo }).catch(async (e) => {
      erros.push(`seletor "${shot.selector}": ${e.message}`);
      await page.screenshot({ path: arquivo });
    });
  } else {
    await page.screenshot({ path: arquivo });
  }
  console.log(`📷 ${arquivo}`);
}

if (atual) await atual.context.close();
await browser.close();

if (erros.length) {
  console.log('\n⚠️  erros na página (costumam explicar o que está estranho na foto):');
  for (const e of [...new Set(erros)].slice(0, 10)) console.log(`   - ${e}`);
} else {
  console.log('\n✅ nenhum erro de console');
}
